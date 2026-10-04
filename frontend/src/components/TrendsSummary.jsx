import { summarize, household } from "../utils/expenses";
import { formatCurrency, localDate } from "../utils/format";
export default function TrendsSummary({ expenses }) {
  const year = localDate().slice(0, 4),
    rows = expenses.filter((e) => e.date.startsWith(year)),
    stats = summarize(rows);
  return (
    <section className="trends-summary" aria-label={`${year} spending summary`}>
      <div>
        <p>Spent in {year}</p>
        <strong>
          {formatCurrency(stats.total / 100)}{" "}
          <small>{household.currency}</small>
        </strong>
      </div>
      <div>
        <p>Receipts this year</p>
        <strong>{rows.length}</strong>
      </div>
      <div>
        <p>Average receipt</p>
        <strong>
          {formatCurrency(rows.length ? stats.total / 100 / rows.length : 0)}{" "}
          <small>{household.currency}</small>
        </strong>
      </div>
    </section>
  );
}
