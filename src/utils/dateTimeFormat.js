import { getPosSettings } from "../services/posSettings";

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function makeDateParts(year, month, day) {
  const monthDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return {
    year,
    month,
    day,
    monthShort: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(monthDate),
    monthLong: new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(monthDate),
  };
}

function dateParts(value, timeZone) {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
        return makeDateParts(year, month, day);
      }
      return null;
    }
  }

  const date = parseDate(value);
  if (!date) return null;
  const parts = timeZone
    ? new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
    : [
      { type: "year", value: String(date.getFullYear()) },
      { type: "month", value: String(date.getMonth() + 1).padStart(2, "0") },
      { type: "day", value: String(date.getDate()).padStart(2, "0") },
    ];
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return makeDateParts(values.year, values.month, values.day);
}

export function formatDate(value, settings = getPosSettings(), options = {}) {
  const parts = dateParts(value, options.timeZone);
  if (!parts) return value === null || value === undefined ? "" : String(value);

  if (settings.dateFormat === "MM/DD/YYYY") return `${parts.month}/${parts.day}/${parts.year}`;
  if (settings.dateFormat === "YYYY-MM-DD") return `${parts.year}-${parts.month}-${parts.day}`;
  if (settings.dateFormat === "DD-MM-YYYY") return `${parts.day}-${parts.month}-${parts.year}`;
  if (settings.dateFormat === "MM-DD-YYYY") return `${parts.month}-${parts.day}-${parts.year}`;
  if (settings.dateFormat === "DD MMM YYYY") return `${Number(parts.day)} ${parts.monthShort} ${parts.year}`;
  if (settings.dateFormat === "MMMM DD, YYYY") return `${parts.monthLong} ${Number(parts.day)}, ${parts.year}`;
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatTime(value, settings = getPosSettings(), options = {}) {
  const date = parseDate(value);
  if (!date) return value === null || value === undefined ? "" : String(value);

  const parts = options.timeZone
    ? new Intl.DateTimeFormat("en", {
      timeZone: options.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: settings.timeFormat === "24-hour" ? "h23" : "h12",
    }).formatToParts(date)
    : [
      { type: "hour", value: String(settings.timeFormat === "24-hour" ? date.getHours() : (date.getHours() % 12 || 12)).padStart(2, "0") },
      { type: "minute", value: String(date.getMinutes()).padStart(2, "0") },
      { type: "dayPeriod", value: date.getHours() < 12 ? "AM" : "PM" },
    ];
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  const time = `${values.hour}:${values.minute}`;
  return settings.timeFormat === "24-hour" ? time : `${time} ${values.dayPeriod.toUpperCase()}`;
}

export function formatDateTime(value, settings = getPosSettings(), options = {}) {
  if (!parseDate(value)) return value === null || value === undefined ? "" : String(value);
  const date = formatDate(value, settings, options);
  const time = formatTime(value, settings, options);
  return date && time ? `${date} ${time}` : date || time;
}

export function formatMonthYear(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(date) : String(value ?? "");
}
