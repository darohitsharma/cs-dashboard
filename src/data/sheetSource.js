// Live read of the Google Sheet, in the browser. Read-only scope, token kept in memory only (never stored).
// Nothing is written to the sheet. Data goes from Google straight to this page, then is aggregated here.
import { CONFIG } from '../config.js';
import { aggregate } from '../engine/aggregate.js';
import { themes } from '../engine/themes.js';
import { insights } from '../engine/insights.js';
import { readMainRows, readConfigPack } from './sheetRead.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const KEY = 'cs.sheetId';

let live = null;
export const getLive = () => live;
export const getSheetId = () => sessionStorage.getItem(KEY) || '';
export const setSheetId = (id) => sessionStorage.setItem(KEY, id.trim());

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in (offline or blocked).'));
    document.head.appendChild(s);
  });
}

function getToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.clientId,
      scope: SCOPE,
      callback: (r) => (r.error ? reject(new Error(`Google sign-in: ${r.error_description || r.error}`)) : resolve(r.access_token)),
      error_callback: (e) => reject(new Error(`Google sign-in: ${e.type || 'cancelled'}`)),
    });
    client.requestAccessToken();
  });
}

// Sign in, read the sheet and the settings tab, aggregate in the browser. Sets the live data used by the adapter.
export async function connectAndLoad(onProgress) {
  const sheetId = getSheetId();
  if (!sheetId) throw new Error('Paste the Google Sheet ID first.');
  await loadGis();
  const token = await getToken();
  const [rows, pack] = await Promise.all([readMainRows(token, sheetId, onProgress), readConfigPack(token, sheetId)]);
  const when = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const { out } = aggregate(rows, { source: `Google Sheet, ${CONFIG.tab} tab, read live ${when} (labels as given)` });
  out.meta.live = true;
  const ins = insights(rows, pack.insights);
  ins.strings = pack.strings || {};
  live = { summary: out, themes: themes(rows, pack.themeDictionary), insights: ins };
  return live;
}
