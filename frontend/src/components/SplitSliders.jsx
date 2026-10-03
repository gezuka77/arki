import { household } from "../utils/expenses";
import { useId, useRef, useState } from "react";
import { formatCurrency, parseAmount } from "../utils/format";
import { rebalanceSplit } from "../utils/splits";
export default function SplitSliders({
  amounts,
  labels,
  valid,
  locks,
  setLocks,
  onChange,
  onError,
}) {
  const id = useId();
  const splitKeys = Object.keys(amounts);
  const baseline = useRef(null);
  const total = valid
    ? splitKeys.reduce((sum, key) => sum + amounts[key], 0)
    : 0;
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const updateError = (key, message) => {
    setErrors((prev) => ({ ...prev, [key]: message }));
    onError(key, message);
  };
  const adjust = (key, cents, source = amounts) => {
    onChange(rebalanceSplit(source, key, cents, locks));
  };
  return (
    <>
      <p id={`${id}-help`} className="muted">
        Lock any amounts you want to keep. Moving a slider shares the adjustment
        evenly among the other unlocked categories. Empty categories cannot give
        any more. Every slider uses the full bill total as its scale.
      </p>
      {splitKeys.map((key) => {
        const others = splitKeys.filter((k) => k !== key && !locks[k]);
        const max = valid
          ? amounts[key] + others.reduce((s, k) => s + amounts[k], 0)
          : 0;
        const disabled = !valid || locks[key] || !others.length || max === 0;
        return (
          <div className="split-part" key={key}>
            <div className="split-control-heading">
              <label htmlFor={`${id}-${key}`}>{labels[key]} share</label>
              <button
                type="button"
                className="split-lock"
                aria-label={`Lock ${labels[key]} amount`}
                aria-pressed={Boolean(locks[key])}
                disabled={!valid}
                onClick={() => {
                  baseline.current = null;
                  setLocks((prev) => ({ ...prev, [key]: !prev[key] }));
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path
                    d={
                      locks[key]
                        ? "M8 10V7a4 4 0 0 1 8 0v3"
                        : "M8 10V7a4 4 0 0 1 8 0"
                    }
                  />
                </svg>
                {locks[key] ? "Locked" : "Unlocked"}
              </button>
            </div>
            <input
              id={`${id}-${key}`}
              className="split-slider"
              type="range"
              min="0"
              max={total}
              step="1"
              disabled={disabled}
              value={valid ? amounts[key] : 0}
              style={{
                "--slider-fill": `${total ? (amounts[key] / total) * 100 : 0}%`,
              }}
              aria-describedby={`${id}-help ${id}-${key}-limit`}
              aria-valuetext={`${labels[key]} ${household.currency} ${formatCurrency((valid ? amounts[key] : 0) / 100)}`}
              onKeyDown={() => {
                baseline.current = null;
              }}
              onPointerDown={() => {
                baseline.current = { ...amounts };
              }}
              onPointerUp={() => {
                baseline.current = null;
              }}
              onPointerCancel={() => {
                baseline.current = null;
              }}
              onBlur={() => {
                baseline.current = null;
              }}
              onChange={(e) => {
                setDrafts({});
                splitKeys.forEach((k) => updateError(k, ""));
                adjust(
                  key,
                  Number(e.target.value),
                  baseline.current || amounts,
                );
              }}
            />
            <div className="split-slider-scale">
              <span>{household.currency} 0</span>
              <span>
                {household.currency} {formatCurrency(total / 100)}
              </span>
            </div>
            <p id={`${id}-${key}-limit`} className="muted">
              {locks[key]
                ? "Amount locked"
                : `Up to ${household.currency} ${formatCurrency(max / 100)} available with the current locks.`}
            </p>
            <label>
              Approximate {labels[key]} amount ({household.currency})
              <input
                className="field"
                inputMode="decimal"
                disabled={disabled}
                value={
                  drafts[key] ??
                  formatCurrency((valid ? amounts[key] : 0) / 100)
                }
                aria-invalid={Boolean(errors[key])}
                aria-describedby={
                  errors[key] ? `${id}-${key}-error` : undefined
                }
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  if (drafts[key] === undefined) return;
                  const value = parseAmount(drafts[key]);
                  if (
                    !Number.isFinite(value) ||
                    value < 0 ||
                    Math.round(value * 100) > max
                  ) {
                    updateError(
                      key,
                      `Enter an amount from ${household.currency} 0 to ${household.currency} ${formatCurrency(max / 100)}, or unlock another category.`,
                    );
                    return;
                  }
                  adjust(key, Math.round(value * 100));
                  updateError(key, "");
                  setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
              />
            </label>
            {errors[key] && (
              <p
                id={`${id}-${key}-error`}
                role="alert"
                className="error-banner"
              >
                {errors[key]}
              </p>
            )}
          </div>
        );
      })}
      {valid && splitKeys.filter((k) => !locks[k]).length < 2 && (
        <p role="status" className="muted">
          Unlock at least two categories to move money between them.
        </p>
      )}
    </>
  );
}
