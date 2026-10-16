import { readFile, open, rename, unlink, mkdir, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateNewsletter, parseSections, vietnamDate, TIMEZONE } from '../dist/lib.mjs';
import { validateArchiveIndex, validDate, addDays } from '../dist/history.mjs';
import { validateEconomicCalendar, assertCalendarUpdate } from '../dist/economic-calendar.mjs';

const data = fileURLToPath(new URL('../dist/data/', import.meta.url));
const archive = path.join(data, 'archive');
const latest = path.join(data, 'latest.json');
const calendarFile = path.join(data, 'economic-calendar.json');
const calendarOnly = process.argv.length === 3 && process.argv[2] === '--calendar';
const reassignFrom = process.argv.length === 4 && process.argv[2] === '--reassign-date' ? process.argv[3] : null;
const runtime = fileURLToPath(new URL('../.sites-runtime/', import.meta.url));
const lockPath = path.join(runtime, 'newsletter-writer.lock');
const MAX_BYTES = 600_000;
const CONTENT_KEYS = ['markdown', 'title', 'reportDate', 'coverageStart',
  'coverageEnd', 'sourceThreadId', 'cutoffAt', 'timezone'];

async function readInput() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error('Newsletter input is too large.');
    chunks.push(chunk);
  }
  let value;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    value = JSON.parse(text);
  } catch {
    throw new Error('Input must be valid UTF-8 JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Refusing an empty or invalid report.');
  }
  return calendarOnly ? validateEconomicCalendar(value) : validateNewsletter({ ...value, exportedAt: new Date().toISOString() });
}

async function acquireLock() {
  await mkdir(runtime, { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try { return await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) {
        throw new Error('Writer lock is busy. Inspect the active writer before retrying.');
      }
      await delay(50);
    }
  }
}

async function readJSON(file) {
  let text;
  try { text = await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try { return JSON.parse(text); }
  catch { throw new Error('Invalid JSON in ' + path.basename(file) + '.'); }
}

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const ENRICHMENT_KEYS = ['market_snapshot', 'academic_feed', 'source_status', 'feed_cache', 'economic_calendar'];
const sameContent = (a, b) => CONTENT_KEYS.every(key => a[key] === b[key])
  && a.meta?.version === b.meta?.version && a.meta?.timezone === b.meta?.timezone
  && ENRICHMENT_KEYS.every(key => JSON.stringify(canonical(a[key])) === JSON.stringify(canonical(b[key])));

async function readArchive(threadId) {
  let files;
  try { files = await readdir(archive); }
  catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  files = files.filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const records = new Map();
  for (let offset = 0; offset < files.length; offset += 4) {
    const batch = files.slice(offset, offset + 4);
    const values = await Promise.all(batch.map(async file => {
      const record = validateNewsletter(await readJSON(path.join(archive, file)));
      if (!record || record.reportDate + '.json' !== file || record.sourceThreadId !== threadId) {
        throw new Error('Archive contains a mismatched date or pipeline. Preserve it.');
      }
      return record;
    }));
    for (const record of values) records.set(record.reportDate, record);
  }
  return records;
}

function serialize(value, limit = MAX_BYTES) {
  const body = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (body.length > limit) throw new Error('Serialized data exceeds the web size limit.');
  return body;
}

async function atomicWrite(file, body) {
  try { if ((await readFile(file)).equals(body)) return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  let created = false;
  try {
    handle = await open(temporary, 'wx', 0o644);
    created = true;
    await handle.writeFile(body);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, file);
  } finally {
    if (handle) await handle.close();
    if (created) await unlink(temporary).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function publish(report) {
  const current = validateNewsletter(await readJSON(latest));
  if (current && current.sourceThreadId !== report.sourceThreadId) {
    throw new Error('Refusing a report from a different pipeline thread.');
  }
  const records = await readArchive(report.sourceThreadId);
  for (const existing of [current, ...records.values()]) {
    if (existing && Date.parse(existing.cutoffAt) > Date.parse(report.cutoffAt)) {
      throw new Error('Refusing to overwrite a newer stored newsletter.');
    }
  }
  const unchanged = Boolean(current && current.cutoffAt === report.cutoffAt);
  if (unchanged && !sameContent(current, report)) {
    throw new Error('Same cutoff has different content. Preserve it and resolve the conflict.');
  }
  const pending = new Map();
  function plan(record, currentSnapshot = false) {
    if (!record) return;
    const existing = records.get(record.reportDate);
    if (existing?.cutoffAt === record.cutoffAt) {
      if (!sameContent(existing, record)) throw new Error('Archived report conflicts at the same cutoff.');
      return;
    }
    if (existing && Date.parse(existing.cutoffAt) > Date.parse(record.cutoffAt)) {
      if (currentSnapshot) return;
      throw new Error('Refusing to replace a newer archived report.');
    }
    records.set(record.reportDate, record);
    pending.set(record.reportDate, record);
  }
  plan(current, true);
  plan(unchanged ? current : report);
  const index = validateArchiveIndex({ version: 1, timezone: TIMEZONE,
    reports: [...records.values()].map(({ reportDate, cutoffAt, title }) => ({ reportDate, cutoffAt, title })) });
  // Validate every serialized payload before changing any published file.
  const writes = [...pending].map(([date, record]) => [path.join(archive, date + '.json'), serialize(record)]);
  if (report.economic_calendar) {
    const previous = validateEconomicCalendar(await readJSON(calendarFile));
    // A separately verified calendar can be newer than the newsletter snapshot.
    if (!previous || Date.parse(previous.checkedAt) <= Date.parse(report.economic_calendar.checkedAt)) {
      assertCalendarUpdate(previous, report.economic_calendar);
      writes.push([calendarFile, serialize(report.economic_calendar)]);
    } else if (previous.sourceThreadId !== report.sourceThreadId) throw new Error('Calendar belongs to a different pipeline.');
  }
  writes.push([path.join(archive, 'index.json'), serialize(index, 8_000_000)]);
  if (!unchanged) writes.push([latest, serialize(report)]);
  await mkdir(archive, { recursive: true });
  // Each file is atomic; publish the archive before its index and latest.
  for (const [file, body] of writes) await atomicWrite(file, body);
  return { unchanged, written: !unchanged, cutoffAt: (unchanged ? current : report).cutoffAt,
    archivedDays: records.size };
}

async function publishCalendar(snapshot) {
  const currentReport = validateNewsletter(await readJSON(latest));
  if (!currentReport || snapshot.sourceThreadId !== currentReport.sourceThreadId) throw new Error('Calendar belongs to a different pipeline.');
  const previous = validateEconomicCalendar(await readJSON(calendarFile));
  assertCalendarUpdate(previous, snapshot);
  await atomicWrite(calendarFile, serialize(snapshot));
  return { calendar: 'published', checkedAt: snapshot.checkedAt, events: snapshot.events.length };
}

async function reassignDate(report, fromDate) {
  if (report.reportDate !== addDays(fromDate, -1) || vietnamDate(new Date(report.cutoffAt)) !== fromDate) throw new Error('Only a late next-day edition can be reassigned to the day summarized.');
  const current = validateNewsletter(await readJSON(latest));
  if (!current || current.sourceThreadId !== report.sourceThreadId) throw new Error('Date correction belongs to a different pipeline.');
  const records = await readArchive(report.sourceThreadId);
  const source = records.get(fromDate), target = records.get(report.reportDate);
  if (!source && target && sameContent(target, report) && sameContent(current, target)) return { unchanged: true, reportDate: target.reportDate, cutoffAt: target.cutoffAt, archivedDays: records.size };
  if (!source || source.cutoffAt !== report.cutoffAt) throw new Error('Source edition or cutoff differs. Preserve it.');
  if ([current, ...records.values()].some(record => Date.parse(record.cutoffAt) > Date.parse(report.cutoffAt))) throw new Error('Refusing to move a report while a newer stored newsletter exists.');
  if (!sameContent(current, source) && !(target && sameContent(current, target))) throw new Error('Latest and source edition conflict. Preserve both.');
  if (target && !sameContent(target, report)) throw new Error('Target date already contains a different report. Preserve both.');
  const metadata = record => Object.fromEntries(Object.entries(record).filter(([key]) => !['reportDate', 'markdown', 'exportedAt'].includes(key)));
  if (JSON.stringify(canonical(metadata(source))) !== JSON.stringify(canonical(metadata(report))) || JSON.stringify(parseSections(source.markdown).sections) !== JSON.stringify(parseSections(report.markdown).sections)) throw new Error('Date correction must preserve all sections, source data and original timestamps.');
  // Only the date and explanatory introduction may change. Retry a partial move safely.
  const corrected = target || report;
  records.delete(fromDate); records.set(corrected.reportDate, corrected);
  const index = validateArchiveIndex({ version: 1, timezone: TIMEZONE, reports: [...records.values()].map(({ reportDate, cutoffAt, title }) => ({ reportDate, cutoffAt, title })) });
  const writes = [[path.join(archive, corrected.reportDate + '.json'), serialize(corrected)], [path.join(archive, 'index.json'), serialize(index, 8_000_000)], [latest, serialize(corrected)]];
  for (const [file, body] of writes) await atomicWrite(file, body);
  // Delete only the old copy after its identical-content replacement and pointers are safe.
  const sourcePath = path.join(archive, fromDate + '.json');
  if (!sameContent(source, validateNewsletter(await readJSON(sourcePath)))) throw new Error('Source changed during date correction. Preserve it.');
  await unlink(sourcePath);
  return { unchanged: false, reassignedFrom: fromDate, reportDate: corrected.reportDate, cutoffAt: corrected.cutoffAt, archivedDays: records.size };
}

async function main() {
  if (process.argv.length > 2 && !calendarOnly && !reassignFrom) throw new Error('Use JSON on stdin, optionally with --calendar or --reassign-date YYYY-MM-DD.');
  if (reassignFrom && !validDate(reassignFrom)) throw new Error('Source date is invalid.');
  const report = await readInput();
  const lock = await acquireLock();
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    console.log(JSON.stringify(await (calendarOnly ? publishCalendar(report) : reassignFrom ? reassignDate(report, reassignFrom) : publish(report))));
  } finally {
    try { await lock.close(); }
    finally { await unlink(lockPath); }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
