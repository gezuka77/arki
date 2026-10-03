import { useState, useId } from "react";
import {
  formatCurrency,
  formatDate,
  localDate,
  parseAmount,
  parseDate,
} from "../utils/format";
import { categories, categoryDetails, household } from "../utils/expenses";
import SplitSliders from "./SplitSliders";
import PlacePicker from "./PlacePicker";
import { api } from "../api";
export default function ExpenseEditor({
  expense,
  suggestions = {},
  onSave,
  onCancel,
}) {
  const id = useId();
  const available = Object.values(categoryDetails).filter(
    (c) => c.active || expense?.allocations.some((a) => a.category_id === c.id),
  );
  const [selected, setSelected] = useState(
    expense?.allocations.map((a) => a.category_id) || [
      household.default_category,
    ],
  );
  const [amounts, setAmounts] = useState(
    Object.fromEntries(
      (expense?.allocations || []).map((a) => [a.category_id, a.amount_cents]),
    ),
  );
  const [totalText, setTotalText] = useState(
    expense ? formatCurrency(expense.amount) : "",
  );
  const [values, setValues] = useState({
    location: expense?.location || "",
    description: expense?.description || "",
    date: formatDate(expense?.date || localDate()),
  });
  const [locks, setLocks] = useState({}),
    [splitErrors, setSplitErrors] = useState({}),
    [version, setVersion] = useState(0),
    [place, setPlace] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const total = parseAmount(totalText),
    totalCents = Math.round(total * 100);
  const valid =
    Number.isFinite(total) &&
    total > 0 &&
    selected.length > 0 &&
    selected.reduce((s, k) => s + (amounts[k] || 0), 0) === totalCents;
  const reset = () => {
    setLocks({});
    setSplitErrors({});
    setVersion((v) => v + 1);
  };
  const toggle = (key) => {
    reset();
    if (selected.includes(key)) {
      if (selected.length === 1) return;
      const rest = selected.filter((k) => k !== key);
      const next = { ...amounts };
      next[rest[0]] = (next[rest[0]] || 0) + (next[key] || 0);
      delete next[key];
      setSelected(rest);
      setAmounts(next);
    } else {
      setSelected([...selected, key]);
      setAmounts({ ...amounts, [key]: 0 });
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const date = parseDate(values.date);
    if (!date || !valid || Object.values(splitErrors).some(Boolean))
      return setError(
        "Enter a valid date and make sure category amounts add up to the bill total.",
      );
    setBusy(true);
    try {
      if (place && values.location.trim())
        await api.savePlace({ ...place, name: values.location.trim() });
      await onSave({
        amount: total,
        allocations: selected
          .filter((k) => amounts[k] > 0)
          .map((k) => ({ category_id: k, amount_cents: amounts[k] })),
        ...values,
        date,
        location: values.location.trim(),
        description: values.description.trim(),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="expense-editor" onSubmit={submit}>
      <fieldset disabled={busy} className="editor-fields">
        <label className="block bill-total">
          Bill total ({household.currency})
          <input
            className="field"
            inputMode="decimal"
            value={totalText}
            required
            autoFocus={!expense}
            onChange={(e) => {
              setTotalText(e.target.value);
              reset();
              const n = parseAmount(e.target.value);
              if (Number.isFinite(n) && n > 0) {
                const old = selected.reduce((s, k) => s + (amounts[k] || 0), 0),
                  c = Math.round(n * 100);
                let left = c;
                const next = {};
                selected.forEach((k, i) => {
                  next[k] =
                    i === selected.length - 1
                      ? left
                      : old
                        ? Math.min(
                            left,
                            Math.floor((c * (amounts[k] || 0)) / old),
                          )
                        : i === 0
                          ? c
                          : 0;
                  left -= next[k];
                });
                setAmounts(next);
              }
            }}
          />
        </label>
        <fieldset className="category-picker">
          <legend>What is on this receipt?</legend>
          <p className="muted">
            Choose one or more categories. Each named pet is tracked separately.
          </p>
          <div className="category-options">
            {available.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  disabled={selected.length === 1 && selected[0] === c.id}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
                {!c.active ? " (archived)" : ""}
              </label>
            ))}
          </div>
        </fieldset>
        {selected.length > 1 && (
          <div className="split-panel">
            <p className="font-semibold">Split this receipt</p>
            <p className="muted">
              These category amounts are approximate. The whole bill is counted
              once.
            </p>
            <SplitSliders
              key={version}
              amounts={Object.fromEntries(
                selected.map((k) => [k, amounts[k] || 0]),
              )}
              labels={categories}
              valid={valid}
              locks={locks}
              setLocks={setLocks}
              onChange={(next) => {
                setAmounts(next);
                setError("");
              }}
              onError={(key, message) =>
                setSplitErrors((prev) => ({ ...prev, [key]: message }))
              }
            />
            <p className="muted">
              Changing the bill total or selected categories clears the locks.
            </p>
          </div>
        )}
        <div className="editor-meta">
          <label>
            Location
            <input
              className="field"
              value={values.location}
              maxLength={200}
              list={`${id}-locations`}
              onChange={(e) => {
                setValues({ ...values, location: e.target.value });
                setPlace(null);
              }}
            />
            <datalist id={`${id}-locations`}>
              {(suggestions.locations || []).map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <div className="editor-place-picker">
            <PlacePicker
              name={values.location}
              onChoose={(p) => {
                setPlace(p);
                setValues({ ...values, location: p.name });
              }}
            />
            {place && (
              <p className="place-confirmed">
                Selected: {place.name}. Save the receipt to confirm this
                location.
              </p>
            )}
          </div>
          <label className="description-field">
            Description (optional)
            <input
              className="field"
              maxLength={2000}
              value={values.description}
              onChange={(e) =>
                setValues({ ...values, description: e.target.value })
              }
            />
          </label>
          <label>
            Date (DD/MM/YYYY)
            <input
              className="field"
              value={values.date}
              onChange={(e) => setValues({ ...values, date: e.target.value })}
              required
              maxLength={10}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </button>
          {onCancel && (
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
