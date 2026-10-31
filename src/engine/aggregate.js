// Main rows (array of arrays, header first) -> cs-summary JSON. Labels (Category, Concern, Status) are used exactly as given. No tagging.
export function aggregate(rows, { mdy = false, priority = {}, source = '' } = {}) {
const MDY = mdy;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const head = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => {
  const i = head.indexOf(name.toLowerCase());
  if (i < 0) throw new Error(`Missing column: ${name}`);
  return i;
};
const iD = col('date'), iP = col('first_intent'), iS = col('secondary_intent'), iC = col('category'), iK = col('concern'), iT = col('status');

// Dates: ISO (2026-09-05, optional time), "Sep 5, 2026" (the Sheets export format), or day-first 05/09/2026 (default).
// Pass --mdy as 4th argument for month-first. Anything else is skipped and counted.
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

const monthly = zero(), primary = {}, secondary = {}, status = {}, cats = {}, catsPR = {}, concern = { specific: zero(), generic: zero() };
for (const r of recs) {
  const i = at(r);
  monthly[i]++;
  if (r.k && r.k !== 'Others') (r.k === 'Generic Concern' ? concern.generic : concern.specific)[i]++;
  if (r.p) (primary[r.p] ||= zero())[i]++;
  if (r.p === 'Product Related' && r.s) (secondary[r.s] ||= zero())[i]++;
  (status[r.t.trim()] ||= zero())[i]++;
  if (r.p === 'Product Related') (catsPR[r.c || 'Others'] ||= zero())[i]++; // category inside Product Related, Others included
  if (r.c && r.c !== 'Others') {
    const o = (cats[r.c] ||= { status: r.t.trim(), monthly: zero() });
    o.monthly[i]++;
  }
}

const qLabel = (y, m) => `${y}-Q${Math.floor(m / 3) + 1}`;
const quarters = [...new Set(recs.map((r) => qLabel(r.y, r.m)))].sort();
const cc = {};
for (const r of recs) {
  if (!r.c || !r.k) continue;
  const key = `${r.c}||${r.k}`;
  (cc[key] ||= quarters.map(() => 0))[quarters.indexOf(qLabel(r.y, r.m))]++;
}
let PRI = priority || {};
const catConcern = { quarters, rows: [] };
const tot = {};
for (const [key, q] of Object.entries(cc)) {
  const [category, concern] = key.split('||');
  catConcern.rows.push({ category, concern, priority: PRI[category] || null, q });
  (tot[category] ||= quarters.map(() => 0)).forEach((_, i) => (tot[category][i] += q[i]));
}
for (const [category, q] of Object.entries(tot)) catConcern.rows.push({ category, concern: '__total__', priority: PRI[category] || null, q });

// Top 75% concerns per category: concerns (excluding Others and Generic Concern) that together make up 75% of that category's tagged concerns.
const catConcernTop = { quarters, rows: [] };
for (const category of Object.keys(tot)) {
  const rs = catConcern.rows.filter((r) => r.category === category && r.concern !== '__total__' && r.concern !== 'Others' && r.concern !== 'Generic Concern').sort((x, y) => y.q.reduce((a, b) => a + b, 0) - x.q.reduce((a, b) => a + b, 0));
  const all = rs.reduce((a, r) => a + r.q.reduce((x, y) => x + y, 0), 0);
  let run = 0;
  for (const r of rs) { if (all && run / all >= 0.75) break; catConcernTop.rows.push(r); run += r.q.reduce((x, y) => x + y, 0); }
  if (rs.length) catConcernTop.rows.push(catConcern.rows.find((r) => r.category === category && r.concern === '__total__'));
}
const out = { meta: { source, rows: recs.length }, months, monthly: { months, counts: monthly }, primary, secondary, categories: cats, categoriesPR: catsPR, concern, status, catConcern, catConcernTop };
return { out, info, used: recs.length };
}
