import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateNewsletter, parseSections, safeLink, sourceName, filterSections, reportFreshness, vietnamDate } from '../dist/lib.mjs';
import { readDashboardData, explicitPercent } from '../dist/dashboard.mjs';

// A real historical fixture keeps tests independent of tomorrow's market data.
const report = JSON.parse(await readFile(new URL('./fixtures/original-newsletter.json', import.meta.url), 'utf8'));
const parsed = parseSections(report.markdown);
const fixedNow = new Date('2026-10-12T18:00:00Z');

test('dashboard preserves quoted values, source times, units and comparison context from the real report', () => {
  const data = readDashboardData(parsed.sections);
  assert.deepEqual(data.indices.map(row => row.percent.value), [0.03, 0.16, 1.71, 0.19]);
  assert.equal(data.indices[0].value, '1.735,62');
  assert.equal(data.indices[0].time, 'Mức hiển thị ngày 12/10 · 09:05');
  assert.ok(data.stockTable.before.includes('so với đóng cửa ngày 9/10'));
  assert.equal(data.indices[0].sources[0].href, 'https://web.stockbiz.vn/IndicesStats.aspx');
  assert.equal(data.gold.value, '144,8 triệu đồng/lượng'); assert.ok(data.gold.time.includes('08:55'));
  assert.equal(data.oil.value, '105,48 USD/thùng'); assert.ok(data.oil.time.includes('06:04 ngày 12/10'));
  assert.ok(data.oil.detail.includes('9/10')); assert.ok(data.insight.includes('Độ tin cậy **vừa**'));
});
test('dashboard leaves missing, unverified, unreferenced or differently formatted values unavailable', () => {
  assert.equal(readDashboardData([]).indices.length, 0); assert.equal(readDashboardData([]).gold, null); assert.equal(readDashboardData([]).oil, null);
  assert.equal(explicitPercent('Chưa xác minh +0,03%'), null);
  assert.equal(explicitPercent('+0.53; +0.03%'), null);
  assert.equal(explicitPercent('+3,00%; −2,00%'), null);
  assert.deepEqual(explicitPercent('−3,88; −0,22%'), { value: -0.22, text: '−0,22%' });
  const noSources = parsed.sections.map(s => ({ ...s, body: s.body.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g, '') }));
  assert.equal(readDashboardData(noSources).indices.length, 0); assert.equal(readDashboardData(noSources).gold, null);
  const unknown = parsed.sections.map(s => ({ ...s, body: s.id === '2' ? s.body.replace('09:05 |', 'Chưa xác minh |') : s.body }));
  assert.equal(readDashboardData(unknown).indices.some(row => row.label === 'VN-Index'), false);
  const noDate = parsed.sections.map(s => ({ ...s, body: s.id === '2' ? s.body.replace('Mức hiển thị ngày 12/10', 'Mức hiển thị') : s.body }));
  assert.equal(readDashboardData(noDate).indices.length, 0);
  const uncertainGold = parsed.sections.map(s => ({ ...s, body: s.body.replace('144,8 triệu đồng/lượng', '144,8 triệu đồng/lượng; Chưa xác minh') }));
  assert.equal(readDashboardData(uncertainGold).gold, null);
});

test('real newsletter has all nine sections and preserves source text', () => {
  assert.equal(validateNewsletter(report, { now: fixedNow }), report);
  assert.deepEqual(parsed.sections.map(s => s.id), ['1','2','3','4','5','6','7','8','9','glossary']);
  assert.ok(parsed.sections.find(s => s.id === '3').body.includes('141,8'));
  assert.ok(parsed.sections.find(s => s.id === '2').body.includes('09:05'));
});
test('malformed dates, future timestamps and export-before-cutoff are rejected', () => {
  assert.throws(() => validateNewsletter({ ...report, cutoffAt: '2026-02-30T09:15:46+07:00', coverageEnd: '2026-02-30T09:15:46+07:00', coverageStart: '2026-02-28T09:15:46+07:00', reportDate: '2026-03-02' }, { now: fixedNow }));
  assert.throws(() => validateNewsletter({ ...report, cutoffAt: '2099-10-12T09:15:46+07:00', coverageEnd: '2099-10-12T09:15:46+07:00', reportDate: '2099-10-12' }, { now: fixedNow }));
  assert.throws(() => validateNewsletter({ ...report, exportedAt: '2026-10-12T01:00:00Z' }, { now: fixedNow }));
});
test('null is empty; invalid JSON shape, timezone and missing sections are errors', () => {
  assert.equal(validateNewsletter(null), null);
  for (const bad of [{}, [], { ...report, timezone: 'UTC' }, { ...report, markdown: 'No newsletter' }]) assert.throws(() => validateNewsletter(bad, { now: fixedNow }));
});
test('source links reject executable schemes and embedded credentials', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/news', 'https://user:password@example.com', '/relative']) assert.equal(safeLink(href), null);
  assert.equal(safeLink('https://www.nso.gov.vn/'), 'https://www.nso.gov.vn/');
  assert.equal(sourceName('fake-vietnamplus.vn'), 'fake-vietnamplus.vn');
  assert.equal(sourceName('support.vndirect.com.vn'), 'VNDIRECT');
});
test('Vietnam date boundary is independent of host timezone', () => {
  assert.equal(vietnamDate(new Date('2026-10-11T17:30:00Z')), '2026-10-12');
  assert.equal(reportFreshness(report, new Date('2026-10-12T17:00:01Z')), 'older');
});
test('topic/search/source filters retain the entire matching section', () => {
  const filters = { topic: '3', query: 'vang', source: 'Kitco', period: 'any' };
  const sections = filterSections(parsed.sections, report, filters, fixedNow);
  assert.equal(sections.length, 1); assert.equal(sections[0].body, parsed.sections[2].body);
  assert.equal(filterSections(parsed.sections, report, { ...filters, query: 'not-a-real-keyword' }, fixedNow).length, 0);
  assert.equal(filterSections(parsed.sections, report, { ...filters, period: 'today' }, new Date('2026-10-13T12:00:00Z')).length, 0);
});
test('writer is idempotent and rejects backwards publication without changing the file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'newsletter-writer-test-'));
  try {
    await mkdir(path.join(directory, 'scripts')); await mkdir(path.join(directory, 'dist', 'data'), { recursive: true });
    for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs']) await copyFile(new URL('../' + file, import.meta.url), path.join(directory, file));
    await copyFile(new URL('./fixtures/original-newsletter.json', import.meta.url), path.join(directory, 'dist/data/latest.json'));
    const target = path.join(directory, 'dist/data/latest.json'); const before = await readFile(target, 'utf8');
    const repeat = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: directory, input: JSON.stringify(report), encoding: 'utf8' });
    assert.equal(repeat.status, 0, repeat.stderr); assert.equal(JSON.parse(repeat.stdout).unchanged, true); assert.equal(await readFile(target, 'utf8'), before);
    const older = { ...report, cutoffAt: '2026-10-11T09:15:46+07:00', coverageEnd: '2026-10-11T09:15:46+07:00', coverageStart: '2026-10-10T09:15:46+07:00', reportDate: '2026-10-11' };
    const reject = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: directory, input: JSON.stringify(older), encoding: 'utf8' });
    assert.notEqual(reject.status, 0); assert.equal(await readFile(target, 'utf8'), before);
  } finally { await rm(directory, { recursive: true }); }
});
test('writer replaces a newer document atomically in an isolated test directory', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'newsletter-atomic-test-'));
  try {
    await mkdir(path.join(directory, 'scripts')); await mkdir(path.join(directory, 'dist', 'data'), { recursive: true });
    for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs']) await copyFile(new URL('../' + file, import.meta.url), path.join(directory, file));
    await copyFile(new URL('./fixtures/original-newsletter.json', import.meta.url), path.join(directory, 'dist/data/latest.json'));
    // Test metadata only; this directory is never served or packaged for publication.
    const newer = { ...report, cutoffAt: '2026-10-12T09:15:47+07:00', coverageEnd: '2026-10-12T09:15:47+07:00' };
    const write = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: directory, input: JSON.stringify(newer), encoding: 'utf8' });
    assert.equal(write.status, 0, write.stderr); assert.equal(JSON.parse(write.stdout).written, true);
    const saved = JSON.parse(await readFile(path.join(directory, 'dist/data/latest.json'), 'utf8'));
    assert.equal(saved.markdown, report.markdown); assert.equal(saved.cutoffAt, newer.cutoffAt);
    const { readdir } = await import('node:fs/promises'); assert.deepEqual(await readdir(path.join(directory, 'dist/data')), ['latest.json']);
  } finally { await rm(directory, { recursive: true }); }
});
