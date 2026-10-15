import { readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateNewsletter, extractSources } from '../dist/lib.mjs';
import { validateArchiveIndex, validateArchivedReport } from '../dist/history.mjs';
import { validateEconomicCalendar } from '../dist/economic-calendar.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['dist/learning.mjs', 'dist/learning-ui.mjs']) { const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr); }
const files = ['dist/app.mjs', 'dist/lib.mjs', 'dist/markdown.mjs', 'dist/dashboard.mjs', 'dist/intelligence-panel.mjs', 'dist/history.mjs', 'dist/history-ui.mjs', 'dist/economic-calendar.mjs', 'dist/economic-calendar-ui.mjs', 'scripts/write-newsletter.mjs', 'scripts/enrich-newsletter.mjs', 'scripts/preview.mjs'];
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr); }
for (const file of ['dist/index.html', 'dist/styles.css', 'dist/favicon.svg']) await access(root + file);
const report = validateNewsletter(JSON.parse(await readFile(root + 'dist/data/latest.json', 'utf8')));
if (!report) throw new Error('The current published document must contain a real report.');
const calendar = validateEconomicCalendar(JSON.parse(await readFile(root + 'dist/data/economic-calendar.json', 'utf8')), { sourceThreadId: report.sourceThreadId });
if (!calendar || (report.economic_calendar && Date.parse(calendar.checkedAt) < Date.parse(report.economic_calendar.checkedAt))) throw new Error('Published calendar is missing or older than the newsletter snapshot.');
const index = validateArchiveIndex(JSON.parse(await readFile(root + 'dist/data/archive/index.json', 'utf8')));
const currentEntry = index.reports.find(entry => entry.reportDate === report.reportDate);
if (!currentEntry || currentEntry.cutoffAt !== report.cutoffAt || index.reports.some(entry => Date.parse(entry.cutoffAt) > Date.parse(report.cutoffAt))) throw new Error('Archive and latest report are inconsistent.');
for (const entry of index.reports) {
  const archived = validateArchivedReport(JSON.parse(await readFile(root + 'dist/data/archive/' + entry.reportDate + '.json', 'utf8')), entry);
  if (archived.sourceThreadId !== report.sourceThreadId) throw new Error('Archive contains a different pipeline.');
  if (entry.reportDate === report.reportDate && archived.markdown !== report.markdown) throw new Error('Latest report differs from its archived copy.');
  if (entry.reportDate === report.reportDate && JSON.stringify(archived.economic_calendar) !== JSON.stringify(report.economic_calendar)) throw new Error('Latest calendar snapshot differs from its archived copy.');
}
const indexed = new Set(index.reports.map(entry => entry.reportDate + '.json'));
for (const file of await readdir(root + 'dist/data/archive')) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(file) && !indexed.has(file)) throw new Error('Unindexed archived report: ' + file);
const manifest = JSON.parse(await readFile(root + '.openai/hosting.json', 'utf8'));
if (!manifest.project_id || manifest.static?.directory !== 'dist') throw new Error('Missing Site identity or static directory.');
console.log(JSON.stringify({ syntax: 'passed', reportDate: report.reportDate, cutoffAt: report.cutoffAt, archivedDays: index.reports.length, calendarCheckedAt: calendar.checkedAt, economicEvents: calendar.events.length, sourceLinks: extractSources(report.markdown).length, hosting: 'static' }));
