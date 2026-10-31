// Main rows (array of arrays, header first) -> cs-insights JSON. Counts and redacted examples only.
export function insights(rows, cfg) {
if (!cfg || !cfg.patterns) throw new Error('insights needs the runtime pattern pack (Dashboard_Config).');
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(v) {
  const t = (v || '').trim(); let m, y, mo;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; }
  else if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/))) { mo = MON.indexOf(m[1].toLowerCase()) + 1; y = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) { y = +m[3]; mo = +m[2]; }
  else return null;
  return mo >= 1 && mo <= 12 ? { y, mo } : null;
}

const head = rows[0].map((h) => h.trim().toLowerCase());
const ix = (n) => head.indexOf(n);
const [iD, iR, iP, iS, iC] = ['date', 'global_remark', 'first_intent', 'secondary_intent', 'category'].map(ix);
const R = (s) => new RegExp(s, 'i');
const qkey = (d) => `${d.y}-Q${Math.floor((d.mo - 1) / 3) + 1}`;
const ALL = [];
for (const r of rows.slice(1)) {
  if (r.length < head.length || r[iP].trim() !== 'Product Related') continue;
  const d = parseDate(r[iD]); if (!d) continue;
  ALL.push({ t: r[iR], sec: r[iS].trim().toLowerCase(), cat: r[iC].trim().toLowerCase(), q: qkey(d), mi: d.y * 12 + d.mo - 1 });
}
// Latest month in the data decides what "last 3 months" means (not today's date).
const latest = ALL.reduce((m, r) => Math.max(m, r.mi), 0);
const earliest = ALL.reduce((m, r) => Math.min(m, r.mi), 1e9);
const MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ml = (mi) => `${MONN[mi % 12]} ${Math.floor(mi / 12)}`;
const PERIODS = {
  all: { label: `Overall (${ml(earliest)} to ${ml(latest)})`, f: () => true },
  last3: { label: latest - earliest >= 2 ? `Last 3 months (${ml(latest - 2)} to ${ml(latest)})` : `Last ${latest - earliest + 1} month(s), the only ones in the data (${ml(earliest)} to ${ml(latest)})`, f: (r) => r.mi > latest - 3 },
  prev3: { label: earliest <= latest - 3 ? `Previous 3 months (${ml(Math.max(latest - 5, earliest))} to ${ml(latest - 3)})${earliest > latest - 5 ? ', fewer than 3 months of data' : ''}` : 'Previous 3 months (no earlier data)', f: (r) => r.mi > latest - 6 && r.mi <= latest - 3 },
};
// Example lines: only lines with no digit, contact word, name-like word or family word, picked by a fixed hash.
const unsafe = /\d|@|http|order|nh-|awb|pincode|address|my name|this is|i am |year|yr|\bson\b|daughter|husband|wife|mother|mom\b|\b(mr|mrs|ms|miss|dear|sir|madam|ma'?am)\b|\bcx\b|customer/i;
const okEx = (s) => !/[√¢¬Ãâ]/.test(s) && s.length >= 25 && s.length <= 140 && !unsafe.test(s);
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const examples = (seg, lines, per = 2, max = 6) => {
  const out = []; const seen = new Set();
  for (const [id, label, pat] of lines) {
    const rx = R(pat);
    const c = seg.filter((r) => rx.test(r.t)).map((r) => r.t.replace(/\s+/g, ' ').trim()).filter((t) => okEx(t) && !seen.has(t) && seen.add(t)).sort((a, b) => hash(a) - hash(b)).slice(0, per);
    c.forEach((text) => out.push({ line: label, text }));
  }
  return out.slice(0, max);
};
const count = (seg, pats) => Object.entries(pats).map(([id, p]) => { const rx = R(p); return { id, n: seg.filter((r) => rx.test(r.t)).length }; });

const L = cfg.patterns, HC = cfg.categories, PRODUCT_WORDS = cfg.productWords, exL = cfg.exampleLabels;

function compute(PR) {
  const colour = PR.filter((r) => r.sec.startsWith('product usage') && HC.includes(r.cat));
  const seqRx = R(L.seq); const seq = colour.filter((r) => seqRx.test(r.t));
  const hi = PR.filter((r) => r.sec.startsWith('product information') && HC.includes(r.cat));
  const pack = PR.filter((r) => r.sec.startsWith('packaging'));
  const rec = PR.filter((r) => r.sec === 'product recommendation');
  const quarters = [...new Set(PR.map((r) => r.q))].sort();
  const o = { productRelated: PR.length, quarters };
  o.colour = { denominator: colour.length,
    lines: count(colour, { sequence: L.seq, orangeRed: L.orangeRed, wantsDarker: L.wantsDarker, howLong: L.howLong, runny: L.runny, dryness: L.dryness }),
    sequenceSplit: { total: seq.length, lines: count(seq, { seqMix: L.seqMix, seqSolo: L.seqSolo, seqGap: L.seqGap }) },
    sequenceByQuarter: quarters.map((q) => { const s = colour.filter((r) => r.q === q); return { q, n: s.length, seq: s.filter((r) => seqRx.test(r.t)).length }; }),
    examples: examples(colour, [['sequence', exL.sequence, L.seq], ['orangeRed', exL.orangeRed, L.orangeRed], ['wantsDarker', exL.wantsDarker, L.wantsDarker], ['mix', exL.mix, L.exMix], ['runny', exL.runny, L.runny]], 1, 6) };
  o.productInfo = { denominator: hi.length, lines: count(hi, { storage: L.storage, shelfLife: L.shelfLife, medical: L.medical }),
    examples: examples(hi, [['storage', exL.storage, L.storage], ['shelfLife', exL.shelfLife, L.shelfLife], ['medical', exL.medical, L.medical]], 2, 6) };
  const byCat = [...new Set(pack.map((r) => r.cat))].map((c) => { const s = pack.filter((r) => r.cat === c); return { cat: c, n: s.length, ...Object.fromEntries(['leak', 'pump', 'broken', 'missing', 'fungus'].map((k) => [k, s.filter((r) => R(L[k]).test(r.t)).length])) }; }).sort((a, b) => b.n - a.n).slice(0, 14);
  o.packaging = { denominator: pack.length,
    proofWaiting: pack.filter((r) => R(L.proof).test(r.t)).length,
    categoryOthers: pack.filter((r) => r.cat === 'others').length,
    othersNoProductWord: pack.filter((r) => r.cat === 'others' && !R(PRODUCT_WORDS).test(r.t)).length,
    pumpMentions: pack.filter((r) => R(L.pump).test(r.t)).length,
    lines: count(pack, { leak: L.leak, pump: L.pump, broken: L.broken, missing: L.missing, fungus: L.fungus }),
    byCategory: byCat,
    byQuarter: quarters.map((q) => { const s = pack.filter((r) => r.q === q); return { q, productRelated: PR.filter((r) => r.q === q).length, n: s.length, leak: s.filter((r) => R(L.leak).test(r.t)).length }; }),
    examples: examples(pack, [['leak', exL.leak, L.leak], ['pump', exL.pump, L.pump], ['broken', exL.broken, L.broken], ['missing', exL.missing, L.missing], ['fungus', exL.fungus, L.fungus]], 1, 6) };
  o.recommendation = { denominator: rec.length,
    lines: count(rec, { hairFall: L.hairFall, greying: L.greying, dandruff: L.dandruff, acne: L.acne, pigmentation: L.pigmentation, drySensitive: L.drySensitive, report: L.report, suits: L.suits, restock: L.restock }),
    range: cfg.rangeWords.map((w) => ({ word: w, n: rec.filter((r) => R('\\b' + w + '\\b').test(r.t)).length })),
    examples: examples(rec, [['hairFall', exL.hairFall, L.hairFall], ['acne', exL.acne, L.acne], ['pigmentation', exL.pigmentation, L.pigmentation], ['suits', exL.suits, L.suits], ['range', exL.range, L.exRange]], 1, 6) };
  return o;
}
const out = {
  note: 'Keyword matches over customer remarks: what customers mention, not confirmed causes. A remark can match several lines. No match does not mean no issue.',
  latestMonth: ml(latest),
  periodLabels: Object.fromEntries(Object.entries(PERIODS).map(([k, v]) => [k, v.label])),
  periods: Object.fromEntries(Object.entries(PERIODS).map(([k, v]) => [k, compute(ALL.filter(v.f))])),
};
return out;
}
