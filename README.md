# Arki Tracker

*Everyday expenses, together.*

A self-hosted spending tracker for one household, with individual accounts, configurable categories, named pets, shared receipts, a monthly budget and purchase maps.

This public edition starts with an empty database and a first-run wizard. There are no default accounts, passwords, household names, pet names or receipts.

## Features

- Choose Food, Household, Eating out and Clothing, or optional Transport, Health, Leisure, Gifts, Home, Education and Other categories.
- Add custom categories, pick their icons and colours, and create a separate category for each named pet.
- Split any receipt across its selected categories using amounts or lockable sliders. Unlocked categories share adjustments evenly; locked amounts remain fixed. Slider scales always use the bill total.
- See monthly/yearly totals, category charts and contributions by person. Filter receipts, export CSV and set one shared monthly budget.
- Save precise shop names and pins, search by address, find nearby shops, and view purchase counts and a heatmap.
- Administrators manage categories, household settings and accounts. Members can manage shared receipts, shop pins and the budget. Archive categories and deactivate users without deleting receipt history.
- Phone-friendly interface and Home Screen icons. Dates use **DD/MM/YYYY**; amounts accept a comma or decimal point. Currency is chosen once per household before recording receipts. Supported currencies use two decimal places; no exchange-rate conversion is performed.

## Quick start

Requirements: Docker with Compose, and Node.js 22 or later to generate installation secrets.

```sh
git clone https://github.com/gezuka77/arki.git
cd arki
node scripts/configure.mjs
docker compose up -d --build
```

Open **http://localhost:8080** on the server. If the server is remote, forward the port through SSH or put it behind your own HTTPS reverse proxy. The default Compose file binds only to `127.0.0.1`; it does not publish the application directly to the internet.

Read `SETUP_TOKEN` from the local `.env` file, then follow the wizard:

1. Enter the installation token, household name and currency. Optionally set the initial map centre for manual pins.
2. Choose categories and add custom categories or named pets. The first category is the initial allocation for new receipts.
3. Create the first administrator and optional household members. Passwords require at least 12 characters and at most 72 UTF-8 bytes.
4. Review and create the household, then sign in.

`configure.mjs` generates independent random setup and session-signing secrets and refuses to overwrite an existing `.env`. Setup is permanently closed after initialization. Do not commit or share `.env` or your data volume.

To use a different local port, change `HOST_PORT` in `.env`. Do not change the Compose project name after storing data unless you deliberately reconnect the existing volume.

## Household administration

Open **Settings → Household administration** as an administrator. Add, rename, recolour or archive categories and pets. Choose a different default before archiving the current default category. Archived allocations remain visible in history and can be edited on their existing receipts, but cannot be added to new receipts.

Users are individual local accounts; this edition does not include public signup, email invitations or password-reset email. An administrator can add users, reset another user's password, change their role or deactivate them. Account changes revoke existing sessions. The final active administrator cannot be demoted or deactivated. Every user can change their own password in Account settings.

All household members share access to receipts and the budget. This is **one household per installation**, not a multi-tenant service.

## Maps and privacy

Phone location is requested only after pressing **Nearby shops**. Precise phone coordinates are not stored. Shop names and map pins are saved only after confirmation. The map shows a loading message until it has a relevant position.

By default, place search uses public Photon and Overpass services and map imagery uses OpenStreetMap tiles. These services receive the requests needed for their feature: search text, a coarse nearby search area, or viewed map tile coordinates, respectively. They have usage policies and no application-specific uptime guarantee. Configure your own provider endpoints for higher usage. Users can enter a shop name without a map pin.

An optional regional directory removes external nearby-search latency in a chosen area. Set `SHOP_DIRECTORY_BBOX=south,west,north,east` in `.env` using decimal degrees for a modest region. The application downloads named shops and dining/veterinary places in the background, refreshes weekly, and keeps the last good copy when a refresh fails. It does not overwrite confirmed shop names or pins. No region is enabled by default. For deliberate initial population:

```sh
docker compose exec app node scripts/import-places.js
```

Outside the imported region, coarse-area caches persist across restarts. First-time searches outside local/cached coverage still rely on the external provider. Set a descriptive `MAP_USER_AGENT` identifying your deployment if using public services. Optional `PHOTON_URL` and `OVERPASS_URL` environment variables can be added to your deployment.

The browser retains up to 30 timing events in `window.arkiLocationTimings` for diagnostics, covering GPS, shop lookup and tile loading. These contain durations/source names, not coordinates or shop names. Server lookup logs likewise omit coordinates and query text. Reverse-proxy access logs may still capture search URLs; configure their retention appropriately.

Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under ODbL. Map provider attribution is retained in the interface.

## Deployment and backups

- Use HTTPS for network access and phone geolocation. Keep the database volume private.
- `TRUST_PROXY=0` is the default. Use `1` only when requests pass through exactly one trusted reverse proxy and direct access to the app is blocked.
- The `household_data` volume contains `household.db` (household data) and `places.db` (rebuildable directory/cache).
- Back up the volume while the app is stopped, or use SQLite's online backup API. Do not copy an active SQLite database without its journal/WAL using ordinary file-copy tools.
- Never use `docker compose down -v` unless you intend to delete the household's data.
- This edition uses a new allocation schema and refuses older fixed-category databases. Do not connect it to a database from another edition; no automatic private-app migration is provided.
- Keep `.env` with your backups so session-signing and installation configuration can be restored. Protect backups as private household data.

The included Compose project has no external domain, reverse-proxy labels, fixed container name or automatic production deployment. CI checks do not deploy anything.

## Development and checks

Use Node.js 22 or later:

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
node scripts/check-public.mjs
```

For local development, generate `.env`, then run these in separate terminals:

```sh
node --env-file=.env backend/server.js
npm run dev --prefix frontend -- --host 127.0.0.1
```

Vite proxies `/api` to port 3000. Tests create isolated temporary databases and credentials; they do not use a running household installation.

Before publishing, run `node scripts/check-public.mjs`, inspect `git diff --cached` and verify the tracked file list contains only source, documentation and generic assets. The script is a useful guard, not a guarantee that all possible secrets or personal information have been detected.

## License

MIT. See [LICENSE](LICENSE). Dependency and OpenStreetMap data licenses remain applicable separately.
