const STORAGE_KEY = "sfhFinancialExpenses";

export const FINANCIAL_EXPENSE_CATEGORIES = [
  { value: "packaging", label: "Packaging & disposables", section: "costOfGoods" },
  { value: "staff", label: "Staff & salaries", section: "operating" },
  { value: "utilities", label: "Utilities & rent", section: "operating" },
  { value: "other", label: "Other expenses", section: "operating" },
];

function validExpense(expense) {
  const date = expense?.date;
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00.000Z`)
    : null;
  return Boolean(
    expense &&
    typeof expense.id === "string" &&
    expense.id.trim() &&
    typeof expense.name === "string" &&
    expense.name.trim() &&
    FINANCIAL_EXPENSE_CATEGORIES.some((category) => category.value === expense.category) &&
    Number.isFinite(Number(expense.amount)) &&
    Number(expense.amount) > 0 &&
    parsedDate &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
}

export function listFinancialExpenses() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  let expenses;
  try {
    expenses = JSON.parse(saved);
  } catch {
    throw new Error("Saved expenses could not be read. Clear the damaged expense data or contact support.");
  }
  if (!Array.isArray(expenses) || !expenses.every(validExpense)) {
    throw new Error("Saved expenses are invalid. Clear the damaged expense data or contact support.");
  }
  return expenses;
}

export function saveFinancialExpenses(expenses) {
  if (!Array.isArray(expenses) || !expenses.every(validExpense)) {
    throw new Error("Expense entries are invalid and could not be saved.");
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}
