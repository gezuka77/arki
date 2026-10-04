import { household } from "../utils/expenses";
import { useState } from "react";
import { api } from "../api";
import { formatCurrency } from "../utils/format";
import { summarize } from "../utils/expenses";
export default function LocationSummary({ expenses, onLocationUpdated }) {
  const [editing, setEditing] = useState(null);
  const [manage, setManage] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(5);
  const groups = new Map();
  for (const expense of expenses) {
    const key = expense.location || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(expense);
  }
  const rows = [...groups]
    .map(([location, values]) => ({
      location,
      count: values.length,
      ...summarize(values),
    }))
    .sort((a, b) => b.total - a.total);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.updateLocation(editing, name.trim());
      setEditing(null);
      await onLocationUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel locations-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Where you spend</h2>
          <p className="muted">Your top places, ranked by all-time spending.</p>
        </div>
        {!!rows.length && (
          <button
            type="button"
            className="text-button"
            aria-pressed={manage}
            onClick={() => {
              setManage(!manage);
              setEditing(null);
            }}
          >
            {manage ? "Done" : "Edit names"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {!rows.length && (
        <p className="trends-empty">
          Your shops and other places will appear here after you add an expense.
        </p>
      )}
      <div className="location-list">
        {rows.slice(0, count).map((row) => (
          <div className="location-row" key={row.location}>
            {editing === row.location ? (
              <form onSubmit={save}>
                <label>
                  Location name
                  <input
                    className="field"
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <p className="muted location-edit-help">
                  Renames this location on all bills. An existing name will
                  combine their totals.
                </p>
                <button disabled={busy || !name.trim()} className="primary">
                  Save
                </button>
                <button
                  disabled={busy}
                  className="secondary location-edit-cancel"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="location-heading">
                  <div className="location-name">
                    <h3 className="location-title">
                      {row.location || "No location"}
                    </h3>
                    <p className="muted">
                      {row.count} {row.count === 1 ? "receipt" : "receipts"}
                    </p>
                  </div>
                  <p className="location-amount">
                    {household.currency} {formatCurrency(row.total / 100)}
                  </p>
                </div>
                <div className="location-payers">
                  {Object.entries(row.users).map(([user, value]) => (
                    <span key={user}>
                      {user}: {household.currency} {formatCurrency(value / 100)}
                    </span>
                  ))}
                </div>
                <div className="location-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${rows[0].total ? (row.total / rows[0].total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {manage && row.location && (
                  <button
                    className="text-button location-rename"
                    onClick={() => {
                      setEditing(row.location);
                      setName(row.location);
                    }}
                  >
                    Rename location
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {rows.length > count && (
        <button
          className="secondary location-more"
          onClick={() => setCount((n) => n + 5)}
        >
          Show more
        </button>
      )}
    </section>
  );
}
