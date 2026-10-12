import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateNewsletter, extractSources } from '../dist/lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['dist/app.mjs', 'dist/lib.mjs', 'dist/markdown.mjs', 'scripts/write-newsletter.mjs', 'scripts/preview.mjs'];
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr); }
for (const file of ['dist/index.html', 'dist/styles.css', 'dist/favicon.svg']) await access(root + file);
const report = validateNewsletter(JSON.parse(await readFile(root + 'dist/data/latest.json', 'utf8')));
if (!report) throw new Error('The current published document must contain a real report.');
const manifest = JSON.parse(await readFile(root + '.openai/hosting.json', 'utf8'));
if (!manifest.project_id || manifest.static?.directory !== 'dist') throw new Error('Missing Site identity or static directory.');
console.log(JSON.stringify({ syntax: 'passed', reportDate: report.reportDate, cutoffAt: report.cutoffAt, sourceLinks: extractSources(report.markdown).length, hosting: 'static' }));
