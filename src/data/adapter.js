// Data adapter. The dashboard only talks to this file.
// This build has no bundled data: everything comes from the live Sheet read.
import { getLive } from './sheetSource.js';

export async function loadCsSummary() {
  if (getLive()) return getLive().summary;
  throw new Error('No data loaded yet. Connect the Google Sheet first.');
}

export async function loadCsThemes() {
  return getLive() ? getLive().themes : null;
}

export async function loadCsInsights() {
  return getLive() ? getLive().insights : null;
}
