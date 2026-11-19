# Setup

## Choose a version first

The editable Vite project in `src/` is the original direct-browser connector. The later Apps Script template in `apps-script/` is a separate application. Do not paste one over the other or upload the repository root to an existing private Apps Script project.

## Original browser connector

1. Use your own Google OAuth Web client, enable the Sheets API and configure your localhost/hosting origin.
2. Set `clientId` and `domain` in your local `src/config.js`. They are blank in this repository.
3. Use `npm ci`, `npm test`, `npm run dev`.
4. Supply the Sheet ID privately through the connector's `?sheet=` link. It is stored in that browser session. Avoid forwarding URLs containing private IDs.
5. Each signed-in viewer needs direct read access to the Sheet. The client-side domain check is not a replacement for Google OAuth policy and Sheet ACLs.

Expected data/config tabs: `Main` and `Dashboard_Config`. Main fields are Date, global_remark, first_intent, secondary_intent, Category, Concern and Status. Configuration JSON in the config tab supplies dictionaries and wording. Use invented data for local testing.

## Apps Script template: new installation only

Use a separate test project and private store first. This repository does not include a private project ID or production deployment URL.

1. Create a Google Apps Script project under the intended owner account. Add only files from `apps-script/`, retaining their names. The bundled UI is already compiled.
2. In Script Properties, set:

| Property | Required | Meaning |
| --- | --- | --- |
| `ADMIN_EMAIL` | Yes, before `setup()` | Exact owner/admin email |
| `ALLOWED_DOMAIN` | Yes | Exact organization domain, without `@` |
| `SHEET_ID` | Yes | Private customer-query workbook |
| `STORE_ID` | Created by setup | Private dashboard store. Never publish it. |
| `APP_URL` | Optional | Verified deployed `/exec` URL if Google returns an unsuitable navigation URL |
| `COMP_SHEET_ID` | Competitor module only | Private competitor workbook, no fallback ID |
| `BASELINE_BRAND` | Competitor module only | Exact baseline brand name, default `Example Brand` |
| `ENABLE_NOTIFICATIONS` | No, default off | Literal `true` enables access-request/invite notices after owner review |
| `ENABLE_ASSIGNMENT_NOTIFICATIONS` | No, default off | Literal `true` enables assignment emails after owner review |

3. Review `Code.gs`, especially domain auto-access, activity retention and all email copy. Review competitor edit permissions before giving colleagues access.
4. Run `setup()` as the configured admin. It creates a private store when `STORE_ID` is absent and installs a daily log-retention trigger. The public template only replaces matching `purgeOldLogs_` triggers, not unrelated triggers. This is **not** an automatic source-data refresh schedule.
5. Deploy as the owner with organization-only access. Authorize only after reviewing Google permissions. The owner needs read access to source workbooks, write access to the separate dashboard store, and email permission only if notifications are intentionally enabled. Domain policy may limit whether active-user email is available. Blank identities are denied, not replaced with the deployer's identity.
6. Open the deployed `/exec` URL. Use `?page=admin` for admin, `?page=competitor` for the optional competitor module. Store the verified URL privately in `APP_URL` if needed.
7. In Admin, explicitly load the customer data and charts. Ordinary dashboard loads use saved data. With no snapshot, the app shows a not-loaded message.
8. Verify with separate admin, allowed viewer, blocked viewer and outside-domain identities. Check revocation, saved reads, source refresh failure, chart bases, activity notice and retention. Do not create test access for real people without approval.

### Workbook contracts

The server's `readDataRows_()` maps eight displayed source columns to Date (A), remark (B), first intent (D), secondary intent (E), category (F), concern (G), status (H). This differs from the original browser reader. Adapt the mapping to your workbook before use.

`Charts.gs` contains fixed Summary/pivot table anchors and ranges. `CompetitorServer.gs` expects its documented table anchors, at least 12 month columns and minimum brand/category counts. These are template contracts, not a general spreadsheet importer. A changed layout fails explicitly. Review ranges and reconcile bases with the source owner.

Competitor table ratio header is `BRAND XX: BASELINE`. The baseline row must match `BASELINE_BRAND`. The inherited growth calculation uses fixed source-period labels; update and test these formulas for a different workbook or reporting period.

### Existing installations

Do not run setup, replace Script Properties, recreate the store or deploy this generic template over an existing private application as part of documentation cleanup. Export and back up its source, private configuration, snapshot store, roles and triggers first. Adapt in a separate project and use an explicit migration plan. No existing production migration is performed by this repository update.

### Source provenance

The later handoff contained editable server/admin/competitor files plus `BundleJs.html` and `BundleCss.html`, but not their latest editable Vite inputs. Keep those bundles until the corresponding source is recovered. Building `src/` does not regenerate them. Regenerating the demo uses `scripts/build-demo.mjs` and invented fixtures only.
