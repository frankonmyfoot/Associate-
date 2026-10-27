import { useEffect, useState } from "react";

/**
 * Controlled date field built from three <select> dropdowns (Month / Day /
 * Year) that compose a `YYYY-MM-DD` string — the same shape a native
 * `<input type="date">` would produce, so downstream consumers (AI prompts,
 * template fallbacks, stored caseDetails) are unchanged.
 *
 * Why not <input type="date">? Its native segments and popup live in the
 * browser's shadow DOM, where typed keystrokes and picker clicks don't
 * reliably reach React's onChange — a date picked through any path could
 * display but never bind to form state (Generate then rejects with
 * "required"). Plain <select> elements are controlled like every other field
 * and work identically for real users and automation.
 */

const MONTH_OPTIONS: Array<[string, string]> = [
  ["01", "January"],
  ["02", "February"],
  ["03", "March"],
  ["04", "April"],
  ["05", "May"],
  ["06", "June"],
  ["07", "July"],
  ["08", "August"],
  ["09", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
];

function currentYear(): number {
  return new Date().getFullYear();
}

function yearOptions(): string[] {
  // Most recent first: a couple of future years (effective dates) back three
  // decades (incidents, matters).
  const now = currentYear();
  const years: string[] = [];
  for (let y = now + 2; y >= now - 30; y--) years.push(String(y));
  return years;
}

function maxDayFor(month: string, year: string): number {
  if (!month) return 31;
  const monthNum = Number(month);
  if (monthNum === 2) {
    const yearNum = Number(year);
    const leap = year && ((yearNum % 4 === 0 && yearNum % 100 !== 0) || yearNum % 400 === 0);
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthNum - 1] ?? 31;
}

export default function DateField({
  id,
  value,
  onChange,
  className = "mt-1 block w-full",
}: {
  id: string;
  /** "YYYY-MM-DD" or "" */
  value: string;
  /** Called with "YYYY-MM-DD" once month/day/year are all set. */
  onChange: (value: string) => void;
  className?: string;
}) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const [year, setYear] = useState(valid ? value.slice(0, 4) : "");
  const [month, setMonth] = useState(valid ? value.slice(5, 7) : "");
  const [day, setDay] = useState(valid ? value.slice(8, 10) : "");

  // External reset (e.g. switching document type clears caseDetails): the
  // composed value becomes "" — drop the internal picks to match. Runs only
  // when the prop actually changes, so mid-selection partial states (which
  // leave the prop at "") never wipe the user's picks.
  useEffect(() => {
    if (!valid && (year || month || day)) {
      setYear("");
      setMonth("");
      setDay("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (nextYear: string, nextMonth: string, nextDay: string) => {
    if (nextYear && nextMonth && nextDay) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else if (value) {
      // Was a complete date, now partial — clear it so validation can't pass
      // on a stale value.
      onChange("");
    }
  };

  const maxDay = maxDayFor(month, year);
  const dayNumber = Number(day);

  const selectClass =
    "rounded-lg border px-2 py-2 text-sm bg-background w-full min-w-0";

  return (
    <div className={`${className} flex gap-2`} data-date-field={id}>
      <select
        id={`${id}-month`}
        aria-label="Month"
        value={month}
        onChange={(e) => {
          const next = e.target.value;
          setMonth(next);
          const max = maxDayFor(next, year);
          if (day && Number(day) > max) {
            setDay("");
            commit(year, next, "");
          } else {
            commit(year, next, day);
          }
        }}
        className={selectClass}
      >
        <option value="">Month</option>
        {MONTH_OPTIONS.map(([num, name]) => (
          <option key={num} value={num}>
            {name}
          </option>
        ))}
      </select>
      <select
        id={`${id}-day`}
        aria-label="Day"
        value={day && dayNumber <= maxDay ? day : ""}
        onChange={(e) => {
          setDay(e.target.value);
          commit(year, month, e.target.value);
        }}
        className={selectClass}
      >
        <option value="">Day</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d).padStart(2, "0")}>
            {d}
          </option>
        ))}
      </select>
      <select
        id={`${id}-year`}
        aria-label="Year"
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          const max = maxDayFor(month, e.target.value);
          if (day && Number(day) > max) {
            setDay("");
            commit(e.target.value, month, "");
          } else {
            commit(e.target.value, month, day);
          }
        }}
        className={selectClass}
      >
        <option value="">Year</option>
        {yearOptions().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
