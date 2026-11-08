import {
  beginApiRequest,
  endApiRequest,
} from "../utils/apiLoadingStore";
import { notifyApiError } from "../utils/apiErrorStore";
import {
  isSessionInvalidated,
  triggerSessionExpiry,
} from "../utils/sessionExpiryStore";
import { API_ENDPOINTS } from "./endpoints";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5050";
const REQUEST_TIMEOUT_MS = 30000;

function isAuthenticationRequest(path) {
  const pathname = new URL(path, API_BASE_URL).pathname;
  return pathname === API_ENDPOINTS.userLogin ||
    pathname === API_ENDPOINTS.forgotPassword;
}

export async function apiRequest(path, options = {}) {
  const {
    skipGlobalLoader = false,
    skipGlobalError = false,
    ...fetchOptions
  } = options;
  const isAuthRequest = isAuthenticationRequest(path);
  if (isSessionInvalidated() && !isAuthRequest) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const { signal: callerSignal, ...requestOptions } = fetchOptions;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abortRequest = () => controller.abort();
  callerSignal?.addEventListener("abort", abortRequest, { once: true });

  if (!skipGlobalLoader) beginApiRequest();

  let sessionExpiredResponse = false;
  try {
    const token = window.localStorage.getItem("authToken");
    const response = await fetch(new URL(path, API_BASE_URL), {
      credentials: "include",
      ...requestOptions,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
        ...requestOptions.headers,
      },
    });
    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && !isAuthRequest) {
        sessionExpiredResponse = true;
        triggerSessionExpiry();
      }
      const message =
        data?.message?.msg ||
        data?.message ||
        data?.error ||
        response.statusText;
      throw new Error(typeof message === "string" ? message : "Request failed.");
    }

    if (data?.success === false) {
      const message = data.message?.msg || data.message || data.error;
      throw new Error(
        typeof message === "string" ? message : "The request was not successful."
      );
    }

    return data;
  } catch (error) {
    const requestError = timedOut
      ? new Error("The request timed out. Please try again.")
      : error;
    if (!skipGlobalError && !sessionExpiredResponse) {
      notifyApiError(
        requestError instanceof Error
          ? requestError.message
          : "The request failed. Please try again."
      );
    }
    throw requestError;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortRequest);
    if (!skipGlobalLoader) endApiRequest();
  }
}
