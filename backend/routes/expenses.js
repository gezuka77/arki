const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("./auth");
const { isMoney } = require("../validation");
router.use(verifyToken);
const rows = () =>
  db
    .prepare(
      "SELECT e.*,u.username,p.latitude,p.longitude,p.address AS place_address FROM expenses e JOIN users u ON u.id=e.user_id LEFT JOIN saved_places p ON p.name=e.location ORDER BY date DESC,created_at DESC",
    )
    .all()
    .map((e) => ({
      ...e,
      amount: e.amount_cents / 100,
      allocations: db
        .prepare(
          "SELECT category_id,amount_cents FROM allocations WHERE expense_id=?",
        )
        .all(e.id),
    }));
router.get("/", (_req, res) => res.json(rows()));
router.get("/suggestions", (_req, res) =>
  res.json({
    locations: db
      .prepare(
        "SELECT DISTINCT location FROM expenses WHERE location<>'' LIMIT 100",
      )
      .all()
      .map((e) => e.location),
    descriptions: db
      .prepare(
        "SELECT DISTINCT description FROM expenses WHERE description<>'' LIMIT 30",
      )
      .all()
      .map((e) => e.description),
  }),
);
function validate(e, existing = []) {
  if (
    !isMoney(e.amount) ||
    typeof e.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
    !Number.isFinite(Date.parse(e.date)) ||
    new Date(e.date).toISOString().slice(0, 10) !== e.date
  )
    return "Enter a valid total and date";
  if (
    typeof e.location !== "string" ||
    e.location.length > 200 ||
    typeof e.description !== "string" ||
    e.description.length > 2000
  )
    return "Invalid shop name or description";
  if (
    !Array.isArray(e.allocations) ||
    !e.allocations.length ||
    e.allocations.length > 40
  )
    return "Assign the bill to at least one category";
  const ids = new Set();
  let total = 0;
  for (const a of e.allocations) {
    if (
      !a ||
      typeof a.category_id !== "string" ||
      ids.has(a.category_id) ||
      !Number.isSafeInteger(a.amount_cents) ||
      a.amount_cents <= 0
    )
      return "Invalid category allocation";
    ids.add(a.category_id);
    total += a.amount_cents;
    const c = db
      .prepare("SELECT active FROM categories WHERE id=?")
      .get(a.category_id);
    if (!c || (!c.active && !existing.includes(a.category_id)))
      return "Choose active categories";
  }
  if (total !== Math.round(e.amount * 100))
    return "Category amounts must add up to the bill total";
}
function save(req, res, update = false) {
  const old = update
    ? rows().find((e) => String(e.id) === req.params.id)
    : null;
  if (update && !old)
    return res.status(404).json({ error: "Expense not found" });
  const e = { location: "", description: "", ...old, ...req.body };
  const error = validate(e, old?.allocations.map((a) => a.category_id) || []);
  if (error) return res.status(400).json({ error });
  let id = old?.id;
  db.transaction(() => {
    if (old)
      db.prepare(
        "UPDATE expenses SET amount_cents=?,location=?,description=?,date=? WHERE id=?",
      ).run(
        Math.round(e.amount * 100),
        e.location.trim(),
        e.description.trim(),
        e.date,
        id,
      );
    else
      id = db
        .prepare(
          "INSERT INTO expenses(user_id,amount_cents,location,description,date,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          req.user.userId,
          Math.round(e.amount * 100),
          e.location.trim(),
          e.description.trim(),
          e.date,
          new Date().toISOString(),
        ).lastInsertRowid;
    db.prepare("DELETE FROM allocations WHERE expense_id=?").run(id);
    for (const a of e.allocations)
      db.prepare("INSERT INTO allocations VALUES(?,?,?)").run(
        id,
        a.category_id,
        a.amount_cents,
      );
  })();
  res.status(update ? 200 : 201).json(rows().find((e) => e.id === id));
}
router.post("/", (req, res) => save(req, res));
router.put("/:id", (req, res) => save(req, res, true));
router.delete("/:id", (req, res) => {
  if (!db.prepare("DELETE FROM expenses WHERE id=?").run(req.params.id).changes)
    return res.status(404).json({ error: "Expense not found" });
  res.json({ message: "Expense deleted" });
});
router.put("/locations/:oldName", (req, res) => {
  const n = req.body.newName;
  if (typeof n !== "string" || !n.trim() || n.length > 200)
    return res.status(400).json({ error: "Enter a valid shop name" });
  db.transaction(() => {
    db.prepare(
      "INSERT OR IGNORE INTO saved_places(name,latitude,longitude,address) SELECT ?,latitude,longitude,address FROM saved_places WHERE name=?",
    ).run(n.trim(), req.params.oldName);
    db.prepare("UPDATE expenses SET location=? WHERE location=?").run(
      n.trim(),
      req.params.oldName,
    );
  })();
  res.json({ message: "Location updated" });
});
module.exports = router;
