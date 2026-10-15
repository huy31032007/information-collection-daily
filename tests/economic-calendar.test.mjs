import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateEconomicCalendar, assertCalendarUpdate, calendarDate, eventStatus, eventRange, selectEvents, surprise } from '../dist/economic-calendar.mjs';
import { validateNewsletter } from '../dist/lib.mjs';

// Real source-verified historical snapshots; hypothetical variants stay in isolated tests.
const fixture = JSON.parse(await readFile(new URL('./fixtures/economic-calendar.json', import.meta.url), 'utf8'));
const newsletter = JSON.parse(await readFile(new URL('./fixtures/original-newsletter.json', import.meta.url), 'utf8'));
const now = new Date('2026-10-16T12:00:00Z');
const clone = () => structuredClone(fixture);

test('verified calendar preserves actual CPI, previous period, sources and missing forecasts', () => {
  const snapshot = validateEconomicCalendar(clone(), { now });
  assert.equal(snapshot.events[0].metrics[0].actual.value, 3.7);
  assert.equal(snapshot.events[0].metrics[0].previous.period, '08/2026');
  assert.equal(snapshot.events[0].metrics[0].forecast, null);
  assert.match(snapshot.events[0].resultSource.url, /bls.gov\/news.release\/archives/);
});
test('US daylight saving and midnight rollover use the publication instant', () => {
  const [cpi, fed, jobs] = fixture.events;
  assert.equal(calendarDate(fed.scheduledAt), '2026-10-29');
  const time = value => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  assert.equal(time(cpi.scheduledAt), '19:30');
  assert.equal(time(jobs.scheduledAt), '20:30');
  assert.equal(time(fed.scheduledAt), '01:00');
});
test('passing release time never invents an actual or confirmed release', () => {
  const fed = fixture.events[1];
  assert.equal(eventStatus(fed, '2026-10-28T00:00:00Z'), 'Sắp công bố');
  assert.match(eventStatus(fed, '2026-10-29T00:00:00Z'), /chưa xác minh/);
  assert.equal(eventStatus({ ...fed, scheduledAt: null }, now), 'Chưa xác định giờ');
  assert.equal(eventStatus({ ...fed, status: 'postponed' }, now), 'Đổi lịch / hoãn');
  assert.equal(eventStatus(fixture.events[0], now), 'Đã công bố');
  assert.equal(fed.metrics[0].actual, null);
});
test('calendar rejects unsafe links, invalid dates, duplicate events and future results', () => {
  for (const mutate of [
    value => { value.events[0].scheduleSource.url = 'javascript:alert(1)'; },
    value => { value.events[0].scheduleSource.url = 'https://user:password@example.com/'; },
    value => { value.events.push(structuredClone(value.events[0])); },
    value => { delete value.events[0].id; },
    value => { value.checkedAt = '2026-02-30T00:00:00Z'; },
    value => { value.events[1].scheduledDate = '2026-10-28'; },
    value => { value.events[1].metrics[0].actual = structuredClone(value.events[0].metrics[0].actual); },
    value => { value.events[0].metrics[0].actual.publishedAt = '2026-12-01T00:00:00Z'; },
    value => { value.events[0].status = 'scheduled'; },
    value => { value.events[0].metrics[0].actual.period = '08/2026'; },
    value => { value.events[1].sourceTimezone = 'Made/Up'; },
  ]) { const value = clone(); mutate(value); assert.throws(() => validateEconomicCalendar(value, { now })); }
});
test('historical newsletter cannot contain calendar data learned after its cutoff', () => {
  assert.throws(() => validateEconomicCalendar(fixture, { now, cutoffAt: newsletter.cutoffAt }));
  assert.throws(() => validateNewsletter({ ...newsletter, economic_calendar: fixture }, { now }));
  assert.throws(() => validateEconomicCalendar(fixture, { now, sourceThreadId: 'different-thread' }));
});
test('forecasts must precede publication; zero, negative and revised values are retained', () => {
  const value = clone(), metric = value.events[0].metrics[0];
  metric.forecast = { ...metric.actual, value: 3.5, publishedAt: '2026-10-14T08:00:00-04:00' };
  metric.previous.revisedFrom = 0;
  validateEconomicCalendar(value, { now }); assert.equal(surprise(metric), '+0,2 điểm phần trăm');
  assert.equal(surprise({ ...metric, actual: { ...metric.actual, value: 0 }, forecast: { ...metric.forecast, value: 0 } }), '0 điểm phần trăm');
  metric.actual.value = -0.2; metric.forecast.value = 0; assert.equal(surprise(metric), '-0,2 điểm phần trăm');
  metric.forecast.publishedAt = value.events[0].releasedAt; assert.throws(() => validateEconomicCalendar(value, { now }));
  metric.forecast.publishedAt = '2026-10-14T08:15:00-04:00'; value.events[0].releasedAt = '2026-10-14T08:00:00-04:00';
  assert.throws(() => validateEconomicCalendar(value, { now }), /dự báo phải có mốc trước công bố/);
});
test('filters use Vietnamese event dates and Monday–Sunday weeks without duplicate dates', () => {
  assert.equal(selectEvents(fixture, { date: '2026-10-28' }).length, 0);
  assert.equal(selectEvents(fixture, { date: '2026-10-29', country: 'US', query: 'lai suat' }).length, 1);
  assert.equal(selectEvents(fixture, { date: '2026-10-29', impact: 'low' }).length, 0);
  assert.deepEqual(eventRange('2026-12-31', 'week'), { start: '2026-12-28', end: '2027-01-03' });
  assert.deepEqual(eventRange('2026-10-29', 'next'), { start: '2026-10-29', end: '2026-11-04' });
});
test('calendar update is idempotent and rejects older or conflicting snapshots', () => {
  assert.doesNotThrow(() => assertCalendarUpdate(fixture, clone()));
  const older = clone(); older.checkedAt = '2026-10-14T20:00:00Z'; assert.throws(() => assertCalendarUpdate(fixture, older));
  const conflict = clone(); conflict.events.pop(); assert.throws(() => assertCalendarUpdate(fixture, conflict));
  conflict.checkedAt = new Date(fixture.checkedAt).toISOString(); assert.throws(() => assertCalendarUpdate(fixture, conflict));
});
async function sandbox() {
  const root = await mkdtemp(path.join(tmpdir(), 'economic-calendar-test-'));
  await mkdir(path.join(root, 'scripts')); await mkdir(path.join(root, 'dist/data'), { recursive: true });
  for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs', 'dist/history.mjs', 'dist/economic-calendar.mjs']) await copyFile(new URL('../' + file, import.meta.url), path.join(root, file));
  await writeFile(path.join(root, 'dist/data/latest.json'), JSON.stringify(newsletter));
  return root;
}
const run = (root, value, calendar = false) => spawnSync(process.execPath, ['scripts/write-newsletter.mjs', ...(calendar ? ['--calendar'] : [])], { cwd: root, input: JSON.stringify(value), encoding: 'utf8', timeout: 10000 });
test('standalone calendar publication preserves newsletter bytes and protects newer data', async () => {
  const root = await sandbox();
  try {
    const before = await readFile(path.join(root, 'dist/data/latest.json'), 'utf8');
    for (let i = 0; i < 2; i++) { const result = run(root, fixture, true); assert.equal(result.status, 0, result.stderr); }
    assert.equal(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'), before);
    const older = clone(); older.checkedAt = '2026-10-14T20:00:00Z'; assert.equal(run(root, older, true).status, 1);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, 'dist/data/economic-calendar.json'), 'utf8')), fixture);
    const conflict = clone(); conflict.events.pop(); assert.equal(run(root, conflict, true).status, 1);
  } finally { await rm(root, { recursive: true }); }
});
test('normal writer archives the calendar snapshot and publishes the same current calendar', async () => {
  const root = await sandbox();
  try {
    const report = { ...newsletter, reportDate: '2026-10-15', coverageStart: '2026-10-15T00:00:00+07:00', cutoffAt: fixture.checkedAt, coverageEnd: fixture.checkedAt, economic_calendar: fixture };
    const result = run(root, report); assert.equal(result.status, 0, result.stderr);
    const latest = JSON.parse(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'));
    const archived = JSON.parse(await readFile(path.join(root, 'dist/data/archive/2026-10-15.json'), 'utf8'));
    assert.deepEqual(latest.economic_calendar, fixture); assert.deepEqual(archived.economic_calendar, fixture);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, 'dist/data/economic-calendar.json'), 'utf8')), fixture);
  } finally { await rm(root, { recursive: true }); }
});
