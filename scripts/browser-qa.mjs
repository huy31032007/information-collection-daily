import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const modules = process.env.NEWSLETTER_QA_MODULES || '/Users/quanghuyvu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(require.resolve('playwright', { paths: [modules] }));
const baseURL = process.argv[2]; if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Use the actual local preview URL.');
const artifactDirectory = fileURLToPath(new URL('../qa-artifacts/', import.meta.url)); await mkdir(artifactDirectory, { recursive: true });
const report = JSON.parse(await readFile(new URL('../dist/data/latest.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() }); const results = { viewports: [], states: [], interactions: [] };
const ready = async page => { await page.waitForSelector('#section-9'); await page.waitForFunction(() => document.querySelector('#report-content').getAttribute('aria-busy') === 'false'); };
try {
  const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 360, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(baseURL); await ready(page);
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: document.querySelectorAll('.report-section').length, links: document.querySelectorAll('.section-body a').length, unsafeLinks: [...document.querySelectorAll('.section-body a')].filter(a => !/^https?:$/.test(new URL(a.href).protocol) || !a.rel.includes('noopener') || !a.rel.includes('noreferrer')).length, misplacedCells: [...document.querySelectorAll('.data-table td')].filter(td => td.children.length !== 1 || !td.firstElementChild.classList.contains('cell-value')).length }));
    assert.ok(geometry.scrollWidth <= width + 1, `Horizontal overflow at ${width}: ${geometry.scrollWidth}`); assert.equal(geometry.cards, 10); assert.equal(geometry.unsafeLinks, 0); assert.equal(geometry.misplacedCells, 0);
    results.viewports.push({ ...geometry, passed: true });
    if (width === 390 || width === 1280) await page.screenshot({ path: artifactDirectory + `top-${width}.png` });
    if (width === 390) { await page.locator('#section-2').scrollIntoViewIfNeeded(); await page.screenshot({ path: artifactDirectory + 'stocks-390.png' }); await page.locator('#section-9').scrollIntoViewIfNeeded(); await page.screenshot({ path: artifactDirectory + 'sources-390.png' }); }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator('[data-topic="3"]').click(); assert.equal(await page.locator('.report-section').count(), 1); assert.equal(await page.locator('#section-3').count(), 1);
  await page.locator('#source-filter').selectOption({ label: 'Kitco' }); assert.equal(await page.locator('.report-section').count(), 1);
  await page.locator('#search').fill('vang'); assert.equal(await page.locator('.report-section').count(), 1); results.interactions.push('topic/source/accent-insensitive search');
  await page.locator('#search').fill('no-such-financial-keyword'); assert.equal(await page.locator('.report-section').count(), 0); assert.equal(await page.locator('#no-results').isVisible(), true); results.states.push('filtered-empty');
  await page.locator('#reset-empty').click(); assert.equal(await page.locator('.report-section').count(), 10);
  await page.locator('#section-3 .section-body a').first().evaluate(node => node.setAttribute('data-focus-test', 'kept'));
  await page.locator('#section-3 .section-body a').first().focus();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(250);
  assert.equal(await page.locator('[data-focus-test="kept"]').count(), 1); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-focus-test')), 'kept'); results.interactions.push('unchanged refresh retains link DOM and keyboard focus');
  await page.setViewportSize({ width: 320, height: 900 }); const link = page.locator('#section-3 .section-body a').first(); await link.scrollIntoViewIfNeeded();
  const popupPromise = page.waitForEvent('popup'); await link.click(); const popup = await popupPromise;
  const requestedSource = await link.getAttribute('href'); assert.ok(requestedSource.startsWith('https://www.vietnamplus.vn/'));
  await popup.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  results.sourceNavigation = { requested: requestedSource, observed: popup.url(), externalLoadVerified: popup.url().startsWith('https://www.vietnamplus.vn/') };
  results.interactions.push('source link is clickable and opens a new tab from 320px'); await popup.close();
  assert.deepEqual(errors, [], 'Unexpected page errors on real content');

  const fixturePage = async (value, options = {}) => {
    const p = await browser.newPage({ viewport: { width: 320, height: 900 } });
    await p.route('**/data/latest.json', async route => { if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay)); await route.fulfill({ status: options.status || 200, contentType: 'application/json', body: options.raw ?? JSON.stringify(value) }); });
    return p;
  };
  const loading = await fixturePage(report, { delay: 900 }); await loading.goto(baseURL); assert.equal(await loading.locator('#refresh').isDisabled(), true); assert.ok((await loading.locator('#status').innerText()).includes('Đang tải')); await ready(loading); results.states.push('loading'); await loading.close();
  const empty = await fixturePage(null); await empty.goto(baseURL); await empty.waitForFunction(() => document.querySelector('#report-content').getAttribute('aria-busy') === 'false'); assert.equal(await empty.locator('#no-results').isVisible(), true); assert.equal(await empty.locator('#reset-empty').innerText(), 'Thử tải lại'); results.states.push('empty-no-placeholder'); await empty.close();
  const invalid = await fixturePage(null, { raw: '{broken json' }); await invalid.goto(baseURL); await invalid.waitForSelector('#status.error'); assert.equal(await invalid.locator('.report-section').count(), 0); results.states.push('invalid-data-error'); await invalid.close();
  const retained = await browser.newPage(); await retained.goto(baseURL); await ready(retained); await retained.route('**/data/latest.json', route => route.fulfill({ status: 503, body: 'unavailable' })); await retained.locator('#refresh').click(); await retained.waitForSelector('#status.error'); assert.equal(await retained.locator('.report-section').count(), 10); await retained.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await retained.waitForTimeout(150); assert.equal(await retained.locator('#status.error').count(), 1); results.states.push('refresh-error-retains-report-and-warning'); await retained.close();
  const staleReport = { ...report, reportDate: '2026-10-11', cutoffAt: '2026-10-11T09:15:46+07:00', coverageEnd: '2026-10-11T09:15:46+07:00', coverageStart: '2026-10-10T09:15:46+07:00' };
  const stale = await fixturePage(staleReport); await stale.goto(baseURL); await ready(stale); assert.ok((await stale.locator('#status').innerText()).includes('Chưa có bản tin hôm nay')); await stale.locator('#period-filter').selectOption('today'); assert.equal(await stale.locator('.report-section').count(), 0); results.states.push('stale-and-today-filter'); await stale.close();
  const injected = { ...report, markdown: report.markdown + '\n\n<img src=x onerror="window.__injected=true"> [unsafe](javascript:alert)\n' };
  const safe = await fixturePage(injected); await safe.goto(baseURL); await ready(safe); assert.equal(await safe.evaluate(() => Boolean(window.__injected)), false); assert.equal(await safe.locator('img[src="x"], a[href^="javascript:"]').count(), 0); results.states.push('untrusted-markdown-does-not-execute'); await safe.close();
  await writeFile(artifactDirectory + 'browser-results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} finally { await browser.close(); }
