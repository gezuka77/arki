import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { summarize, categoryDetails, household } from "../utils/expenses";
import { formatCurrency } from "../utils/format";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
export default function MonthlyChart({ expenses }) {
  const months = [...new Set(expenses.map((e) => e.date.slice(0, 7)))]
    .sort()
    .slice(-12);
  const stats = months.map((month) =>
    summarize(expenses.filter((e) => e.date.startsWith(month))),
  );
  const cats = Object.values(categoryDetails).filter(
    (c) => c.active || stats.some((s) => s.byCategory[c.id]),
  );
  return (
    <section className="panel chart-panel">
      <h2 className="section-title">Monthly spending</h2>
      <p className="muted">The last 12 months with receipts, by category.</p>
      {!months.length ? (
        <p>No expenses yet.</p>
      ) : (
        <>
          <div className="chart-frame">
            <Bar
              aria-label="Monthly spending. Category amounts are provided in the following table."
              data={{
                labels: months,
                datasets: cats.map((c) => ({
                  label: c.name,
                  backgroundColor: c.color,
                  data: stats.map((s) => (s.byCategory[c.id] || 0) / 100),
                  maxBarThickness: 48,
                })),
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { legend: { position: "bottom" } },
              }}
            />
          </div>
          <div className="sr-only">
            <table>
              <caption>Monthly spending in {household.currency}</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {cats.map((c) => (
                    <th scope="col" key={c.id}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={m}>
                    <th scope="row">{m}</th>
                    {cats.map((c) => (
                      <td key={c.id}>
                        {formatCurrency((stats[i].byCategory[c.id] || 0) / 100)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
