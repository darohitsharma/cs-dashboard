import { Chart, registerables } from 'chart.js';
import { loadCsSummary, loadCsThemes, loadCsInsights } from '../../data/adapter.js';
import { getLive, getSheetId, setSheetId } from '../../data/sheetSource.js';
import { buildFindings } from './findings.js';
import { themesHtml } from './themes-view.js';
import { insightsHtml } from './insights-view.js';
import { fmt, pct, chg, chgText, sum, slice, COLORS } from './format.js';

Chart.register(...registerables);
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.font.size = 12;

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tagLabel = { observed: 'Observed', hypothesis: 'Possible reason, not tested', action: 'Suggested action', check: 'Data check' };
const cls = { observed: 'obs', hypothesis: 'hyp', action: 'act', check: 'chk' };
const tagCls = { observed: 'observed', hypothesis: 'hypothesis', action: 'action', check: 'check' };

function insightList(items) {
  if (!items.length) return '<p class="muted">Nothing to flag.</p>';
  return items
    .map((i) => `<div class="insight ${cls[i.kind]}"><span class="tag ${tagCls[i.kind]}">${tagLabel[i.kind]}</span>${esc(i.text)}</div>`)
    .join('');
}

function kpi(label, value, delta, note) {
  const dcls = delta == null ? 'flat' : delta > 0.005 ? 'up' : delta < -0.005 ? 'down' : 'flat';
  return `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div>
    <div class="delta ${dcls}">${delta == null ? '' : chgText(delta)} <span class="muted">${note}</span></div></div>`;
}

const charts = {};
function draw(id, config) {
  charts[id]?.destroy();
  const el = document.getElementById(id);
  if (el) charts[id] = new Chart(el, config);
}
const baseOpts = (extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
  ...extra,
});

export default {
  id: 'cs-queries',
  title: 'Customer Queries',
  group: 'Customer Support',
  async render(root) {
    if (!getLive()) return renderConnectPanel(root);
    const [d, themes, insights] = await Promise.all([loadCsSummary(), loadCsThemes(), loadCsInsights()]);
    const n = d.months.length;
    const state = { period: location.hash.includes('all') ? 'all' : 'last3', mode: location.hash.includes('pct') ? 'pct' : 'number', cat: 'All categories' };
    const LABEL = { last3: n >= 3 ? `Last 3 months (${d.months[n - 3].replace('-', ' ')} to ${d.months[n - 1].replace('-', ' ')})` : `Last ${n} month${n > 1 ? 's' : ''} (only ${n} in the data: ${n > 1 ? d.months[0].replace('-', ' ') + ' to ' : ''}${d.months[n - 1].replace('-', ' ')})`, all: `Overall (${d.months[0].replace('-', ' ')} to ${d.months[n - 1].replace('-', ' ')}, ${n} months)` };
    const monthIdx = (y, m) => d.months.findIndex((x) => x === `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}-${y}`);
    // Quarters fully inside the window. Last 3 months = the latest calendar quarter when the data ends on a quarter end.
    const quarterIdx = (qs, from, to) => qs.map((q, i) => ({ q, i })).filter(({ q }) => { const [y, qq] = q.split('-Q').map(Number); return [0, 1, 2].every((k) => { const ix = monthIdx(y, (qq - 1) * 3 + 1 + k); return ix >= from && ix <= to; }); }).map(({ i }) => i);

    const paint = () => {
    const from = state.period === 'last3' ? Math.max(0, n - 3) : 0, to = n - 1;
    state.from = from; state.to = to;
    const sl = (a) => a.slice(from, to + 1);
    const mapObj = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
    const pickQ = (c) => { if (!c) return c; const qi = quarterIdx(c.quarters, from, to); return { ...c, quarters: qi.map((i) => c.quarters[i]), rows: c.rows.map((r) => ({ ...r, q: qi.map((i) => r.q[i]) })) }; };
    const dp = { ...d, concern: d.concern ? mapObj(d.concern, sl) : undefined, months: sl(d.months), monthly: { ...d.monthly, counts: sl(d.monthly.counts) }, primary: mapObj(d.primary, sl), secondary: mapObj(d.secondary, sl), status: mapObj(d.status, sl), categories: mapObj(d.categories, (v) => ({ ...v, monthly: sl(v.monthly) })), catConcern: pickQ(d.catConcern), catConcernTop: pickQ(d.catConcernTop) };
    const themesP = themes && themes.periods ? { ...themes.periods[state.period], note: themes.note } : null;
    const insightsP = insights && insights.periods ? insights : null;
    const findings = buildFindings(dp, themesP, state.period);
    const totalP = sum(dp.monthly.counts);
    const othersShareP = totalP ? sum(dp.status['Untagged (Others)'] || []) / totalP : 0;
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Customer Queries</h1>
          <div class="muted">${LABEL[state.period]} · ${fmt(totalP)} queries · source: ${esc((d.meta && d.meta.source) || 'Main sheet snapshot')}</div>
          <div class="muted" style="margin-top:4px">${d.meta && d.meta.live ? 'Live data read from the Main sheet (labels used exactly as given). Press the button to read it again.' : 'Data is a saved snapshot of the Main sheet (labels used exactly as given in the sheet).'} <button id="sheet-connect" class="noprint" style="margin-left:6px">${d.meta && d.meta.live ? 'Refresh from Google Sheet' : 'Connect Google Sheet (sign in)'}</button> <span id="sheet-status" class="muted"></span></div>
        </div>
        <div class="toolbar noprint">
          <div class="seg" data-gmode title="Applies to the charts. Tables stay as counts (labelled)."><button data-v="number" class="${state.mode === 'number' ? 'on' : ''}">Number</button><button data-v="pct" class="${state.mode === 'pct' ? 'on' : ''}">%</button></div>
          <div class="seg period" data-period><button data-p="last3" class="${state.period === 'last3' ? 'on' : ''}">Last 3 months</button><button data-p="all" class="${state.period === 'all' ? 'on' : ''}">Overall</button></div>
          <button id="theme">Dark / light</button>
          <button id="print" class="primary">Print / PDF</button>
        </div>
      </div>

      <div class="banner"><b>Read with care:</b> ${pct(othersShareP, 0)} of all queries in this period have Category "Others / unmapped": Category is "Others" in Main. That includes non-product queries and may include product names that were not mapped, so it is not a measured error rate. Category charts cover Product Related queries and show Others / unmapped as its own bar. Labels are used exactly as they are in the Main sheet; this dashboard does not re-tag or check them.</div>

      <h2>What customers ask about, and how it is classified</h2>
      <p class="sub">Computed from the loaded data. These describe the content and classification of queries, not whether volume went up or down. Where a line comes from keyword matching it says so.</p>
      <div class="card">${findings.map((f) => `<div class="finding"><span class="k">${esc(f.k)}${f.theme ? ' (keyword matches)' : ''}</span>${esc(f.text)}</div>`).join('')}</div>

      <h2>What the queries tell us</h2>
      <p class="sub">Product-specific questions and mentions found in the query text, with example lines. Mentions, not confirmed causes or unmet needs.</p>
      ${insightsHtml(insightsP, state.period)}

      <h2>Themes inside Product Related queries</h2>
      <p class="sub">What customers actually write in each sub-intent: usage, packaging, product information and safety, regime requests.</p>
      ${themesHtml(themesP, LABEL[state.period])}


      <h2>Primary intent</h2>
      <p class="sub">What customers contacted us about. Use the Number / % switch at the top. % is of all queries in that month.</p>
      <div class="card">
        <div class="card-head"><h3>Intent by month</h3></div>
        <div class="chart-box tall"><canvas id="c-intent"></canvas></div>
      </div>
      <div class="card" style="margin-top:14px"><h3>${state.period === 'last3' ? 'Intent: last 3 months vs same 3 months a year earlier' : 'Intent: overall counts and shares'}</h3><div class="scroll" id="intent-table"></div></div>

      <h2>Product-related queries</h2>
      <p class="sub">Breakdown of the Product Related intent. Smaller groups are folded into "other".</p>
      <div class="card">
        <div class="card-head"><h3>Product intent by month</h3></div>
        <div class="chart-box tall"><canvas id="c-sec"></canvas></div>
      </div>

      <h2>Status (as labelled in Main)</h2>
      <p class="sub">Status values are read from the Main sheet exactly as given. Existing and Opportunity are the sheet's labels for a category, and Untagged (Others) means Category is Others / unmapped. They are not a check against a product catalogue, and not stock, launch or demand evidence. % is of all queries in the month.</p>
      <div class="card"><div class="chart-box"><canvas id="c-status"></canvas></div></div>

      <h2>Product categories</h2>
      <p class="sub">Product Related queries only, with Others / unmapped shown as its own bar. Counts and % use the same population. ${state.period === 'last3' ? 'Compares the last 3 months with the same 3 months a year earlier.' : 'Overall volume across all months in the data; no comparison period.'}</p>
      <div class="cols-2">
        <div class="card"><h3>${state.period === 'last3' ? 'Top categories, last 3 months' : 'Top categories, overall'}</h3><div class="chart-box tall"><canvas id="c-cat"></canvas></div></div>
        <div class="card"><div class="card-head"><h3>Category trend</h3><select id="cat-pick"></select></div><div class="chart-box tall"><canvas id="c-cattrend"></canvas></div></div>
      </div>

      <h2>Category x Concern division</h2>
      <p class="sub"><b>Tables below stay as counts</b> and are not affected by the Number / % switch.</p>
      <p class="sub">Computed from the Main rows: for each category, the concerns that together make up 75% of its specifically labelled concerns (Others and Generic Concern are not listed). Category totals cover all queries in that category. The grey row is the category total minus the listed concerns, which includes Others and Generic Concern. Quarters are calendar quarters; rows with no queries in this period are hidden.</p>
      <div class="card">
        <div class="card-head"><h3>Quarter-wise counts</h3><select id="div-cat"></select></div>
        <div class="scroll tall-scroll" id="div-table"></div>
      </div>

      <h2>Concerns by quarter</h2>
      <p class="sub">Customer concerns named in product queries. "Others" is excluded. Darker = more queries.</p>
      <div class="card">
        <div class="card-head"><h3>Concern heatmap</h3><select id="hm-cat"></select></div>
        <div class="scroll" id="heatmap"></div>
      </div>

      <h2>Context: query volume</h2>
      <p class="sub">Volume is context only. It is not corrected for orders, sales, campaigns or festivals.</p>
      <div class="grid g4" style="margin-top:8px">
        ${kpi('Queries, ' + (state.period === 'last3' ? 'last 3 months' : 'overall'), fmt(totalP), state.period === 'last3' && n >= 15 ? chg(totalP, sum(slice(d.monthly.counts, n - 13, 3))) : null, state.period === 'last3' ? (n >= 15 ? 'vs same 3 months last year' : '') : n + ' months')}
        ${kpi('Average per month', fmt(totalP / dp.months.length), null, 'in this period')}
        ${kpi(dp.months[dp.months.length - 1] + ' queries', fmt(dp.monthly.counts[dp.months.length - 1]), dp.months.length > 1 ? chg(dp.monthly.counts[dp.months.length - 1], dp.monthly.counts[dp.months.length - 2]) : null, dp.months.length > 1 ? 'vs ' + dp.months[dp.months.length - 2] : '')}
        <div class="card kpi"><div class="label">Category marked Others</div><div class="value">${pct(othersShareP, 0)}</div><div class="delta flat"><span class="muted">of queries in this period</span></div></div>
      </div>
      </div>

      <h2>Monthly query movement</h2>
      <p class="sub">Solid line: monthly queries. Dashed line: 3-month moving average. Always shown as counts (a % of total would be a flat 100%).</p>
      <div class="card"><div class="chart-box"><canvas id="c-volume"></canvas></div></div>


      <h2>How to read this</h2>
      <div class="card"><ul class="muted" style="margin:0;padding-left:18px;line-height:1.7">
        <li>Category, Concern, Status and intent counts are computed from the Main sheet rows exactly as labelled there (nothing is re-tagged). Theme and example counts use the remark text of the same rows.</li>
        <li>Query counts are not corrected for order volume, sales, campaigns or festivals. A rise can reflect business growth.</li>
        <li>Quarters in the tables are calendar quarters. "Last 3 months" means the 3 latest months in the data, not the 3 months before today. "Overall" is every month in the data.</li>
        <li>Theme counts are keyword matches over the raw remarks (see the notice above them).</li>
      </ul></div>`;

    const rng = () => ({ labels: d.months.slice(state.from, state.to + 1), i0: state.from, i1: state.to + 1 });
    const cut = (a) => a.slice(state.from, state.to + 1);

    function volume() {
      const { labels } = rng();
      const c = d.monthly.counts;
      const ma = c.map((_, i) => (i < 2 ? null : (c[i] + c[i - 1] + c[i - 2]) / 3));
      draw('c-volume', {
        data: { labels, datasets: [
          { type: 'line', label: 'Monthly queries', data: cut(c), borderColor: '#d9871f', backgroundColor: '#d9871f', tension: .1, pointRadius: 3, borderWidth: 2.5 },
          { type: 'line', label: '3-month average', data: cut(ma), borderColor: COLORS[0], backgroundColor: COLORS[0], borderDash: [7, 5], tension: .1, pointRadius: 0, borderWidth: 2 },
        ] },
        options: baseOpts({ scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmt(v) } } } }),
      });
    }

    function stacked(id, series, mode, colors, baseArr, baseLabel) {
      const { labels } = rng();
      const totals = baseArr ? cut(baseArr) : labels.map((_, i) => sum(series.map((s) => cut(s.v)[i])));
      mode = mode === 'pct' ? 'share' : mode;
      draw(id, {
        type: 'bar',
        data: { labels, datasets: series.map((s, k) => ({
          label: s.k,
          data: cut(s.v).map((x, i) => (mode === 'share' ? (totals[i] ? (x / totals[i]) * 100 : 0) : x)),
          backgroundColor: colors?.[s.k] || COLORS[k % COLORS.length], borderWidth: 0,
        })) },
        options: baseOpts({ scales: { x: { stacked: true }, y: { stacked: true, max: mode === 'share' ? 100 : undefined, ticks: { callback: (v) => (mode === 'share' ? v + '%' : fmt(v)) } } },
          plugins: { title: { display: mode === 'share', text: baseLabel, color: '#7b6c63', font: { size: 11, weight: 'normal' } }, legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => mode === 'share' ? `${c.dataset.label}: ${c.parsed.y.toFixed(1)}% (${fmt(cut(series[c.datasetIndex].v)[c.dataIndex])} of ${fmt(totals[c.dataIndex])})` : `${c.dataset.label}: ${fmt(c.parsed.y)}` } } } }),
      });
    }

    function intent() {
      stacked('c-intent', Object.entries(d.primary).map(([k, v]) => ({ k, v })), state.mode, null, d.monthly.counts, '% of all queries in the month');
      const last = n - 1, ly = n - 13;
      const tbl = document.getElementById('intent-table');
      if (state.period === 'all') {
        const tot = sum(d.monthly.counts);
        const rows = Object.entries(d.primary).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${fmt(sum(v))}</td><td>${pct(sum(v) / tot)}</td></tr>`).join('');
        tbl.innerHTML = `<table class="t"><thead><tr><th>Intent</th><th>Overall</th><th>Share</th></tr></thead><tbody>${rows}</tbody></table>`;
        return;
      }
      const l3 = sum(slice(d.monthly.counts, last, 3)), b3 = ly >= 2 ? sum(slice(d.monthly.counts, ly, 3)) : null;
      const rows = Object.entries(d.primary).map(([k, v]) => {
        const a = sum(slice(v, last, 3)), b = b3 ? sum(slice(v, ly, 3)) : null;
        const sd = b3 ? (a / l3 - b / b3) * 100 : null;
        return `<tr><td>${esc(k)}</td><td>${fmt(a)}</td><td>${pct(a / l3)}</td><td>${b != null ? fmt(b) : '-'}</td><td>${b != null ? pct(b / b3) : '-'}</td>
          <td>${b != null ? chgText(chg(a, b)) : '-'}</td><td class="${sd > 0 ? 'neg' : 'pos'}">${sd != null ? (sd > 0 ? '+' : '') + sd.toFixed(1) + ' pts' : '-'}</td></tr>`;
      }).join('');
      tbl.innerHTML = `<table class="t"><thead><tr><th>Intent</th><th>Last 3m</th><th>Share</th><th>Year ago 3m</th><th>Share</th><th>Count change</th><th>Share change</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    function secondary() {
      const entries = Object.entries(d.secondary).map(([k, v]) => ({ k, v, t: sum(v) })).sort((a, b) => b.t - a.t);
      const main = entries.slice(0, 5);
      const rest = entries.slice(5);
      const other = { k: 'other (small groups)', v: d.months.map((_, i) => sum(rest.map((r) => r.v[i]))) };
      const prBase = d.primary['Product Related'] || d.months.map((_, i) => sum(entries.map((r) => r.v[i])));
      stacked('c-sec', [...main, other], state.mode, null, prBase, '% of Product Related queries in the month');
    }

    function status() {
      const { labels } = rng();
      const ks = Object.keys(d.status).sort((a, b) => (a.startsWith('Untagged') ? 1 : 0) - (b.startsWith('Untagged') ? 1 : 0) || sum(d.status[b]) - sum(d.status[a]));
      const col = { Existing: COLORS[1], Opportunity: COLORS[0], 'Untagged (Others)': '#cfc3b8' };
      stacked('c-status', ks.map((k) => ({ k, v: d.status[k] })), state.mode, col, d.monthly.counts, '% of all queries in the month');
    }

    function categories() {
      const last = n - 1, ly = n - 13;
      const all = state.period === 'all';
      const C = d.categoriesPR || {};
      const prT = d.primary['Product Related'] || [];
      const win = (m) => (all ? sum(m) : sum(slice(m, last, 3)));
      const winB = (m) => (!all && ly >= 2 ? sum(slice(m, ly, 3)) : 0);
      const baseA = win(prT), baseB = winB(prT);
      const P = state.mode === 'pct';
      const val = (x, base) => (P ? (base ? (x / base) * 100 : 0) : x);
      const top = Object.entries(C).filter(([k]) => k !== 'Others').map(([k, m]) => ({ k, a: win(m), b: winB(m) })).sort((x, y) => y.a - x.a).slice(0, 12);
      const oth = C['Others'] ? [{ k: 'Others / unmapped', a: win(C['Others']), b: winB(C['Others']) }] : [];
      const rows = [...oth, ...top];
      draw('c-cat', {
        type: 'bar',
        data: { labels: rows.map((r) => r.k), datasets: [
          ...(all ? [] : [{ label: 'Same 3 months last year', data: rows.map((r) => val(r.b, baseB)), backgroundColor: '#cfc3b8' }]),
          { label: all ? 'Overall' : 'Last 3 months', data: rows.map((r) => val(r.a, baseA)), backgroundColor: COLORS[0] },
        ] },
        options: baseOpts({ indexAxis: 'y', scales: { x: { ticks: { callback: (v) => (P ? v + '%' : fmt(v)) } } }, plugins: { title: { display: true, text: `${P ? '% of' : 'Count of'} Product Related queries, Others included. Base N=${fmt(baseA)}${baseB ? ' (year ago ' + fmt(baseB) + ')' : ''}`, color: '#7b6c63', font: { size: 11, weight: 'normal' } }, legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => { const r = rows[c.dataIndex]; const yr = c.dataset.label.startsWith('Same'); const raw = yr ? r.b : r.a; const b = yr ? baseB : baseA; return P ? `${c.dataset.label}: ${c.parsed.x.toFixed(1)}% (${fmt(raw)} of ${fmt(b)} Product Related)` : `${c.dataset.label}: ${fmt(raw)} (of ${fmt(b)} Product Related)`; } } } } }),
      });
      const pick = document.getElementById('cat-pick');
      if (!pick.options.length) {
        const names = Object.entries(C).sort((a, b) => sum(b[1].slice(state.from, state.to + 1)) - sum(a[1].slice(state.from, state.to + 1))).map(([k]) => k);
        pick.innerHTML = names.map((k) => `<option>${esc(k)}</option>`).join('');
        pick.onchange = trend;
      }
      trend();
    }
    function trend() {
      const k = document.getElementById('cat-pick').value;
      const v = (d.categoriesPR || {})[k] || [];
      const tb = d.primary['Product Related'] || [];
      const { labels } = rng();
      const P = state.mode === 'pct';
      const shown = P ? cut(v).map((x, i) => (cut(tb)[i] ? (x / cut(tb)[i]) * 100 : 0)) : cut(v);
      draw('c-cattrend', {
        type: 'line',
        data: { labels, datasets: [{ label: k, data: shown, borderColor: COLORS[0], backgroundColor: '#b5452a22', fill: true, tension: .3, pointRadius: 2 }] },
        options: baseOpts({ scales: { y: { beginAtZero: true, ticks: { callback: (x) => (P ? x + '%' : fmt(x)) } } }, plugins: { title: { display: true, text: P ? "% of that month's Product Related queries" : 'Product Related queries per month', color: '#7b6c63', font: { size: 11, weight: 'normal' } }, legend: { display: false }, tooltip: { callbacks: { label: (c) => P ? `${c.parsed.y.toFixed(1)}% (${fmt(cut(v)[c.dataIndex])} of ${fmt(cut(tb)[c.dataIndex])} Product Related)` : `${fmt(c.parsed.y)} (of ${fmt(cut(tb)[c.dataIndex])} Product Related)` } } } }),
      });
    }

    function divTable() {
      const sel = document.getElementById('div-cat');
      const src = dp.catConcernTop;
      if (!src) { document.getElementById('div-table').innerHTML = '<p class="muted">This data file has no Category x Concern table.</p>'; return; }
      const rowsAll = src.rows;
      if (!sel.options.length) {
        const cats = [...new Set(rowsAll.map((r) => r.category))];
        sel.innerHTML = ['All categories', ...cats].map((c) => `<option>${esc(c)}</option>`).join('');
        sel.onchange = divTable;
      }
      const cq = src.quarters;
      const rows = rowsAll.filter((r) => (sel.value === 'All categories' || r.category === sel.value) && sum(r.q) > 0);
      const listed = {};
      rowsAll.forEach((r) => { if (r.concern !== '__total__') { listed[r.category] ||= cq.map(() => 0); r.q.forEach((x, i) => (listed[r.category][i] += x)); } });
      const tot = cq.map(() => 0);
      const cellsOf = (q) => q.map((x) => `<td>${x ? fmt(x) : ''}</td>`).join('');
      let out = '', prevCat = null;
      rows.forEach((r) => {
        if (r.concern === '__total__') {
          const rest = r.q.map((x, i) => x - (listed[r.category]?.[i] || 0));
          if (rest.some((x) => x > 0)) out += `<tr class="rest"><td></td><td class="l">Not listed in the sheet (incl. Others)</td><td></td>${cellsOf(rest)}<td>${fmt(sum(rest))}</td></tr>`;
          r.q.forEach((x, i) => (tot[i] += x));
          out += `<tr class="sub-total"><td>${esc(r.category)} Total</td><td></td>${cellsOf(r.q)}<td>${fmt(sum(r.q))}</td></tr>`;
          prevCat = null;
          return;
        }
        const first = r.category !== prevCat;
        out += `<tr><td>${first ? esc(r.category) : ''}</td><td class="l">${esc(r.concern)}</td>${cellsOf(r.q)}<td>${fmt(sum(r.q))}</td></tr>`;
        prevCat = r.category;
      });
      document.getElementById('div-table').innerHTML = `<table class="t div"><thead><tr><th>Category</th><th class="l">Concern</th>${cq.map((q) => `<th>${q}</th>`).join('')}<th>Total (this period)</th></tr></thead><tbody>${out}<tr class="grand"><td>Grand Total</td><td></td>${cellsOf(tot)}<td>${fmt(sum(tot))}</td></tr></tbody></table>`;
    }

    function heatmap() {
      const sel = document.getElementById('hm-cat');
      if (!sel.options.length) {
        const cats = [...new Set(dp.catConcern.rows.filter((r) => r.concern !== '__total__').map((r) => r.category))].filter((c) => c !== 'Others').sort();
        sel.innerHTML = ['All categories', ...cats].map((c) => `<option>${esc(c)}</option>`).join('');
        sel.onchange = heatmap;
      }
      const cq = dp.catConcern.quarters;
      const acc = {};
      dp.catConcern.rows.forEach((r) => {
        if (r.concern === '__total__' || r.concern === 'Others') return;
        if (sel.value !== 'All categories' && r.category !== sel.value) return;
        acc[r.concern] ||= cq.map(() => 0);
        r.q.forEach((x, i) => (acc[r.concern][i] += x));
      });
      const rows = Object.entries(acc).sort((a, b) => sum(b[1]) - sum(a[1]));
      const max = Math.max(1, ...rows.flatMap(([, v]) => v));
      const cell = (x) => `<td class="c" style="background:rgba(181,69,42,${(x / max * 0.85).toFixed(2)});color:${x / max > 0.5 ? '#fff' : 'inherit'}">${x ? fmt(x) : ''}</td>`;
      document.getElementById('heatmap').innerHTML = rows.length
        ? `<table class="t hm"><thead><tr><th>Concern</th>${cq.map((q) => `<th>${q}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td>${v.map(cell).join('')}<td>${fmt(sum(v))}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">No tagged concerns for this category.</p>';
    }

    const redraw = () => { volume(); intent(); secondary(); status(); categories(); };
    volume(); intent(); secondary(); status(); categories(); divTable(); heatmap();

    root.querySelectorAll('[data-gmode]').forEach((seg) =>
      seg.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target));
        state.mode = e.target.dataset.v;
        redraw();
      })
    );
    root.querySelectorAll('[data-period] button').forEach((b) => (b.onclick = () => {
      if (state.period === b.dataset.p) return;
      state.period = b.dataset.p;
      paint();
      window.scrollTo(0, 0);
    }));
    root.querySelector('#sheet-connect').onclick = async (ev) => {
      const st = root.querySelector('#sheet-status'); const b = ev.target; b.disabled = true;
      try {
        const { connectAndLoad } = await import('../../data/sheetSource.js');
        st.textContent = 'Signing in…';
        await connectAndLoad((n) => { st.textContent = `Reading sheet: ${n.toLocaleString('en-IN')} rows…`; });
        st.textContent = 'Building charts…';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (e) { st.textContent = e.message; b.disabled = false; }
    };
    root.querySelector('#print').onclick = () => window.print();
    root.querySelector('#theme').onclick = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = dark ? '' : 'dark';
    };
    };
    paint();
  },
};

// First screen when no data is loaded: ask for the sheet ID and connect.
// Customer rows are processed in this browser and not uploaded to this site's server.
function renderConnectPanel(root) {
  root.innerHTML = `
    <div class="page-head"><div><h1>Customer Queries</h1>
      <div class="muted">Reads your Google Sheet directly in this browser, read-only.</div></div></div>
    <div class="card" style="max-width:560px">
      <h3>Connect your Google Sheet</h3>
      <p class="muted">Paste the ID of the Google Sheet (the long code between /d/ and /edit in its link), then sign in with the Google account that can open it.</p>
      <p><input id="sheet-id-input" type="text" spellcheck="false" autocomplete="off" placeholder="Google Sheet ID" style="width:100%;padding:8px" value=""></p>
      <p><button id="sheet-connect-panel" class="primary">Connect Google Sheet (sign in)</button> <span id="sheet-panel-status" class="muted"></span></p>
      <p class="muted">Customer rows are processed in your browser and not uploaded to this site's server. The sheet ID is kept for this browser session only.</p>
    </div>`;
  const input = root.querySelector('#sheet-id-input');
  input.value = getSheetId();
  root.querySelector('#sheet-connect-panel').onclick = async (ev) => {
    const st = root.querySelector('#sheet-panel-status'); const b = ev.target; b.disabled = true;
    try {
      setSheetId(input.value);
      const { connectAndLoad } = await import('../../data/sheetSource.js');
      st.textContent = 'Signing in...';
      await connectAndLoad((n) => { st.textContent = `Reading sheet: ${n.toLocaleString('en-IN')} rows...`; });
      st.textContent = 'Building charts...';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) { st.textContent = e.message; b.disabled = false; }
  };
}
