import { household } from "../utils/expenses";
import { useEffect, useState } from "react";
import { api } from "../api";
import { formatCurrency, localDate, parseAmount } from "../utils/format";
import { summarize } from "../utils/expenses";
import Icon from "./Icon";
export default function Budget({ expenses }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [budget, setBudget] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setLoaded(false);
    setError("");
    setBudget(null);
    setInput("");
    setSaved(false);
    api
      .getBudget(month)
      .then((data) => {
        if (active) {
          setBudget(data.amount);
          setInput(data.amount === null ? "" : formatCurrency(data.amount));
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [month, retry]);
  const save = async (e) => {
    e.preventDefault();
    const amount = input.trim() === "" ? null : parseAmount(input);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0))
      return setError("Enter a valid budget, or leave blank to remove it.");
    setBusy(true);
    setError("");
    try {
      const result = await api.setBudget(month, amount);
      setBudget(result.amount);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const spent = summarize(
    expenses.filter((e) => e.date.startsWith(month)),
  ).total;
  const remaining = budget === null ? null : Math.round(budget * 100) - spent;
  const percent =
    budget > 0
      ? Math.min(100, (spent / (budget * 100)) * 100)
      : spent
        ? 100
        : 0;
  return (
    <section className="panel budget-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Monthly budget</h2>
          <p className="muted">One shared limit. All expense types.</p>
        </div>
      </div>
      <label className="budget-month-label">
        Month
        <select
          aria-label="Month"
          className="field"
          value={month}
          disabled={busy}
          onChange={(e) => setMonth(e.target.value)}
        >
          {[
            ...new Set([
              localDate().slice(0, 7),
              month,
              ...expenses.map((e) => e.date.slice(0, 7)),
              ...Array.from({ length: 12 }, (_, i) => {
                const now = new Date();
                return localDate(
                  new Date(now.getFullYear(), now.getMonth() + i + 1, 1),
                ).slice(0, 7);
              }),
            ]),
          ]
            .sort()
            .reverse()
            .map((value) => (
              <option key={value} value={value}>
                {value.slice(5)}/{value.slice(0, 4)}
              </option>
            ))}
        </select>
      </label>
      {busy && !loaded && <p className="muted py-4">Loading budget…</p>}
      {loaded && budget === null && !editing && (
        <div className="budget-empty">
          <span className="budget-illustration">
            <Icon name="basket" size={28} />
          </span>
          <h3>A little room to plan</h3>
          <p>
            Set an optional monthly limit for your household’s spending and all
            the categories you choose.
          </p>
          <button
            className="secondary"
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
          >
            Set a budget <Icon name="plus" size={16} />
          </button>
        </div>
      )}
      {remaining !== null && (
        <div className="budget-summary">
          <span className="eyebrow">
            {remaining < 0 ? "OVER BUDGET" : "LEFT THIS MONTH"}
          </span>
          <p
            className={
              remaining < 0 ? "budget-amount over-budget" : "budget-amount"
            }
          >
            {household.currency} {formatCurrency(Math.abs(remaining) / 100)}
          </p>
          <div
            className={`budget-track ${remaining < 0 ? "over" : ""}`}
            role="progressbar"
            aria-label="Monthly budget used"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${household.currency} ${formatCurrency(spent / 100)} spent of ${household.currency} ${formatCurrency(budget)}`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="budget-totals">
            <span>
              {household.currency} {formatCurrency(spent / 100)} spent
            </span>
            <span>
              {household.currency} {formatCurrency(budget)} budget
            </span>
          </div>
          {!editing && (
            <button
              className="text-button"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              Edit budget
            </button>
          )}
        </div>
      )}
      {editing && (
        <form onSubmit={save} className="budget-form">
          <label>
            Budget ({household.currency})
            <input
              className="field"
              inputMode="decimal"
              placeholder="e.g. 500,00"
              value={input}
              disabled={busy || !loaded}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          </label>
          <p className="muted">Leave blank and save to remove the budget.</p>
          <div className="flex gap-2">
            <button className="primary" disabled={busy || !loaded}>
              {busy ? "Saving…" : "Save budget"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setInput(budget === null ? "" : formatCurrency(budget));
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {saved && (
        <p role="status" className="save-confirmation">
          <Icon name="check" size={16} />
          Budget saved
        </p>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}{" "}
          {!loaded && (
            <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
          )}
        </p>
      )}
    </section>
  );
}
