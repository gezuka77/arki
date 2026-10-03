const path = require("path");
const fs = require("fs");
const {
  PlaceStore,
  REGION,
  WEEK,
  parseDirectory,
  ranked,
} = require("./place-store");
const { photonPlaces } = require("./places");
const filename =
  process.env.PLACES_DB_PATH ||
  path.join(
    path.dirname(
      process.env.DB_PATH || path.join(__dirname, "data", "household.db"),
    ),
    "places.db",
  );
fs.mkdirSync(path.dirname(filename), { recursive: true });
const store = new PlaceStore(filename);
const pending = new Map();
const cooldown = new Map();
let nextRequest = 0,
  refreshing = null,
  lastRefreshAttempt = 0;
const provider = () =>
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const selectors = (area) =>
  `(nwr[shop][name](${area});nwr[amenity~"^(restaurant|cafe|fast_food|bar|pub|veterinary)$"][name](${area}););out center tags;`;
async function download(url, options = {}, timeout = 18000) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent":
        process.env.MAP_USER_AGENT ||
        "Arki/1.0 (self-hosted household application)",
      ...options.headers,
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
  return response.json();
}
const overpass = (query, timeout) =>
  download(
    provider(),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }).toString(),
    },
    timeout,
  );
async function refreshDirectory(force = false) {
  if (!REGION) return;
  if (refreshing) return refreshing;
  if (
    !force &&
    ((store.status()?.region === JSON.stringify(REGION) &&
      Date.now() - store.status().updated < WEEK) ||
      Date.now() - lastRefreshAttempt < 3600000)
  )
    return;
  lastRefreshAttempt = Date.now();
  refreshing = (async () => {
    try {
      const count = store.import(
        await overpass(
          `[out:json][timeout:90];${selectors(REGION.join(","))}`,
          120000,
        ),
      );
      console.log(JSON.stringify({ event: "shop_directory_refreshed", count }));
    } catch (e) {
      console.warn(
        JSON.stringify({
          event: "shop_directory_refresh_failed",
          reason:
            e.name === "TimeoutError"
              ? "timeout"
              : "provider_or_incomplete_data",
        }),
      );
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
function startRefresh() {
  if (process.env.PLACES_REFRESH_DISABLED === "1") return;
  const initial = setTimeout(() => refreshDirectory(), 1000);
  initial.unref();
  const timer = setInterval(() => refreshDirectory(), 3600000);
  timer.unref();
}
async function cachedLookup(key, loader) {
  const saved = store.cached(key);
  const load = () => {
    if (pending.has(key)) return pending.get(key);
    if (Date.now() < nextRequest || Date.now() < (cooldown.get(key) || 0)) {
      const e = Error("Please wait a moment before searching again.");
      e.status = 429;
      return Promise.reject(e);
    }
    nextRequest = Date.now() + 1500;
    const work = (async () => {
      try {
        const value = await loader();
        store.cache(key, value);
        cooldown.delete(key);
        return value;
      } catch (e) {
        if (cooldown.size >= 200) cooldown.delete(cooldown.keys().next().value);
        cooldown.set(key, Date.now() + 60000);
        console.warn(
          JSON.stringify({
            event: "place_lookup_failed",
            provider: key.startsWith("area:") ? "overpass" : "photon",
            reason: e.name === "TimeoutError" ? "timeout" : "provider",
          }),
        );
        throw e;
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, work);
    return work;
  };
  if (saved) {
    if (saved.stale) void load().catch(() => {});
    return {
      value: saved.value,
      source: saved.stale ? "stale-cache" : "cache",
    };
  }
  return { value: await load(), source: "provider" };
}
async function nearby(lat, lon) {
  if (store.covers(lat, lon))
    return { value: store.nearby(lat, lon), source: "directory" };
  // Coarse area centres cache public shops, never the precise phone position.
  const a = Number((Math.round(lat / 0.02) * 0.02).toFixed(2)),
    b = Number((Math.round(lon / 0.02) * 0.02).toFixed(2));
  const result = await cachedLookup(`area:${a},${b}`, async () =>
    parseDirectory(
      await overpass(
        `[out:json][timeout:15];${selectors(`around:3500,${a},${b}`)}`,
      ),
    ).map(({ name, address, latitude, longitude }) => ({
      name,
      address,
      latitude,
      longitude,
    })),
  );
  return { ...result, value: ranked(result.value, lat, lon) };
}
async function search(query) {
  const local = store.search(query);
  if (local.length) return { value: local, source: "directory" };
  const url = new URL(
    process.env.PHOTON_URL || "https://photon.komoot.io/api/",
  );
  const home = require("./db")
    .prepare("SELECT map_lat,map_lon FROM household WHERE id=1")
    .get();
  url.search = new URLSearchParams({
    q: query.trim(),
    limit: "8",
    ...(home && (home.map_lat || home.map_lon)
      ? { lat: String(home.map_lat), lon: String(home.map_lon) }
      : {}),
  }).toString();
  return cachedLookup(`search:${query.trim().toLowerCase()}`, async () =>
    photonPlaces(await download(url)),
  );
}
module.exports = { store, nearby, search, startRefresh, refreshDirectory };
