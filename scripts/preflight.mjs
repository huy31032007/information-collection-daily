// Check a newsletter JSON before publishing: schema validity plus whether the
// dashboard cards can be built from its tables. Reads nothing from the network.
//
//   npm run preflight -- path/to/report.json      # a draft file
//   npm run preflight -- - < path/to/report.json  # JSON on stdin ("-")
//   npm run preflight                             # the published latest.json
//   add --strict to fail (exit 1) when a dashboard card would be empty.
import { readFile } from 'node:fs/promises';
import { validateNewsletter, parseSections, extractSources } from '../dist/lib.mjs';
import { dashboardCoverage, DASHBOARD_TABLE_HINTS } from '../dist/dashboard.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const file = args.find(arg => arg === '-' || !arg.startsWith('-'));
const LABELS = { vnIndex: 'Thẻ VN-Index', vn30: 'Thẻ VN30', gold: 'Thẻ vàng miếng SJC', oil: 'Thẻ dầu Brent', chart: 'Biểu đồ % thay đổi', insight: 'Khối nhận định' };

async function readStdin() {
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
const source = file === '-' ? await readStdin()
  : await readFile(file || new URL('../dist/data/latest.json', import.meta.url), 'utf8');

let report;
try {
  const value = JSON.parse(source);
  // The writer stamps exportedAt itself; a draft may not have it yet.
  report = validateNewsletter({ exportedAt: new Date().toISOString(), ...value });
  if (!report) throw new Error('Tệp không chứa bản tin.');
} catch (error) {
  console.error('✗ Bản tin chưa hợp lệ: ' + error.message);
  process.exit(1);
}

const sections = parseSections(report.markdown).sections;
const coverage = dashboardCoverage(sections);
const missing = Object.keys(LABELS).filter(key => !coverage[key]);
console.log(`✓ Hợp lệ · ngày ${report.reportDate} · chốt ${report.cutoffAt} · ${sections.filter(s => /^\d$/.test(s.id)).length} mục · ${extractSources(report.markdown).length} link nguồn`);
for (const key of Object.keys(LABELS)) console.log(`${coverage[key] ? '  ✓' : '  ✗'} ${LABELS[key]}`);
if (missing.length) {
  console.log('\nDashboard sẽ trống ở các phần trên. Thêm bảng theo mẫu (dữ liệu thật, giữ nguồn và thời điểm):');
  for (const key of missing) console.log('  • ' + DASHBOARD_TABLE_HINTS[key]);
  console.log('Xem mẫu đầy đủ: docs/dashboard-tables.md');
}
if (strict && missing.length) process.exit(1);
