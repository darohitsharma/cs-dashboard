# Customer Query Analytics

Customer-query analysis and competitor search tracking, with a standalone browser project and an owner-executed Google Apps Script template.

[Sample-data demo](https://darohitsharma.github.io/cs-dashboard/) | [Setup](SETUP.md) | [Security](SECURITY.md) | [Changes](CHANGELOG.md)

The demo contains invented queries only. It has no live data connection, login, activity collection or email delivery. Private spreadsheet IDs, deployment URLs, account addresses and customer data are not included.

## Two distinct versions

| Path | Purpose | What runs there |
| --- | --- | --- |
| `src/` | Original editable Vite/browser application | Google OAuth and direct read-only Sheets access, after local configuration |
| `apps-script/` | Reusable server-hosted template from the later source handoff | Owner reads Sheets, viewers read saved aggregates, admin manages access and refreshes |
| `docs/index.html` | Public sample demo | Later customer-query UI with a synthetic browser bridge and invented fixtures |

The later handoff supplied editable Apps Script files and a compiled UI bundle, **not the newer editable Vite source**. `npm run build` builds the original `src/` version. It does not reproduce or replace `apps-script/BundleJs.html`. The sample demo is generated from that sanitized bundle. This distinction is intentional, not a claim that the two builds are identical.

## Included functionality

- Monthly query movement, intent classification, category/concern tables and keyword-based themes.
- Overall or latest-three-data-month period, with number/percentage controls for the original dashboard charts.
- Separate Charts and Insights views in the Apps Script UI. Source-table charts retain their own bases and periods.
- Server-checked admin/viewer access in the Apps Script template. Exact configured-domain first-open access, with blocked accounts excluded from auto-enrolment.
- Admin-only upstream refresh and saved aggregate snapshots. Ordinary viewers do not need source-Sheet access.
- Session-style activity tables, presence signals and 30-day retention. Presence is not proof of reading or a real login/logout record.
- Optional competitor module with layout-validated source parsing, dashboard-side overrides, highlights and assignments. All authorized viewers can edit that module's stored overrides. Source spreadsheets remain read-only.
- Notifications are disabled by default in the public template. Enabling them requires owner review of recipients, copy and permissions.

## Run and test

Use Node satisfying `package.json` and npm:

```sh
npm ci
npm test
npm run build
npm run dev
```

The original browser connector needs your own OAuth client and domain in `src/config.js`, plus a privately supplied Sheet link. An unconfigured connector stops before requesting Google sign-in. See [SETUP.md](SETUP.md).

To regenerate the synthetic Pages demo:

```sh
node scripts/build-demo.mjs
python3 -m http.server 5173 --bind 127.0.0.1 --directory docs
```

Open `http://localhost:5173`. No account is needed for that demo.

## Verification and limits

`npm test` runs 55 existing checks over invented data, plus the Apps Script template tests. Checks cover aggregation/privacy invariants, access denial, configured-domain matching, admin-only refresh, saved reads, snapshot round trips, missing competitor configuration and notification defaults. JavaScript syntax and the original Vite build are checked separately.

These are local/mocked checks. The reusable template has not been deployed into a fresh Google Workspace organization. Real identity availability, scopes, email delivery and source-layout compatibility require owner acceptance testing. No private production deployment is changed by a GitHub commit.

Snapshot storage is chunked JSON, not a transactional database. Source-read/parser errors occur before a save, but a storage failure during a multi-step write can leave an incomplete snapshot. Back up the private store before migration and do not promise atomic recovery.

## Reading the analysis

Keyword matches are mentions, not verified causes or unmet demand. Categories and labels are taken as supplied. A query count is not normalized by sales, campaigns or order volume. Example-line filtering reduces risk but is not a guarantee of anonymization. Review outputs before sharing them.

No customer datasets are provided. Keep business-specific dictionaries, data exports, private stores and project mappings outside this repository. Existing history is preserved; older commits may describe the earlier architecture.
