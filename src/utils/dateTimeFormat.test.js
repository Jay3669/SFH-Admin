import { formatDate, formatDateTime, formatMonthYear, formatTime } from "./dateTimeFormat";

const sample = new Date(2026, 10, 9, 13, 5);

test("formats dates and times using saved POS preferences", () => {
  expect(formatDate(sample, { dateFormat: "DD/MM/YYYY" })).toBe("09/11/2026");
  expect(formatDate(sample, { dateFormat: "MM/DD/YYYY" })).toBe("11/09/2026");
  expect(formatDate(sample, { dateFormat: "YYYY-MM-DD" })).toBe("2026-11-09");
  expect(formatDate(sample, { dateFormat: "DD-MM-YYYY" })).toBe("09-11-2026");
  expect(formatDate(sample, { dateFormat: "MM-DD-YYYY" })).toBe("11-09-2026");
  expect(formatDate(sample, { dateFormat: "DD MMM YYYY" })).toBe("9 Nov 2026");
  expect(formatDate(sample, { dateFormat: "MMMM DD, YYYY" })).toBe("November 9, 2026");
  expect(formatTime(sample, { timeFormat: "12-hour" })).toBe("01:05 PM");
  expect(formatTime(sample, { timeFormat: "24-hour" })).toBe("13:05");
});

test("formats date-only values and combined timestamps", () => {
  expect(formatDate("2026-11-09", { dateFormat: "DD/MM/YYYY" })).toBe("09/11/2026");
  expect(formatDate("2026-11-09", { dateFormat: "DD MMM YYYY" })).toBe("9 Nov 2026");
  expect(formatDateTime(sample, { dateFormat: "YYYY-MM-DD", timeFormat: "24-hour" })).toBe("2026-11-09 13:05");
});

test("keeps month/year labels and invalid values readable", () => {
  expect(formatMonthYear(new Date(2026, 10, 1))).toMatch(/2026/);
  expect(formatDate("not-a-date", { dateFormat: "DD/MM/YYYY" })).toBe("not-a-date");
});
