const Database = require("better-sqlite3");
const { validCoordinates, distance } = require("./places");
const REGION = process.env.SHOP_DIRECTORY_BBOX
  ? process.env.SHOP_DIRECTORY_BBOX.split(",").map(Number)
  : null;
if (
  REGION &&
  (REGION.length !== 4 ||
    !REGION.every(Number.isFinite) ||
    REGION[0] < -90 ||
    REGION[2] > 90 ||
    REGION[1] < -180 ||
    REGION[3] > 180 ||
    REGION[0] >= REGION[2] ||
    REGION[1] >= REGION[3])
)
  throw Error(
    "SHOP_DIRECTORY_BBOX must be south,west,north,east in decimal degrees",
  );
const WEEK = 7 * 86400000;
const normalize = (text) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
function parseDirectory(data) {
  if (!Array.isArray(data.elements) || data.remark)
    throw Error("Incomplete shop directory response");
  return data.elements
    .map((e) => ({
      osm_id: `${e.type}/${e.id}`,
      name: e.tags?.name || e.tags?.brand || "",
      address: [
        e.tags?.["addr:street"],
        e.tags?.["addr:housenumber"],
        e.tags?.["addr:postcode"],
        e.tags?.["addr:city"],
      ]
        .filter(Boolean)
        .join(" "),
      latitude: e.lat ?? e.center?.lat,
      longitude: e.lon ?? e.center?.lon,
      aliases: [e.tags?.["name:fi"], e.tags?.["name:sv"], e.tags?.brand]
        .filter(Boolean)
        .join(" "),
    }))
    .filter(
      (p) =>
        p.name &&
        validCoordinates(p.latitude, p.longitude) &&
        !p.osm_id.includes("undefined"),
    );
}
function ranked(places, lat, lon, radius = 1500) {
  const candidates = places
    .map((p) => ({
      ...p,
      distance: Math.round(distance(lat, lon, p.latitude, p.longitude)),
    }))
    .filter((p) => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
  const selected = [];
  for (const p of candidates) {
    if (
      selected.some(
        (q) =>
          q.name.toLowerCase() === p.name.toLowerCase() &&
          distance(q.latitude, q.longitude, p.latitude, p.longitude) < 50,
      )
    )
      continue;
    selected.push(p);
    if (selected.length === 25) break;
  }
  return selected;
}

class PlaceStore {
  constructor(filename, now = Date.now, getRegion = () => REGION) {
    this.now = now;
    this.getRegion = getRegion;
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS directory (osm_id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, search_text TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS directory_position ON directory(latitude,longitude);
      CREATE TABLE IF NOT EXISTS directory_meta (id INTEGER PRIMARY KEY CHECK(id=1), updated INTEGER NOT NULL, count INTEGER NOT NULL, region TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS place_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);`);
    if (
      !this.db
        .prepare("PRAGMA table_info(directory_meta)")
        .all()
        .some((c) => c.name === "region")
    ) {
      this.db.exec(
        "ALTER TABLE directory_meta ADD COLUMN region TEXT NOT NULL DEFAULT ''",
      );
    }
  }
  status() {
    return this.db
      .prepare("SELECT updated,count,region FROM directory_meta WHERE id=1")
      .get();
  }
  import(data, minimum = 0, region = this.getRegion()) {
    const REGION = region;
    if (!REGION)
      throw Error("Configure SHOP_DIRECTORY_BBOX before importing a directory");
    const places = parseDirectory(data).filter(
      (p) =>
        p.latitude >= REGION[0] &&
        p.latitude <= REGION[2] &&
        p.longitude >= REGION[1] &&
        p.longitude <= REGION[3],
    );
    const previous = this.status();
    if (
      places.length < minimum ||
      (previous &&
        previous.region === JSON.stringify(REGION) &&
        places.length < previous.count * 0.5)
    )
      throw Error("Incomplete shop directory; keeping previous version");
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM directory").run();
      const insert = this.db.prepare(
        "INSERT OR REPLACE INTO directory VALUES (?,?,?,?,?,?)",
      );
      for (const p of places)
        insert.run(
          p.osm_id,
          p.name,
          p.address,
          p.latitude,
          p.longitude,
          normalize(`${p.name} ${p.address} ${p.aliases}`),
        );
      this.db
        .prepare("INSERT OR REPLACE INTO directory_meta VALUES (1,?,?,?)")
        .run(this.now(), places.length, JSON.stringify(REGION));
    })();
    return places.length;
  }
  covers(lat, lon) {
    const REGION = this.getRegion();
    if (!REGION || this.status()?.region !== JSON.stringify(REGION))
      return false;
    // Only claim coverage when the entire search circle is inside the imported rectangle.
    const y = 1500 / 110000,
      x = y / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
    return (
      Boolean(this.status()) &&
      lat - y >= REGION[0] &&
      lat + y <= REGION[2] &&
      lon - x >= REGION[1] &&
      lon + x <= REGION[3]
    );
  }
  nearby(lat, lon) {
    const y = 1500 / 110000,
      x = y / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
    return ranked(
      this.db
        .prepare(
          "SELECT name,address,latitude,longitude FROM directory WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?",
        )
        .all(lat - y, lat + y, lon - x, lon + x),
      lat,
      lon,
    );
  }
  search(query) {
    const REGION = this.getRegion();
    if (!REGION || this.status()?.region !== JSON.stringify(REGION)) return [];
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return this.db
      .prepare(
        `SELECT name,address,latitude,longitude FROM directory WHERE ${terms.map(() => "instr(search_text, ?) > 0").join(" AND ")} ORDER BY name LIMIT 8`,
      )
      .all(...terms);
  }
  cached(key) {
    const row = this.db
      .prepare("SELECT value,updated FROM place_cache WHERE key=?")
      .get(key);
    return row
      ? { value: JSON.parse(row.value), stale: this.now() - row.updated > WEEK }
      : null;
  }
  cache(key, value) {
    this.db.transaction(() => {
      this.db
        .prepare("INSERT OR REPLACE INTO place_cache VALUES (?,?,?)")
        .run(key, JSON.stringify(value), this.now());
      this.db
        .prepare(
          "DELETE FROM place_cache WHERE key IN (SELECT key FROM place_cache ORDER BY updated DESC LIMIT -1 OFFSET 200)",
        )
        .run();
    })();
  }
  close() {
    this.db.close();
  }
}
module.exports = { PlaceStore, REGION, WEEK, parseDirectory, ranked };
