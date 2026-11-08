const STORAGE_KEY = "sfhDailyCashDrawer";

function isValidMovement(movement) {
  return Boolean(
    movement &&
    typeof movement.id === "string" &&
    ["in", "out"].includes(movement.direction) &&
    Number.isFinite(Number(movement.amount)) &&
    Number(movement.amount) > 0 &&
    typeof movement.description === "string" &&
    typeof movement.at === "string"
  );
}

function isValidSession(session) {
  return Boolean(
    session &&
    typeof session.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
    Number.isFinite(Number(session.openingAmount)) &&
    Number(session.openingAmount) >= 0 &&
    Array.isArray(session.movements) &&
    session.movements.every(isValidMovement) &&
    typeof session.status === "string" &&
    ["open", "closed"].includes(session.status) &&
    (session.status === "open" || (
      Number.isFinite(Number(session.closingCount)) &&
      Number(session.closingCount) >= 0 &&
      Number.isFinite(Number(session.cashTaken)) &&
      Number(session.cashTaken) >= 0
    ))
  );
}

export function getCashDrawerSessions() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  let sessions;
  try {
    sessions = JSON.parse(saved);
  } catch {
    throw new Error("Saved cash-drawer data could not be read. Clear the damaged cash-drawer data or contact support.");
  }
  if (!Array.isArray(sessions) || !sessions.every(isValidSession)) {
    throw new Error("Saved cash-drawer data is invalid. Clear the damaged cash-drawer data or contact support.");
  }
  return sessions;
}

export function saveCashDrawerSessions(sessions) {
  if (!Array.isArray(sessions) || !sessions.every(isValidSession)) {
    throw new Error("Cash-drawer session data is invalid and could not be saved.");
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
