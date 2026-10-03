// Equal euro adjustments, in whole cents. Empty categories stop contributing.
export function rebalanceSplit(amounts, key, requested, locks = {}) {
  const splitKeys = Object.keys(amounts);
  const next = { ...amounts };
  if (locks[key] || !Number.isSafeInteger(requested)) return next;
  const others = splitKeys.filter((k) => k !== key && !locks[k]);
  if (!others.length) return next;
  const maximum = amounts[key] + others.reduce((sum, k) => sum + amounts[k], 0);
  const target = Math.max(0, Math.min(maximum, requested));
  let remaining = Math.abs(target - amounts[key]);
  const shrinking = target > amounts[key];
  let active = others.filter((k) => !shrinking || next[k] > 0);
  while (remaining && active.length) {
    const each = Math.floor(remaining / active.length);
    const extra = remaining % active.length;
    active.forEach((k, i) => {
      const share = each + (i < extra ? 1 : 0);
      const change = shrinking ? Math.min(next[k], share) : share;
      next[k] += shrinking ? -change : change;
      remaining -= change;
    });
    active = active.filter((k) => !shrinking || next[k] > 0);
  }
  next[key] = target;
  return next;
}
