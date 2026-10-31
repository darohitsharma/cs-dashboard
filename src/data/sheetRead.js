import { CONFIG } from '../config.js';

const COLS = ['A', 'B', 'D', 'E', 'F', 'G', 'H']; // Date, global_remark, first_intent, secondary_intent, Category, Concern, Status
const HEAD = ['Date', 'global_remark', 'first_intent', 'secondary_intent', 'Category', 'Concern', 'Status'];
const CHUNK = 15000;

async function api(url, token, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * 2 ** i)); continue; }
    const msg = (await res.json().catch(() => ({}))).error?.message || res.status;
    throw new Error(res.status === 403 || res.status === 404 ? `No access to the data sheet with this Google account (${msg}). Ask the sheet owner to share it with your nathabit.in email.` : `Sheets API: ${msg}`);
  }
  throw new Error('Google Sheets is busy (rate limit). Try again in a minute.');
}

// Reads the data tab chunk by chunk and returns rows (header first) in the same shape as the CSV parser.
export async function readMainRows(token, sheetId, onProgress = () => {}, tab = CONFIG.tab) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet`;
  const rows = [HEAD];
  for (let start = 2; ; start += CHUNK) {
    const q = COLS.map((c) => `ranges=${encodeURIComponent(`${tab}!${c}${start}:${c}${start + CHUNK - 1}`)}`).join('&');
    const data = await api(`${base}?${q}&majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE`, token);
    const cols = data.valueRanges.map((v) => v.values?.[0] || []);
    const n = Math.max(...cols.map((c) => c.length));
    for (let i = 0; i < n; i++) rows.push(cols.map((c) => String(c[i] ?? '')));
    onProgress(rows.length - 1);
    if (n < CHUNK) break;
  }
  return rows;
}

// Reads the runtime settings pack: column A of the config tab, cells joined in order, parsed as one JSON document.
export async function readConfigPack(token, sheetId, configTab = CONFIG.configTab) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${configTab}!A1:A100`)}?majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE`;
  const data = await api(url, token);
  const cells = data.values?.[0] || [];
  const text = cells.map((c) => String(c ?? '')).join('');
  if (!text.trim()) throw new Error(`The ${configTab} tab is empty. It should hold the dashboard settings JSON in column A.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The ${configTab} tab does not contain valid dashboard settings JSON.`);
  }
}
