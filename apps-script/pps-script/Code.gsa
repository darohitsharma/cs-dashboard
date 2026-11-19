const DATA_TAB = 'Main';
const CONFIG_TAB = 'Dashboard_Config';
const RETENTION_DAYS = 30;
const LOG_KEEP = 200;

function props_() { return PropertiesService.getScriptProperties(); }
function sheetId_() { return props_().getProperty('SHEET_ID'); }
function storeId_() { return props_().getProperty('STORE_ID'); }
function adminEmail_() { return (props_().getProperty('ADMIN_EMAIL') || '').trim().toLowerCase(); }
function userEmail_() { return (Session.getActiveUser().getEmail() || '').trim().toLowerCase(); }
function isAdmin_(email) { return !!email && !!adminEmail_() && email === adminEmail_(); }

function storeSheet_() {
  if (!storeId_()) throw new Error('Admin store is not set up yet. Ask the owner to run setup().');
  return SpreadsheetApp.openById(storeId_());
}

function isViewer_(email) {
  if (!email) return false;
  if (isAdmin_(email)) return true;
  try {
    const vals = storeSheet_().getSheetByName('Viewers').getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim().toLowerCase() === email) return true;
    }
  } catch (e) {}
  return false;
}

function allowedDomain_() { return String(props_().getProperty('ALLOWED_DOMAIN') || '').trim().toLowerCase(); }
function isDomainEmail_(email) {
  const domain = allowedDomain_();
  return !!domain && /^[^\s@]+@[^\s@]+$/.test(String(email)) && String(email).toLowerCase().split('@')[1] === domain;
}

function blockedSheet_() {
  const ss = storeSheet_();
  let sh = ss.getSheetByName('Blocked');
  if (!sh) { sh = ss.insertSheet('Blocked'); sh.appendRow(['email', 'removed_at', 'removed_by']); }
  return sh;
}

function findBlocked_(sh, email) {
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) return { row: i + 1 };
  }
  return null;
}

function isBlocked_(email) {
  if (!email) return false;
  try { return !!findBlocked_(blockedSheet_(), email); } catch (e) { return false; }
}

function unblock_(email) {
  try { const bs = blockedSheet_(); const bf = findBlocked_(bs, email); if (bf) bs.deleteRow(bf.row); } catch (e) {}
}

function grantAutoAccess_(email) {
  if (!isDomainEmail_(email)) return isViewer_(email);
  if (isViewer_(email)) return true;
  if (isBlocked_(email)) return false;
  storeSheet_().getSheetByName('Viewers').appendRow([email, new Date(), 'auto: your configured organization domain sign-in']);
  logEvent_(email, 'auto_access', 'granted on first open');
  return true;
}


function appUrl_() {
  return props_().getProperty('APP_URL') || ScriptApp.getService().getUrl() || '';
}

function emailsEnabled_() { return props_().getProperty('ENABLE_NOTIFICATIONS') === 'true'; }

function emailText_(kind, toEmail) {
  var app = appUrl_();
  var admin = adminEmail_();
  if (kind === 'invite') return {
    subject: 'You now have access to the Growth OS dashboard (auto-generated email)',
    body: 'Hi,\n\nYour your configured organization domain account (' + toEmail + ') now has access to the your organization CS dashboard (Growth OS).\n\nOpen it here: ' + app + '\nSign in with your your configured organization domain Google account - no extra sharing is needed.\n\n(This is an auto-generated email from the Growth OS dashboard.)'
  };
  if (kind === 'admin_alert') return {
    subject: 'Dashboard access request: ' + toEmail + ' (auto-generated email)',
    body: toEmail + ' asked for access to the Growth OS dashboard.\n\nApprove or reject it on the admin page: ' + app + '?page=admin\n\n(This is an auto-generated email from the Growth OS dashboard.)'
  };
  if (kind === 'rejected') return {
    subject: 'Your Growth OS dashboard access request (auto-generated email)',
    body: 'Hi,\n\nYour request for access to the Growth OS dashboard (' + toEmail + ') was not approved. If you think this is a mistake, please contact the dashboard admin (' + admin + ').\n\n(This is an auto-generated email from the Growth OS dashboard.)'
  };
  return null;
}

function maybeSendMail_(kind, toEmail) {
  if (!emailsEnabled_()) return false;
  var t = emailText_(kind, String(toEmail || '').trim().toLowerCase());
  if (!t) return false;
  try { MailApp.sendEmail(String(toEmail), t.subject, t.body); return true; } catch (e) { return false; }
}

function requestsSheet_() {
  const ss = storeSheet_();
  let sh = ss.getSheetByName('Requests');
  if (!sh) { sh = ss.insertSheet('Requests'); sh.appendRow(['email', 'requested_at', 'status', 'decided_at', 'decided_by']); }
  return sh;
}

function findRequest_(sh, email) {
  const vals = sh.getDataRange().getValues();
  let found = null;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) found = { row: i + 1, status: String(vals[i][2] || '') };
  }
  return found;
}

function accessStatus_(email) {
  if (!email) return 'none';
  if (isViewer_(email)) return 'viewer';
  if (isBlocked_(email)) return 'removed';
  try { const f = findRequest_(requestsSheet_(), email); return f ? (f.status || 'pending') : 'none'; } catch (e) { return 'none'; }
}

function requestAccess() {
  const email = userEmail_();
  if (!isDomainEmail_(email)) { logEvent_(email, 'deny', 'access_request'); throw new Error('Access requests need a signed-in your configured organization domain account.'); }
  if (isViewer_(email)) return { status: 'viewer' };
  if (isBlocked_(email)) return { status: 'removed' };
  const sh = requestsSheet_();
  const found = findRequest_(sh, email);
  if (found && found.status === 'pending') return { status: 'pending', already: true };
  if (found && found.status === 'rejected') return { status: 'rejected' };
  if (found) sh.getRange(found.row, 1, 1, 5).setValues([[email, new Date(), 'pending', '', '']]);
  else sh.appendRow([email, new Date(), 'pending', '', '']);
  logEvent_(email, 'access_request', '');
  if (!maybeSendMail_('admin_alert', adminEmail_())) logEvent_(email, 'admin_alert_failed', 'access_request');
  return { status: 'pending' };
}

function readRequests_() {
  try {
    const vals = requestsSheet_().getDataRange().getValues();
    return vals.slice(1)
      .map((r) => ({ email: String(r[0]).trim().toLowerCase(), requestedAt: r[1] ? Utilities.formatDate(new Date(r[1]), 'Asia/Kolkata', 'd MMM yyyy, h:mm a') : '', status: String(r[2] || 'pending'), decidedAt: r[3] ? Utilities.formatDate(new Date(r[3]), 'Asia/Kolkata', 'd MMM yyyy, h:mm a') : '' }))
      .filter((x) => x.email).reverse();
  } catch (e) { return []; }
}

function readBlocked_() {
  try {
    const vals = blockedSheet_().getDataRange().getValues();
    return vals.slice(1)
      .map((r) => ({ email: String(r[0]).trim().toLowerCase(), removedAt: r[1] ? Utilities.formatDate(new Date(r[1]), 'Asia/Kolkata', 'd MMM yyyy') : '', removedBy: String(r[2] || '') }))
      .filter((x) => x.email).reverse();
  } catch (e) { return []; }
}

const ADMIN_USAGE_EVENTS_ = ['view', 'data', 'refresh', 'admin_view', 'print', 'click', 'hover'];
function logEvent_(email, event, detail) {
  try {
    if (isAdmin_(String(email || '').trim().toLowerCase()) && ADMIN_USAGE_EVENTS_.indexOf(event) >= 0) return; // admin's own usage is not tracked
    storeSheet_().getSheetByName('Log').appendRow([new Date(), email || 'unknown', event, String(detail || '').slice(0, 500)]);
  } catch (e) {}
}

function doGet(e) {
  const email = userEmail_();
  const page = (e && e.parameter && e.parameter.page) || '';
  const viewer = grantAutoAccess_(email);
  let name;
  if (!viewer) {
    logEvent_(email, 'deny', 'open');
    name = 'Denied';
  } else if (page === 'admin') {
    if (!isAdmin_(email)) { logEvent_(email, 'deny', 'admin'); name = 'Denied'; }
    else { logEvent_(email, 'admin_view', ''); name = 'Admin'; }
  } else if (page === 'competitor') {
    logEvent_(email, 'view', 'competitor');
    name = 'Competitor';
  } else {
    logEvent_(email, 'view', '');
    name = 'Index';
  }
  const t = HtmlService.createTemplateFromFile(name);
  t.userJson = JSON.stringify({ email: email || null, admin: isAdmin_(email) });
  t.reqJson = JSON.stringify({ status: viewer ? 'viewer' : accessStatus_(email) });
  t.appUrlJson = JSON.stringify(appUrl_());
  t.baselineJson = JSON.stringify(baselineBrand_());
  return t.evaluate()
    .setTitle('Growth OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function loadAll() {
  const email = userEmail_();
  if (!isViewer_(email)) {
    logEvent_(email, 'deny', 'loadAll');
    throw new Error('No access. Ask the admin to add your your configured organization domain email.');
  }
  const snap = readSnapshot_();
  if (!snap) {
    logEvent_(email, 'data', 'no saved data yet');
    throw new Error('No dashboard data is saved yet. The admin can load it from the Admin page ("Reload from Google Sheet now").');
  }
  snap.pack.summary.meta.live = false;
  snap.pack.summary.meta.when = 'data saved ' + fmtWhen_(snap.savedAt);
  logEvent_(email, 'data', 'snapshot (' + snap.pack.summary.meta.when + ')');
  return snap.pack;
}

function adminRefreshData() {
  const admin = requireAdmin_();
  if (!sheetId_()) throw new Error('Data sheet is not configured yet. Ask the owner to run setup().');
  const rows = readDataRows_();
  const pack = readConfigPack_();
  const when = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM yyyy, h:mm a').toLowerCase();
  const summary = aggregate(rows, { source: 'Google Sheet, ' + DATA_TAB + ' tab' }).out;
  summary.meta.live = true;
  summary.meta.when = 'read live ' + when;
  const ins = insights(rows, pack.insights);
  ins.strings = pack.strings || {};
  const th = themes(rows, pack.themeDictionary);
  const out = { summary: summary, themes: th, insights: ins };
  const chartPack = readSheetChartTables_();
  const savedAt = writeSnapshot_(out);
  writeSnapshot_(chartPack, sourceChartSnapshotSheet_());
  logEvent_(admin, 'data_refresh', 'read live ' + when + ' - ' + summary.meta.info);
  return { savedAt: savedAt, when: 'read live ' + when, pack: out };
}

function snapshotSheet_() {
  const ss = storeSheet_();
  let sh = ss.getSheetByName('Snapshot');
  if (!sh) { sh = ss.insertSheet('Snapshot'); sh.appendRow(['saved_at', 'chunks']); }
  return sh;
}

function snapshotSavedAt_() {
  try {
    const sh = storeSheet_().getSheetByName('Snapshot');
    if (!sh) return null;
    const v = sh.getRange(1, 1).getValue();
    return v ? String(v) : null;
  } catch (e) { return null; }
}

function writeSnapshot_(pack, shOpt) {
  const sh = shOpt || snapshotSheet_();
  const savedAt = new Date().toISOString();
  const json = JSON.stringify(pack);
  const chunks = [];
  for (let i = 0; i < json.length; i += 45000) chunks.push([json.slice(i, i + 45000)]);
  const existing = sh.getLastRow();
  if (existing > 1) sh.deleteRows(2, existing - 1);
  sh.getRange(1, 1, 1, 2).setValues([[savedAt, chunks.length]]);
  if (chunks.length) sh.getRange(2, 1, chunks.length, 1).setValues(chunks);
  return savedAt;
}

function readSnapshot_(shOpt) {
  try {
    const sh = shOpt || storeSheet_().getSheetByName('Snapshot');
    if (!sh) return null;
    const head = sh.getRange(1, 1, 1, 2).getValues()[0];
    const savedAt = head[0] ? String(head[0]) : '';
    const n = Number(head[1]) || 0;
    if (!savedAt || !n) return null;
    const parts = sh.getRange(2, 1, n, 1).getValues().map((r) => String(r[0] || ''));
    const pack = JSON.parse(parts.join(''));
    return { savedAt: savedAt, pack: pack };
  } catch (e) { return null; }
}

function fmtWhen_(iso) {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return String(iso);
  return Utilities.formatDate(t, 'Asia/Kolkata', 'd MMM yyyy, h:mm a').toLowerCase();
}

const TRACK_ACTIONS = { click: true, hover: true };
function trackClientAction(action, label) {
  const email = userEmail_();
  if (!isViewer_(email)) {
    logEvent_(email, 'deny', 'track');
    throw new Error('No access. Ask the admin to add your your configured organization domain email.');
  }
  if (!TRACK_ACTIONS[String(action)]) return false;
  label = String(label || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  if (!label) return false;
  logEvent_(email, String(action), label);
  return true;
}

function logClientEvent(name) {
  const email = userEmail_();
  if (!isViewer_(email)) {
    logEvent_(email, 'deny', 'client_event');
    throw new Error('No access. Ask the admin to add your your configured organization domain email.');
  }
  if (name === 'print') logEvent_(email, 'print', '');
  return true;
}

function readDataRows_() {
  const sh = SpreadsheetApp.openById(sheetId_()).getSheetByName(DATA_TAB);
  if (!sh) throw new Error('Data tab "' + DATA_TAB + '" not found in the sheet.');
  const last = sh.getLastRow();
  const rows = [['Date', 'global_remark', 'first_intent', 'secondary_intent', 'Category', 'Concern', 'Status']];
  if (last < 2) return rows;
  const vals = sh.getRange(2, 1, last - 1, 8).getDisplayValues();
  for (const v of vals) rows.push([v[0], v[1], v[3], v[4], v[5], v[6], v[7]]);
  return rows;
}

function readConfigPack_() {
  const sh = SpreadsheetApp.openById(sheetId_()).getSheetByName(CONFIG_TAB);
  if (!sh) throw new Error('Config tab "' + CONFIG_TAB + '" not found in the sheet.');
  const text = sh.getRange('A1:A100').getDisplayValues().map((r) => String(r[0] || '')).join('');
  if (!text.trim()) throw new Error('The ' + CONFIG_TAB + ' tab is empty. It should hold the dashboard settings JSON in column A.');
  return JSON.parse(text);
}


function requireAdmin_() {
  const email = userEmail_();
  if (!isAdmin_(email)) { logEvent_(email, 'deny', 'admin_api'); throw new Error('Admin only.'); }
  return email;
}

function adminGetState() {
  const admin = requireAdmin_();
  const vals = storeSheet_().getSheetByName('Viewers').getDataRange().getValues();
  const viewers = vals.slice(1)
    .map((r) => ({ email: String(r[0]).trim().toLowerCase(), addedAt: r[1] ? Utilities.formatDate(new Date(r[1]), 'Asia/Kolkata', 'd MMM yyyy') : '', note: String(r[2] || '') }))
    .filter((v) => v.email);
  return { admin: admin, viewers: viewers, log: readLog_(LOG_KEEP), presence: readPresence_(), snapshotAt: snapshotSavedAt_(), compSnapshotAt: compSnapshotSavedAt_(), requests: readRequests_(), blocked: readBlocked_() };
}

function readLog_(n) {
  const vals = storeSheet_().getSheetByName('Log').getDataRange().getValues();
  return vals.slice(Math.max(vals.length - n, 1)).reverse()
    .map((r) => ({ ts: r[0] ? Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'd MMM yyyy, h:mm a') : '', t: r[0] ? new Date(r[0]).getTime() : 0, email: String(r[1]), event: String(r[2]), detail: String(r[3]) }));
}

function presenceSheet_() {
  const ss = storeSheet_();
  let sh = ss.getSheetByName('Presence');
  if (!sh) { sh = ss.insertSheet('Presence'); sh.appendRow(['email', 'last_ping']); }
  return sh;
}

function heartbeat() {
  const email = userEmail_();
  if (!isViewer_(email)) { logEvent_(email, 'deny', 'heartbeat'); throw new Error('No access. Ask the admin to add your your configured organization domain email.'); }
  const sh = presenceSheet_();
  const vals = sh.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) { sh.getRange(i + 1, 1, 1, 2).setValues([[email, now]]); return true; }
  }
  sh.appendRow([email, now]);
  return true;
}

function readPresence_() {
  const out = {};
  try {
    const vals = presenceSheet_().getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      const e = String(vals[i][0]).trim().toLowerCase();
      const t = vals[i][1] ? new Date(vals[i][1]).getTime() : 0;
      if (e && !isNaN(t) && t > 0) out[e] = t;
    }
  } catch (e) {}
  return out;
}

function adminAddViewer(emailIn, note) {
  const admin = requireAdmin_();
  const v = String(emailIn || '').trim().toLowerCase();
  if (!isDomainEmail_(v)) throw new Error('Only your configured organization domain emails can be added.');
  if (isAdmin_(v)) throw new Error('You are the admin - you always have access.');
  if (isViewer_(v)) throw new Error(v + ' already has access.');
  unblock_(v);
  storeSheet_().getSheetByName('Viewers').appendRow([v, new Date(), String(note || '').slice(0, 200)]);
  try { const rs = requestsSheet_(); const f = findRequest_(rs, v); if (f && f.status !== 'approved') rs.getRange(f.row, 3, 1, 3).setValues([['approved', new Date(), admin]]); } catch (e) {}
  logEvent_(admin, 'viewer_add', v);
  const mailSent = maybeSendMail_('invite', v);
  const st = adminGetState(); st.lastMailSent = mailSent; st.lastMailTo = v;
  return st;
}

function adminApproveRequest(emailIn) {
  const admin = requireAdmin_();
  const v = String(emailIn || '').trim().toLowerCase();
  const sh = requestsSheet_();
  const f = findRequest_(sh, v);
  if (!f || f.status !== 'pending') throw new Error('No pending request from ' + v + '.');
  if (!isViewer_(v)) {
    if (!isDomainEmail_(v)) throw new Error('Only your configured organization domain emails can be added.');
    if (isAdmin_(v)) throw new Error('You are the admin - you always have access.');
    unblock_(v);
    storeSheet_().getSheetByName('Viewers').appendRow([v, new Date(), 'approved access request']);
  }
  sh.getRange(f.row, 3, 1, 3).setValues([['approved', new Date(), admin]]);
  logEvent_(admin, 'request_approve', v);
  const mailSent = maybeSendMail_('invite', v);
  const st = adminGetState(); st.lastMailSent = mailSent; st.lastMailTo = v;
  return st;
}

function adminRejectRequest(emailIn) {
  const admin = requireAdmin_();
  const v = String(emailIn || '').trim().toLowerCase();
  const sh = requestsSheet_();
  const f = findRequest_(sh, v);
  if (!f || f.status !== 'pending') throw new Error('No pending request from ' + v + '.');
  sh.getRange(f.row, 3, 1, 3).setValues([['rejected', new Date(), admin]]);
  logEvent_(admin, 'request_reject', v);
  const mailSent = maybeSendMail_('rejected', v);
  const st = adminGetState(); st.lastMailSent = mailSent; st.lastMailTo = v;
  return st;
}

function adminRemoveViewer(emailIn) {
  const admin = requireAdmin_();
  const v = String(emailIn || '').trim().toLowerCase();
  if (isAdmin_(v)) throw new Error('The admin cannot be removed.');
  const sh = storeSheet_().getSheetByName('Viewers');
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === v) {
      sh.deleteRow(i + 1);
      try { const bs = blockedSheet_(); if (!findBlocked_(bs, v)) bs.appendRow([v, new Date(), admin]); } catch (e) {}
      logEvent_(admin, 'viewer_remove', v);
      return adminGetState();
    }
  }
  throw new Error(v + ' is not on the viewer list.');
}

function adminClearLog() {
  const admin = requireAdmin_();
  const removed = clearLogRows_(storeSheet_().getSheetByName('Log'));
  logEvent_(admin, 'purge_all', removed + ' rows');
  return { removed: removed, state: adminGetState() };
}

function clearLogRows_(sh) {
  const last = sh.getLastRow();
  const removed = Math.max(0, last - 1);
  if (last > 1) sh.deleteRows(2, last - 1);
  return removed;
}

function purgeLogsNow() {
  const admin = requireAdmin_();
  const removed = purgeOldLogs_();
  logEvent_(admin, 'purge', removed + ' old log rows deleted');
  return { removed: removed, state: adminGetState() };
}

function purgeOldLogs_() {
  const sh = storeSheet_().getSheetByName('Log');
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  const vals = sh.getDataRange().getValues();
  let removed = 0;
  for (let i = vals.length - 1; i >= 1; i--) {
    const t = new Date(vals[i][0]).getTime();
    if (!isNaN(t) && t < cutoff) { sh.deleteRow(i + 1); removed++; }
  }
  try {
    const ph = storeSheet_().getSheetByName('Presence');
    if (ph) {
      const pv = ph.getDataRange().getValues();
      for (let i = pv.length - 1; i >= 1; i--) {
        const t = new Date(pv[i][1]).getTime();
        if (isNaN(t) || t < cutoff) ph.deleteRow(i + 1);
      }
    }
  } catch (e) {}
  return removed;
}

function setup() {
  requireAdmin_();
  const props = props_();
  if (!allowedDomain_()) throw new Error('Set ALLOWED_DOMAIN in Project Settings first.');
  if (!props.getProperty('SHEET_ID')) throw new Error('Set SHEET_ID in Project Settings first.');
  if (!props.getProperty('ADMIN_EMAIL')) props.setProperty('ADMIN_EMAIL', Session.getEffectiveUser().getEmail());
  if (!props.getProperty('STORE_ID')) {
    const ss = SpreadsheetApp.create('CS Dashboard Admin (private)');
    const v = ss.getSheets()[0].setName('Viewers');
    v.appendRow(['email', 'added_at', 'note']);
    const l = ss.insertSheet('Log');
    l.appendRow(['ts', 'email', 'event', 'detail']);
    props.setProperty('STORE_ID', ss.getId());
  }
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'purgeOldLogs_').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('purgeOldLogs_').timeBased().everyDays(1).atHour(3).create();
  logEvent_(Session.getEffectiveUser().getEmail(), 'setup', 'store + retention trigger created');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

