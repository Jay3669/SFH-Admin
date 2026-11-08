import { apiRequest } from "./apiService";

export async function createPosSale(payload) {
  const response = await apiRequest("/api/pos/sales", {
    method: "POST",
    skipGlobalError: true,
    headers: { "Idempotency-Key": payload.idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!response?.sale || response.success === false) throw new Error("The completed bill response was invalid.");
  return response.sale;
}

export async function listRecentPosSales(limit = 5) {
  const query = new URLSearchParams({ limit: String(limit) });
  const response = await apiRequest(`/api/pos/sales?${query}`, { skipGlobalError: true });
  if (!Array.isArray(response?.sales) || response.success === false) throw new Error("The recent bills response was invalid.");
  return response.sales;
}