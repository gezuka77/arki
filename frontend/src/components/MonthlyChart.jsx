import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { summarize, categoryDetails, household } from "../utils/expenses";
import { formatCurrency } from "../utils/format";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);
const monthName = (m) =>
  new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
export default function MonthlyChart({ expenses }) {
  const months = [...new Set(expenses.map((e) => e.date.slice(0, 7)))]
    .sort()
    .slice(-12);
  const stats = months.map((m) =>
    summarize(expenses.filter((e) => e.date.startsWith(m))),
  );
  const total = stats.reduce((sum, s) => sum + s.total, 0);
  const cats = Object.values(categoryDetails).filter((c) =>
    stats.some((s) => s.byCategory[c.id]),
  );
  const single = months.length === 1;
  const range = months.length
    ? single
      ? monthName(months[0])
      : `${monthName(months[0])} – ${monthName(months.at(-1))}`
    : "No receipts yet";
  return (
    <section className="panel chart-panel">
      <div className="trends-panel-heading">
        <div>
          <h2 className="section-title">Monthly spending</h2>
          <p className="muted">{range}</p>
        </div>
        <span className="trends-currency">{household.currency}</span>
      </div>
      {!months.length ? (
        <p className="trends-empty">
          Add your first expense to see your spending over time.
        </p>
      ) : (
        <>
          <div className="trend-total">
            <strong>
              {formatCurrency(total / 100)} <span>{household.currency}</span>
            </strong>
            <p className="muted">
              {single ? "Total this month" : "Total across these months"}
            </p>
          </div>
          <div className={`chart-frame ${single ? "chart-frame-single" : ""}`}>
            <Bar
              role="img"
              aria-label={`Monthly spending in ${household.currency}. Exact figures are available below.`}
              data={{
                labels: months.map(monthName),
                datasets: cats.map((c) => ({
                  label: c.name,
                  backgroundColor: c.color,
                  data: stats.map((s) => (s.byCategory[c.id] || 0) / 100),
                  maxBarThickness: single ? 42 : 36,
                  borderWidth: 0,
                })),
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                indexAxis: single ? "y" : "x",
                scales: {
                  x: {
                    stacked: true,
                    grid: { display: single, color: "#e8ece6" },
                    border: { display: false },
                    ticks: {
                      color: "#5b6a61",
                      maxRotation: 0,
                      autoSkip: true,
                      maxTicksLimit: 6,
                      ...(single
                        ? { callback: (v) => formatCurrency(Number(v)) }
                        : {}),
                    },
                  },
                  y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { display: !single, color: "#e8ece6" },
                    border: { display: false },
                    ticks: {
                      color: "#5b6a61",
                      display: !single,
                      maxTicksLimit: 5,
                      ...(!single
                        ? { callback: (v) => formatCurrency(Number(v)) }
                        : {}),
                    },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) =>
                        `${ctx.dataset.label}: ${formatCurrency(single ? ctx.parsed.x : ctx.parsed.y)} ${household.currency}`,
                    },
                  },
                },
              }}
            />
          </div>
          {single && (
            <p className="muted chart-note">
              More months will appear as you add receipts.
            </p>
          )}
          <ul
            className="chart-breakdown"
            aria-label="Category totals for the displayed period"
          >
            {cats.map((c) => {
              const amount = stats.reduce(
                (sum, s) => sum + (s.byCategory[c.id] || 0),
                0,
              );
              return (
                <li key={c.id}>
                  <span
                    className="chart-swatch"
                    style={{ backgroundColor: c.color }}
                    aria-hidden="true"
                  />
                  <span className="chart-category-name">{c.name}</span>
                  <strong>{formatCurrency(amount / 100)}</strong>
                </li>
              );
            })}
          </ul>
          <details className="chart-data">
            <summary>View monthly figures</summary>
            <div
              className="chart-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Monthly spending figures"
            >
              <table>
                <caption>Amounts in {household.currency}</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    {cats.map((c) => (
                      <th scope="col" key={c.id}>
                        {c.name}
                      </th>
                    ))}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={m}>
                      <th scope="row">{monthName(m)}</th>
                      {cats.map((c) => (
                        <td key={c.id}>
                          {formatCurrency(
                            (stats[i].byCategory[c.id] || 0) / 100,
                          )}
                        </td>
                      ))}
                      <td>{formatCurrency(stats[i].total / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
