const crypto = require("crypto");
const schema = require("./schema");
const { validHousehold, text } = require("./validation");
module.exports = function migrateLegacy(db, options) {
  if (
    db.prepare("SELECT name FROM sqlite_master WHERE name='allocations'").get()
  )
    throw Error("Database is already migrated");
  if (!validHousehold(options) || !text(options.petName))
    throw Error(
      "Supply household name, currency, map_lat, map_lon and petName",
    );
  const users = db.prepare("SELECT * FROM users").all();
  if (!users.some((u) => u.id === options.adminUserId))
    throw Error("Choose an existing administrator user ID");
  if (new Set(users.map((u) => u.username.toLowerCase())).size !== users.length)
    throw Error(
      "Resolve case-insensitive duplicate usernames before migration",
    );
  const old = db.prepare("SELECT * FROM expenses ORDER BY id").all();
  const definitions = [
    ["food", "Grocery food", "grocery", "#37795a"],
    ["household", "Non-food", "nonFood", "#aa742f"],
    ["dining", "Eating out", "dining", "#827099"],
    ["clothing", "Clothing", "clothing", "#4682a0"],
    ["pet", options.petName, "dog", "#af6b50"],
  ];
  const planned = old.map((e) => {
    const total = e.amount_cents ?? Math.round(e.amount * 100);
    if (!Number.isSafeInteger(total) || total <= 0)
      throw Error(`Invalid total on receipt ${e.id}`);
    let amounts;
    switch (e.category || "grocery") {
      case "restaurant":
      case "cafeteria":
      case "dining":
        amounts = { dining: total };
        break;
      case "dog":
        amounts = { pet: total };
        break;
      case "clothing":
        amounts = { clothing: total };
        break;
      case "grocery": {
        const household = e.non_food_cents ?? 0,
          pet = e.dog_cents ?? 0,
          clothing = e.clothing_cents ?? 0;
        const remainder = total - household - pet - clothing;
        amounts = {
          household,
          pet,
          clothing,
          [e.non_food_cents == null ? "unallocated" : "food"]: remainder,
        };
        break;
      }
      default:
        throw Error(`Unknown category on receipt ${e.id}`);
    }
    if (
      Object.values(amounts).some((v) => !Number.isSafeInteger(v) || v < 0) ||
      Object.values(amounts).reduce((a, b) => a + b, 0) !== total
    )
      throw Error(`Invalid split on receipt ${e.id}`);
    return { e, total, amounts };
  });
  if (planned.some((p) => p.amounts.unallocated > 0))
    definitions.push(["unallocated", "Unallocated", "receipt", "#69746f"]);
  if (
    new Set(definitions.map((d) => d[1].toLowerCase())).size !==
    definitions.length
  )
    throw Error("Pet name conflicts with a category name");
  const ids = Object.fromEntries(
    definitions.map((d) => [d[0], crypto.randomUUID()]),
  );
  db.transaction(() => {
    const cols = new Set(
      db
        .prepare("PRAGMA table_info(users)")
        .all()
        .map((c) => c.name),
    );
    if (!cols.has("role"))
      db.exec(
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member'))",
      );
    if (!cols.has("active"))
      db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
    if (!cols.has("auth_version"))
      db.exec(
        "ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0",
      );
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_username_nocase ON users(username COLLATE NOCASE)",
    );
    db.prepare(
      "UPDATE users SET role=CASE WHEN id=? THEN 'admin' ELSE 'member' END, auth_version=auth_version+1",
    ).run(options.adminUserId);
    db.exec("DROP TABLE expenses");
    db.exec(schema);
    definitions.forEach(([key, name, icon, color], i) =>
      db
        .prepare(
          "INSERT INTO categories(id,name,icon,color,kind,position) VALUES(?,?,?,?,?,?)",
        )
        .run(
          ids[key],
          name,
          icon,
          color,
          key === "pet" ? "pet" : "category",
          i,
        ),
    );
    db.prepare("INSERT INTO household VALUES(1,?,?,?,?,?)").run(
      options.name,
      options.currency,
      ids.food,
      options.map_lat,
      options.map_lon,
    );
    const receipt = db.prepare(
      "INSERT INTO expenses(id,user_id,amount_cents,location,description,date,created_at) VALUES(?,?,?,?,?,?,?)",
    );
    const allocation = db.prepare("INSERT INTO allocations VALUES(?,?,?)");
    for (const { e, total, amounts } of planned) {
      receipt.run(
        e.id,
        e.user_id,
        total,
        e.location || "",
        e.description || "",
        e.date,
        e.created_at,
      );
      for (const [key, amount] of Object.entries(amounts))
        if (amount) allocation.run(e.id, ids[key], amount);
    }
    if (db.pragma("foreign_key_check").length)
      throw Error("Foreign key validation failed");
    if (db.prepare("SELECT count(*) n FROM expenses").get().n !== old.length)
      throw Error("Receipt count mismatch");
  })();
  return {
    receipts: old.length,
    totalCents: planned.reduce((sum, p) => sum + p.total, 0),
    users: users.length,
    categories: definitions.length,
  };
};
