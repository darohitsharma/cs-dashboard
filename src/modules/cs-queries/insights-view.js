import { fmt } from './format.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sh = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');
const ln = (a, id) => ((a || []).find((x) => x.id === id) || { n: 0 }).n;
const MIN_BASE = 100;   // below this many queries, shares are flagged as unstable
const MIN_LINE = 30;    // a hypothesis is only offered when its main line has at least this many queries
// Display strings that name products come from the runtime pack (I.strings), never hardcoded here.
const tpl = (s, m) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => m[k] ?? '');

export function insightsHtml(I, mode) {
  if (!I || !I.periods) return '<div class="card"><p class="muted">No insights loaded. Connect the Google Sheet to build them.</p></div>';
  const S = I.strings || {};
  const P = I.periods[mode], V = mode === 'last3' ? I.periods.prev3 : null;
  const lab = I.periodLabels, cur = lab[mode], prv = V ? lab.prev3 : null;
  const cmp = !!V;
  const th = cmp ? '<th>Previous 3 months</th>' : '';
  const row = (label, n, d, pn, pd) => `<tr><td>${label}</td><td class="num">${fmt(n)}</td><td class="num">${sh(n, d)}</td>${cmp ? `<td class="num">${pd ? sh(pn, pd) : '-'}</td>` : ''}</tr>`;
  const exBlock = (ex) => (ex && ex.length ? `<div class="exs"><div class="muted">Example lines for the keyword lines above (one or two each; a line can be a loose mention):</div>${ex.map((e) => `<blockquote><span class="tag">${esc(e.line)}</span> ${esc(e.text)}</blockquote>`).join('')}</div>` : '<p class="muted">No example line passed the privacy filter for this period.</p>');
  const small = (n, what) => (n < MIN_BASE ? `<p class="warn">Small base: only ${fmt(n)} ${what} in this period, so shares can move a lot from a few queries.</p>` : '');
  const hyp = (ok, text) => (ok ? `<p class="hyp"><b>Hypothesis to test (not validated):</b> ${esc(text || '')}</p>` : `<p class="muted">Too few matching queries in this period to suggest a change.</p>`);
  const chipHtml = `<div class="chips"><span class="chip">Showing: ${esc(cur)}</span>${cmp ? `<span class="chip alt">Compared with: ${esc(prv)}</span>` : '<span class="chip alt">No earlier period to compare with</span>'}</div>`;
  const blocks = [];

  // 1. Product application and colour questions
  const c = P.colour, cd = c.denominator, cv = V && V.colour;
  const seq = ln(c.lines, 'sequence'), sp = c.sequenceSplit;
  const cl = (id) => row({ sequence: esc(S.rowSequence || id), orangeRed: 'Mentions an orange, red, rust or reddish result', wantsDarker: 'Says they want brown or black, or got something lighter' }[id], ln(c.lines, id), cd, cv && ln(cv.lines, id), cv && cv.denominator);
  const trend1 = cmp
    ? `Sequence asks were ${sh(seq, cd)} of these queries in the last 3 months and ${sh(ln(cv.lines, 'sequence'), cv.denominator)} in the previous 3 months.`
    : `Share of these queries that ask the sequence question, by quarter: ${c.sequenceByQuarter.map((x) => `${x.q.replace('-', ' ')} ${sh(x.seq, x.n)}`).join(', ')}.`;
  blocks.push(`<div class="card insight"><h3>${esc(S.s1Title || '1. Application and colour questions')}</h3>${chipHtml}
    <p class="muted">Base: ${fmt(cd)} ${esc(S.s1BaseWhat || 'usage queries in this period')}.</p>${small(cd, 'usage queries on these products')}
    <table class="tbl"><tr><th>What the remark says</th><th>Queries</th><th>Share</th>${th}</tr>
      ${cl('sequence')}${cl('orangeRed')}${cl('wantsDarker')}
      ${row(esc(S.rowMixTogether || 'Of the sequence asks: mix together'), ln(sp.lines, 'seqMix'), sp.total, 0, 0).replace(/<td class="num">-<\/td><\/tr>$/, '</tr>')}
      ${row('Of the sequence asks: gap, next day, how many hours', ln(sp.lines, 'seqGap'), sp.total, 0, 0).replace(/<td class="num">-<\/td><\/tr>$/, '</tr>')}
      ${row(esc(S.rowSeqSolo || 'Of the sequence asks: second step alone'), ln(sp.lines, 'seqSolo'), sp.total, 0, 0).replace(/<td class="num">-<\/td><\/tr>$/, '</tr>')}
    </table>
    <p class="muted">Rows that split the sequence asks use that smaller group (${fmt(sp.total)}) as the base and are not compared with the earlier period.</p>
    <p><b>Trend:</b> ${esc(trend1)}</p>
    <p><b>Reading (numbers only):</b> ${esc(tpl(S.read1Tpl, { seq: sh(seq, cd), orange: sh(ln(c.lines, 'orangeRed'), cd), mix: sh(ln(sp.lines, 'seqMix'), sp.total), gap: sh(ln(sp.lines, 'seqGap'), sp.total) }))}</p>
    ${hyp(seq >= MIN_LINE, S.hyp1)}
    ${exBlock(c.examples)}
  </div>`);

  // 2. Storage / shelf life
  const h = P.productInfo, hd = h.denominator, hv = V && V.productInfo;
  const hl = (id, label) => row(label, ln(h.lines, id), hd, hv && ln(hv.lines, id), hv && hv.denominator);
  blocks.push(`<div class="card insight"><h3>${esc(S.s2Title || '2. Storage and shelf-life questions')}</h3>${chipHtml}
    <p class="muted">Base: ${fmt(hd)} ${esc(S.s2BaseWhat || 'product-information queries in this period')}.</p>${small(hd, 'information queries on these products')}
    <table class="tbl"><tr><th>Mentions</th><th>Queries</th><th>Share</th>${th}</tr>
      ${hl('storage', 'Storage, fridge, freezer, opened pack')}${hl('shelfLife', 'Shelf life or expiry')}${hl('medical', 'Pregnancy, lactation or a medical condition')}
    </table>
    <p><b>Reading (numbers only):</b> ${sh(ln(h.lines, 'storage'), hd)} of these information queries use storage words and ${sh(ln(h.lines, 'shelfLife'), hd)} use shelf-life or expiry words. The counts show how often the words appear, not how many questions went unanswered.</p>
    ${hyp(ln(h.lines, 'storage') >= MIN_LINE, S.hyp2)}
    <p class="muted">Pregnancy and medical questions need an answer from the qualified product team. This page does not answer them.</p>
    ${exBlock(h.examples)}
  </div>`);

  // 3. Packaging
  const k = P.packaging, kd = k.denominator, kv = V && V.packaging;
  const hot = k.byCategory.filter((x) => x.cat !== 'others' && x.n >= MIN_LINE).slice(0, 7);
  const pc = (n, d) => `${Math.round((n / d) * 100)}%`;
  const hidden = k.byCategory.filter((x) => x.cat !== 'others' && x.n < MIN_LINE).length;
  const kl = (id, label) => row(label, ln(k.lines, id), kd, kv && ln(kv.lines, id), kv && kv.denominator);
  const pkTrend = cmp
    ? `Packaging queries were ${sh(kd, P.productRelated)} of Product Related queries in the last 3 months and ${sh(kv.denominator, V.productRelated)} in the previous 3 months. Leak or spill words were in ${sh(ln(k.lines, 'leak'), kd)} of packaging queries, against ${sh(ln(kv.lines, 'leak'), kv.denominator)}.`
    : `Packaging as a share of Product Related queries, by quarter: ${k.byQuarter.map((x) => `${x.q.replace('-', ' ')} ${sh(x.n, x.productRelated)}`).join(', ')}.`;
  blocks.push(`<div class="card insight"><h3>3. Packaging-related mentions by product</h3>${chipHtml}
    <p class="muted">Base: ${fmt(kd)} packaging and quality queries in this period.</p>${small(kd, 'packaging queries')}
    <table class="tbl"><tr><th>Mentions</th><th>Queries</th><th>Share</th>${th}</tr>
      ${kl('leak', 'Leak or spill')}${kl('pump', 'Pump, spray or nozzle')}${kl('broken', 'Broken or damaged')}${kl('missing', 'Missing, wrong or short')}${kl('fungus', 'Fungus or mould')}
    </table>
    ${hot.length ? `<table class="tbl"><tr><th>Product tag (tagged category)</th><th>Packaging queries</th><th>Leak or spill</th><th>Pump or spray</th><th>Broken or damaged</th><th>Missing, wrong or short</th></tr>${hot.map((x) => `<tr><td>${esc(x.cat.replace(/\b\w/g, (m) => m.toUpperCase()))}</td><td class="num">${fmt(x.n)}</td><td class="num">${pc(x.leak, x.n)}</td><td class="num">${pc(x.pump, x.n)}</td><td class="num">${pc(x.broken, x.n)}</td><td class="num">${pc(x.missing, x.n)}</td></tr>`).join('')}</table>
    <p class="muted">Shares are of each product's own packaging queries in this period. Products with fewer than ${MIN_LINE} packaging queries are not shown${hidden ? ` (${hidden} hidden)` : ''}.</p>` : `<p class="muted">No tagged product has ${MIN_LINE} or more packaging queries in this period, so no product table is shown.</p>`}
    <p><b>Read this with two things in mind.</b></p>
    <p>(a) <b>${sh(k.categoryOthers, kd)} of packaging queries (${fmt(k.categoryOthers)}) in this period have the category "Others".</b> In ${fmt(k.othersNoProductWord)} of them none of a short product-word list (${esc(S.productWordList || 'a short product-word list')}) appears in the text. The product table covers only the tagged rest.</p>
    <p>(b) <b>${sh(k.proofWaiting, kd)} (${fmt(k.proofWaiting)}) of packaging remarks say the case is waiting for images, video or details.</b> Whether that adds delay is not measured here.</p>
    <p><b>Trend:</b> ${esc(pkTrend)}</p>
    ${hyp(k.proofWaiting >= MIN_LINE, 'ask for the proof in the first reply or in the order-help form.')}
    ${exBlock(k.examples)}
  </div>`);

  // 4. Recommendation asks
  const r = P.recommendation, rd = r.denominator, rv = V && V.recommendation;
  const rl = (id, label) => row(label, ln(r.lines, id), rd, rv && ln(rv.lines, id), rv && rv.denominator);
  blocks.push(`<div class="card insight"><h3>4. Recommendation asks by concern</h3>${chipHtml}
    <p class="muted">Base: ${fmt(rd)} product recommendation queries in this period (${sh(rd, P.productRelated)} of Product Related).</p>${small(rd, 'recommendation queries')}
    <table class="tbl"><tr><th>Mentions</th><th>Queries</th><th>Share</th>${th}</tr>
      ${rl('hairFall', 'Hair fall, thinning, growth')}${rl('drySensitive', 'Dry, sensitive or ageing skin')}${rl('pigmentation', 'Pigmentation, tan, dark circles')}${rl('acne', 'Acne, oily skin, open pores')}${rl('dandruff', 'Dandruff, scalp')}${rl('greying', 'Greying')}${rl('report', 'Waiting for a skin or hair report')}${rl('suits', '"Which one suits my skin or hair type or season"')}
    </table>
    <p><b>Reading (numbers only):</b> the largest concern line in this period is ${esc(['hairFall', 'drySensitive', 'pigmentation', 'acne', 'dandruff', 'greying'].map((id) => [id, ln(r.lines, id)]).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${{ hairFall: 'hair fall', drySensitive: 'dry, sensitive or ageing skin', pigmentation: 'pigmentation, tan or dark circles', acne: 'acne, oily skin or open pores', dandruff: 'dandruff or scalp', greying: 'greying' }[id]} (${sh(n, rd)})`)[0])}. A query can list more than one concern.</p>
    ${hyp(ln(r.lines, 'suits') >= MIN_LINE, 'a short concern-to-product guide by hair or skin type, and a clear reply when a report is still pending.')}
    ${exBlock(r.examples)}
  </div>`);

  // 5. Range words
  const rg = Object.fromEntries(r.range.map((x) => [x.word, x.n])), rgv = rv && Object.fromEntries(rv.range.map((x) => [x.word, x.n]));
  blocks.push(`<div class="card insight"><h3>5. Products customers ask about by name</h3>${chipHtml}
    <table class="tbl"><tr><th>Word in recommendation queries</th><th>Queries</th><th>Share</th>${th}</tr>
      ${r.range.map((x) => row(esc(x.word), x.n, rd, rgv && rgv[x.word], rv && rv.denominator)).join('')}
    </table>
    <p class="muted">These are word mentions. A mention can be a pairing or choice question about an existing product, or a "do you have this" ask. Read the example lines in section 4 and the theme cards below before treating any word as a range gap.</p>
    <p class="muted">Restock asks: ${fmt(ln(r.lines, 'restock'))} queries in this period.</p>
  </div>`);

  return `<div class="banner">Period: <b>${esc(cur)}</b>. ${cmp ? `Compared with ${esc(prv)}. ` : 'Overall is every month in the data, not exactly two years. '}Counts are keyword matches over customer remarks, so they show what customers <b>mention</b>, not confirmed causes. A remark can match several lines. No match does not mean no issue. Remarks mix customer words and support-team notes (for example "waiting for images"). Example lines were filtered for numbers, names and contact words, and are picked by a fixed rule, not hand-picked. Keyword precision was not measured. "Hypothesis" lines are suggestions to test, not findings.</div>${blocks.join('')}`;
}
