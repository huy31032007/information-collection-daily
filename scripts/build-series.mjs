// Build dist/data/market-series.json for the interactive trend chart from the archived
// reports. Values come only from the dashboard tables (same parser as the cards), so a
// day without a readable table is simply absent from the chart, never estimated.
//
//   node scripts/build-series.mjs          # write the file
//   node scripts/build-series.mjs --check  # exit 1 if the file is missing or stale
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseSections } from '../dist/lib.mjs';
import { readDashboardData, explicitPercent } from '../dist/dashboard.mjs';

const root = fileURLToPath(new URL('../dist/data/', import.meta.url));
const target = root + 'market-series.json';

// "1.733,02" → 1733.02; returns null for anything that is not a plain Vietnamese number.
export function viNumber(text = '') {
  const match = /^([+−-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/.exec(String(text).replace(/\*\*/g, '').trim());
  if (!match) return null;
  const value = Number(match[2].replace(/\./g, '') + (match[3] ? '.' + match[3] : ''));
  return Number.isFinite(value) ? (match[1] ? -value : value) : null;
}
// Gold quotes are normalised to triệu đồng/lượng.
function goldValue(text = '') {
  const value = viNumber(text); if (value == null) return null;
  if (/triệu (?:đồng|VNĐ)\/lượng/i.test(text)) return value;
  if (/(?:đồng|VNĐ)\/lượng/i.test(text)) return Math.round(value / 10_000) / 100;
  return null;
}

export async function buildSeries() {
  const files = (await readdir(root + 'archive')).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const series = {
    vnIndex: { label: 'VN-Index', unit: 'điểm', note: 'Mức đóng cửa ghi trong bảng chỉ số của bản tin', points: [] },
    vn30: { label: 'VN30', unit: 'điểm', note: 'Mức đóng cửa ghi trong bảng chỉ số của bản tin', points: [] },
    gold: { label: 'Vàng miếng SJC', unit: 'triệu đồng/lượng', note: 'Giá bán ra và mua vào theo bảng giá trong bản tin; đơn vị bán lẻ có thể khác nhau giữa các ngày', points: [] },
    brent: { label: 'Dầu Brent', unit: 'USD/thùng', note: 'Giá hợp đồng tương lai tại thời điểm ghi trong bản tin', points: [] },
  };
  for (const file of files) {
    const report = JSON.parse(await readFile(root + 'archive/' + file, 'utf8'));
    const data = readDashboardData(parseSections(report.markdown).sections);
    for (const key of ['vnIndex', 'vn30']) {
      const row = data.indices.find(item => item.label === (key === 'vnIndex' ? 'VN-Index' : 'VN30'));
      const value = viNumber(row?.value);
      if (value != null) series[key].points.push({ date: report.reportDate, value, changePct: explicitPercent(row.change || '')?.value ?? null, time: row.observedTime || null });
    }
    const sell = goldValue(data.gold?.value), buy = goldValue(data.gold?.buyValue);
    if (sell != null) series.gold.points.push({ date: report.reportDate, value: sell, buy, time: data.gold.time || null, product: data.gold.product || null });
    const brent = viNumber(data.oil?.value);
    if (brent != null && /USD\/thùng/.test(data.oil.value)) series.brent.points.push({ date: report.reportDate, value: brent, time: data.oil.time || null, contract: data.oil.product || null });
  }
  return { version: 1, timezone: 'Asia/Ho_Chi_Minh', series };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = JSON.stringify(await buildSeries(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    let current = ''; try { current = await readFile(target, 'utf8'); } catch { /* missing */ }
    if (current !== body) { console.error('dist/data/market-series.json is stale. Run `npm run build:series`.'); process.exit(1); }
    console.log('market-series.json is up to date.');
  } else {
    await writeFile(target, body);
    const counts = Object.fromEntries(Object.entries(JSON.parse(body).series).map(([key, item]) => [key, item.points.length]));
    console.log(JSON.stringify({ written: 'dist/data/market-series.json', points: counts }));
  }
}
