import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSource, groupSources } from '../dist/source-catalog.mjs';

test('publisher role does not pretend to certify facts or demote company first-party prices', () => {
  assert.equal(describeSource('https://banggia.doji.vn/gold-price').role, 'company');
  assert.equal(describeSource('https://labs.petrolimex.com.vn/ndi/').role, 'company');
  assert.equal(describeSource('https://sbv.gov.vn/vi/trang-chu').role, 'authority');
  assert.equal(describeSource('https://web.vsd.vn/vi/').role, 'exchange');
  assert.equal(describeSource('https://www.pmi.spglobal.com/public/').role, 'research');
  const firm = describeSource('https://www.vndirect.com.vn/');
  assert.match(firm.note, /nhận định.*cần đối chiếu/);
  assert.equal('verified' in firm, false); assert.equal('tier' in firm, false);
});
test('redistributed wire articles and data repositories retain their provenance role', () => {
  const wire = describeSource('https://uk.marketscreener.com/news/example');
  assert.equal(wire.name, 'MarketScreener'); assert.equal(wire.role, 'aggregate');
  assert.equal(describeSource('https://fred.stlouisfed.org/series/DGS10').role, 'aggregate');
  assert.notEqual(wire.id, describeSource('https://reuters.com/world/').id);
});
test('lookalike domains stay unclassified and unsafe links never acquire a trusted badge', () => {
  for (const url of ['https://sbv.gov.vn.evil.example/', 'https://fake-sbv.gov.vn/', 'https://unknown.gov.vn/']) {
    const source = describeSource(url); assert.equal(source.role, 'unknown'); assert.equal(source.known, false);
  }
  for (const url of ['javascript:alert(1)','data:text/html,hello','//sbv.gov.vn/','https://user:password@sbv.gov.vn/','ftp://sbv.gov.vn/','bad url',undefined]) assert.equal(describeSource(url), null);
  assert.equal(describeSource('https://WWW.SBV.GOV.VN./').id, 'sbv');
});
test('source grouping merges publisher aliases but preserves every distinct original article URL', () => {
  const sources = [
    { href: 'https://uk.marketscreener.com/news/a', label: 'Reuters — vàng' },
    { href: 'https://www.marketscreener.com/news/b', label: 'Reuters — dầu' },
    { href: 'https://uk.marketscreener.com/news/a', label: 'Lặp' },
    { url: 'https://www.bls.gov/schedule/', name: 'BLS' },
    { href: 'javascript:alert(1)' }
  ];
  const before = JSON.stringify(sources), groups = groupSources(sources);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find(group => group.id === 'marketscreener').links.map(link => link.href), ['https://uk.marketscreener.com/news/a','https://www.marketscreener.com/news/b']);
  assert.equal(JSON.stringify(sources), before);
});
