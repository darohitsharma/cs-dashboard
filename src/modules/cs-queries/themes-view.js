import { fmt, pct } from './format.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function themesHtml(t, label = '') {
  if (!t) return '<div class="card"><p class="muted">No themes loaded. Connect the Google Sheet to build them.</p></div>';
  const qs = t.quarters;
  const lastQ = qs[qs.length - 1];
  return `<div class="banner">${label ? esc(label) + '. ' : ''}Keyword matches over customer remarks (${fmt(t.rowsUsed)} queries in this period, ${fmt(t.productRelated)} Product Related). A match means the words appear, not that the issue is confirmed. One query can match several themes, so shares do not add up. No match does not mean no issue. This is not a validated theme model. Example lines are shortened and automatically redacted; check them before sharing.</div>
  <div class="grid g2">${t.groups.map((g) => {
    const sorted = [...g.themes].sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...sorted.map((x) => x.n));
    return `<div class="card"><h3>${esc(g.label)}</h3>
      <div class="muted">${fmt(g.n)} queries in this sub-intent. ${pct(g.matchedAny / g.n, 0)} match at least one theme below, ${pct(1 - g.matchedAny / g.n, 0)} match none.</div>
      ${sorted.map((x) => {
        const ql = x.byQuarter[x.byQuarter.length - 1];
        return `<div class="theme"><div class="theme-row"><span>${esc(x.label)}</span><span><b>${fmt(x.n)}</b> <span class="muted">${pct(x.n / g.n, 1)} of ${esc(g.label.toLowerCase())}</span></span></div>
        <div class="bar"><i style="width:${(x.n / max * 100).toFixed(1)}%"></i></div>
        <details><summary class="muted">Where it shows up, sample lines (a match can be a loose mention)</summary>
          <div class="muted">Most matches by category: ${x.topCategories.map((c) => `${esc(c.category)} ${fmt(c.n)}`).join(', ') || 'none'}. Latest quarter (${esc(lastQ)}, may be partial): ${fmt(ql)} matches.</div>
          ${x.examples.map((e) => `<blockquote>${esc(e)}</blockquote>`).join('') || '<div class="muted">No example passed the redaction filter.</div>'}
        </details></div>`;
      }).join('')}
    </div>`;
  }).join('')}</div>`;
}
