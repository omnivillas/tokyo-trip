# Tokyo Family Weekend

A phone-first trip companion, published with GitHub Pages from the `main` branch root.

- **Now** – what's next today, countdown, leave-by time with a travel estimate, open-now places near the hotel, 4-day forecast.
- **Plan** – day tabs, yes/maybe/no picks, booked and done/skipped marks, editable day/time/note/who per item, opening-hours checks, your own items (+ Add), timeline with travel estimates.
- **Map** – OpenStreetMap with numbered pins, Locate me, "Save map for offline".
- **Essentials** – hotel card in Japanese for taxis, flights/transfers, emergency numbers, yen converter and shared spend tracker, phrases, home-screen install.

`index.html` is self-contained apart from the vendored Leaflet 1.9.4 in `vendor/leaflet`. `sw.js` keeps the app and map tiles available offline; `manifest.webmanifest` + `icons/` make it installable on a home screen.

## Shared data (Google Sheet backend)

`apps-script/Code.gs` is a tiny web app (deployed from the account that owns the Japan Trip sheet) that reads and writes the `Picks` tab. One row per document: item picks/notes (`goku`, `tsukiji`, …), custom items (`c-…`), spend entries (`s-…`) and `_settings` (the trip's Friday date). Newest timestamp wins; a cleared pick stays as a row with empty fields.

To update the deployed script: paste the new `Code.gs`, save, then Deploy > Manage deployments > pencil > Version: New version > Deploy. The `/exec` URL stays the same, so the page needs no change.

The page keeps everything in `localStorage` too, queues changes while offline, and pushes them when back online. The "Copy backup link" button in Essentials encodes all data in the URL for a manual transfer between phones.
