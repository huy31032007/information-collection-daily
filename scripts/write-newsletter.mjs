import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateNewsletter } from '../dist/lib.mjs';

const target = fileURLToPath(new URL('../dist/data/latest.json', import.meta.url));
let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 600_000) throw new Error('Newsletter input is too large.'); }
const payload = JSON.parse(input); const report = validateNewsletter({ ...payload, exportedAt: new Date().toISOString() });
if (!report) throw new Error('Refusing to publish an empty report.');
const current = validateNewsletter(JSON.parse(await readFile(target, 'utf8')));
if (current && report.sourceThreadId !== current.sourceThreadId) throw new Error('Refusing a report from a different pipeline thread.');
if (current && Date.parse(report.cutoffAt) < Date.parse(current.cutoffAt)) throw new Error('Refusing to overwrite a newer newsletter.');
if (current && Date.parse(report.cutoffAt) === Date.parse(current.cutoffAt)) {
  const keys = ['markdown', 'title', 'reportDate', 'coverageStart', 'coverageEnd', 'sourceThreadId'];
  if (keys.some(key => report[key] !== current[key])) throw new Error('Same cutoff has different content. Preserve it and resolve the conflict.');
  console.log(JSON.stringify({ unchanged: true, cutoffAt: current.cutoffAt }));
} else {
  const temporary = target + '.' + process.pid + '.tmp';
  try { await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, target); }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  console.log(JSON.stringify({ written: true, cutoffAt: report.cutoffAt }));
}
