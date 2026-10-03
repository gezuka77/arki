import { formatCurrency, localDate } from "../utils/format";
import { summarize, categoryDetails, household } from "../utils/expenses";
import Icon from "./Icon";
export default function MonthlyStats({ expenses, yearOnly = false }) {
  const period = localDate().slice(0, yearOnly ? 4 : 7),
    selected = expenses.filter((e) => e.date.startsWith(period)),
    totals = summarize(selected);
  return (
    <section className="spending-overview">
      <div className="total-card">
        <div>
          <p className="eyebrow">
            {yearOnly
              ? period
              : new Date(`${period}-01T12:00:00`).toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
          </p>
          <h2>Total spent</h2>
          <p className="hero-amount">
            <span>{household.currency} </span>
            {formatCurrency(totals.total / 100)}
          </p>
          <p className="total-caption">
            {selected.length} {selected.length === 1 ? "receipt" : "receipts"} ·
            All categories
          </p>
        </div>
        <div className="contributions">
          <p>Paid by</p>
          {Object.entries(totals.users).map(([name, amount]) => (
            <div key={name}>
              <span className="small-avatar">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="contributor-name">{name}</span>
              <strong>{formatCurrency(amount / 100)}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="category-cards">
        {Object.values(categoryDetails)
          .filter((c) => c.active || totals.byCategory[c.id])
          .map((c) => (
            <div
              key={c.id}
              className="category-card"
              style={{ "--category": c.color }}
            >
              <div className="category-top">
                <span className="category-icon">
                  <Icon name={c.icon} />
                </span>
                <span className="category-caption">
                  {c.kind === "pet"
                    ? "Pet expenses"
                    : !c.active
                      ? "Archived"
                      : "Your spending"}
                </span>
              </div>
              <h3>{c.name}</h3>
              <p>
                {household.currency}{" "}
                {formatCurrency((totals.byCategory[c.id] || 0) / 100)}
              </p>
              <div className="mini-track" aria-hidden="true">
                <span
                  style={{
                    width: `${totals.total ? ((totals.byCategory[c.id] || 0) / totals.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
