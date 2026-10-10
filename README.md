# Packers Central

Independent Green Bay Packers fan site at https://frankgbp-afk.github.io/Packers-central/

The site has a unified homepage and news feed, an interactive 2026 schedule and results page, and a season tracker. Legacy Command Center links redirect to the Season page.

## Automated data
A GitHub Action fetches ESPN team schedules every 15 minutes (actual GitHub scheduled runs can be delayed), and refreshes news every three hours. After each final game, the workflow updates the stored score, winner, and season record. Open pages refresh the local data periodically without a full reload. All kickoffs use America/Chicago for proper daylight saving time.

Files: index.html, schedule.html, season.html, styles.css, app.js, scripts/update-football.mjs, scripts/fetch-data.mjs and data/*.json.

No accounts, API keys, servers, or paid services are required. ESPN's public site API is unofficial and may change; failed fetches leave existing JSON data intact. Injury reports, the roster and transactions link directly to Packers.com rather than showing manually maintained stale information.

Independent fan project. Not affiliated with the Packers, NFL, ESPN or linked publishers.
