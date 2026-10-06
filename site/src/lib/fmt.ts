// Deterministic date formatting — no Intl/locale, so SSR and the browser
// always render the same string (prevents hydration mismatches).

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats SQLite `datetime('now')` output ("YYYY-MM-DD HH:MM:SS") as
 * "Oct 6, 2026" — or "Oct 6, 2026, 09:30" with `withTime`.
 * Falls back to the raw input for anything it doesn't recognize.
 */
export function fmtDate(
  value: string | null | undefined,
  withTime = false,
): string {
  if (!value) return "";
  const [datePart, timePart] = value.split(/T|\s/);
  const m = datePart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  const base = `${month} ${Number(m[3])}, ${m[1]}`;
  if (withTime && timePart) return `${base}, ${timePart.slice(0, 5)}`;
  return base;
}
