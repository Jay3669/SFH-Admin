import { apiRequest } from "./apiService";

export async function getMenuEngineering(days = 30) {
  const query = new URLSearchParams({ days: String(days) });
  const response = await apiRequest(`/api/analytics/menu-engineering?${query}`, {
    skipGlobalError: true,
  });
  if (!response?.success || !Array.isArray(response.dishes)) {
    throw new Error(response?.message || "The menu engineering response was invalid.");
  }
  return response;
}
