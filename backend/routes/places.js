const express = require("express");
const db = require("../db");
const { verifyToken } = require("./auth");
const { validCoordinates } = require("../places");
const router = express.Router();
router.use(verifyToken);
const service = require("../place-service");
router.get("/", (req, res) =>
  res.json(db.prepare("SELECT * FROM saved_places ORDER BY name").all()),
);
async function timedLookup(res, kind, work) {
  const start = performance.now();
  const { value, source } = await work();
  const duration = Number((performance.now() - start).toFixed(1));
  res.set("Server-Timing", `shops;dur=${duration};desc="${source}"`);
  res.set("X-Places-Source", source);
  console.log(
    JSON.stringify({
      event: "place_lookup",
      kind,
      source,
      duration_ms: duration,
      results: value.length,
    }),
  );
  return res.json(value);
}
router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (typeof q !== "string" || q.trim().length < 2 || q.length > 200)
    return res
      .status(400)
      .json({ error: "Enter a shop name and area (2–200 characters)." });
  try {
    await timedLookup(res, "search", () => service.search(q));
  } catch (e) {
    res
      .status(e.status || 503)
      .json({
        error:
          e.status === 429
            ? e.message
            : "Shop search is temporarily unavailable. You can still save the receipt and add its map location later.",
      });
  }
});
router.post("/nearby", async (req, res) => {
  const { latitude, longitude } = req.body;
  if (!validCoordinates(latitude, longitude))
    return res.status(400).json({ error: "Invalid coordinates" });
  try {
    await timedLookup(res, "nearby", () => service.nearby(latitude, longitude));
  } catch (e) {
    res
      .status(e.status || 503)
      .json({
        error:
          e.status === 429
            ? e.message
            : "Nearby search is temporarily unavailable. Try searching by shop name instead.",
      });
  }
});
router.put("/", (req, res) => {
  const { name, latitude, longitude, address = "" } = req.body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 200 ||
    !validCoordinates(latitude, longitude) ||
    typeof address !== "string" ||
    address.length > 500
  )
    return res.status(400).json({ error: "Choose a valid shop location." });
  const existing = db
    .prepare("SELECT * FROM saved_places WHERE name=?")
    .get(name.trim());
  if (
    existing &&
    (existing.latitude !== latitude ||
      existing.longitude !== longitude ||
      existing.address !== address) &&
    req.body.replace !== true
  )
    return res
      .status(409)
      .json({
        error:
          "This shop name already has a saved location. Confirm updating it for all receipts, or choose a different branch name.",
      });
  db.prepare(
    "INSERT INTO saved_places (name,latitude,longitude,address) VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,address=excluded.address",
  ).run(name.trim(), latitude, longitude, address);
  res.json({ name: name.trim(), latitude, longitude, address });
});
router.delete("/", (req, res) => {
  if (typeof req.body.name !== "string")
    return res.status(400).json({ error: "Location name required" });
  db.prepare("DELETE FROM saved_places WHERE name=?").run(req.body.name);
  res.json({ message: "Map location removed; receipts retained." });
});
module.exports = router;
