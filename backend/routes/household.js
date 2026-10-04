const router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../db");
const catalog = require("../catalog.json");
const area = require("../shop-area");
const places = () => require("../place-service");
const {
  validCategory,
  validUser,
  validHousehold,
  password,
} = require("../validation");
const { verifyToken, requireAdmin } = require("./auth");
const limit = require("../rate-limit")({ limit: 10 });
const config = () => ({
  ...db.prepare("SELECT * FROM household WHERE id=1").get(),
  shop_area: area.read(),
  shop_directory: places().directoryStatus(),
  categories: db.prepare("SELECT * FROM categories ORDER BY position").all(),
});
router.get("/setup", (_req, res) =>
  res.json({
    initialized: Boolean(db.prepare("SELECT id FROM household").get()),
    ...catalog,
  }),
);
async function searchArea(req, res) {
  if (
    typeof req.body.query !== "string" ||
    req.body.query.trim().length < 2 ||
    req.body.query.length > 160
  )
    return res.status(400).json({ error: "Enter a city or area name" });
  try {
    res.json(await places().searchArea(req.body.query.trim()));
  } catch {
    res
      .status(503)
      .json({
        error:
          "Area search is temporarily unavailable. Try again or use your current location.",
      });
  }
}
router.post("/setup/area-search", limit, (req, res) => {
  if (db.prepare("SELECT id FROM household").get())
    return res.status(409).json({ error: "Setup is already complete" });
  const supplied = req.body.setupToken,
    expected = process.env.SETUP_TOKEN;
  if (
    typeof supplied !== "string" ||
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return res
      .status(403)
      .json({ error: "Enter the installation setup token first" });
  return searchArea(req, res);
});
router.post("/setup", limit, async (req, res, next) => {
  if (db.prepare("SELECT id FROM household").get())
    return res.status(409).json({ error: "Setup is already complete" });
  const expected = process.env.SETUP_TOKEN || "",
    supplied = req.body.setupToken;
  if (
    typeof supplied !== "string" ||
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return res.status(403).json({
      error: "Enter the setup token from your installation configuration",
    });
  const { household, categories, users } = req.body;
  if (
    !validHousehold(household) ||
    (household.shop_area !== undefined && !area.valid(household.shop_area)) ||
    !Array.isArray(categories) ||
    categories.length < 1 ||
    categories.length > 20 ||
    !categories.every(validCategory) ||
    !Array.isArray(users) ||
    users.length < 1 ||
    users.length > 20 ||
    !users.every(validUser) ||
    !users.some((u) => u.role === "admin")
  )
    return res.status(400).json({
      error:
        "Check household settings, categories and users. At least one administrator and one category are required; passwords need at least 12 characters and at most 72 UTF-8 bytes.",
    });
  if (
    new Set(categories.map((c) => c.name.trim().toLowerCase())).size !==
      categories.length ||
    new Set(users.map((u) => u.username.trim().toLowerCase())).size !==
      users.length
  )
    return res
      .status(400)
      .json({ error: "Category names and usernames must be unique" });
  try {
    const hashes = await Promise.all(
      users.map((u) => bcrypt.hash(u.password, 12)),
    );
    const cats = categories.map((c) => ({ ...c, id: crypto.randomUUID() }));
    db.transaction(() => {
      if (db.prepare("SELECT id FROM household").get()) {
        const e = Error("Setup is already complete");
        e.status = 409;
        throw e;
      }
      cats.forEach((c, i) =>
        db
          .prepare(
            "INSERT INTO categories(id,name,icon,color,kind,position) VALUES(?,?,?,?,?,?)",
          )
          .run(c.id, c.name.trim(), c.icon, c.color, c.kind || "category", i),
      );
      db.prepare("INSERT INTO household VALUES(1,?,?,?,?,?)").run(
        household.name.trim(),
        household.currency,
        cats[0].id,
        household.map_lat,
        household.map_lon,
      );
      area.save(household.shop_area);
      users.forEach((u, i) =>
        db
          .prepare("INSERT INTO users(username,password,role) VALUES(?,?,?)")
          .run(u.username.trim(), hashes[i], u.role),
      );
    })();
    void places().refreshDirectory();
    res
      .status(201)
      .json({ message: "Household created. Sign in with your new account." });
  } catch (e) {
    next(e);
  }
});
router.use((req, res, next) => {
  if (!/^\/(household|categories|users)(\/|$)/.test(req.path))
    return next("router");
  verifyToken(req, res, next);
});
router.get("/household", (req, res) =>
  res.json({ ...config(), user: req.user, ...catalog }),
);
router.use(requireAdmin);
router.post("/household/area-search", limit, searchArea);
router.get("/household/directory", (_req, res) =>
  res.json(places().directoryStatus()),
);
router.put("/household", (req, res) => {
  const h = req.body;
  if (
    !validHousehold(h) ||
    (h.shop_area !== undefined && !area.valid(h.shop_area))
  )
    return res
      .status(400)
      .json({ error: "Enter a valid household name, currency and map centre" });
  const old = config();
  if (
    old.currency !== h.currency &&
    db.prepare("SELECT id FROM expenses LIMIT 1").get()
  )
    return res.status(400).json({
      error: "Currency cannot change after receipts have been recorded",
    });
  if (
    !db
      .prepare("SELECT id FROM categories WHERE id=? AND active=1")
      .get(h.default_category)
  )
    return res.status(400).json({ error: "Choose an active default category" });
  db.prepare(
    "UPDATE household SET name=?,currency=?,default_category=?,map_lat=?,map_lon=? WHERE id=1",
  ).run(h.name.trim(), h.currency, h.default_category, h.map_lat, h.map_lon);
  area.save(h.shop_area);
  void places().refreshDirectory();
  res.json(config());
});
router.post("/categories", (req, res) => {
  const c = req.body;
  if (
    !validCategory(c) ||
    db.prepare("SELECT count(*) AS n FROM categories WHERE active=1").get().n >=
      20
  )
    return res.status(400).json({
      error:
        "Choose a name, icon and colour; at most 20 active categories are supported",
    });
  if (db.prepare("SELECT id FROM categories WHERE name=?").get(c.name.trim()))
    return res.status(409).json({ error: "That category name already exists" });
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO categories(id,name,icon,color,kind,position) VALUES(?,?,?,?,?,?)",
  ).run(id, c.name.trim(), c.icon, c.color, c.kind || "category", Date.now());
  res.status(201).json(config());
});
router.put("/categories/:id", (req, res) => {
  const old = db
    .prepare("SELECT * FROM categories WHERE id=?")
    .get(req.params.id);
  if (!old) return res.status(404).json({ error: "Category not found" });
  const c = { ...old, ...req.body };
  if (!validCategory(c) || ![0, 1].includes(c.active))
    return res.status(400).json({ error: "Invalid category" });
  if (
    db
      .prepare("SELECT id FROM categories WHERE name=? AND id<>?")
      .get(c.name.trim(), old.id)
  )
    return res.status(409).json({ error: "That category name already exists" });
  if (
    !c.active &&
    db.prepare("SELECT default_category FROM household").get()
      .default_category === old.id
  )
    return res.status(400).json({
      error: "Choose another default category before archiving this one",
    });
  if (
    c.active &&
    !old.active &&
    db.prepare("SELECT count(*) AS n FROM categories WHERE active=1").get().n >=
      20
  )
    return res
      .status(400)
      .json({ error: "At most 20 active categories are supported" });
  db.prepare(
    "UPDATE categories SET name=?,icon=?,color=?,kind=?,active=? WHERE id=?",
  ).run(c.name.trim(), c.icon, c.color, c.kind, c.active, old.id);
  res.json(config());
});
router.get("/users", (_req, res) =>
  res.json(
    db.prepare("SELECT id,username,role,active FROM users ORDER BY id").all(),
  ),
);
router.post("/users", limit, async (req, res, next) => {
  const u = req.body;
  if (!validUser(u))
    return res.status(400).json({
      error:
        "Enter a valid username, role and password (at least 12 characters, at most 72 UTF-8 bytes)",
    });
  try {
    const hash = await bcrypt.hash(u.password, 12);
    db.prepare("INSERT INTO users(username,password,role) VALUES(?,?,?)").run(
      u.username.trim(),
      hash,
      u.role,
    );
    res.status(201).json({ message: "User created" });
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE")
      return res.status(409).json({ error: "Username already exists" });
    next(e);
  }
});
router.put("/users/:id", limit, async (req, res, next) => {
  const old = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!old) return res.status(404).json({ error: "User not found" });
  const role = req.body.role ?? old.role,
    active = req.body.active ?? old.active;
  if (
    !["admin", "member"].includes(role) ||
    ![0, 1].includes(active) ||
    (req.body.password !== undefined && !password(req.body.password))
  )
    return res
      .status(400)
      .json({ error: "Invalid role, account status or password" });
  try {
    const hash = req.body.password
      ? await bcrypt.hash(req.body.password, 12)
      : null;
    db.transaction(() => {
      const current = db.prepare("SELECT * FROM users WHERE id=?").get(old.id);
      if (
        current.role === "admin" &&
        current.active &&
        (!active || role !== "admin") &&
        db
          .prepare(
            "SELECT count(*) AS n FROM users WHERE role='admin' AND active=1",
          )
          .get().n <= 1
      ) {
        const e = Error("Keep at least one active administrator");
        e.status = 400;
        throw e;
      }
      db.prepare(
        "UPDATE users SET role=?,active=?,password=COALESCE(?,password),auth_version=auth_version+1 WHERE id=?",
      ).run(role, active, hash, old.id);
    })();
    res.json({ message: "User updated; previous sessions revoked" });
  } catch (e) {
    next(e);
  }
});
module.exports = router;
