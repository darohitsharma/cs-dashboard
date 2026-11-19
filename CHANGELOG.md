# Changes

## Repository refresh

- Added a sanitized Apps Script template for saved customer-query aggregates, admin access/activity controls, source-table charts and competitor collaboration.
- Removed private deployment/source wiring and business-specific discrepancy figures from the new template. Original private application and its store are not changed.
- Made the organization's domain and baseline brand configurable. Missing domain or competitor source configuration fails closed.
- Kept notification delivery off by default. Removed private approval references from distributable source.
- Scoped setup cleanup to the retention handler, preserving unrelated triggers. Setup now requires the configured admin.
- Added synthetic template tests alongside the 55 existing browser-engine checks.
- Added a generated-data Pages demo built from the sanitized compiled UI bundle.
- Documented source provenance, separate build paths, fixed workbook mappings, privacy limits and non-transactional snapshot writes.
- Replaced the original connector's organization-specific OAuth client/domain defaults with blank local configuration and a configuration guard.

Existing commits and legacy source remain in history. No backdated or invented development history was added. This repository refresh does not claim a new live Apps Script deployment, production migration, email-delivery test or complete recovery of the later editable Vite source.
