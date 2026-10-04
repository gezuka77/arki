const db = require("./db");
const valid = (a) =>
  a === null ||
  (a &&
    typeof a.label === "string" &&
    a.label.trim().length > 0 &&
    a.label.length <= 160 &&
    Number.isFinite(a.latitude) &&
    Math.abs(a.latitude) <= 80 &&
    Number.isFinite(a.longitude) &&
    Math.abs(a.longitude) <= 179 &&
    [5, 10, 20].includes(a.radius));
const read = () => {
  const row = db.prepare("SELECT value FROM shop_area WHERE id=1").get();
  return row ? JSON.parse(row.value) : undefined;
};
const save = (a) => {
  if (a !== undefined)
    db.prepare(
      "INSERT INTO shop_area VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    ).run(JSON.stringify(a));
};
function bounds(a) {
  if (!a) return null;
  const y = a.radius / 111,
    x = y / Math.cos((a.latitude * Math.PI) / 180);
  return [a.latitude - y, a.longitude - x, a.latitude + y, a.longitude + x].map(
    (v) => Number(v.toFixed(5)),
  );
}
module.exports = { valid, read, save, bounds };
