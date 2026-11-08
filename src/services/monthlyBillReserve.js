const STORAGE_KEY = "sfhMonthlyBillReserve";
const BILL_TYPES = ["rent", "electricity"];

function isValidMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return false;
  const [year, month] = value.split("-").map(Number);
  return year > 0 && month >= 1 && month <= 12;
}

function isValidDate(value) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
  return Boolean(parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value);
}

function validPlan(plan) {
  return Boolean(
    plan &&
    BILL_TYPES.includes(plan.billType) &&
    isValidMonth(plan.billMonth) &&
    isValidDate(plan.dueDate) &&
    plan.dueDate.slice(0, 7) === plan.billMonth &&
    Number.isFinite(Number(plan.amount)) &&
    Number(plan.amount) > 0
  );
}

function validTransaction(transaction) {
  return Boolean(
    transaction &&
    typeof transaction.id === "string" &&
    ["deposit", "payment"].includes(transaction.type) &&
    BILL_TYPES.includes(transaction.billType) &&
    isValidMonth(transaction.billMonth) &&
    Number.isFinite(Number(transaction.amount)) &&
    Number(transaction.amount) > 0 &&
    isValidDate(transaction.date)
  );
}

function validateData(data) {
  if (
    !data ||
    !Array.isArray(data.plans) ||
    !data.plans.every(validPlan) ||
    !Array.isArray(data.transactions) ||
    !data.transactions.every(validTransaction)
  ) {
    throw new Error("Monthly bill reserve data is invalid and could not be saved.");
  }
  const keys = new Set();
  for (const plan of data.plans) {
    const key = `${plan.billType}:${plan.billMonth}`;
    if (keys.has(key)) throw new Error("Only one plan per bill and month can be saved.");
    keys.add(key);
  }
  const transactionIds = new Set();
  const dailyDeposits = new Set();
  const balances = new Map();
  for (const transaction of data.transactions) {
    if (transactionIds.has(transaction.id)) throw new Error("Monthly bill reserve transactions must have unique IDs.");
    transactionIds.add(transaction.id);
    const key = `${transaction.billType}:${transaction.billMonth}`;
    const balance = balances.get(key) || 0;
    if (transaction.type === "deposit") {
      const dailyKey = `${key}:${transaction.date}`;
      if (dailyDeposits.has(dailyKey)) throw new Error("Only one daily reserve deposit per bill can be recorded.");
      dailyDeposits.add(dailyKey);
      balances.set(key, balance + Number(transaction.amount));
    } else {
      const nextBalance = balance - Number(transaction.amount);
      if (nextBalance < -0.000001) throw new Error("Bill payments cannot exceed the saved reserve balance.");
      balances.set(key, nextBalance);
    }
  }
  return data;
}

export function getMonthlyBillReserve() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return { plans: [], transactions: [] };
  let data;
  try {
    data = JSON.parse(saved);
  } catch {
    throw new Error("Saved monthly bill reserve data could not be read. Clear the damaged data or contact support.");
  }
  try {
    const migratedData = {
      ...data,
      plans: data.plans.map((plan) => {
        if (plan.dueDate) return plan;
        const [year, month] = plan.billMonth.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const dueDay = Math.min(Math.max(Number(plan.dueDay) || 1, 1), lastDay);
        return { ...plan, dueDate: `${plan.billMonth}-${String(dueDay).padStart(2, "0")}` };
      }),
    };
    return validateData(migratedData);
  } catch (error) {
    throw new Error(`Saved monthly bill reserve data is invalid. ${error.message}`);
  }
}

export function saveMonthlyBillReserve(data) {
  validateData(data);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getMonthlyBillBalance(data, billType, billMonth) {
  return data.transactions.reduce((balance, transaction) => {
    if (transaction.billType !== billType || transaction.billMonth !== billMonth) return balance;
    return balance + (transaction.type === "deposit" ? 1 : -1) * Number(transaction.amount);
  }, 0);
}

export function getDaysUntilDue(dueDate, today) {
  if (!isValidDate(dueDate) || !isValidDate(today)) throw new Error("A valid due date and current date are required.");
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  const current = Date.parse(`${today}T00:00:00.000Z`);
  return Math.ceil((due - current) / 86400000);
}

export function getDailyReserveTarget(amount, dueDate, savedBalance, today) {
  const remaining = Math.max(0, Number(amount) - Number(savedBalance));
  const daysUntilDue = getDaysUntilDue(dueDate, today);
  const savingDays = Math.max(1, daysUntilDue + 1);
  return remaining / savingDays;
}
