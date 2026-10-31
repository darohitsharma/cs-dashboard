// Main rows (array of arrays, header first) -> cs-themes JSON. Counts and redacted examples only.
export function themes(rows, dict) {
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
// An example is only shown if it has no digit run, no address-like word and no self-introduction.
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
      const s = (g.stats[t.id] ||= { n: 0, q: {}, cat: {} });
      s.n++; s.q[q] = (s.q[q] || 0) + 1; s.cat[r.cat] = (s.cat[r.cat] || 0) + 1;
      const clean = redact(r.text);
      if (safeExample(clean)) { const k = g.id + '/' + t.id; (exCandidates[k] ||= []).push(clean); }
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
