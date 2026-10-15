import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LESSONS, eventLessons, metricExplanation } from '../dist/learning.mjs';

const calendar = JSON.parse(await readFile(new URL('./fixtures/economic-calendar.json', import.meta.url), 'utf8'));
const cpi = calendar.events[0].metrics[0];
test('real CPI change is explained in percentage points with both reference periods', () => {
  const text = metricExplanation(cpi).join(' ');
  assert.match(text, /09\/2026.*3,7 %/);
  assert.match(text, /08\/2026.*3,4 %/);
  assert.match(text, /0,3 điểm phần trăm/);
  assert.match(text, /Chưa có dự báo đã xác minh/);
  assert.ok(!text.includes('tăng 0,3%'));
});
test('falling inflation and negative price growth are not confused', () => {
  const lower = { ...cpi, actual: { ...cpi.actual, value: 3 }, previous: { ...cpi.previous, value: 4 } };
  assert.match(metricExplanation(lower).join(' '), /giá bình quân vẫn cao hơn/);
  assert.match(metricExplanation(lower).join(' '), /giảm 1 điểm phần trăm/);
  lower.actual.value = -1;
  assert.ok(!metricExplanation(lower).join(' ').includes('giá bình quân vẫn cao hơn'));
});
test('zero results are retained; missing results and non-numeric ranges never become calculated changes', () => {
  const zero = { ...cpi, actual: { ...cpi.actual, value: 0 }, previous: { ...cpi.previous, value: 0 } };
  assert.match(metricExplanation(zero).join(' '), /không đổi 0 điểm phần trăm/);
  assert.match(metricExplanation({ ...cpi, actual: null })[0], /Chưa có kết quả/);
  assert.match(metricExplanation({ ...cpi, actual: { ...cpi.actual, value: '4–4,25' } }).join(' '), /Chưa đủ hai mốc/);
});
test('comparisons require consecutive matching monthly or quarterly periods', () => {
  for (const period of ['09/2026', '07/2026', 'Quý II/2026', 'không rõ']) {
    const text = metricExplanation({ ...cpi, previous: { ...cpi.previous, period } }).join(' ');
    assert.match(text, /Chưa đủ hai mốc/); assert.ok(!text.includes('Phép trừ:'));
  }
  const quarter = { ...cpi, actual: { ...cpi.actual, period: 'Quý III/2026' }, previous: { ...cpi.previous, period: 'Quý II/2026' } };
  assert.match(metricExplanation(quarter).join(' '), /Phép trừ:/);
});
test('forecast, revised previous and count changes retain their distinct meanings', () => {
  const metric = { ...cpi, unit: 'việc làm', actual: { ...cpi.actual, value: 0 }, previous: { ...cpi.previous, value: -10, revisedFrom: -5 }, forecast: { ...cpi.actual, value: 20 } };
  const text = metricExplanation(metric).join(' ');
  assert.match(text, /tăng 10 việc làm/); assert.match(text, /− \(20\) = -20 việc làm/); assert.match(text, /số đã điều chỉnh/);
  assert.ok(!text.includes('điểm phần trăm'));
});
test('only relevant event lessons appear and every example is visibly hypothetical', () => {
  assert.deepEqual(eventLessons(calendar.events[0]), ['cpi', 'core', 'units']);
  assert.deepEqual(eventLessons(calendar.events[1]), ['fed', 'units']);
  assert.deepEqual(eventLessons(calendar.events[2]), ['jobs', 'units']);
  assert.deepEqual(eventLessons({ title: 'Một sự kiện khác', metrics: [] }), ['units']);
  for (const lesson of Object.values(LESSONS)) {
    assert.match(lesson.example, /^Ví dụ giả định:/);
    for (const source of lesson.sources) assert.equal(new URL(source.url).protocol, 'https:');
  }
});
