// Live read of the Google Sheet, in the browser. Read-only.
import { CONFIG } from '../config.js';
import { aggregate } from '../engine/aggregate.js';
import { themes } from '../engine/themes.js';
import { insights } from '../engine/insights.js';
import { readMainRows, readConfigPack } from './sheetRead.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly openid email';
const KEY = 'cs.sheetId';

let live = null;
export const getLive = () => live;

// The sheet key reaches the app through the share link (?sheet=...) and is then kept in
// this browser session only. It is never stored in this repo.
export const getSheetId = () => {
  const q = new URLSearchParams(location.search).get('sheet');
  const h = (location.hash.match(/[#?&]sheet=([^&]+)/) || [])[1];
  const fromUrl = (q || h || '').trim();
  if (fromUrl) sessionStorage.setItem(KEY, fromUrl);
  return fromUrl || sessionStorage.getItem(KEY) || '';
};
export const setSheetId = (id) => sessionStorage.setItem(KEY, (id || '').trim());

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

// Confirm the signed-in account is on the allowed domain. Google also blocks accounts
// outside the organization at sign-in (the app is Internal), this is the exact-domain check.
async function getSignedInEmail(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not confirm the signed-in Google account. Try signing in again.');
  const info = await res.json();
  return String(info.email || '').toLowerCase();
}

// Sign in, read the sheet and the settings tab, aggregate in the browser. Sets the live data used by the adapter.
export async function connectAndLoad(onProgress) {
  const sheetId = getSheetId();
  if (!sheetId) throw new Error('This link does not carry the sheet key. Ask the sheet owner for the full dashboard link.');
  await loadGis();
  const token = await getToken();
  const email = await getSignedInEmail(token);
  if (!email.endsWith('@' + CONFIG.domain)) throw new Error(`Only ${CONFIG.domain} Google accounts can open this dashboard (this is ${email || 'an outside account'}).`);
  const [rows, pack] = await Promise.all([readMainRows(token, sheetId, onProgress), readConfigPack(token, sheetId)]);
  const when = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const { out } = aggregate(rows, { source: `Google Sheet, ${CONFIG.tab} tab, read live ${when} (labels as given)` });
  out.meta.live = true;
  const ins = insights(rows, pack.insights);
  ins.strings = pack.strings || {};
  live = { summary: out, themes: themes(rows, pack.themeDictionary), insights: ins };
  return live;
}
