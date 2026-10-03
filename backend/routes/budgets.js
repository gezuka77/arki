const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("./auth");
const { isMoney } = require("../validation");
router.use(verifyToken);
router.use("/:month", (req, res, next) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(req.params.month))
    return res.status(400).json({ error: "Invalid month" });
  next();
});
router.get("/:month", (req, res) => {
  const row = db
    .prepare("SELECT amount_cents FROM budgets WHERE month = ?")
    .get(req.params.month);
  res.json({
    month: req.params.month,
    amount: row ? row.amount_cents / 100 : null,
  });
});
router.put("/:month", (req, res) => {
  const { amount } = req.body;
  if (amount === null)
    db.prepare("DELETE FROM budgets WHERE month = ?").run(req.params.month);
  else {
    if (!isMoney(amount, true))
      return res
        .status(400)
        .json({
          error:
            "Budget must be zero or positive, with at most two decimal places",
        });
    db.prepare(
      "INSERT INTO budgets (month, amount_cents) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET amount_cents = excluded.amount_cents",
    ).run(req.params.month, Math.round(amount * 100));
  }
  res.json({ month: req.params.month, amount });
});
module.exports = router;
