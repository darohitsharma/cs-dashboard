# Customer Queries Dashboard

A standalone, read-only browser dashboard for customer-query data kept in a Google Sheet. Built with Vite, vanilla JS and Chart.js. No backend, no database, no tracking.

## How it works
- The sheet owner shares a link that carries the sheet key (`?sheet=...`). Opening that link, you sign in with your Google account (only accounts on the allowed domain can sign in) and your account needs access to the sheet.
- The page reads the sheet straight from Google into your browser and builds every chart and count there. Customer rows are processed in your browser and are not uploaded to this site's server. The sheet key is kept for this browser session only and is never stored in this repo.
- Nothing is ever written to the sheet (read-only scope).

## The sheet it expects
- A data tab (default name `Main`) with these columns: `Date`, `global_remark`, `first_intent`, `secondary_intent`, `Category`, `Concern`, `Status`. Labels are used exactly as given; the dashboard never re-tags.
- A settings tab (default name `Dashboard_Config`) holding the dashboard settings JSON in column A: keyword rules and display labels. This keeps business-specific wording out of the public code.

## Run locally
```
npm install
npm run dev
```
Open the printed localhost address.

## Deploy
It is a static site (`npm run build` -> `dist/`), so any static host works, including free GitHub Pages. Sign-in needs a Google OAuth Web client (Google Cloud console) whose allowed JavaScript origins include the site's origin, with the Google Sheets API enabled. Put that client ID in `src/config.js` before building. Google notes new OAuth settings can take minutes to hours to apply.

## Test
`npm test` runs a smoke suite over invented fixture data and an invented settings pack: engines, invariants (no share exceeds its base), example-line privacy filtering, and the sheet-reading code against a fake Sheets API.

## Notes
- Keyword counts are mentions of words, not confirmed causes. A row can match several lines; no match does not mean no issue.
- Example lines are automatically filtered for numbers, names and contact words, and picked by a fixed rule.
- Query counts are not corrected for order volume, sales or campaigns.
