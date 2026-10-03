import { useState, useEffect } from "react";
import { api } from "../api";
import ExpenseEditor from "./ExpenseEditor";
export default function ExpenseForm({ onExpenseAdded, expenses }) {
  const [suggestions, setSuggestions] = useState({});
  useEffect(() => {
    let active = true;
    api
      .getSuggestions()
      .then((data) => {
        if (active) setSuggestions(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [expenses]);
  return (
    <section className="add-expense-content">
      <p className="eyebrow">ONE RECEIPT AT A TIME</p>
      <h2 id="add-expense-title" className="section-title">
        Add expense
      </h2>
      <p className="muted form-intro">
        The whole bill, with a simple split for the extras.
      </p>
      <ExpenseEditor
        suggestions={suggestions}
        onSave={async (values) => {
          await api.createExpense(values);
          await onExpenseAdded();
        }}
      />
    </section>
  );
}
