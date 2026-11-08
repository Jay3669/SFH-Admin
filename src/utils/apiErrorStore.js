let errors = [];
let nextErrorId = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToApiErrors(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiErrorsSnapshot() {
  return errors;
}

export function notifyApiError(message) {
  if (!message) return;
  errors = [...errors, { id: ++nextErrorId, message }];
  emit();
}

export function dismissApiError() {
  errors = errors.slice(1);
  emit();
}
