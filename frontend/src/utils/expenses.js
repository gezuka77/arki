import { formatDate } from "./format.js";
export const categories = Object.create(null),
  categoryDetails = Object.create(null);
export const household = {
  name: "Arki Tracker",
  currency: "EUR",
  default_category: "",
  map_lat: 0,
  map_lon: 0,
};
export function configure(data) {
  Object.keys(categories).forEach((k) => delete categories[k]);
  Object.keys(categoryDetails).forEach((k) => delete categoryDetails[k]);
  for (const c of data.categories) {
    categories[c.id] = c.name;
    categoryDetails[c.id] = c;
  }
  Object.assign(household, data);
}
export const cents = (value) => Math.round(value * 100);
export const normalizeCategory = (c) => c;
export function summarize(expenses) {
  const s = {
    total: 0,
    users: Object.create(null),
    byCategory: Object.create(null),
  };
  for (const e of expenses) {
    s.total += e.amount_cents;
    s.users[e.username] = (s.users[e.username] || 0) + e.amount_cents;
    for (const a of e.allocations)
      s.byCategory[a.category_id] =
        (s.byCategory[a.category_id] || 0) + a.amount_cents;
  }
  return s;
}
export function filterExpenses(
  expenses,
  { month = "", location = "", category = "" },
) {
  return expenses.filter(
    (e) =>
      (!month || e.date.startsWith(month)) &&
      (!location || e.location === location) &&
      (!category || e.allocations.some((a) => a.category_id === category)),
  );
}
const cell = (v) => {
  let t = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(t) || /^[\t\r\n]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
};
export function expensesCsv(expenses) {
  const ids = Object.keys(categories);
  const rows = [
    [
      "Date",
      `Bill total ${household.currency}`,
      ...ids.map((id) => categories[id]),
      "Location",
      "Description",
      "Paid by",
    ],
  ];
  for (const e of expenses)
    rows.push([
      formatDate(e.date),
      (e.amount_cents / 100).toFixed(2),
      ...ids.map((id) =>
        (
          (e.allocations.find((a) => a.category_id === id)?.amount_cents || 0) /
          100
        ).toFixed(2),
      ),
      e.location,
      e.description,
      e.username,
    ]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
