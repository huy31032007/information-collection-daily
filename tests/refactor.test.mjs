import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, access, unlink } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { validateNewsletter, parseSections } from '../dist/lib.mjs';
import { validateArchiveIndex } from '../dist/history.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/original-newsletter.json', import.meta.url), 'utf8'));
async function sandbox() {
  const root = await mkdtemp(path.join(tmpdir(), 'newsletter-refactor-test-'));
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'dist/data'), { recursive: true });
  for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs', 'dist/history.mjs', 'dist/economic-calendar.mjs']) {
    await copyFile(new URL('../' + file, import.meta.url), path.join(root, file));
  }
  await writeFile(path.join(root, 'dist/data/latest.json'), JSON.stringify(fixture));
  return root;
}
function run(root, value, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/write-newsletter.mjs', ...args], { cwd: root });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.on('error', reject);
    child.stdin.end(JSON.stringify(value));
  });
}

test('overlapping writers leave the newest successful report and release their lock', async () => {
  const root = await sandbox();
  try {
    const newer = { ...fixture, title: '[TEST FIXTURE] concurrent report',
      cutoffAt: '2026-10-12T09:15:47+07:00', coverageEnd: '2026-10-12T09:15:47+07:00' };
    const results = await Promise.all([run(root, fixture), run(root, newer)]);
    assert.equal(results[1].code, 0, results[1].stderr);
    assert.ok([0, 1].includes(results[0].code));
    if (results[0].code === 1) assert.match(results[0].stderr, /newer stored newsletter/);
    const latest = JSON.parse(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'));
    assert.equal(latest.cutoffAt, newer.cutoffAt);
    assert.equal(latest.markdown, fixture.markdown);
    await assert.rejects(access(path.join(root, '.sites-runtime/newsletter-writer.lock')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true }); }
});

// Date-handling fixtures only; no synthetic timestamps are published to the website.
function lateEdition() {
  return { ...fixture, title: '[TEST FIXTURE] late evening edition', reportDate: '2026-10-13',
    cutoffAt: '2026-10-13T00:49:42+07:00', coverageStart: '2026-10-12T00:00:00+07:00',
    coverageEnd: '2026-10-13T00:49:42+07:00', exportedAt: new Date().toISOString() };
}

test('late editions keep the summarized date and real next-day cutoff with strict coverage bounds', () => {
  const late = { ...lateEdition(), reportDate: '2026-10-12' };
  assert.equal(validateNewsletter(late).cutoffAt, '2026-10-13T00:49:42+07:00');
  assert.equal(validateArchiveIndex({ version: 1, timezone: late.timezone, reports: [{ reportDate: late.reportDate, cutoffAt: late.cutoffAt, title: late.title }] }).reports[0].reportDate, '2026-10-12');
  assert.throws(() => validateNewsletter({ ...late, reportDate: '2026-10-11' }));
  assert.throws(() => validateNewsletter({ ...late, coverageStart: '2026-10-12T09:00:00+07:00' }));
  assert.throws(() => validateArchiveIndex({ version: 1, timezone: late.timezone, reports: [{ reportDate: '2026-10-11', cutoffAt: late.cutoffAt, title: late.title }] }));
});

test('explicit date correction preserves sections and timestamps, retries safely, and leaves the next evening separate', async () => {
  const root = await sandbox();
  try {
    const late = lateEdition(), corrected = { ...late, reportDate: '2026-10-12', markdown: '[TEST FIXTURE] Late publication belongs to the day summarized.\n\n' + late.markdown };
    await writeFile(path.join(root, 'dist/data/latest.json'), JSON.stringify(late));
    assert.equal((await run(root, late)).code, 0);
    const before = await readFile(path.join(root, 'dist/data/latest.json'), 'utf8');
    const normal = await run(root, corrected); assert.equal(normal.code, 1); assert.match(normal.stderr, /Same cutoff/);
    const changedSection = { ...corrected, markdown: corrected.markdown.replace('## 3.', '## 3. changed') };
    const denied = await run(root, changedSection, ['--reassign-date', late.reportDate]); assert.equal(denied.code, 1); assert.match(denied.stderr, /preserve all sections/);
    assert.equal(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'), before);
    const moved = await run(root, corrected, ['--reassign-date', late.reportDate]); assert.equal(moved.code, 0, moved.stderr);
    const targetFile = path.join(root, 'dist/data/archive/2026-10-12.json'), movedBytes = await readFile(targetFile, 'utf8'), saved = JSON.parse(movedBytes);
    assert.equal(saved.reportDate, '2026-10-12'); assert.equal(saved.cutoffAt, late.cutoffAt); assert.equal(saved.coverageStart, late.coverageStart);
    assert.deepEqual(parseSections(saved.markdown).sections, parseSections(late.markdown).sections);
    await assert.rejects(access(path.join(root, 'dist/data/archive/2026-10-13.json')), { code: 'ENOENT' });
    const retry = await run(root, corrected, ['--reassign-date', late.reportDate]); assert.equal(retry.code, 0, retry.stderr); assert.equal(JSON.parse(retry.stdout).unchanged, true);
    assert.equal(await readFile(targetFile, 'utf8'), movedBytes);
    const evening = { ...late, title: '[TEST FIXTURE] next evening', coverageStart: '2026-10-13T00:00:00+07:00', cutoffAt: '2026-10-13T21:30:00+07:00', coverageEnd: '2026-10-13T21:30:00+07:00' };
    const next = await run(root, evening); assert.equal(next.code, 0, next.stderr);
    assert.equal(await readFile(targetFile, 'utf8'), movedBytes);
    assert.equal(JSON.parse(await readFile(path.join(root, 'dist/data/archive/2026-10-13.json'), 'utf8')).cutoffAt, evening.cutoffAt);
    assert.equal((await run(root, corrected, ['--reassign-date', late.reportDate])).code, 1);
    assert.equal(JSON.parse(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8')).cutoffAt, evening.cutoffAt);
  } finally { await rm(root, { recursive: true }); }
});

test('date correction protects occupied target dates and recovers either partial write stage', async () => {
  for (const stage of ['target-written', 'latest-written']) {
    const root = await sandbox();
    try {
      const late = lateEdition(), corrected = { ...late, reportDate: '2026-10-12' };
      await writeFile(path.join(root, 'dist/data/latest.json'), JSON.stringify(late));
      assert.equal((await run(root, late)).code, 0);
      const target = path.join(root, 'dist/data/archive/2026-10-12.json');
      await writeFile(target, JSON.stringify(fixture));
      const denied = await run(root, corrected, ['--reassign-date', late.reportDate]); assert.equal(denied.code, 1); assert.match(denied.stderr, /Target date/);
      assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), fixture);
      await unlink(target);
      // Simulate a stopped maintenance operation after saving its validated target.
      await writeFile(target, JSON.stringify(corrected));
      if (stage === 'latest-written') await writeFile(path.join(root, 'dist/data/latest.json'), JSON.stringify(corrected));
      const retry = await run(root, corrected, ['--reassign-date', late.reportDate]); assert.equal(retry.code, 0, retry.stderr);
      await assert.rejects(access(path.join(root, 'dist/data/archive/2026-10-13.json')), { code: 'ENOENT' });
      const index = JSON.parse(await readFile(path.join(root, 'dist/data/archive/index.json'), 'utf8'));
      assert.deepEqual(index.reports.map(row => row.reportDate), ['2026-10-12']);
    } finally { await rm(root, { recursive: true }); }
  }
});

test('a newer archive from an interrupted run blocks an older publication and can be retried', async () => {
  const root = await sandbox();
  try {
    const newer = { ...fixture, title: '[TEST FIXTURE] interrupted run', reportDate: '2026-10-13',
      cutoffAt: '2026-10-13T09:15:46+07:00', coverageEnd: '2026-10-13T09:15:46+07:00',
      coverageStart: '2026-10-12T09:15:46+07:00', exportedAt: new Date().toISOString() };
    await mkdir(path.join(root, 'dist/data/archive'));
    const archivedFile = path.join(root, 'dist/data/archive/2026-10-13.json');
    await writeFile(archivedFile, JSON.stringify(newer));
    const before = await readFile(path.join(root, 'dist/data/latest.json'), 'utf8');
    const rejection = await run(root, fixture);
    assert.equal(rejection.code, 1);
    assert.match(rejection.stderr, /newer stored newsletter/);
    assert.equal(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'), before);
    const retry = await run(root, newer); assert.equal(retry.code, 0, retry.stderr);
    assert.equal(JSON.parse(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8')).reportDate, '2026-10-13');
  } finally { await rm(root, { recursive: true }); }
});

test('Vietnamese text survives a UTF-8 character split across stdin chunks', async () => {
  const root = await sandbox();
  try {
    const value = { ...fixture, title: '[TEST FIXTURE] tiếng Việt' };
    const input = Buffer.from(JSON.stringify(value));
    const offset = input.findIndex(byte => byte > 127) + 1;
    const { unlink } = await import('node:fs/promises');
    await unlink(path.join(root, 'dist/data/latest.json'));
    const child = spawn(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: root });
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdout.resume();
    const finished = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    child.stdin.write(input.subarray(0, offset)); await delay(150);
    child.stdin.end(input.subarray(offset));
    assert.equal(await finished, 0, stderr);
    const saved = JSON.parse(await readFile(path.join(root, 'dist/data/latest.json'), 'utf8'));
    assert.equal(saved.title, value.title); assert.equal(saved.markdown, fixture.markdown);
  } finally { await rm(root, { recursive: true }); }
});

test('invalid UTF-8 and oversized byte input leave the existing report unchanged', async () => {
  const root = await sandbox();
  try {
    const file = path.join(root, 'dist/data/latest.json'), before = await readFile(file, 'utf8');
    const invalid = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], {
      cwd: root, input: Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x22, 0x7d]), encoding: 'utf8' });
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /valid UTF-8 JSON/);
    const oversized = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], {
      cwd: root, input: JSON.stringify({ text: 'ắ'.repeat(210000) }), encoding: 'utf8' });
    assert.equal(oversized.status, 1); assert.match(oversized.stderr, /input is too large/);
    assert.equal(await readFile(file, 'utf8'), before);
  } finally { await rm(root, { recursive: true }); }
});
