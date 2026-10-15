import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, access } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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
function run(root, value) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/write-newsletter.mjs'], { cwd: root });
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
