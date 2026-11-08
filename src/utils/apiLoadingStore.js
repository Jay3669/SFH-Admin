const MINIMUM_LOADER_DURATION_MS = 3000;

let activeRequests = 0;
let loaderVisible = false;
let loaderStartedAt = null;
let hideTimer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToApiLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLoadingSnapshot() {
  return loaderVisible;
}

export function beginApiRequest() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;

    if (Date.now() - loaderStartedAt >= MINIMUM_LOADER_DURATION_MS) {
      loaderVisible = false;
      loaderStartedAt = null;
    }
  }

  if (activeRequests === 0 && !loaderVisible) {
    loaderVisible = true;
    loaderStartedAt = Date.now();
  }

  activeRequests += 1;
  emit();
}

export function endApiRequest() {
  if (activeRequests === 0) return;

  activeRequests -= 1;
  if (activeRequests === 0) {
    const elapsed = Date.now() - loaderStartedAt;
    const remaining = MINIMUM_LOADER_DURATION_MS - elapsed;

    if (remaining <= 0) {
      loaderVisible = false;
      loaderStartedAt = null;
    } else {
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (activeRequests === 0) {
          loaderVisible = false;
          loaderStartedAt = null;
          emit();
        }
      }, remaining);
    }
  }

  emit();
}
