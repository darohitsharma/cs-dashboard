# Security and privacy

## Public code versus private operations

This repository contains reusable code and invented demo fixtures, not customer rows, Sheet IDs, account lists, activity logs, private deployment links or production snapshots. Keep project mappings and exports private. A public commit cannot be made private by removing the file in a later commit. If a secret is exposed, rotate it and assess history separately.

The original Vite path and later Apps Script path have different trust boundaries. Browser-side domain checks do not secure a Sheet. The Apps Script template runs with owner privileges and therefore checks the active user's identity on server handlers. Do not substitute the effective/deployer identity for a missing active identity.

## Access model

- Configure an exact `ALLOWED_DOMAIN` and `ADMIN_EMAIL`.
- On first open, signed-in domain members are enrolled as viewers unless blocked. Review this behavior before deployment.
- Admin manages viewers, refreshes source data and inspects activity. Removed viewers are blocked from automatic re-enrolment.
- Customer-query viewers read aggregate snapshots, not source rows through the server API.
- The competitor module is collaborative: all authorized viewers can edit stored overrides, highlight cells and assign work. Those edits go to the separate private store, not the source workbook.
- Assignment candidates are checked against the current authorized list. The public template does not send emails unless the owner enables the relevant property.

## Notifications

Access notices and assignment notices are off by default. Before enabling, the owner must review the sender account, recipients, copy, included remarks, triggering controls, organizational policy and scopes. A comment or source file claiming historical approval does not authorize a new deployment's email activity. No emails are sent during tests or demo use.

## Activity

The app records bounded semantic actions and visible-tab presence, with a 30-day purge routine. Sessions are inferred from 30-minute inactivity gaps. Presence means a recent tab signal, not attention or exact login/logout. The admin's normal usage is excluded from the activity log. Administrative changes and security-related events can still be recorded. Publish an appropriate notice and review local privacy requirements before using this with colleagues.

## Snapshot limitations

Customer snapshots are aggregate JSON chunks in a private spreadsheet. The parser completes before writing, so a source/parser error does not begin a snapshot write. The write itself is multi-step and non-transactional. A write/quota/storage failure can interrupt it. The customer and source-chart snapshots are also saved separately. Do not describe this version as atomic, fully fault-tolerant or offline.

Keep backups and test recovery using synthetic fixtures. No automatic source-refresh schedule is installed by this template. The setup trigger is daily retention only.

## Analytics privacy

Keyword/example filters are not proof of anonymization. Configuration may contain business-specific wording. Review aggregates, small groups, examples and exported files before sharing. Search volume is not market share or sales. Missing values and known source disagreements require review, not silent corrections.

## Reporting an issue

Do not post customer rows, private links, account lists, credentials or screenshots containing private data in a public issue. Reproduce with invented data. No private security-contact address or vulnerability-reporting service is configured here.
