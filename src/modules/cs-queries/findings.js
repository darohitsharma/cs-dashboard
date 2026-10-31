import { fmt, pct, sum } from './format.js';

// Findings about WHAT customers ask and HOW they are classified. Every figure is computed from the loaded data.
// Nothing here comments on volume going up or down.
export function buildFindings(d, themes, mode = 'all') {
  const out = [];
  const total = sum(d.monthly.counts);
  const prim = Object.fromEntries(Object.entries(d.primary).map(([k, v]) => [k, sum(v)]));
  const pr = prim['Product Related'] || 0;
  const facts = [];
  // Every share goes through here: the numerator must be a part of the denominator, or the line is wrong.
  const share = (x, t = total) => { facts.push({ x, t }); if (x > t + 1e-9) throw new Error(`Share check failed: ${x} is more than its base ${t}`); return t ? pct(x / t, 1) : 'n/a'; };

  out.push({ k: 'Why they wrote', text: `Delivery Related plus Order Related is ${share((prim['Delivery Related'] || 0) + (prim['Order Related'] || 0))} of all ${fmt(total)} queries. Product Related is ${share(pr)} (${fmt(pr)}).` });

  const sec = Object.fromEntries(Object.entries(d.secondary).map(([k, v]) => [k, sum(v)]));
  const secTotal = sum(Object.values(sec));
  const g = (k) => sec[k] || 0;
  const hes = g('product usage & performance') + g('product information & safety') + g('regime request');
  if (secTotal) out.push({ k: 'Inside Product Related', text: `Of the ${fmt(pr)} Product Related queries, ${fmt(secTotal)} (${share(secTotal, pr)}) have a secondary intent in Main. Among those ${fmt(secTotal)}: usage & performance, product information & safety and regime requests together are ${share(hes, secTotal)} (${fmt(hes)}), and product recommendation alone is ${share(g('product recommendation'), secTotal)} (${fmt(g('product recommendation'))}).` });

  // Status labels exactly as given in the Main sheet. They are upstream labels, not a catalogue check.
  // Row-level: count rows whose own Status label matches, grouped by their category (category buckets can mix statuses).
  const byStatus = (st) => Object.entries((d.statusCat || {})[st] || {}).map(([k, v]) => [k, sum(v)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const opp = byStatus('Opportunity');
  if (opp.length) {
    const t = sum(opp.map((x) => x[1]));
    const top3 = opp.slice(0, 3).map(([k, v]) => `${k} ${fmt(v)} (${share(v, t)})`).join(', ');
    out.push({ k: 'Status "Opportunity" (as labelled in Main)', text: `${fmt(t)} queries (${share(t)} of all queries) carry the Main status "Opportunity". Top categories (share of these ${fmt(t)}): ${top3}. This is the sheet's own label. It is not proof that a product is missing from the range, and it is not measured demand.` });
  }

  // Concern coverage: specific concerns and Generic Concern are kept apart
  const cs = d.concern ? sum(d.concern.specific) : null, cg = d.concern ? sum(d.concern.generic) : null;
  if (cs != null) out.push({ k: 'Tagging coverage', text: `${share(cs)} of queries carry a specific concern (${fmt(cs)}). Another ${fmt(cg)} (${share(cg)}) are labelled Generic Concern, and the rest have none. Category is Others / unmapped for ${share(sum(d.status['Untagged (Others)'] || []), total)} of queries. Others is the sheet\'s own label; this page does not know why.` });
  out.push({ k: 'Data note', text: 'Category, concern, status and intent counts use the Main sheet labels exactly as supplied (nothing is re-tagged). Theme counts use the remark text of the same rows.' });

  // Theme-based (keyword matches)
  if (themes) {
    themes.groups.forEach((gr) => {
      const top = [...gr.themes].sort((a, b) => b.n - a.n).filter((t) => t.id !== 'routine_ask');
      if (!gr.n || !top.length) return;
      out.push({ k: gr.label, text: `Keyword matches in ${fmt(gr.n)} queries: ${top.slice(0, 3).map((t) => `${t.label} ${fmt(t.n)} (${pct(t.n / gr.n, 1)})`).join('; ')}. ${pct(1 - gr.matchedAny / gr.n, 0)} matched none of the listed themes.`, theme: true });
    });
  }
  out.facts = facts;
  return out;
}
