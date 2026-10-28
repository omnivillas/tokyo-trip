# Tokyo Family Weekend

A single-page trip planner: day tabs, an OpenStreetMap map with numbered pins, a confirmed timeline with travel estimates, Google ratings, and yes/maybe/no picks plus a "booked" toggle (saved in the browser).

Published with GitHub Pages from the `main` branch root. `index.html` is self-contained apart from the vendored Leaflet 1.9.4 in `vendor/leaflet`.

## Shared picks (Google Sheet backend)

`apps-script/Code.gs` runs inside the Japan Trip Google Sheet and exposes a tiny web app the page reads and writes. Setup once:

1. Open the Japan Trip sheet > Extensions > Apps Script. Replace the editor contents with `apps-script/Code.gs`, save.
2. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy, authorize, copy the `/exec` URL.
3. Put that URL in `index.html` as `const API = "...";` and push. With `API` empty the page works per-browser with share links.

Rows land in the `Picks` tab. Newest timestamp wins; a cleared pick is kept as a row with empty state and booked.
