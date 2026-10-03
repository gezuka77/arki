const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  crypto = require("crypto"),
  express = require("express");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "household-public-"));
process.env.DB_PATH = path.join(dir, "household.db");
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.SETUP_TOKEN = crypto.randomBytes(32).toString("hex");
const db = require("../db");
const app = express();
app.use(express.json());
app.use("/api", require("../routes/household"));
app.use("/api/auth", require("../routes/auth"));
app.use("/api/expenses", require("../routes/expenses"));
app.use("/api/places", require("../routes/places"));
app.use("/api/budgets", require("../routes/budgets"));
app.use((e, req, res, next) =>
  res.status(e.status || 500).json({ error: e.message }),
);
test("fresh setup, permissions, dynamic categories/pets, allocations, archiving and session revocation", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    require("../place-service").store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (route, method = "GET", body, token) =>
    fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const pw = crypto.randomBytes(16).toString("hex");
  const payload = {
    setupToken: process.env.SETUP_TOKEN,
    household: {
      name: "Test household",
      currency: "EUR",
      map_lat: 0,
      map_lon: 0,
    },
    categories: [
      { name: "Food", icon: "grocery", color: "#37795a" },
      { name: "Milo", icon: "cat", color: "#467b9d", kind: "pet" },
      { name: "Travel", icon: "transport", color: "#69746f" },
    ],
    users: [
      { username: "Owner", password: pw, role: "admin" },
      { username: "Member", password: pw, role: "member" },
    ],
  };
  assert.equal((await (await request("/setup")).json()).initialized, false);
  assert.equal((await request("/household")).status, 401);
  assert.equal(
    (await request("/setup", "POST", { ...payload, setupToken: "wrong" }))
      .status,
    403,
  );
  assert.equal(
    (await request("/setup", "POST", { ...payload, categories: [] })).status,
    400,
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 0);
  const setups = await Promise.all([
    request("/setup", "POST", payload),
    request("/setup", "POST", payload),
  ]);
  assert.deepEqual(setups.map((r) => r.status).sort(), [201, 409]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 2);
  assert.notEqual(
    db.prepare("SELECT password FROM users LIMIT 1").get().password,
    pw,
  );
  const login = async (username) =>
    (
      await (
        await request("/auth/login", "POST", { username, password: pw })
      ).json()
    ).token;
  const admin = await login("Owner"),
    member = await login("Member");
  assert.ok(admin && member);
  const config = await (
    await request("/household", "GET", undefined, admin)
  ).json();
  assert.equal(config.categories.length, 3);
  assert.equal(config.categories[1].name, "Milo");
  assert.equal(config.user.role, "admin");
  assert.ok(!JSON.stringify(config).includes(pw));
  assert.equal((await request("/users", "GET", undefined, member)).status, 403);
  assert.equal(
    (await request("/categories", "POST", payload.categories[0], member))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/users/" + config.user.userId,
        "PUT",
        { role: "member" },
        admin,
      )
    ).status,
    400,
  );
  const [food, pet, travel] = config.categories.map((c) => c.id);
  const expense = {
    amount: 100.01,
    date: "2026-10-03",
    location: "Example shop",
    description: "Mixed bill",
    allocations: [
      { category_id: food, amount_cents: 6000 },
      { category_id: pet, amount_cents: 3001 },
      { category_id: travel, amount_cents: 1000 },
    ],
  };
  const created = await request("/expenses", "POST", expense, member);
  assert.equal(created.status, 201);
  const receipt = await created.json();
  assert.equal(receipt.username, "Member");
  assert.equal(receipt.amount_cents, 10001);
  for (const allocations of [
    [],
    [{ category_id: food, amount_cents: 10000 }],
    [{ category_id: "missing", amount_cents: 10001 }],
    [
      { category_id: food, amount_cents: 5000 },
      { category_id: food, amount_cents: 5001 },
    ],
    [{ category_id: food, amount_cents: -1 }],
  ])
    assert.equal(
      (await request("/expenses", "POST", { ...expense, allocations }, member))
        .status,
      400,
    );
  assert.equal(
    (await request("/categories/" + pet, "PUT", { name: "Milo cat" }, admin))
      .status,
    200,
  );
  assert.equal(
    (await request("/categories/" + pet, "PUT", { active: 0 }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/expenses", "POST", expense, member)).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/expenses/" + receipt.id,
        "PUT",
        { description: "Edited archived allocation" },
        member,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/categories/" + food, "PUT", { active: 0 }, admin)).status,
    400,
  );
  assert.equal(
    (await request("/household", "PUT", { ...config, currency: "USD" }, admin))
      .status,
    400,
  );
  assert.equal(
    (await request("/budgets/2026-10", "PUT", { amount: 500 }, member)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/categories",
        "POST",
        { name: "Clover", icon: "dog", color: "#af6b50", kind: "pet" },
        admin,
      )
    ).status,
    201,
  );
  assert.equal(
    (await (await request("/household", "GET", undefined, admin)).json())
      .categories.length,
    4,
  );
  const memberId = db
    .prepare("SELECT id FROM users WHERE username='Member'")
    .get().id;
  assert.equal(
    (await request("/users/" + memberId, "PUT", { active: 0 }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/expenses", "GET", undefined, member)).status,
    401,
  );
  assert.equal(
    (await request("/auth/login", "POST", { username: "Member", password: pw }))
      .status,
    401,
  );
  assert.equal(
    (await (await request("/expenses", "GET", undefined, admin)).json()).length,
    1,
  );
});
