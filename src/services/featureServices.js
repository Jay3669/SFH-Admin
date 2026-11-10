import { apiRequest } from "./apiService";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5050";

function assertArray(response, key, fallback) {
  if (!Array.isArray(response?.[key]) || response.success === false) {
    throw new Error(response?.message || fallback);
  }
  return response[key];
}

async function publicRequest(path, options = {}) {
  const response = await fetch(new URL(path, API_BASE_URL), {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || response.statusText || "The request failed.");
  }
  return data;
}

export async function listPromotions() {
  return assertArray(await apiRequest("/api/pos/promotions", { skipGlobalError: true }), "promotions", "The promotions response was invalid.");
}

export async function listActivePromotions(categoryIds) {
  const query = new URLSearchParams({ categoryIds: [...new Set(categoryIds)].join(",") });
  return assertArray(await apiRequest(`/api/pos/promotions/active?${query}`, { skipGlobalError: true }), "promotions", "The active promotions response was invalid.");
}

export async function savePromotion(payload, id) {
  const response = await apiRequest(`/api/pos/promotions${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PUT" : "POST",
    skipGlobalError: true,
    body: JSON.stringify(payload),
  });
  if (!response?.promotion || response.success === false) throw new Error(response?.message || "Unable to save the promotion.");
  return response.promotion;
}

export async function deletePromotion(id) {
  return apiRequest(`/api/pos/promotions/${encodeURIComponent(id)}`, { method: "DELETE", skipGlobalError: true });
}

export async function createTableQrCode(tableName) {
  const response = await apiRequest("/api/pos/qr-codes", {
    method: "POST",
    skipGlobalError: true,
    body: JSON.stringify({ tableName }),
  });
  if (!response?.url || response.success === false) throw new Error(response?.message || "The QR code response was invalid.");
  return response;
}

export async function resendWhatsAppBill(saleId) {
  const response = await apiRequest(`/api/pos/sales/${encodeURIComponent(saleId)}/whatsapp`, {
    method: "POST",
    skipGlobalError: true,
  });
  if (!response?.whatsappDelivery || response.success === false) throw new Error(response?.message || "Unable to resend the WhatsApp bill.");
  return response.whatsappDelivery;
}

export async function getAggregatorOrders() {
  return assertArray(await apiRequest("/api/aggregator/orders", { skipGlobalError: true }), "orders", "The aggregator order response was invalid.");
}

async function updateAggregatorOrder(id, action, payload = {}) {
  const response = await apiRequest(`/api/aggregator/orders/${encodeURIComponent(id)}/${action}`, {
    method: action === "fire" ? "POST" : "PATCH",
    skipGlobalError: true,
    body: JSON.stringify(payload),
  });
  if (!response?.order || response.success === false) throw new Error(response?.message || "Unable to update the aggregator order.");
  return response.order;
}

export const acceptAggregatorOrder = (id) => updateAggregatorOrder(id, "accept");
export const assignAggregatorRider = (id, riderName) => updateAggregatorOrder(id, "rider", { riderName });

export async function fireAggregatorOrder(id) {
  const response = await apiRequest(`/api/aggregator/orders/${encodeURIComponent(id)}/fire`, {
    method: "POST",
    skipGlobalError: true,
  });
  if (!response?.order || !Array.isArray(response.kots) || response.success === false) {
    throw new Error(response?.message || "Unable to send the order to the kitchen.");
  }
  return response;
}

export async function getKitchenAnalytics(days = 30) {
  const response = await apiRequest(`/api/analytics/kitchen?days=${encodeURIComponent(days)}`, { skipGlobalError: true });
  if (!Array.isArray(response?.dishes) || response.success === false) throw new Error(response?.message || "The kitchen analytics response was invalid.");
  return response;
}

export async function loadPublicOrder(token) {
  return publicRequest(`/api/order/${encodeURIComponent(token)}`);
}

export async function submitPublicOrder(token, items, idempotencyKey) {
  return publicRequest(`/api/order/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ items }),
  });
}

export async function loadPublicReceipt(token) {
  const response = await publicRequest(`/api/receipts/${encodeURIComponent(token)}`);
  if (!response?.receipt) throw new Error("The receipt response was invalid.");
  return response.receipt;
}

export async function submitPublicFeedback(token, rating) {
  return publicRequest(`/api/receipts/${encodeURIComponent(token)}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}
