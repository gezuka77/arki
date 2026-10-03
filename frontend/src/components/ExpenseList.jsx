import { useState } from "react";
import { api } from "../api";
import {
  categories,
  categoryDetails,
  filterExpenses,
  summarize,
  expensesCsv,
  household,
} from "../utils/expenses";
import { formatCurrency, formatDate } from "../utils/format";
import ExpenseEditor from "./ExpenseEditor";
import Icon from "./Icon";
export default function ExpenseList({
  expenses,
  compact,
  onViewAll,
  onAdd,
  onExpenseDeleted,
  onExpenseUpdated,
}) {
  const [filters, setFilters] = useState({
      month: "",
      category: "",
      location: "",
    }),
    [editing, setEditing] = useState(null),
    [error, setError] = useState("");
  const rows = compact
    ? expenses.slice(0, 5)
    : filterExpenses(expenses, filters);
  const total = summarize(rows);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([expensesCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "household-expenses.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2 className="section-title">
          {compact ? "Recent expenses" : "Receipts"}
        </h2>
        {compact ? (
          <button className="text-action" onClick={onViewAll}>
            View all →
          </button>
        ) : (
          <button className="secondary" onClick={download}>
            Export CSV
          </button>
        )}
      </div>
      {!compact && (
        <>
          <div className="filter-grid">
            <label>
              Month
              <select
                className="field"
                value={filters.month}
                onChange={(e) =>
                  setFilters({ ...filters, month: e.target.value })
                }
              >
                <option value="">All months</option>
                {[...new Set(expenses.map((e) => e.date.slice(0, 7)))].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Category
              <select
                aria-label="Category filter"
                className="field"
                value={filters.category}
                onChange={(e) =>
                  setFilters({ ...filters, category: e.target.value })
                }
              >
                <option value="">All categories</option>
                {Object.entries(categories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                className="field"
                value={filters.location}
                onChange={(e) =>
                  setFilters({ ...filters, location: e.target.value })
                }
              >
                <option value="">All shops</option>
                {[
                  ...new Set(expenses.map((e) => e.location).filter(Boolean)),
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            {rows.length} receipts · {household.currency}{" "}
            {formatCurrency(total.total / 100)} in whole receipts
            {filters.category &&
              ` · ${categories[filters.category]} share ${formatCurrency((total.byCategory[filters.category] || 0) / 100)}`}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {!rows.length && (
        <p className="muted">
          No receipts yet.{" "}
          <button className="text-action" onClick={onAdd}>
            Add an expense
          </button>
        </p>
      )}
      <div className="receipt-list">
        {rows.map((e) => (
          <article key={e.id} className="receipt-item">
            {editing === e.id ? (
              <ExpenseEditor
                expense={e}
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  await api.updateExpense(e.id, value);
                  await onExpenseUpdated();
                  setEditing(null);
                }}
              />
            ) : (
              <>
                <div className="receipt-main">
                  <span className="receipt-symbol">
                    <Icon
                      name={
                        categoryDetails[e.allocations[0]?.category_id]?.icon
                      }
                    />
                  </span>
                  <div className="receipt-description">
                    <h3>{e.location || "Receipt"}</h3>
                    <p>
                      {formatDate(e.date)} · {e.username}
                    </p>
                  </div>
                  <strong className="receipt-amount">
                    {household.currency} {formatCurrency(e.amount)}
                  </strong>
                </div>
                {e.description && (
                  <p className="receipt-note">{e.description}</p>
                )}
                <div className="receipt-bottom">
                  <div className="receipt-tags">
                    {e.allocations.map((a) => (
                      <span key={a.category_id} className="type-tag">
                        {categories[a.category_id]}{" "}
                        {formatCurrency(a.amount_cents / 100)}
                      </span>
                    ))}
                  </div>
                  <div className="receipt-actions">
                    <button onClick={() => setEditing(e.id)}>Edit</button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this receipt?")) return;
                        try {
                          await api.deleteExpense(e.id);
                          await onExpenseDeleted();
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
