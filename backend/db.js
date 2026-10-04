const Database = require("better-sqlite3");
const path = require("path"),
  fs = require("fs");
const filename =
  process.env.DB_PATH || path.join(__dirname, "data", "household.db");
if (filename !== ":memory:")
  fs.mkdirSync(path.dirname(filename), { recursive: true });
const db = new Database(filename);
db.pragma("foreign_keys=ON");
db.pragma("journal_mode=WAL");
db.pragma("busy_timeout=5000");
if (
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'",
    )
    .get() &&
  !db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='allocations'",
    )
    .get()
)
  throw Error(
    "This database belongs to an older application. Stop the app and run scripts/migrate-legacy.js with a backup and migration configuration.",
  );
db.exec(require("./schema"));
module.exports = db;
