function aggregate(rows, { mdy = false, priority = {}, source = '' } = {}) {
const MDY = mdy;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const head = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => {
  const i = head.indexOf(name.toLowerCase());
  if (i < 0) throw new Error(`Missing column: ${name}`);
  return i;
};
const iD = col('date'), iP = col('first_intent'), iS = col('secondary_intent'), iC = col('category'), iK = col('concern'), iT = col('status');

function parseDate(v) {
  const t = (v || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  let y, mo, d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T].*)?$/))) {
    [y, mo, d] = MDY ? [+m[3], +m[1], +m[2]] : [+m[3], +m[2], +m[1]];
  } else if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/))) {
    mo = MON.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) + 1;
    [y, d] = [+m[3], +m[2]];
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo - 1 };
}
const recs = [];
const skipped = { badDate: 0, shortRow: 0 };
let blankStatus = 0;
for (const r of rows.slice(1)) {
  if (r.length < head.length) { skipped.shortRow++; continue; }
  const dt = parseDate(r[iD]);
  if (!dt) { skipped.badDate++; continue; }
  if (!(r[iT] || '').trim()) blankStatus++;
  recs.push({
    y: dt.y, m: dt.m,
    p: (r[iP] || '').trim(), s: (r[iS] || '').trim().toLowerCase(),
    c: (r[iC] || '').trim(), k: (r[iK] || '').trim(), t: (r[iT] || '').trim() || 'Untagged (Others)',
  });
}
const info = `Read ${rows.length - 1} rows: ${recs.length} used, skipped ${skipped.badDate} bad date, ${skipped.shortRow} short rows; ${blankStatus} blank Status counted as Untagged (Others).`;
if (!recs.length) throw new Error('No rows with a valid Date');

const keys = [...new Set(recs.map((r) => r.y * 12 + r.m))].sort((a, b) => a - b);
const first = keys[0], lastK = keys[keys.length - 1];
const monthIdx = [];
for (let k = first; k <= lastK; k++) monthIdx.push(k);
const months = monthIdx.map((k) => `${MON[k % 12]}-${Math.floor(k / 12)}`);
const at = (r) => r.y * 12 + r.m - first;
const zero = () => monthIdx.map(() => 0);

const monthly = zero(), primary = {}, secondary = {}, status = {}, statusCat = {}, cats = {}, catsPR = {}, concern = { specific: zero(), generic: zero() };
for (const r of recs) {
  const i = at(r);
  monthly[i]++;
  if (r.k && r.k !== 'Others') (r.k === 'Generic Concern' ? concern.generic : concern.specific)[i]++;
  if (r.p) { primary[r.p] = primary[r.p] || zero(); primary[r.p][i]++; }
  if (r.p === 'Product Related' && r.s) { secondary[r.s] = secondary[r.s] || zero(); secondary[r.s][i]++; }
  status[r.t.trim()] = status[r.t.trim()] || zero(); status[r.t.trim()][i]++;
  var __st = r.t.trim(); statusCat[__st] = statusCat[__st] || {}; var __sc = statusCat[__st]; var __k = r.c || 'Others'; __sc[__k] = __sc[__k] || zero(); __sc[__k][i]++;
  if (r.p === 'Product Related') { var __k2 = r.c || 'Others'; catsPR[__k2] = catsPR[__k2] || zero(); catsPR[__k2][i]++; } // category inside Product Related, Others included
  if (r.c && r.c !== 'Others') {
    cats[r.c] = cats[r.c] || { status: r.t.trim(), monthly: zero() }; const o = cats[r.c];
    o.monthly[i]++;
  }
}

const qLabel = (y, m) => `${y}-Q${Math.floor(m / 3) + 1}`;
const quarters = [...new Set(recs.map((r) => qLabel(r.y, r.m)))].sort();
const cc = {};
for (const r of recs) {
  if (!r.c || !r.k) continue;
  const key = `${r.c}||${r.k}`;
  cc[key] = cc[key] || quarters.map(() => 0); cc[key][quarters.indexOf(qLabel(r.y, r.m))]++;
}
let PRI = priority || {};
const catConcern = { quarters, rows: [] };
const tot = {};
for (const [key, q] of Object.entries(cc)) {
  const [category, concern] = key.split('||');
  catConcern.rows.push({ category, concern, priority: PRI[category] || null, q });
  tot[category] = tot[category] || quarters.map(() => 0); tot[category].forEach((_, i) => (tot[category][i] += q[i]));
}
for (const [category, q] of Object.entries(tot)) catConcern.rows.push({ category, concern: '__total__', priority: PRI[category] || null, q });

const catConcernTop = { quarters, rows: [] };
for (const category of Object.keys(tot)) {
  const rs = catConcern.rows.filter((r) => r.category === category && r.concern !== '__total__' && r.concern !== 'Others' && r.concern !== 'Generic Concern').sort((x, y) => y.q.reduce((a, b) => a + b, 0) - x.q.reduce((a, b) => a + b, 0));
  const all = rs.reduce((a, r) => a + r.q.reduce((x, y) => x + y, 0), 0);
  let run = 0;
  for (const r of rs) { if (all && run / all >= 0.75) break; catConcernTop.rows.push(r); run += r.q.reduce((x, y) => x + y, 0); }
  if (rs.length) catConcernTop.rows.push(catConcern.rows.find((r) => r.category === category && r.concern === '__total__'));
}
const out = { meta: { source, rows: recs.length }, months, monthly: { months, counts: monthly }, primary, secondary, categories: cats, categoriesPR: catsPR, concern, status, statusCat, catConcern, catConcernTop };
return { out, info, used: recs.length };
}


function themes(rows, dict) {
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(v) {
  const t = (v || '').trim(); let m, y, mo;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; }
  else if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/))) { mo = MON.indexOf(m[1].toLowerCase()) + 1; y = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) { y = +m[3]; mo = +m[2]; }
  else return null;
  return mo >= 1 && mo <= 12 ? { y, mo } : null;
}
const redact = (s) => s
  .replace(/https?:\/\/\S+/gi, ' ').replace(/\S+@\S+/g, ' ').replace(/\+?\d[\d\s-]{6,}\d/g, ' ')
  .replace(/\s+/g, ' ').trim();
const safeExample = (s) => !/[√¢¬Ãâ]/.test(s) && s.length >= 25 && s.length <= 140 && !/\d|@|http|order|nh-|awb|year|yr|\bson\b|daughter|my (kid|baby|child)|husband|wife|mother|mom\b|pincode|address|my name|this is|i am |\b(mr|mrs|ms|miss|dear|sir|madam|ma'?am)\b/i.test(s) && !/\bcx\b/i.test(s);
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

const head = rows[0].map((h) => h.trim().toLowerCase());
const ix = (n) => { const i = head.indexOf(n); if (i < 0) throw new Error('Missing column ' + n); return i; };
const [iD, iR, iP, iS, iC] = ['date', 'global_remark', 'first_intent', 'secondary_intent', 'category'].map(ix);

const compile = (t) => ({ ...t, all: (t.all || []).map((r) => new RegExp(r, 'i')), any: (t.any || []).map((r) => new RegExp(r, 'i')) });
const hit = (t, s) => (t.all.length ? t.all.every((r) => r.test(s)) : true) && (t.any.length ? t.any.some((r) => r.test(s)) : true);
const qkey = (d) => `${d.y}-Q${Math.floor((d.mo - 1) / 3) + 1}`;
const MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const recs = []; let skippedDate = 0;
for (const r of rows.slice(1)) {
  if (r.length < head.length) continue;
  const d = parseDate(r[iD]); if (!d) { skippedDate++; continue; }
  recs.push({ d, mi: d.y * 12 + d.mo - 1, intent: r[iP].trim(), sec: r[iS].trim().toLowerCase(), text: r[iR], cat: r[iC].trim() || 'Others' });
}
const latest = recs.reduce((m, r) => Math.max(m, r.mi), 0);
const earliest = recs.reduce((m, r) => Math.min(m, r.mi), 1e9);
const mlabel = (mi) => `${MONN[mi % 12]} ${Math.floor(mi / 12)}`;
const PERIODS = { all: () => true, last3: (r) => r.mi > latest - 3 };

function compute(filter) {
  const groups = dict.groups.map((g) => ({ ...g, themes: g.themes.map(compile), n: 0, matched: 0, stats: {} }));
  const quarters = new Set(); const exCandidates = {}; let used = 0, productRelated = 0;
  for (const r of recs) {
    if (!filter(r)) continue;
    used++;
    if (r.intent !== 'Product Related') continue;
    productRelated++;
    const g = groups.find((x) => x.secondary_intent === r.sec); if (!g) continue;
    const q = qkey(r.d); quarters.add(q);
    g.n++;
    let any = false;
    for (const t of g.themes) {
      if (!hit(t, r.text)) continue;
      any = true;
      g.stats[t.id] = g.stats[t.id] || { n: 0, q: {}, cat: {} }; const s = g.stats[t.id];
      s.n++; s.q[q] = (s.q[q] || 0) + 1; s.cat[r.cat] = (s.cat[r.cat] || 0) + 1;
      const clean = redact(r.text);
      if (safeExample(clean)) { const k = g.id + '/' + t.id; exCandidates[k] = exCandidates[k] || []; exCandidates[k].push(clean); }
    }
    if (any) g.matched++;
  }
  const qs = [...quarters].sort();
  return {
    rowsUsed: used, productRelated, quarters: qs,
    groups: groups.map((g) => ({
      id: g.id, label: g.label, secondaryIntent: g.secondary_intent, n: g.n, matchedAny: g.matched,
      themes: g.themes.map((t) => {
        const s = g.stats[t.id] || { n: 0, q: {}, cat: {} };
        const ex = (exCandidates[g.id + '/' + t.id] || []).slice().sort((a, b) => hash(a) - hash(b)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);
        return { id: t.id, label: t.label, n: s.n, byQuarter: qs.map((q) => s.q[q] || 0), topCategories: Object.entries(s.cat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => ({ category: c, n })), examples: ex };
      }),
    })),
  };
}
const out = {
  note: 'Keyword matches over customer remarks. A match means the words appear, not that the issue is confirmed. A remark can match more than one theme, so shares do not add up. No match does not mean no issue. Not a validated theme model. Examples are shortened, heuristically redacted, and picked deterministically.',
  rowsRead: rows.length - 1, rowsSkippedDate: skippedDate, latestMonth: mlabel(latest),
  periodLabels: { last3: latest - earliest >= 2 ? `Last 3 months (${mlabel(latest - 2)} to ${mlabel(latest)})` : `Last ${latest - earliest + 1} month(s), the only ones in the data (${mlabel(earliest)} to ${mlabel(latest)})`, all: `Overall (${mlabel(earliest)} to ${mlabel(latest)})` },
  periods: Object.fromEntries(Object.entries(PERIODS).map(([k, f]) => [k, compute(f)])),
};
return out;
}


function insights(rows, cfg) {
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
const latest = ALL.reduce((m, r) => Math.max(m, r.mi), 0);
const earliest = ALL.reduce((m, r) => Math.min(m, r.mi), 1e9);
const MONN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ml = (mi) => `${MONN[mi % 12]} ${Math.floor(mi / 12)}`;
const PERIODS = {
  all: { label: `Overall (${ml(earliest)} to ${ml(latest)})`, f: () => true },
  last3: { label: latest - earliest >= 2 ? `Last 3 months (${ml(latest - 2)} to ${ml(latest)})` : `Last ${latest - earliest + 1} month(s), the only ones in the data (${ml(earliest)} to ${ml(latest)})`, f: (r) => r.mi > latest - 3 },
  prev3: { label: earliest <= latest - 3 ? `Previous 3 months (${ml(Math.max(latest - 5, earliest))} to ${ml(latest - 3)})${earliest > latest - 5 ? ', fewer than 3 months of data' : ''}` : 'Previous 3 months (no earlier data)', f: (r) => r.mi > latest - 6 && r.mi <= latest - 3 },
};
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
