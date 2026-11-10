import { apiRequest } from "./apiService";

const CASH_DRAWER_ENDPOINT = "/api/pos/cash-drawers";

export async function getCashDrawerSessions() {
  const response = await apiRequest(CASH_DRAWER_ENDPOINT, { skipGlobalError: true });
  if (!Array.isArray(response?.drawers) || response.success === false) {
    throw new Error("The cash-drawer sessions response was invalid.");
  }
  return response.drawers;
}

export async function openCashDrawer(payload) {
  const response = await apiRequest(CASH_DRAWER_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
    skipGlobalError: true,
  });
  if (!response?.drawer || response.success === false) throw new Error("The cash drawer response was invalid.");
  return response.drawer;
}

export async function addCashDrawerMovement(drawerId, payload) {
  return apiRequest(`${CASH_DRAWER_ENDPOINT}/${encodeURIComponent(drawerId)}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
    skipGlobalError: true,
  });
}

export async function closeCashDrawer(drawerId, payload) {
  return apiRequest(`${CASH_DRAWER_ENDPOINT}/${encodeURIComponent(drawerId)}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
    skipGlobalError: true,
  });
}

export async function handoverCashDrawer(drawerId, payload) {
  return apiRequest(`${CASH_DRAWER_ENDPOINT}/${encodeURIComponent(drawerId)}/handover`, {
    method: "POST",
    body: JSON.stringify(payload),
    skipGlobalError: true,
  });
}
