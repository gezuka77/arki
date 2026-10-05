# Administration guide

For the person running an Arki Tracker installation. Start with the [installation steps](../README.md#quick-start) if you have not set up a household yet.

## Deployment and backups

- Use HTTPS for network access and phone geolocation. Keep the database volume private.
- `TRUST_PROXY=0` is the default. Use `1` only when requests pass through exactly one trusted reverse proxy and direct access to the app is blocked.
- The `household_data` volume contains `household.db` (household data) and `places.db` (rebuildable directory/cache).
- Back up the volume while the app is stopped, or use SQLite's online backup API. Do not copy an active SQLite database without its journal/WAL using ordinary file-copy tools.
- Never use `docker compose down -v` unless you intend to delete the household's data.
- Older fixed-category databases require the explicit, backed-up migration described in [Upgrading a fixed-category installation](#upgrading-a-fixed-category-installation). They are never migrated automatically on startup.
- Keep `.env` with your backups so session-signing and installation configuration can be restored. Protect backups as private household data.

The included Compose project has no external domain, reverse-proxy labels, fixed container name or automatic production deployment. CI checks do not deploy anything.

## Map directory and providers

Choose a nearby-shop preparation area in the setup wizard or **Settings → Household administration**. The following options are for server-managed regions and custom providers.

For installations managed through server configuration, set `SHOP_DIRECTORY_BBOX=south,west,north,east` in `.env` using decimal degrees for a modest region. The application downloads named shops and dining/veterinary places in the background, refreshes weekly, and keeps the last good copy when a refresh fails. It does not overwrite confirmed shop names or pins. No region is enabled by default unless chosen during setup. An explicit household selection overrides the server setting; turning preparation off disables the directory but keeps ordinary search caching. Existing installations retain their server-configured region until an administrator changes it. For deliberate initial population:

```sh
docker compose exec app node scripts/import-places.js
```

Outside the imported region, coarse-area caches persist across restarts. First-time searches outside local/cached coverage still rely on the external provider. Set a descriptive `MAP_USER_AGENT` identifying your deployment if using public services. Optional `PHOTON_URL` and `OVERPASS_URL` environment variables can be added to your deployment.

## Location diagnostics

The browser retains up to 30 timing events in `window.arkiLocationTimings`, covering GPS, shop lookup and tile loading. These contain durations and source names, not coordinates or shop names. You can inspect them in the browser developer console when investigating slow location lookup.

Server lookup logs omit coordinates and query text. Reverse-proxy access logs may still capture search URLs; configure their retention appropriately. Remove personal information before sharing diagnostic output in a bug report.

## Upgrading a fixed-category installation

Keep the old application image for rollback. Stop writes, back up the volume and test migration on a copy first. The migration preserves receipt IDs, exact cents, users and password hashes, budgets and saved shops. It creates configurable categories, closes first-run setup and promotes the administrator you select. Existing sessions are revoked; users sign in again with their existing passwords. Unsplit legacy grocery amounts become **Unallocated**, so they are not silently classified as food.

Create a private configuration JSON outside the repository:

```json
{"name":"My household","currency":"EUR","map_lat":0,"map_lon":0,"petName":"My pet","adminUserId":1}
```

Using the new application image, while the old app is stopped:

```sh
node scripts/migrate-legacy.js /data/old.db /private/migration.json /private/before-upgrade.db
```

This is the backend script (run from the container's `/app` directory). Mount the appropriate data and private configuration paths when running a temporary container. The backup path must not already exist. Invalid data aborts the transaction. Configure `DB_PATH` to the existing migrated database and provide `JWT_SECRET` and a fresh `SETUP_TOKEN` before starting the new app. Keep the original map search region in `SHOP_DIRECTORY_BBOX` if you previously used a local directory. For rollback, stop the new app, restore the complete pre-upgrade database and start the old image; do not run old code against the migrated schema.
