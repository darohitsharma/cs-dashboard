// Public-build smoke test: engines run pack-driven, invariants hold, examples are privacy-filtered.
// Uses only invented rows and an invented settings pack. No real data anywhere. Run: npm test
import assert from 'node:assert/strict';
import { aggregate } from '../src/engine/aggregate.js';
import { themes } from '../src/engine/themes.js';
import { insights } from '../src/engine/insights.js';
import { readMainRows, readConfigPack } from '../src/data/sheetRead.js';

let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

const HEAD = ['Date', 'global_remark', 'first_intent', 'secondary_intent', 'Category', 'Concern', 'Status'];
const row = (date, remark, intent, sec, cat, concern = '', status = 'Existing') => [date, remark, intent, sec, cat, concern, status];
const rows = [
  HEAD,
  row('2026-08-05', 'how do I use alpha gel with beta', 'Product Related', 'product usage & performance', 'alpha gel', 'Usage', 'Existing'),
  row('2026-08-12', 'alpha gel turned my cloth orange and red', 'Product Related', 'product usage & performance', 'alpha gel', '', 'Existing'),
  row('2026-09-02', 'can I keep alpha gel in the fridge after opening', 'Product Related', 'product information & safety', 'alpha gel', '', 'Existing'),
  row('2026-09-11', 'my order was late and the box was broken and damaged', 'Delivery Related', '', 'Others', '', 'Untagged (Others)'),
  row('2026-09-20', 'pump spray nozzle not working on the bottle', 'Product Related', 'packaging', 'beta spray', '', 'Opportunity'),
  row('2026-10-01', 'which one suits my skin type best', 'Product Related', 'product recommendation', 'Others', '', 'Untagged (Others)'),
  row('2026-10-03', 'do you have a beta wash for kids', 'Product Related', 'product recommendation', 'Others', '', 'Untagged (Others)'),
  row('2026-10-09', 'alpha gel leak spill in transit, seal open', 'Product Related', 'packaging', 'alpha gel', '', 'Existing'),
];

const pack = {
  version: 1,
  themeDictionary: { groups: [
    { id: 'usage', label: 'Usage', secondary_intent: 'product usage & performance', themes: [{ id: 't1', label: 'Mentions alpha', any: ['alpha'] }] },
    { id: 'pack', label: 'Packaging', secondary_intent: 'packaging', themes: [{ id: 't2', label: 'Mentions leak', any: ['leak|spill'] }] },
  ] },
  insights: {
    categories: ['alpha gel'],
    productWords: 'alpha|beta',
    patterns: {
      seq: 'alpha[^.]{0,60}(before|after|gap)', orangeRed: 'orange|\\bred\\b', wantsDarker: 'want[^.]{0,30}dark',
      howLong: 'how long', runny: 'runny|watery', dryness: 'dry|itch',
      seqMix: 'mix|together', seqSolo: 'without alpha|only beta', seqGap: 'gap|next day',
      storage: 'fridge|refriger|store', shelfLife: 'shelf|expir', medical: 'pregnan',
      leak: 'leak|spill', pump: 'pump|spray|nozzle', broken: 'broke|damag', missing: 'missing|wrong', fungus: 'fung|mold',
      proof: 'wait\\w* for[^.]{0,25}image', hairFall: 'hair fall', greying: 'grey|gray', dandruff: 'dandruff',
      acne: 'acne|pimple', pigmentation: 'pigment|tan\\b', drySensitive: 'sensitive', report: 'report|scan',
      suits: 'which one[^.]{0,40}(best|suit)|suitable', restock: 'restock|out of stock',
      exMix: 'mix beta', exRange: '\\b(beta wash|kids)\\b',
    },
    rangeWords: ['beta wash', 'kids'],
    exampleLabels: {
      sequence: 'Asks sequence', orangeRed: 'Mentions orange or red', wantsDarker: 'Wants darker', mix: 'Mix', runny: 'Runny',
      storage: 'Storage', shelfLife: 'Shelf life', medical: 'Medical', leak: 'Leak', pump: 'Pump',
      broken: 'Broken', missing: 'Missing', fungus: 'Fungus', hairFall: 'Hair fall', acne: 'Acne',
      pigmentation: 'Pigmentation', suits: 'Suits', range: 'Range ask',
    },
  },
  strings: { s1Title: 'Section one', read1Tpl: 'seq {seq} orange {orange} mix {mix} gap {gap}' },
};

// 1. aggregate runs and totals are consistent
const { out } = aggregate(rows, { source: 'smoke fixture' });
const total = out.monthly.counts.reduce((s, x) => s + x, 0);
ok(total === rows.length - 1, 'aggregate total = data rows');
ok(out.primary['Product Related'].reduce((s, x) => s + x, 0) === 7, 'Product Related count');

// 2. themes runs against the pack dictionary
const th = themes(rows, pack.themeDictionary);
ok(th.periods.all.groups[0].n === 2, 'usage group rows');
ok(th.periods.all.groups[0].themes[0].n === 2, 'alpha theme matches');
ok(th.periods.all.groups[1].themes[0].n === 1, 'leak theme matches');

// 3. insights runs against the pack patterns
const ins = insights(rows, pack.insights);
const A = ins.periods.all;
ok(A.colour.denominator === 2, 'colour denominator');
ok(A.productInfo.denominator === 1, 'info denominator');
ok(A.packaging.denominator === 2, 'packaging denominator');
ok(A.recommendation.denominator === 2, 'recommendation denominator');
for (const sec of ['colour', 'productInfo', 'packaging', 'recommendation']) {
  const d = A[sec].denominator;
  for (const line of A[sec].lines) ok(line.n <= d, `${sec}.${line.id} exceeds its base`);
}
ok(A.recommendation.range.length === 2, 'range words from pack');
ok(A.recommendation.range.every((x) => pack.insights.rangeWords.includes(x.word)), 'range words match pack');

// 4. example lines never carry digits or contact words (privacy filter)
for (const p of Object.values(ins.periods)) {
  for (const sec of ['colour', 'productInfo', 'packaging', 'recommendation']) {
    for (const ex of p[sec].examples) {
      ok(!/\d|@|http/i.test(ex.text), `example leaked contact/order text: ${ex.text}`);
    }
  }
}
for (const p of Object.values(th.periods)) {
  for (const g of p.groups) for (const t of g.themes) for (const e of t.examples) {
    ok(!/\d|@|http/i.test(e), `theme example leaked: ${e}`);
  }
}

// 5. sheet readers work against a fake Sheets API (no network)
const letters = { A: 0, B: 1, D: 2, E: 3, F: 4, G: 5, H: 6 };
globalThis.fetch = async (url, opt) => {
  assert.equal(opt.headers.Authorization, 'Bearer T');
  const u = new URL(url);
  if (u.pathname.includes('/values/')) {
    const cell = JSON.stringify(pack);
    return { ok: true, status: 200, json: async () => ({ values: [[cell.slice(0, 9000)], [cell.slice(9000)]] }) }; // split across two cells
  }
  const valueRanges = u.searchParams.getAll('ranges').map((r) => {
    const m = r.match(/^Main!([A-Z])(\d+):[A-Z](\d+)$/); const col = letters[m[1]]; const a = +m[2], b = +m[3];
    const vals = rows.slice(a - 1, b).map((x) => x[col]);
    return vals.length ? { values: [vals] } : {};
  });
  return { ok: true, status: 200, json: async () => ({ valueRanges }) };
};
const gotRows = await readMainRows('T', 'fake-sheet-id');
ok(gotRows.length === rows.length, 'readMainRows row count');
ok(gotRows[1][1] === rows[1][1], 'readMainRows content');
const gotPack = await readConfigPack('T', 'fake-sheet-id');
ok(JSON.stringify(gotPack) === JSON.stringify(pack), 'config pack survives the two-cell join');

console.log(`smoke: ${checks} checks passed`);
