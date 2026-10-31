export const fmt = (n) => Math.round(n).toLocaleString('en-IN');
export const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
export const pts = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pts`;
export const chg = (a, b) => (b ? (a - b) / b : null);
export const chgText = (c) => (c == null ? 'n/a' : `${c >= 0 ? '+' : ''}${(c * 100).toFixed(1)}%`);
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const slice = (a, i, n) => a.slice(Math.max(0, i - n + 1), i + 1);
export const COLORS = ['#b5452a', '#2f8f7b', '#d9a441', '#4a6fa5', '#8e5ba6', '#7b6c63', '#c97b5a', '#5fb3a1', '#e0b95c', '#7d97c4'];
