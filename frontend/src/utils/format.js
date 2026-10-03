// Format number with Finnish locale (comma as decimal separator)
export const formatCurrency = (amount) => {
  return amount.toLocaleString("fi-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Accept Finnish grouping spaces and either decimal separator; reject partial numbers.
export const parseAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[,.]\d{1,2})?$/.test(text))
    return NaN;
  return Number(text.replace(/[ \u00a0\u202f]/g, "").replace(",", "."));
};

export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDate = (iso) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso || "")
    ? iso.split("-").reverse().join("/")
    : iso || "";

export const parseDate = (text) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return null;
  const iso = text.split("/").reverse().join("-");
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
};
