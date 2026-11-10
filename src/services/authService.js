import { API_ENDPOINTS } from "./endpoints";
import { apiRequest } from "./apiService";
import { resetSessionExpiry } from "../utils/sessionExpiryStore";

const ADMIN_USER_KEY = "sfhAdminUser";
const AUTH_TOKEN_KEY = "authToken";

function getResponseUser(response) {
  return response?.data?.user || response?.user || response?.data || response;
}

export async function loginAdmin(credentials) {
  const response = await apiRequest(API_ENDPOINTS.userLogin, {
    method: "POST",
    body: JSON.stringify({
      identifier: credentials.identifier.trim(),
      password: credentials.password,
    }),
    skipGlobalLoader: true,
    skipGlobalError: true,
  });

  if (response?.success === false) {
    throw new Error(response.message || "Unable to sign in.");
  }

  const user = getResponseUser(response);
  const role = String(
    user?.role || user?.userRole || response?.role || ""
  ).toLowerCase();

  if (!["admin", "manager", "employee"].includes(role)) {
    throw new Error("This account does not have staff portal access.");
  }

  const adminUser = {
    id: user?.id ? String(user.id) : "",
    name:
      user?.name ||
      user?.fullName ||
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.email ||
      "Administrator",
    email: user?.email || credentials.identifier,
    role,
  };

  window.localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  resetSessionExpiry();

  return adminUser;
}

export async function requestPasswordReset(email) {
  return apiRequest(API_ENDPOINTS.forgotPassword, {
    method: "POST",
    body: JSON.stringify({ email }),
    skipGlobalLoader: true,
    skipGlobalError: true,
  });
}

export async function resetPassword(token, password) {
  return apiRequest(`${API_ENDPOINTS.resetPassword}/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify({ password }),
    skipGlobalLoader: true,
    skipGlobalError: true,
  });
}

export function getStoredAdmin() {
  try {
    const user = JSON.parse(window.localStorage.getItem(ADMIN_USER_KEY) || "null");
    return ["admin", "manager", "employee"].includes(user?.role) ? user : null;
  } catch {
    return null;
  }
}

export async function logoutAdmin() {
  const authenticationKey = /(auth|token|jwt|refresh|access|session|user)/i;

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && authenticationKey.test(key)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  });
  resetSessionExpiry();
  await apiRequest(API_ENDPOINTS.userLogout, {
    method: "POST",
    skipGlobalLoader: true,
    skipGlobalError: true,
  });
}