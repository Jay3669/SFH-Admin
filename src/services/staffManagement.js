const STORAGE_KEY = "sfhStaffManagement";

export const STAFF_ROLES = [
  "Manager",
  "Chef",
  "Kitchen staff",
  "Server",
  "Cashier",
  "Delivery",
  "Cleaner",
];

function isValidState(state) {
  return Boolean(
    state &&
    Array.isArray(state.staff) &&
    state.staff.every((member) => (
      member &&
      typeof member.id === "string" &&
      typeof member.name === "string" &&
      typeof member.email === "string" &&
      typeof member.phone === "string" &&
      Array.isArray(member.roles) &&
      member.roles.length > 0 &&
      member.roles.every((role) => STAFF_ROLES.includes(role)) &&
      ["Active", "Invited", "Inactive"].includes(member.status) &&
      Number.isFinite(Number(member.sharePercent)) &&
      Number(member.sharePercent) >= 0 &&
      Number(member.sharePercent) <= 100
    )) &&
    Array.isArray(state.transactions) &&
    state.transactions.every((transaction) => (
      transaction &&
      typeof transaction.id === "string" &&
      typeof transaction.staffId === "string" &&
      typeof transaction.date === "string" &&
      typeof transaction.description === "string" &&
      Number.isFinite(Number(transaction.amount))
    ))
  );
}

export function getStaffManagementData() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return { staff: [], transactions: [] };
  let state;
  try {
    state = JSON.parse(saved);
  } catch {
    throw new Error("Saved staff data could not be read. Clear the damaged staff data or contact support.");
  }
  if (!isValidState(state)) {
    throw new Error("Saved staff data is invalid. Clear the damaged staff data or contact support.");
  }
  return state;
}

export function saveStaffManagementData(state) {
  if (!isValidState(state)) {
    throw new Error("Staff or wallet data is invalid and could not be saved.");
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
