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
