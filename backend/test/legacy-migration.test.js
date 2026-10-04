const test = require("node:test"),
  assert = require("node:assert/strict"),
  Database = require("better-sqlite3");
const migrate = require("../legacy-migration");
const options = {
  name: "Example household",
  currency: "EUR",
  map_lat: 0,
  map_lon: 0,
  petName: "Milo",
  adminUserId: 1,
};
function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,password TEXT,auth_version INTEGER DEFAULT 0);
 INSERT INTO users VALUES(1,'owner','preserved-password-hash',3),(2,'member','second-hash',0);
 CREATE TABLE expenses(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),amount REAL,amount_cents INTEGER,category TEXT,non_food_cents INTEGER,dog_cents INTEGER,clothing_cents INTEGER,location TEXT,description TEXT,date TEXT,created_at TEXT);
 CREATE TABLE budgets(month TEXT PRIMARY KEY,amount_cents INTEGER);INSERT INTO budgets VALUES('2026-10',50000);
 CREATE TABLE saved_places(name TEXT PRIMARY KEY COLLATE NOCASE,latitude REAL,longitude REAL,address TEXT);INSERT INTO saved_places VALUES('Example shop',10,20,'Example street');`);
  const insert = db.prepare(
    "INSERT INTO expenses VALUES(?,1,10,1000,?,?,?,?, 'Example shop','Note','2026-10-01','2026-10-01T12:00:00Z')",
  );
  insert.run(1, "grocery", 200, 100, 300);
  insert.run(2, "dining", 0, 0, 0);
  insert.run(3, "dog", 0, 1000, 0);
  insert.run(4, "clothing", 0, 0, 1000);
  insert.run(5, "grocery", null, 100, 100);
  return db;
}
test("legacy migration preserves exact splits, accounts, pins and budgets and closes setup", () => {
  const db = fixture();
  const result = migrate(db, options);
  assert.equal(result.totalCents, 5000);
  const user = db.prepare("SELECT * FROM users WHERE id=1").get();
  assert.equal(user.password, "preserved-password-hash");
  assert.equal(user.role, "admin");
  assert.equal(user.auth_version, 4);
  const amounts = Object.fromEntries(
    db
      .prepare(
        "SELECT c.name,sum(a.amount_cents) amount FROM allocations a JOIN categories c ON c.id=a.category_id GROUP BY c.id",
      )
      .all()
      .map((r) => [r.name, r.amount]),
  );
  assert.deepEqual(amounts, {
    "Grocery food": 400,
    "Non-food": 200,
    "Eating out": 1000,
    Clothing: 1400,
    Milo: 1200,
    Unallocated: 800,
  });
  assert.equal(db.prepare("SELECT count(*) n FROM expenses").get().n, 5);
  assert.equal(
    db.prepare("SELECT amount_cents FROM budgets").get().amount_cents,
    50000,
  );
  assert.equal(
    db.prepare("SELECT name FROM saved_places").get().name,
    "Example shop",
  );
  assert.equal(
    db.prepare("SELECT name FROM household").get().name,
    options.name,
  );
  assert.throws(() => migrate(db, options), /already migrated/);
  db.close();
});
test("invalid allocations and transaction failures leave the original database intact", () => {
  const db = fixture();
  db.prepare("UPDATE expenses SET dog_cents=5000 WHERE id=1").run();
  assert.throws(() => migrate(db, options), /Invalid split/);
  assert.equal(db.prepare("SELECT count(*) n FROM expenses").get().n, 5);
  db.prepare("UPDATE expenses SET dog_cents=100 WHERE id=1").run();
  db.exec("CREATE TABLE household(id INTEGER PRIMARY KEY,name TEXT)");
  assert.throws(() => migrate(db, options));
  assert.equal(
    db.prepare("SELECT amount FROM expenses WHERE id=1").get().amount,
    10,
  );
  assert.equal(
    db.prepare("SELECT auth_version FROM users WHERE id=1").get().auth_version,
    3,
  );
  db.close();
});
