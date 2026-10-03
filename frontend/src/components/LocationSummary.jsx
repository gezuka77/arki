import { household } from "../utils/expenses";
import { useState } from "react";
import { api } from "../api";
import { formatCurrency } from "../utils/format";
import { summarize } from "../utils/expenses";
export default function LocationSummary({ expenses, onLocationUpdated }) {
  const [editing, setEditing] = useState(null);
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
  if (!rows.length) return null;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Where you spend</h2>
          <p className="muted">
            All-time spending by shop, restaurant and café.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="space-y-3">
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
                <p className="text-sm text-gray-600 my-2">
                  Renames this location on all bills. An existing name will
                  combine their totals.
                </p>
                <button disabled={busy || !name.trim()} className="primary">
                  Save
                </button>
                <button
                  disabled={busy}
                  className="secondary ml-2"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0 break-words">
                    <h3 className="font-semibold">
                      {row.location || "No location"}
                    </h3>
                    <p className="text-sm">{row.count} bills</p>
                  </div>
                  <p className="font-bold whitespace-nowrap">
                    {household.currency} {formatCurrency(row.total / 100)}
                  </p>
                </div>
                <div className="text-sm text-gray-600 flex flex-wrap gap-3 mt-2">
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
                {row.location && (
                  <button
                    className="text-button mt-2"
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
          className="secondary mt-4"
          onClick={() => setCount((n) => n + 5)}
        >
          Show more
        </button>
      )}
    </section>
  );
}
