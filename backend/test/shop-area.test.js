const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  crypto = require("crypto");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arki-area-"));
process.env.DB_PATH = path.join(dir, "household.db");
process.env.SETUP_TOKEN = crypto.randomBytes(32).toString("hex");
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.SHOP_DIRECTORY_BBOX = "10,20,11,21";
process.env.PLACES_REFRESH_DISABLED = "1";
const db = require("../db"),
  area = require("../shop-area"),
  service = require("../place-service");
const { PlaceStore } = require("../place-store");
test("area selection overrides legacy configuration, disabling is explicit and sparse-region imports work", () => {
  assert.equal(service.directoryStatus().source, "server");
  assert.equal(service.directoryStatus().configured, true);
  const selected = {
    label: "Example city",
    latitude: 15,
    longitude: 25,
    radius: 10,
  };
  assert.equal(area.valid(selected), true);
  assert.equal(area.valid({ ...selected, radius: 1000 }), false);
  assert.equal(area.valid({ ...selected, latitude: 90 }), false);
  area.save(selected);
  assert.deepEqual(area.read(), selected);
  assert.equal(service.directoryStatus().source, "household");
  let region = area.bounds(selected);
  const s = new PlaceStore(":memory:", Date.now, () => region);
  const data = {
    elements: [
      { type: "node", id: 1, tags: { name: "Example shop" }, lat: 15, lon: 25 },
    ],
  };
  s.import(data);
  assert.equal(s.covers(15, 25), true);
  assert.equal(s.nearby(15, 25).length, 1);
  region = area.bounds({ ...selected, latitude: 16 });
  assert.equal(s.covers(15, 25), false);
  assert.deepEqual(s.search("Example"), []);
  s.import({ elements: [] });
  assert.equal(s.status().count, 0);
  assert.throws(
    () => s.import({ elements: [], remark: "timeout" }),
    /Incomplete/,
  );
  area.save(null);
  assert.equal(service.directoryStatus().configured, false);
  s.close();
});
test("setup area search requires the installation token and closes after setup; members cannot change area", async () => {
  const express = require("express"),
    app = express();
  app.use(express.json());
  app.use("/api", require("../routes/household"));
  app.use((e, req, res, next) => res.status(500).json({ error: e.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const old = service.searchArea;
  let calls = 0;
  service.searchArea = async () => {
    calls++;
    return [{ name: "Example city", latitude: 15, longitude: 25 }];
  };
  const post = (route, body, token) =>
    fetch(base + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post("/api/setup/area-search", { query: "Example" })).status,
      403,
    );
    assert.equal(calls, 0);
    const res = await post("/api/setup/area-search", {
      query: "Example",
      setupToken: process.env.SETUP_TOKEN,
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json())[0].name, "Example city");
    const payload = {
      setupToken: process.env.SETUP_TOKEN,
      household: {
        name: "Example household",
        currency: "EUR",
        map_lat: 15,
        map_lon: 25,
        shop_area: {
          label: "Example city",
          latitude: 15,
          longitude: 25,
          radius: 10,
        },
      },
      categories: [{ name: "Food", icon: "grocery", color: "#37795a" }],
      users: [
        {
          username: "Owner",
          password: crypto.randomBytes(16).toString("hex"),
          role: "admin",
        },
        {
          username: "Member",
          password: crypto.randomBytes(16).toString("hex"),
          role: "member",
        },
      ],
    };
    assert.equal((await post("/api/setup", payload)).status, 201);
    assert.equal(area.read().label, "Example city");
    assert.equal(
      (
        await post("/api/setup/area-search", {
          query: "Example",
          setupToken: process.env.SETUP_TOKEN,
        })
      ).status,
      409,
    );
    const member = db.prepare("SELECT * FROM users WHERE role='member'").get(),
      token = require("jsonwebtoken").sign(
        { userId: member.id, authVersion: 0 },
        process.env.JWT_SECRET,
      );
    assert.equal(
      (await post("/api/household/area-search", { query: "Example" }, token))
        .status,
      403,
    );
  } finally {
    service.searchArea = old;
    await new Promise((r) => server.close(r));
    service.store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
