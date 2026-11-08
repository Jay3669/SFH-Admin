import { apiRequest } from "./apiService";

export async function getBillingReport(period) {
  const query = new URLSearchParams({ period });
  const response = await apiRequest(`/api/inventory/reports/billing?${query}`, { skipGlobalError: true });
  if (!response?.report || response.success === false) {
    const message = response?.message?.msg || response?.message;
    throw new Error(typeof message === "string" ? message : "Unable to load the billing report.");
  }
  const { purchases, sales } = response.report;
  if (!Array.isArray(purchases?.bills) || !Array.isArray(sales?.bills)) {
    throw new Error("The billing report response was invalid.");
  }
  return response.report;
}
