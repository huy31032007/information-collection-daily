import { readFile, writeFile, rename, unlink, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateNewsletter, TIMEZONE } from '../dist/lib.mjs';
import { validateArchiveIndex } from '../dist/history.mjs';

const target = fileURLToPath(new URL('../dist/data/latest.json', import.meta.url));
const archive = path.join(path.dirname(target), 'archive');
let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 600_000) throw new Error('Newsletter input is too large.'); }
const report = validateNewsletter({ ...JSON.parse(input), exportedAt: new Date().toISOString() });
if (!report) throw new Error('Refusing to publish an empty report.');
async function readOptional(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function atomic(file, value) {
  const body = JSON.stringify(value, null, 2) + '\n';
  try { if (await readFile(file, 'utf8') === body) return false; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = file + '.' + process.pid + '.tmp'; let created = false;
  try { await writeFile(temporary, body, { flag: 'wx' }); created = true; await rename(temporary, file); return true; }
  finally { if (created) await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
const sameContent = (a, b) => ['markdown','title','reportDate','coverageStart','coverageEnd','sourceThreadId','cutoffAt','timezone'].every(key => a[key] === b[key]);
const current = validateNewsletter(await readOptional(target));
if (current && report.sourceThreadId !== current.sourceThreadId) throw new Error('Refusing a report from a different pipeline thread.');
if (current && Date.parse(report.cutoffAt) < Date.parse(current.cutoffAt)) throw new Error('Refusing to overwrite a newer newsletter.');
const unchanged = Boolean(current && current.cutoffAt === report.cutoffAt);
if (unchanged && !sameContent(report, current)) throw new Error('Same cutoff has different content. Preserve it and resolve the conflict.');

const records = new Map();
let files = []; try { files = await readdir(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const file of files.filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))) {
  const record = validateNewsletter(await readOptional(path.join(archive, file)));
  if (!record || record.reportDate + '.json' !== file || record.sourceThreadId !== report.sourceThreadId) throw new Error('Archive contains a mismatched date or pipeline. Preserve it and inspect before publishing.');
  records.set(record.reportDate, record);
}
const pending = new Map();
function plan(record, { currentSnapshot = false } = {}) {
  if (!record) return; const existing = records.get(record.reportDate);
  if (existing && existing.cutoffAt === record.cutoffAt) { if (!sameContent(existing, record)) throw new Error('Archived report conflicts at the same cutoff.'); return; }
  if (existing && Date.parse(existing.cutoffAt) > Date.parse(record.cutoffAt)) { if (currentSnapshot) return; throw new Error('Refusing to replace a newer archived report.'); }
  records.set(record.reportDate, record); pending.set(record.reportDate, record);
}
plan(current, { currentSnapshot: true }); plan(unchanged ? current : report);
const index = validateArchiveIndex({ version: 1, timezone: TIMEZONE, reports: [...records.values()].map(record => ({ reportDate: record.reportDate, cutoffAt: record.cutoffAt, title: record.title })) });

// Publish files before their index; a failed archive write cannot discard the current report.
await mkdir(archive, { recursive: true });
for (const [date, record] of pending) await atomic(path.join(archive, date + '.json'), record);
await atomic(path.join(archive, 'index.json'), index);
if (!unchanged) await atomic(target, report);
console.log(JSON.stringify({ unchanged, written: !unchanged, cutoffAt: (unchanged ? current : report).cutoffAt, archivedDays: records.size }));
