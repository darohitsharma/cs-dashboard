const COMP_MAIN_TAB = 'Google_Summary_Main';
const COMP_DIST_TAB = 'Keyword_Distribution_Summary';

function compSheetId_() {
  const id = props_().getProperty('COMP_SHEET_ID');
  if (!id) throw new Error('Set COMP_SHEET_ID before refreshing competitor data.');
  return id;
}
function baselineBrand_() { return props_().getProperty('BASELINE_BRAND') || 'Example Brand'; }
function isBaselineBrand_(name) { return String(name).trim().toLowerCase() === baselineBrand_().trim().toLowerCase(); }

function compSnapshotSheet_() {
  const ss = storeSheet_();
  return ss.getSheetByName('CompSnapshot') || ss.insertSheet('CompSnapshot');
}

function compSnapshotSavedAt_() {
  try {
    const sh = storeSheet_().getSheetByName('CompSnapshot');
    if (!sh) return null;
    const v = sh.getRange(1, 1).getValue();
    return v ? String(v) : null;
  } catch (e) { return null; }
}

function loadCompetitor() {
  const email = userEmail_();
  if (!isViewer_(email)) {
    logEvent_(email, 'deny', 'loadCompetitor');
    throw new Error('No access. Ask the admin to add your your configured organization domain email.');
  }
  const snap = readSnapshot_(compSnapshotSheet_());
  if (!snap) {
    logEvent_(email, 'data', 'competitor: no saved data yet');
    throw new Error('No competitor data is saved yet. The admin can load it from the Admin page ("Reload competitor data now").');
  }
  const compMap = readCompOverrides_();
  applyCompOverrides_(snap.pack, compMap);
  const fps = {};
  snap.pack.brands.forEach((b) => { fps[b.name] = compBrandFp_(compMap, b.name); });
  snap.pack.overrideFps = fps;
  logEvent_(email, 'data', 'competitor snapshot (' + fmtWhen_(snap.savedAt) + ')');
  return { savedAt: snap.savedAt, when: 'data saved ' + fmtWhen_(snap.savedAt), pack: snap.pack, canEdit: canEditCompetitor_(email) };
}

function adminRefreshCompetitor() {
  const admin = requireAdmin_();
  const pack = readCompetitorTables_();
  const savedAt = writeSnapshot_(pack, compSnapshotSheet_());
  logEvent_(admin, 'data_refresh', 'saved competitor search tables');
  return { savedAt: savedAt, brands: pack.brands.length, categories: pack.categories.length };
}

const COMP_CAVEATS = [
  'Search volumes measure search demand, not sales or market share.',
  'Missing values, zero values and manual overrides need source-owner review. No reconciliation with another workbook is assumed.'
];

function readCompetitorTables_() {
  const ss = SpreadsheetApp.openById(compSheetId_());
  const gsm = ss.getSheetByName(COMP_MAIN_TAB);
  if (!gsm) throw new Error(COMP_MAIN_TAB + ' tab missing. Previous competitor data kept.');
  const v = gsm.getDataRange().getValues();
  const s = (r, c) => String((v[r - 1] && v[r - 1][c - 1] != null) ? v[r - 1][c - 1] : '').trim();
  const n = (r, c) => { const x = v[r - 1] ? v[r - 1][c - 1] : null; const num = Number(x); return (x === '' || x == null || isNaN(num)) ? null : num; };

  if (s(1, 1) !== 'Category Wise' || s(2, 1) !== 'Keyword' || s(3, 1) !== 'Total' || s(3, 2) !== baselineBrand_())
    throw new Error(COMP_MAIN_TAB + ' top-block layout changed. Previous competitor data kept; update the source mapping.');

  const lastCol = gsm.getLastColumn();
  const monthCols = [];
  const growthCols = {};
  for (let c = 3; c <= lastCol; c++) {
    const h = s(2, c);
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(h)) monthCols.push({ label: h, col: c });
    else if (h === '6M Growth') growthCols.g6 = c;
    else if (h === 'Y-o-Y Growth') growthCols.yoy = c;
    else if (h === 'BRAND XX: BASELINE') growthCols.nh = c;
  }
  if (monthCols.length < 12 || !growthCols.g6)
    throw new Error(COMP_MAIN_TAB + ' month/growth columns changed. Previous competitor data kept.');

  const brands = [];
  let r = 3;
  for (; r <= v.length; r++) {
    const name = s(r, 2);
    if (!name) break;
    if (s(r, 1) !== 'Total')
      throw new Error('Unexpected row ' + r + ' in the brand total block of ' + COMP_MAIN_TAB + '. Previous competitor data kept.');
    brands.push({
      name: name,
      total: monthCols.map((m) => n(r, m.col)),
      g6: growthCols.g6 ? n(r, growthCols.g6) : null,
      yoy: growthCols.yoy ? n(r, growthCols.yoy) : null,
      nhRatio: growthCols.nh ? n(r, growthCols.nh) : null
    });
  }
  if (brands.length < 10) throw new Error('Brand total block looks truncated. Previous competitor data kept.');

  let hdr = -1;
  for (let hr = r; hr <= v.length; hr++) {
    if (s(hr, 1) === 'Category' && s(hr, 2) === 'Brand') { hdr = hr; break; }
  }
  if (hdr < 0) throw new Error('Category section header not found in ' + COMP_MAIN_TAB + '. Previous competitor data kept.');
  const catMonthCols = [];
  for (let c = 3; c <= lastCol; c++) {
    const m = s(hdr, c).match(/^Searches:\s*([A-Z][a-z]{2})\s+(\d{4})$/);
    if (m) catMonthCols.push({ label: m[1] + '-' + m[2].slice(2), col: c });
  }
  if (catMonthCols.length < 12) throw new Error('Category month columns changed. Previous competitor data kept.');
  const categories = [];
  let cur = null;
  for (let cr = hdr + 1; cr <= v.length; cr++) {
    const cat = s(cr, 1), brand = s(cr, 2);
    if (!cat || !brand) continue; // blank separators and stray marker rows
    if (!cur || cur.name !== cat) { cur = { name: cat, rows: [] }; categories.push(cur); }
    cur.rows.push({ brand: brand, values: catMonthCols.map((m) => n(cr, m.col)) });
  }
  if (categories.length < 10) throw new Error('Category section looks truncated. Previous competitor data kept.');

  const kd = ss.getSheetByName(COMP_DIST_TAB);
  if (!kd) throw new Error(COMP_DIST_TAB + ' tab missing. Previous competitor data kept.');
  const dv = kd.getDataRange().getValues();
  const d = (r2, c) => String((dv[r2 - 1] && dv[r2 - 1][c - 1] != null) ? dv[r2 - 1][c - 1] : '').trim();
  const dn = (r2, c) => { const x = dv[r2 - 1] ? dv[r2 - 1][c - 1] : null; const num = Number(x); return (x === '' || x == null || isNaN(num)) ? null : num; };
  if (d(1, 1) !== 'Keyword' || d(1, 2) !== 'Matrix')
    throw new Error(COMP_DIST_TAB + ' layout changed. Previous competitor data kept.');
  const distMonthCols = [];
  for (let c = 3; c <= kd.getLastColumn(); c++) {
    const h = d(1, c);
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(h)) distMonthCols.push({ label: h, col: c });
  }
  if (distMonthCols.length < 6) throw new Error(COMP_DIST_TAB + ' month columns changed. Previous competitor data kept.');
  const dist = [];
  let dbrand = '';
  const distMonths = distMonthCols.map((m) => m.label);
  for (let dr = 2; dr <= dv.length; dr++) {
    if (d(dr, 1)) dbrand = d(dr, 1);
    const tier = d(dr, 2).toLowerCase().replace(/\s/g, '');
    if (!dbrand || ['top10', 'top25', 'top50', 'top75', 'total'].indexOf(tier) < 0) continue;
    let entry = null;
    for (let i = 0; i < dist.length; i++) if (dist[i].name === dbrand) entry = dist[i];
    if (!entry) { entry = { name: dbrand }; dist.push(entry); }
    entry[tier] = distMonthCols.map((m) => dn(dr, m.col));
  }

  return {
    source: 'Google Sheet API workbook (read-only)',
    months: monthCols.map((m) => m.label),
    catMonths: catMonthCols.map((m) => m.label),
    distMonths: distMonths,
    brands: brands,
    categories: categories,
    dist: dist,
    caveats: COMP_CAVEATS,
    note: 'Data only from the Google Sheet API workbook. Layout follows the old stakeholder workbook; no values are taken from it.'
  };
}


function canEditCompetitor_(email) {
  return isViewer_(email);
}

function compOverridesSheet_() {
  const ss = storeSheet_();
  const sh = ss.getSheetByName('CompOverrides') || ss.insertSheet('CompOverrides');
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 4).setValues([['key', 'value', 'by', 'at']]);
  return sh;
}

function readCompOverrides_() {
  const sh = compOverridesSheet_();
  const n = sh.getLastRow();
  const map = {};
  if (n < 2) return map;
  const rows = sh.getRange(2, 1, n - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    map[String(rows[i][0])] = { value: String(rows[i][1] == null ? '' : rows[i][1]), by: String(rows[i][2] || ''), at: String(rows[i][3] || '') };
  }
  return map;
}

function compAvg2_(vals, mi, a, b) {
  const x = vals[mi[a]], y = vals[mi[b]];
  if (x == null && y == null) return null;
  if (x == null) return y;
  if (y == null) return x;
  return (x + y) / 2;
}

function recomputeCompGrowth_(pack) {
  const mi = {};
  pack.months.forEach((m, i) => { mi[m] = i; });
  let nh = null;
  for (let i = 0; i < pack.brands.length; i++) if (isBaselineBrand_(pack.brands[i].name)) nh = pack.brands[i];
  const nhAvg = nh && !(nh.manual && nh.manual.nh) ? compAvg2_(nh.total, mi, 'Jun-26', 'Jul-26') : null;
  for (let i = 0; i < pack.brands.length; i++) {
    const b = pack.brands[i];
    const manual = b.manual || {};
    const recent = compAvg2_(b.total, mi, 'Jun-26', 'Jul-26');
    const base = compAvg2_(b.total, mi, 'Dec-25', 'Jan-26');
    if (!manual.g6) b.g6 = (recent != null && base) ? recent / base : null;
    if (!manual.nh) b.nhRatio = (recent != null && nhAvg) ? recent / nhAvg : null;
  }
}

function applyCompOverrides_(pack, map) {
  const edits = {};
  let monthsTouched = false;
  for (let bi = 0; bi < pack.brands.length; bi++) {
    const b = pack.brands[bi];
    b.manual = {};
    for (let i = 0; i < pack.months.length; i++) {
      const k = 'm|' + b.name + '|' + pack.months[i];
      const o = map[k];
      if (o) {
        if (o.value !== '' && !isNaN(Number(o.value))) {
          edits[k] = { by: o.by, at: o.at, src: b.total[i] };
          b.total[i] = Number(o.value);
          monthsTouched = true;
        }
      }
    }
    const g6o = map['g6|' + b.name], yo = map['yoy|' + b.name], no = map['nh|' + b.name], rk = map['remark|' + b.name];
    if (g6o && g6o.value !== '' && !isNaN(Number(g6o.value))) { b.g6 = Number(g6o.value); b.manual.g6 = true; edits['g6|' + b.name] = { by: g6o.by, at: g6o.at }; }
    if (yo && yo.value !== '' && !isNaN(Number(yo.value))) { b.yoy = Number(yo.value); b.manual.yoy = true; edits['yoy|' + b.name] = { by: yo.by, at: yo.at }; }
    if (no && no.value !== '' && !isNaN(Number(no.value))) { b.nhRatio = Number(no.value); b.manual.nh = true; edits['nh|' + b.name] = { by: no.by, at: no.at }; }
    if (rk) { b.remark = rk.value; edits['remark|' + b.name] = { by: rk.by, at: rk.at }; }
  }
  if (monthsTouched) recomputeCompGrowth_(pack);
  pack.brands.forEach((b) => { if (!Object.keys(b.manual).length) delete b.manual; });
  pack.edits = edits;
  const known = {};
  pack.brands.forEach((b) => { known[b.name] = true; });
  const highlights = {};
  for (const k in map) {
    if (k.indexOf('hl|') === 0 && map[k].value === '1' && known[compKeyBrand_(k)]) highlights[k.slice(3)] = { by: map[k].by, at: map[k].at };
  }
  pack.highlights = highlights;
  const assignments = {};
  for (const k in map) {
    if (k.indexOf('assign|') === 0 && known[compKeyBrand_(k)]) assignments[k.slice(7)] = { to: String(map[k].value || ''), by: map[k].by, at: map[k].at };
  }
  pack.assignments = assignments;
  return Object.keys(edits).length > 0 || Object.keys(highlights).length > 0 || Object.keys(assignments).length > 0;
}

function compEffectiveValue_(key, map, pack) {
  const o = map[key];
  if (o) return o.value;
  const parts = key.split('|');
  const brand = parts[1];
  const b = pack.brands.find((x) => x.name === brand);
  if (!b) return '';
  if (parts[0] === 'm') {
    const i = pack.months.indexOf(parts[2]);
    return i < 0 || b.total[i] == null ? '' : String(b.total[i]);
  }
  if (parts[0] === 'g6') return b.g6 == null ? '' : String(b.g6);
  if (parts[0] === 'yoy') return b.yoy == null ? '' : String(b.yoy);
  if (parts[0] === 'nh') return b.nhRatio == null ? '' : String(b.nhRatio);
  if (parts[0] === 'remark') return '';
  return '';
}

function compLock_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Dashboard is busy with another edit. Try again in a few seconds.');
  return lock;
}

function compKeyBrand_(k) {
  const p = String(k || '').split('|');
  if (p[0] === 'hl' || p[0] === 'assign') return p[2] || '';
  return p[1] || '';
}

function compBrandFp_(map, brand) {
  const parts = [];
  for (const k in map) { if (compKeyBrand_(k) === brand) parts.push(k + '=' + map[k].value); }
  return parts.sort().join('\n');
}

function saveCompetitorOverride(key, value, expected) {
  const email = userEmail_();
  if (!isViewer_(email)) { logEvent_(email, 'deny', 'saveCompetitorOverride'); throw new Error('No access.'); }
  if (!canEditCompetitor_(email)) { logEvent_(email, 'deny', 'competitor edit'); throw new Error('No edit access.'); }
  key = String(key || '');
  value = String(value == null ? '' : value).slice(0, 2000).trim();
  if (!/^(m\|[^|]+\|[A-Z][a-z]{2}-\d{2}|(g6|yoy|nh|remark)\|[^|]+)$/.test(key)) throw new Error('Bad edit key.');
  if (key.indexOf('remark|') !== 0 && value !== '' && isNaN(Number(value))) throw new Error('Number expected (blank restores the source/computed value).');

  const snap = readSnapshot_(compSnapshotSheet_());
  if (snap) {
    const map = readCompOverrides_();
    const current = compEffectiveValue_(key, map, snap.pack);
    const exp = String(expected == null ? '' : expected).trim();
    if (exp !== '' && exp !== current && Number(exp) !== Number(current)) {
      logEvent_(email, 'deny', 'competitor edit conflict ' + key);
      return { conflict: true, current: current };
    }
  }

  const lock = compLock_();
  try {
    const sh = compOverridesSheet_();
    const n = sh.getLastRow();
    const keys = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map((r) => String(r[0])) : [];
    const idx = keys.indexOf(key);
    if (value === '') {
      if (idx >= 0) sh.deleteRow(idx + 2);
    } else {
      const row = [key, value, email, new Date().toISOString()];
      if (idx >= 0) sh.getRange(idx + 2, 1, 1, 4).setValues([row]); else sh.appendRow(row);
    }
  } finally { lock.releaseLock(); }
  logEvent_(email, 'data', 'competitor edit ' + key);
  return { ok: true };
}

function resetCompetitorOverrides(brand, knownFp) {
  const email = userEmail_();
  if (!canEditCompetitor_(email)) { logEvent_(email, 'deny', 'competitor reset'); throw new Error('No edit access.'); }
  const lock = compLock_();
  try {
    const sh = compOverridesSheet_();
    const n = sh.getLastRow();
    if (n > 1) {
      const rows = sh.getRange(2, 1, n - 1, 2).getValues();
      if (brand && knownFp != null) {
        const map = {};
        rows.forEach((r) => { map[String(r[0] || '')] = { value: String(r[1] == null ? '' : r[1]) }; });
        if (String(knownFp) !== compBrandFp_(map, brand)) {
          logEvent_(email, 'deny', 'competitor reset stale ' + brand);
          return { conflict: true };
        }
      }
      for (let i = rows.length - 1; i >= 0; i--) {
        if (!brand || compKeyBrand_(String(rows[i][0] || '')) === brand) sh.deleteRow(i + 2);
      }
    }
  } finally { lock.releaseLock(); }
  logEvent_(email, 'data', 'competitor edits reset ' + (brand || '(all brands)'));
  return { ok: true };
}

function toggleCompetitorHighlight(cellKey) {
  const email = userEmail_();
  if (!isViewer_(email)) { logEvent_(email, 'deny', 'toggleCompetitorHighlight'); throw new Error('No access.'); }
  cellKey = String(cellKey || '');
  if (!/^hl\|(m\|[^|]+\|[A-Z][a-z]{2}-\d{2}|(g6|yoy|nh|remark)\|[^|]+)$/.test(cellKey)) throw new Error('Bad highlight key.');
  const lock = compLock_();
  let on;
  try {
    const sh = compOverridesSheet_();
    const n = sh.getLastRow();
    const keys = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map((r) => String(r[0])) : [];
    const idx = keys.indexOf(cellKey);
    if (idx >= 0) { sh.deleteRow(idx + 2); on = false; } else { sh.appendRow([cellKey, '1', email, new Date().toISOString()]); on = true; }
  } finally { lock.releaseLock(); }
  logEvent_(email, 'data', 'competitor highlight ' + (on ? 'on ' : 'off ') + cellKey);
  return { ok: true, on: on };
}

function assignmentEmailsEnabled_() { return props_().getProperty('ENABLE_ASSIGNMENT_NOTIFICATIONS') === 'true'; }

function compAssigneeList_(selfEmail) {
  const vals = storeSheet_().getSheetByName('Viewers').getDataRange().getValues();
  const seen = {}, out = [];
  for (let i = 1; i < vals.length; i++) {
    const v = String(vals[i][0] || '').trim().toLowerCase();
    if (v && v !== selfEmail && !seen[v] && !isBlocked_(v)) { seen[v] = true; out.push(v); }
  }
  const admin = adminEmail_();
  if (admin && admin !== selfEmail && !seen[admin]) out.push(admin);
  return out.sort();
}

function listCompetitorAssignees() {
  const email = userEmail_();
  if (!isViewer_(email)) { logEvent_(email, 'deny', 'listCompetitorAssignees'); throw new Error('No access.'); }
  return compAssigneeList_(email);
}

function assignCompetitorCell(cellKey, assignee) {
  const email = userEmail_();
  if (!isViewer_(email)) { logEvent_(email, 'deny', 'assignCompetitorCell'); throw new Error('No access.'); }
  cellKey = String(cellKey || '');
  if (!/^(m\|[^|]+\|[A-Z][a-z]{2}-\d{2}|(g6|yoy|nh|remark)\|[^|]+)$/.test(cellKey)) throw new Error('Bad assign key.');
  assignee = String(assignee || '').trim().toLowerCase();
  if (assignee && !isDomainEmail_(assignee)) throw new Error('Assignments stay inside your configured organization domain.');
  if (assignee && compAssigneeList_(email).indexOf(assignee) < 0) throw new Error(assignee + ' is not a current viewer (or was just removed). Ask the admin to add them first.');

  const lock = compLock_();
  let keys;
  try {
    const sh = compOverridesSheet_();
    const n = sh.getLastRow();
    keys = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map((r) => String(r[0])) : [];
    const key = 'assign|' + cellKey;
    const idx = keys.indexOf(key);
    if (!assignee) {
      if (idx >= 0) sh.deleteRow(idx + 2);
      logEvent_(email, 'data', 'competitor unassign ' + cellKey);
      return { ok: true, emailed: false };
    }
    const row = [key, assignee, email, new Date().toISOString()];
    if (idx >= 0) sh.getRange(idx + 2, 1, 1, 4).setValues([row]); else sh.appendRow(row);
    logEvent_(email, 'data', 'competitor assign ' + cellKey + ' -> ' + assignee);
  } finally { lock.releaseLock(); }

  let emailed = false;
  if (assignmentEmailsEnabled_()) {
    const parts = cellKey.split('|');
    const brand = parts[1];
    const col = parts[0] === 'm' ? parts[2] : ({ g6: '6M Growth', yoy: 'Y-o-Y Growth', nh: 'BRAND XX: BASELINE', remark: 'Remarks' })[parts[0]] || parts[0];
    let remark = '';
    const rk = keys.indexOf('remark|' + brand);
    if (rk >= 0) remark = String(compOverridesSheet_().getRange(rk + 2, 2).getValue() || '');
    const body = email + ' assigned you the ' + col + ' cell for ' + brand + ' in Competitor Search Tracking.\n' +
      (remark ? 'Remark: ' + remark + '\n' : '') +
      'Open dashboard: ' + appUrl_() + '?page=competitor\n\n' +
      'For questions, contact ' + email + '.\n\n(This is an auto-generated email from the Growth OS dashboard.)';
    try {
      MailApp.sendEmail(assignee, 'Competitor Search Tracking: cell assigned to you (auto-generated email)', body);
      emailed = true;
    } catch (e) { emailed = false; }
  }
  return { ok: true, emailed: emailed };
}
