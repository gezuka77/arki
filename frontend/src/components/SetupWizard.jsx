import { useState, useRef } from "react";
import Icon from "./Icon";
import { api } from "../api";
export function CategoryFields({ value, onChange, icons }) {
  return (
    <div className="category-edit-fields">
      <label>
        Name
        <input
          className="field"
          value={value.name}
          maxLength={80}
          required
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <label>
        Icon
        <select
          aria-label="Icon"
          className="field"
          value={value.icon}
          onChange={(e) => onChange({ ...value, icon: e.target.value })}
        >
          {icons.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <label>
        Colour
        <input
          className="field color-field"
          type="color"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
        />
      </label>
      <span className="category-icon" style={{ color: value.color }}>
        <Icon name={value.icon} />
      </span>
    </div>
  );
}
export default function SetupWizard({ options, onComplete }) {
  const [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const form = useRef();
  const [household, setHousehold] = useState({
    name: "My household",
    currency: "EUR",
    map_lat: 0,
    map_lon: 0,
  });
  const [token, setToken] = useState("");
  const [categories, setCategories] = useState(
    options.presets.slice(0, 4).map((c) => ({ ...c, kind: "category" })),
  );
  const [users, setUsers] = useState([
    { username: "", password: "", confirmation: "", role: "admin" },
  ]);
  const names = ["Household", "Categories & pets", "People", "Review"];
  const next = async (e) => {
    e.preventDefault();
    setError("");
    if (
      step === 1 &&
      (categories.length === 0 ||
        new Set(categories.map((c) => c.name.trim().toLowerCase())).size !==
          categories.length)
    )
      return setError(
        "Choose at least one category, with a unique name for each category and pet.",
      );
    if (step === 2 && users.some((u) => u.password !== u.confirmation))
      return setError("Passwords and confirmations must match.");
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await api.setup({
        setupToken: token,
        household,
        categories,
        users: users.map(({ confirmation, ...u }) => u),
      });
      setToken("");
      setUsers([]);
      await onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="setup-page">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="basket" size={28} />
        </span>
        <strong>Arki Tracker</strong>
      </div>
      <h1>Make room for your everyday.</h1>
      <p className="muted">
        One household, your people, your categories. Set up once and adjust
        things later.
      </p>
      <ol className="setup-steps">
        {names.map((n, i) => (
          <li key={n} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {n}
          </li>
        ))}
      </ol>
      <form ref={form} className="panel setup-panel" onSubmit={next}>
        <fieldset disabled={busy}>
          <h2>{names[step]}</h2>
          {step === 0 && (
            <div className="form-stack">
              <label>
                Installation setup token
                <input
                  className="field"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  minLength={24}
                />
              </label>
              <p className="muted">
                Use SETUP_TOKEN from the .env file created on your server. This
                prevents someone else claiming a new installation.
              </p>
              <label>
                Household name
                <input
                  className="field"
                  value={household.name}
                  onChange={(e) =>
                    setHousehold({ ...household, name: e.target.value })
                  }
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Currency
                <select
                  aria-label="Currency"
                  className="field"
                  value={household.currency}
                  onChange={(e) =>
                    setHousehold({ ...household, currency: e.target.value })
                  }
                >
                  {options.currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Dates use DD/MM/YYYY. Each installation uses one currency; it
                cannot change after you record receipts.
              </p>
              <details>
                <summary>Optional starting area for manual maps</summary>
                <p className="muted">
                  Nearby shops still use your phone location when you ask. Leave
                  this at zero to start with a world map.
                </p>
                {["map_lat", "map_lon"].map((key, i) => (
                  <label key={key}>
                    {i ? "Longitude" : "Latitude"}
                    <input
                      className="field"
                      type="number"
                      step="any"
                      min={i ? -180 : -90}
                      max={i ? 180 : 90}
                      value={household[key]}
                      onChange={(e) =>
                        setHousehold({
                          ...household,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </details>
            </div>
          )}
          {step === 1 && (
            <>
              <p className="muted">
                Select presets, add your own categories, and give each pet its
                own name. The first category becomes the initial allocation for
                new receipts.
              </p>
              <div className="preset-grid">
                {options.presets.map((p) => (
                  <label key={p.name}>
                    <input
                      type="checkbox"
                      checked={categories.some((c) => c.name === p.name)}
                      onChange={(e) =>
                        setCategories(
                          e.target.checked
                            ? [...categories, { ...p, kind: "category" }]
                            : categories.filter((c) => c.name !== p.name),
                        )
                      }
                    />
                    <Icon name={p.icon} />
                    {p.name}
                  </label>
                ))}
              </div>
              {categories.map((c, i) => (
                <div className="setup-category" key={i}>
                  <p className="eyebrow">
                    {c.kind === "pet" ? "Named pet" : "Category"}
                  </p>
                  <CategoryFields
                    value={c}
                    icons={options.icons}
                    onChange={(v) =>
                      setCategories(categories.map((c, n) => (n === i ? v : c)))
                    }
                  />
                  <button
                    type="button"
                    className="text-action"
                    onClick={() =>
                      setCategories(categories.filter((_, n) => n !== i))
                    }
                  >
                    Remove {c.name || "category"}
                  </button>
                </div>
              ))}
              <div className="editor-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={categories.length >= 20}
                  onClick={() =>
                    setCategories([
                      ...categories,
                      {
                        name: "",
                        icon: "receipt",
                        color: "#69746f",
                        kind: "category",
                      },
                    ])
                  }
                >
                  Add custom category
                </button>
                <button
                  className="secondary"
                  type="button"
                  disabled={categories.length >= 20}
                  onClick={() =>
                    setCategories([
                      ...categories,
                      { name: "", icon: "dog", color: "#af6b50", kind: "pet" },
                    ])
                  }
                >
                  Add a pet
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="muted">
                Each person signs in with their own account. Administrators
                manage the household and accounts; all members can manage shared
                receipts and the budget.
              </p>
              {users.map((u, i) => (
                <div key={i} className="setup-category form-stack">
                  <h3>
                    {i === 0
                      ? "First administrator"
                      : `Household member ${i + 1}`}
                  </h3>
                  <label>
                    Username
                    <input
                      className="field"
                      required
                      maxLength={60}
                      autoComplete="off"
                      value={u.username}
                      onChange={(e) =>
                        setUsers(
                          users.map((u, n) =>
                            n === i ? { ...u, username: e.target.value } : u,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Password
                    <input
                      className="field"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      value={u.password}
                      onChange={(e) =>
                        setUsers(
                          users.map((u, n) =>
                            n === i ? { ...u, password: e.target.value } : u,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      className="field"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={u.confirmation}
                      onChange={(e) =>
                        setUsers(
                          users.map((u, n) =>
                            n === i
                              ? { ...u, confirmation: e.target.value }
                              : u,
                          ),
                        )
                      }
                    />
                  </label>
                  {i > 0 && (
                    <>
                      <label>
                        Role
                        <select
                          aria-label="Role"
                          className="field"
                          value={u.role}
                          onChange={(e) =>
                            setUsers(
                              users.map((u, n) =>
                                n === i ? { ...u, role: e.target.value } : u,
                              ),
                            )
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="text-action"
                        onClick={() =>
                          setUsers(users.filter((_, n) => n !== i))
                        }
                      >
                        Remove member
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={users.length >= 20}
                onClick={() =>
                  setUsers([
                    ...users,
                    {
                      username: "",
                      password: "",
                      confirmation: "",
                      role: "member",
                    },
                  ])
                }
              >
                Add household member
              </button>
            </>
          )}
          {step === 3 && (
            <div className="form-stack">
              <p>
                <strong>{household.name}</strong> · {household.currency} ·
                DD/MM/YYYY
              </p>
              <h3>Categories and pets</h3>
              <ul>
                {categories.map((c, i) => (
                  <li key={i}>
                    {c.name}
                    {c.kind === "pet" ? " (pet)" : ""}
                    {i === 0 ? " · default" : ""}
                  </li>
                ))}
              </ul>
              <h3>People</h3>
              <ul>
                {users.map((u, i) => (
                  <li key={i}>
                    {u.username} · {u.role}
                  </li>
                ))}
              </ul>
              <p className="muted">
                No sample receipts are created. Setup will close after your
                household is created.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="editor-actions">
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            <button className="primary">
              {busy
                ? "Creating household…"
                : step === 3
                  ? "Create household"
                  : "Continue"}
            </button>
          </div>
        </fieldset>
      </form>
    </main>
  );
}
