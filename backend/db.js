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
    "This database belongs to an older application. Use a new data volume for the public edition.",
  );
db.exec(`CREATE TABLE IF NOT EXISTS household(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,currency TEXT NOT NULL,default_category TEXT NOT NULL,map_lat REAL NOT NULL DEFAULT 0,map_lon REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','member')),active INTEGER NOT NULL DEFAULT 1,auth_version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,icon TEXT NOT NULL,color TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'category',active INTEGER NOT NULL DEFAULT 1,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),location TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',date TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS allocations(expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,category_id TEXT NOT NULL REFERENCES categories(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),PRIMARY KEY(expense_id,category_id));
CREATE INDEX IF NOT EXISTS expenses_date ON expenses(date);
CREATE TABLE IF NOT EXISTS budgets(month TEXT PRIMARY KEY,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0));
CREATE TABLE IF NOT EXISTS saved_places(name TEXT PRIMARY KEY COLLATE NOCASE,latitude REAL NOT NULL,longitude REAL NOT NULL,address TEXT NOT NULL DEFAULT '');`);
module.exports = db;
