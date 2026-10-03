import test from "node:test";
import assert from "node:assert/strict";
import { rebalanceSplit } from "../src/utils/splits.js";
import {
  configure,
  summarize,
  filterExpenses,
  expensesCsv,
} from "../src/utils/expenses.js";
test("arbitrary categories and multiple pets retain totals, locks, filters and export", () => {
  configure({
    currency: "EUR",
    categories: [
      { id: "a", name: "Food" },
      { id: "pet1", name: "Milo" },
      { id: "pet2", name: "Clover" },
      { id: "x", name: "Travel" },
    ],
  });
  const amounts = { a: 4000, pet1: 3000, pet2: 1000, x: 2000 };
  const next = rebalanceSplit(amounts, "pet2", 3000, { a: true });
  assert.equal(next.a, 4000);
  assert.equal(next.pet2, 3000);
  assert.equal(
    Object.values(next).reduce((s, v) => s + v, 0),
    10000,
  );
  const rows = [
    {
      amount_cents: 10000,
      date: "2026-10-03",
      username: "Member",
      location: "=UNSAFE",
      allocations: Object.entries(next).map(([category_id, amount_cents]) => ({
        category_id,
        amount_cents,
      })),
    },
  ];
  assert.equal(summarize(rows).byCategory.pet2, 3000);
  assert.equal(filterExpenses(rows, { category: "pet1" }).length, 1);
  const csv = expensesCsv(rows);
  assert.ok(csv.includes('"Milo";"Clover"'));
  assert.ok(csv.includes("'=UNSAFE"));
  assert.ok(csv.includes("03/10/2026"));
});
test("locks, clamping and cent conservation work with any category set", () => {
  for (let n = 1; n <= 20; n++) {
    const a = Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`category${i}`, i * 31]),
    );
    const locks = { category0: true };
    for (const key of Object.keys(a))
      for (const target of [0, 1, 103, 999999]) {
        const b = rebalanceSplit(a, key, target, locks);
        assert.equal(
          Object.values(b).reduce((s, v) => s + v, 0),
          Object.values(a).reduce((s, v) => s + v, 0),
        );
        assert.equal(b.category0, a.category0);
        assert.ok(Object.values(b).every((v) => Number.isInteger(v) && v >= 0));
      }
  }
});
