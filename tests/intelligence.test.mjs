import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  viNumber, publishedAt, marketSnapshot, cleanItem, validCache, readFeed, academicItems
} from '../scripts/enrich-newsletter.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/original-newsletter.json', import.meta.url), 'utf8'));
const feed = { id: 'test', name: 'Test source', url: 'https://vneconomy.vn/tai-chinh.rss', host: 'vneconomy.vn' };
const now = Date.parse('2026-10-12T10:00:00Z');
const article = {
  title: '[TEST FIXTURE] Lãi suất và lạm phát',
  link: 'https://vneconomy.vn/test-fixture.htm',
  summary: '[TEST FIXTURE] Chính sách tiền tệ.',
  published_at_raw: 'Mon, 12 Oct 2026 02:00:00 GMT',
  published_at: '2026-10-12T02:00:00.000Z', source: feed.name
};
const xml = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test fixtures only</title><link>https://vneconomy.vn/</link><description>Test fixtures</description><item><title>[TEST FIXTURE] Lãi suất và lạm phát</title><link>https://vneconomy.vn/test-fixture.htm</link><description>&lt;p&gt;Chính sách tiền tệ.&lt;/p&gt;</description><pubDate>Mon, 12 Oct 2026 02:00:00 GMT</pubDate></item></channel></rss>';

test('Vietnamese numbers reject ambiguous formats and preserve quoted precision', () => {
  assert.equal(viNumber('1.735,62'), 1735.62);
  assert.equal(viNumber('−1,88'), -1.88);
  assert.equal(viNumber('1,735.62'), null);
  assert.equal(viNumber('Chưa xác minh'), null);
  const snapshot = marketSnapshot(fixture, []);
  assert.equal(snapshot.indices[0].decimal_places, 2);
  assert.equal(snapshot.gold_sjc.decimal_places, 1);
});

test('RSS timestamps require an explicit timezone and a valid calendar date', () => {
  assert.equal(publishedAt('10/13/2026 7:09:00 PM'), null);
  assert.equal(publishedAt('Tue, 13 Oct 2026 02:00:00 GMT'), '2026-10-13T02:00:00.000Z');
  assert.equal(publishedAt('2026-10-13T09:00:00+07:00'), '2026-10-13T02:00:00.000Z');
  for (const value of ['2026-02-30T09:00:00Z', 'Mon, 30 Feb 2026 09:00:00 GMT', '2026-10-13T25:00:00Z', '2026-10-13T09:00:00+14:30', 'Tue, 13 Oct 2026 09:00:00 +1560'])
    assert.equal(publishedAt(value), null);
});

test('gold fallback keeps the original source, location and source time and ignores future reports', () => {
  const missing = { ...fixture, title: '[TEST FIXTURE] missing gold',
    markdown: fixture.markdown.replaceAll('144,8 triệu đồng/lượng', 'Chưa xác minh') };
  const future = { ...fixture, cutoffAt: '2099-01-01T09:00:00+07:00' };
  const snapshot = marketSnapshot(missing, [future, fixture]);
  assert.equal(snapshot.gold_sjc.sell, 144.8);
  assert.equal(snapshot.gold_sjc.buy, 141.8);
  assert.equal(snapshot.gold_sjc.status, 'last_known');
  assert.equal(snapshot.gold_sjc.is_stale, true);
  assert.equal(snapshot.gold_sjc.report_date, fixture.reportDate);
  assert.match(snapshot.gold_sjc.product, /Hà Nội/);
  assert.match(snapshot.gold_sjc.time_text, /không nêu phút niêm yết/);
  assert.match(snapshot.gold_sjc.sources[0].url, /vietnamplus\.vn/);
  assert.equal(snapshot.gold_sjc.updated_at, null);
  assert.equal(snapshot.gold_sjc.change_pct, null);
  assert.equal(marketSnapshot(missing, []).gold_sjc.status, 'unavailable');
  assert.equal(marketSnapshot(missing, []).gold_sjc.sell, null);
});

test('RSS items cannot add off-domain, executable or credential-bearing links', () => {
  for (const link of ['javascript:alert(1)', 'https://vneconomy.vn.evil.invalid/news', 'https://user:pass@vneconomy.vn/news', 'http://vneconomy.vn/news'])
    assert.equal(cleanItem({ title: '[TEST FIXTURE]', link }, feed), null);
  assert.equal(cleanItem({ title: article.title, link: article.link, pubDate: article.published_at_raw }, feed).published_at, article.published_at);
});

test('fresh cache prevents network requests; invalid caches are discarded', async () => {
  const cache = { url: feed.url, checked_at: new Date(now - 1000).toISOString(), items: [article] };
  let requests = 0;
  const result = await readFeed(feed, cache, { now, fetcher: async () => { requests++; throw new Error('Must not fetch'); } });
  assert.equal(requests, 0);
  assert.equal(result.status.state, 'cached');
  assert.equal(result.cache.items[0].link, article.link);
  assert.equal(validCache({ ...cache, url: 'https://evil.invalid/' }, feed, now), null);
  assert.equal(validCache({ ...cache, checked_at: new Date(now + 1000).toISOString() }, feed, now), null);
  assert.equal(validCache({ ...cache, checked_at: '10/12/2026 10:00 AM' }, feed, now), null);
  assert.equal(validCache({ ...cache, items: [null] }, feed, now).items.length, 0);
});

test('real XML parser reads safe RSS and preserves declared source timestamps', async () => {
  const result = await readFeed(feed, null, {
    now,
    fetcher: async (url, options) => {
      assert.equal(url, feed.url);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
    }
  });
  assert.equal(result.status.state, 'ok');
  assert.equal(result.cache.items.length, 1);
  assert.equal(result.cache.items[0].published_at, article.published_at);
  assert.equal(result.cache.items[0].summary, 'Chính sách tiền tệ.');
});

test('RSS network, HTML, oversized payload and entity declaration failures keep validated old cache', async () => {
  const cache = { url: feed.url, checked_at: new Date(now - 60 * 60_000).toISOString(), items: [article] };
  const failures = [
    async () => { throw new Error('Network failed'); },
    async () => new Response('Unavailable', { status: 503 }),
    async () => new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html' } }),
    async () => new Response('<!DOCTYPE rss [<!ENTITY x "unsafe">]>' + xml, { headers: { 'Content-Type': 'text/xml' } }),
    async () => new Response('ắ'.repeat(210000), { headers: { 'Content-Type': 'text/xml' } })
  ];
  for (const fetcher of failures) {
    const result = await readFeed(feed, cache, { now, fetcher });
    assert.equal(result.status.state, 'error');
    assert.equal(result.cache.items[0].link, article.link);
    assert.equal(result.cache.checked_at, cache.checked_at);
  }
});

test('academic feed respects cutoff, removes duplicate links and labels heuristic connections', () => {
  const results = [{ status: { source: feed.name, state: 'ok' }, cache: { items: [
    article, article,
    { ...article, link: 'https://vneconomy.vn/future.htm', published_at: '2099-01-01T00:00:00Z' },
    { ...article, link: 'https://vneconomy.vn/old.htm', published_at: '2020-01-01T00:00:00Z' },
    { ...article, link: 'https://vneconomy.vn/unknown.htm', published_at: null },
    { ...article, title: '[TEST FIXTURE] unrelated sports', summary: '', link: 'https://vneconomy.vn/unrelated.htm' }
  ] } }];
  const result = academicItems(results, fixture);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].course_id, 'macroeconomics');
  assert.equal(result.articles[0].label, 'Unverified');
  assert.equal(result.articles[0].relevance_label, 'Analysis');
  assert.match(result.articles[0].academic_relevance, /cần đọc bài gốc/);
  assert.equal(result.status[0].excluded_time, 1);
});

test('writer preserves v2 metadata and refuses changed prices at an identical cutoff', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'newsletter-v2-test-'));
  try {
    await mkdir(path.join(directory, 'scripts'));
    await mkdir(path.join(directory, 'dist/data'), { recursive: true });
    for (const file of ['scripts/write-newsletter.mjs', 'dist/lib.mjs', 'dist/history.mjs'])
      await copyFile(new URL('../' + file, import.meta.url), path.join(directory, file));
    const report = { ...fixture, title: '[TEST FIXTURE] enriched report',
      meta: { version: '2.0', generated_at: new Date().toISOString(), timezone: fixture.timezone },
      market_snapshot: marketSnapshot(fixture, []), academic_feed: [] };
    const run = value => spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], {
      cwd: directory, input: JSON.stringify(value), encoding: 'utf8'
    });
    const first = run(report); assert.equal(first.status, 0, first.stderr);
    const target = path.join(directory, 'dist/data/latest.json');
    const before = await readFile(target, 'utf8');
    assert.deepEqual(JSON.parse(before).market_snapshot, report.market_snapshot);
    const repeat = run({ ...report, meta: { ...report.meta, generated_at: new Date().toISOString() } });
    assert.equal(repeat.status, 0, repeat.stderr);
    assert.equal(JSON.parse(repeat.stdout).unchanged, true);
    const changed = structuredClone(report); changed.market_snapshot.gold_sjc.sell += 1;
    const rejection = run(changed); assert.equal(rejection.status, 1);
    assert.equal(await readFile(target, 'utf8'), before);
  } finally { await rm(directory, { recursive: true }); }
});


test('enrichment CLI and writer publish v2 in isolation without fetching sources or changing the original markdown', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'newsletter-pipeline-test-'));
  try {
    await mkdir(path.join(directory, 'scripts'));
    await mkdir(path.join(directory, 'dist/data'), { recursive: true });
    for (const file of ['scripts/enrich-newsletter.mjs', 'scripts/write-newsletter.mjs',
      'dist/lib.mjs', 'dist/history.mjs', 'dist/dashboard.mjs', 'dist/intelligence-panel.mjs', 'dist/markdown.mjs'])
      await copyFile(new URL('../' + file, import.meta.url), path.join(directory, file));
    await symlink(fileURLToPath(new URL('../node_modules/', import.meta.url)), path.join(directory, 'node_modules'), 'dir');
    const cache = {
      vneconomy: { url: 'https://vneconomy.vn/tai-chinh.rss', checked_at: new Date().toISOString(), items: [] },
      chinhphu: { url: 'https://baochinhphu.vn/home.rss', checked_at: new Date().toISOString(), items: [] }
    };
    const prior = { ...fixture, feed_cache: cache };
    await writeFile(path.join(directory, 'dist/data/latest.json'), JSON.stringify(prior));
    const incoming = { ...fixture, title: '[TEST FIXTURE] isolated v2 pipeline',
      reportDate: '2026-10-13', cutoffAt: '2026-10-13T09:15:46+07:00',
      coverageStart: '2026-10-12T09:15:46+07:00', coverageEnd: '2026-10-13T09:15:46+07:00',
      markdown: fixture.markdown.replaceAll('144,8 triệu đồng/lượng', 'Chưa xác minh') };
    const generated = spawnSync(process.execPath, ['scripts/enrich-newsletter.mjs'], {
      cwd: directory, input: JSON.stringify(incoming), encoding: 'utf8'
    });
    assert.equal(generated.status, 0, generated.stderr);
    const output = JSON.parse(generated.stdout);
    assert.equal(output.markdown, incoming.markdown);
    assert.equal(output.meta.version, '2.0');
    assert.equal(output.market_snapshot.gold_sjc.status, 'last_known');
    assert.ok(output.source_status.rss.every(source => source.state === 'cached'));
    assert.equal(await readFile(path.join(directory, 'dist/data/latest.json'), 'utf8'), JSON.stringify(prior));
    const written = spawnSync(process.execPath, ['scripts/write-newsletter.mjs'], {
      cwd: directory, input: generated.stdout, encoding: 'utf8'
    });
    assert.equal(written.status, 0, written.stderr);
    const saved = JSON.parse(await readFile(path.join(directory, 'dist/data/latest.json'), 'utf8'));
    const archived = JSON.parse(await readFile(path.join(directory, 'dist/data/archive/2026-10-13.json'), 'utf8'));
    assert.deepEqual(saved.market_snapshot, output.market_snapshot);
    assert.equal(archived.markdown, incoming.markdown);
    assert.deepEqual(archived.academic_feed, output.academic_feed);
  } finally { await rm(directory, { recursive: true }); }
});
