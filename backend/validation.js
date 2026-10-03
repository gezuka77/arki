const { icons, currencies } = require("./catalog.json");
const isMoney = (v, zero = false) =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= (zero ? 0 : 0.01) &&
  v <= 999999999.99 &&
  Math.abs(v * 100 - Math.round(v * 100)) < 0.00001;
const text = (v, max = 80) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const password = (p) =>
  typeof p === "string" && p.length >= 12 && Buffer.byteLength(p) <= 72;
const validCategory = (c) =>
  c &&
  text(c.name) &&
  icons.includes(c.icon) &&
  /^#[0-9a-fA-F]{6}$/.test(c.color) &&
  ["category", "pet"].includes(c.kind || "category");
const validUser = (u) =>
  u &&
  text(u.username, 60) &&
  /^[\p{L}\p{N}_.@ -]+$/u.test(u.username) &&
  password(u.password) &&
  ["admin", "member"].includes(u.role);
const validHousehold = (h) =>
  h &&
  text(h.name) &&
  currencies.includes(h.currency) &&
  typeof h.map_lat === "number" &&
  Math.abs(h.map_lat) <= 90 &&
  typeof h.map_lon === "number" &&
  Math.abs(h.map_lon) <= 180;
module.exports = {
  isMoney,
  text,
  password,
  validCategory,
  validUser,
  validHousehold,
};
