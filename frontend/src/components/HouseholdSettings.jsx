import ShopArea from "./ShopArea";
import { useState, useEffect } from "react";
import { api } from "../api";
import { CategoryFields } from "./SetupWizard";
export default function HouseholdSettings({ config, onUpdated }) {
  const [form, setForm] = useState({ ...config }),
    [cats, setCats] = useState(config.categories),
    [users, setUsers] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [newCat, setNewCat] = useState({
      name: "",
      icon: "receipt",
      color: "#69746f",
      kind: "category",
    }),
    [newUser, setNewUser] = useState({
      username: "",
      password: "",
      role: "member",
    }),
    [resets, setResets] = useState({});
  useEffect(() => {
    setForm({ ...config });
    setCats(config.categories);
    api
      .getUsers()
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, [config]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await onUpdated();
      setUsers(await api.getUsers());
      setNotice("Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel household-settings">
      <h2 className="section-title">Household administration</h2>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="place-confirmed">
          {notice}
        </p>
      )}
      <fieldset disabled={busy}>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.saveHousehold(form));
          }}
        >
          <label>
            Household name
            <input
              className="field"
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Currency
            <select
              aria-label="Currency"
              className="field"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {config.currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Default category
            <select
              aria-label="Default category"
              className="field"
              value={form.default_category}
              onChange={(e) =>
                setForm({ ...form, default_category: e.target.value })
              }
            >
              {cats
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <ShopArea
            value={form.shop_area}
            directory={config.shop_directory}
            onChange={(area) =>
              setForm({
                ...form,
                shop_area: area,
                ...(area
                  ? { map_lat: area.latitude, map_lon: area.longitude }
                  : {}),
              })
            }
          />
          <button className="primary">Save household</button>
        </form>
        <h3>Categories and named pets</h3>
        <p className="muted">
          Renaming updates labels on existing receipts. Archiving hides a
          category from new receipts and preserves its history.
        </p>
        {cats.map((c, i) => (
          <form
            key={c.id}
            className="setup-category"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api.updateCategory(c.id, c));
            }}
          >
            <CategoryFields
              value={c}
              icons={config.icons}
              onChange={(v) => setCats(cats.map((c, n) => (n === i ? v : c)))}
            />
            <p className="muted">
              {c.kind === "pet" ? "Pet" : "Category"} ·{" "}
              {c.active ? "Active" : "Archived"}
            </p>
            <div className="editor-actions">
              <button className="secondary">Save {c.name}</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  run(() =>
                    api.updateCategory(c.id, { active: c.active ? 0 : 1 }),
                  )
                }
              >
                {c.active ? "Archive" : "Restore"}
              </button>
            </div>
          </form>
        ))}
        <form
          className="setup-category"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.addCategory(newCat);
              setNewCat({ ...newCat, name: "" });
            });
          }}
        >
          <h3>Add a category or pet</h3>
          <label>
            Type
            <select
              aria-label="Type"
              className="field"
              value={newCat.kind}
              onChange={(e) =>
                setNewCat({
                  ...newCat,
                  kind: e.target.value,
                  icon: e.target.value === "pet" ? "dog" : "receipt",
                })
              }
            >
              <option value="category">Category</option>
              <option value="pet">Named pet</option>
            </select>
          </label>
          <CategoryFields
            value={newCat}
            icons={config.icons}
            onChange={setNewCat}
          />
          <button className="primary">Add category</button>
        </form>
        <h3>Household users</h3>
        <p className="muted">
          Deactivated accounts keep their receipt history. Role, password and
          status changes revoke existing sessions.
        </p>
        {users.map((u) => (
          <div className="setup-category" key={u.id}>
            <h4>
              {u.username} · {u.role} · {u.active ? "Active" : "Inactive"}
            </h4>
            {u.id !== config.user.userId && (
              <>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      run(() =>
                        api.updateUser(u.id, { active: u.active ? 0 : 1 }),
                      )
                    }
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      run(() =>
                        api.updateUser(u.id, {
                          role: u.role === "admin" ? "member" : "admin",
                        }),
                      )
                    }
                  >
                    Make {u.role === "admin" ? "member" : "administrator"}
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api.updateUser(u.id, { password: resets[u.id] });
                      setResets({ ...resets, [u.id]: "" });
                    });
                  }}
                >
                  <label>
                    New password for {u.username}
                    <input
                      className="field"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={resets[u.id] || ""}
                      onChange={(e) =>
                        setResets({ ...resets, [u.id]: e.target.value })
                      }
                    />
                  </label>
                  <button className="secondary">Reset password</button>
                </form>
              </>
            )}
          </div>
        ))}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.addUser(newUser);
              setNewUser({ username: "", password: "", role: "member" });
            });
          }}
        >
          <h3>Add a household member</h3>
          <label>
            Username
            <input
              className="field"
              required
              maxLength={60}
              value={newUser.username}
              onChange={(e) =>
                setNewUser({ ...newUser, username: e.target.value })
              }
            />
          </label>
          <label>
            Initial password
            <input
              className="field"
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
            />
          </label>
          <label>
            Role
            <select
              aria-label="Role"
              className="field"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <button className="primary">Create user</button>
        </form>
      </fieldset>
    </section>
  );
}
