let sessionExpired = false;
let sessionInvalidated = false;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSessionExpiry(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionExpirySnapshot() {
  return sessionExpired;
}

export function isSessionInvalidated() {
  return sessionInvalidated;
}

export function triggerSessionExpiry() {
  if (sessionInvalidated) return;
  sessionInvalidated = true;
  sessionExpired = true;
  emit();
}

export function dismissSessionExpiry() {
  if (!sessionExpired) return;
  sessionExpired = false;
  emit();
}

export function resetSessionExpiry() {
  if (!sessionExpired && !sessionInvalidated) return;
  sessionExpired = false;
  sessionInvalidated = false;
  emit();
}
