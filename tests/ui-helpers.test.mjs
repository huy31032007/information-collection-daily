import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { editionStatus, formatTime, slashDayMonth, parseSections } from '../dist/lib.mjs';
import { dateLabel } from '../dist/history.mjs';
import { dashboardCoverage } from '../dist/dashboard.mjs';

const report = JSON.parse(await readFile(new URL('./fixtures/original-newsletter.json', import.meta.url), 'utf8'));

test('yesterday\'s edition is expected until the 21:30 publication, then reads as compiling', () => {
  const edition = { reportDate: '2026-11-07' };
  assert.equal(editionStatus(edition, new Date('2026-11-07T10:00:00Z')), 'today');
  assert.equal(editionStatus(edition, new Date('2026-11-08T03:00:00Z')), 'awaiting');
  assert.equal(editionStatus(edition, new Date('2026-11-08T14:31:00Z')), 'compiling');
  assert.equal(editionStatus(edition, new Date('2026-11-09T01:00:00Z')), 'older');
});

test('day/month without a year uses slashes, as Vietnamese readers expect', () => {
  assert.equal(slashDayMonth('21:54 07-11'), '21:54 07/11');
  assert.equal(formatTime('2026-11-07T21:54:47+07:00', { year: undefined, second: undefined }), '21:54 07/11');
  assert.equal(dateLabel('2026-11-07', { year: undefined }), '07/11');
  assert.equal(dateLabel('2026-11-07'), '07/11/2026');
});

test('dashboard coverage reports every card for a tabled report and none for prose-only markdown', () => {
  const full = dashboardCoverage(parseSections(report.markdown).sections);
  assert.deepEqual(Object.keys(full).sort(), ['chart', 'gold', 'insight', 'oil', 'vn30', 'vnIndex']);
  assert.equal(full.vnIndex && full.vn30 && full.chart, true);
  const prose = report.markdown.split('\n').filter(line => !line.startsWith('|')).join('\n');
  const empty = dashboardCoverage(parseSections(prose).sections);
  assert.equal(empty.vnIndex || empty.vn30 || empty.gold || empty.oil || empty.chart, false);
});

// Backfill ("làm bù") editions: written days later, archived under the summarized day.
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateNewsletter } from '../dist/lib.mjs';
import { validateArchiveIndex } from '../dist/history.mjs';

const backfillOf = (base, date, cutoff) => ({ ...base, edition: 'backfill', title: `Bản tin kinh tế và thị trường — ${date} (làm bù)`, reportDate: date, coverageStart: date + 'T00:00:00+07:00', cutoffAt: cutoff, coverageEnd: cutoff, exportedAt: cutoff });

test('backfills may close days later but must cover the day from 00:00 and be labelled', () => {
  const ok = backfillOf(report, '2026-10-10', '2026-10-12T10:00:00+07:00');
  assert.equal(validateNewsletter(ok).edition, 'backfill');
  assert.throws(() => validateNewsletter({ ...ok, edition: undefined }), /Khoảng tổng hợp/);
  assert.throws(() => validateNewsletter({ ...ok, title: 'Bản tin 10/10' }), /làm bù/);
  assert.throws(() => validateNewsletter({ ...ok, coverageStart: '2026-10-10T09:00:00+07:00' }), /đầu ngày/);
  assert.throws(() => validateNewsletter({ ...ok, cutoffAt: '2026-10-10T22:00:00+07:00', coverageEnd: '2026-10-10T22:00:00+07:00', exportedAt: '2026-10-10T22:00:00+07:00' }), /chốt sau ngày/);
  assert.throws(() => validateNewsletter({ ...ok, edition: 'draft' }), /Loại bản tin/);
  const index = { version: 1, timezone: 'Asia/Ho_Chi_Minh', reports: [{ reportDate: '2026-10-10', cutoffAt: ok.cutoffAt, title: ok.title, edition: 'backfill' }] };
  assert.equal(validateArchiveIndex(index).reports.length, 1);
  assert.throws(() => validateArchiveIndex({ ...index, reports: [{ ...index.reports[0], edition: undefined }] }));
});

test('writing a backfill archives it without replacing the newer latest edition', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'newsletter-backfill-test-'));
  try {
    await mkdir(path.join(root, 'scripts')); await mkdir(path.join(root, 'dist/data'), { recursive: true });
    for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs', 'dist/history.mjs', 'dist/economic-calendar.mjs']) await copyFile(new URL('../' + file, import.meta.url), path.join(root, file));
    const write = value => spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: root, input: JSON.stringify(value), encoding: 'utf8' });
    const { exportedAt, economic_calendar, ...latest } = report;
    assert.equal(write(latest).status, 0);
    const late = backfillOf(latest, '2026-10-10', '2026-10-12T10:00:00+07:00'); delete late.exportedAt;
    const result = write(late); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).latest, 'kept');
    const read = async file => JSON.parse(await (await import('node:fs/promises')).readFile(path.join(root, 'dist/data', file), 'utf8'));
    assert.equal((await read('latest.json')).reportDate, report.reportDate);
    assert.equal((await read('archive/2026-10-10.json')).edition, 'backfill');
    const index = await read('archive/index.json');
    assert.deepEqual(index.reports.map(row => [row.reportDate, row.edition ?? null]), [[report.reportDate, null], ['2026-10-10', 'backfill']]);
    assert.equal(write(late).status, 0, 'retrying the same backfill is idempotent');
    // A regular edition for a later day still publishes normally after a backfill.
    const next = { ...latest, reportDate: '2026-10-12', cutoffAt: '2026-10-12T21:40:00+07:00', coverageEnd: '2026-10-12T21:40:00+07:00', coverageStart: '2026-10-12T00:00:00+07:00' };
    const regular = write(next); assert.equal(regular.status, 0, regular.stderr);
    assert.equal((await read('latest.json')).cutoffAt, next.cutoffAt);
  } finally { await rm(root, { recursive: true }); }
});
