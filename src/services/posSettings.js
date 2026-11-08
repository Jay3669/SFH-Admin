import { apiRequest } from "./apiService";

const STORAGE_KEY = "sfhPosSettings";

export const DEFAULT_POS_SETTINGS = {
  billNumberPrefix: "POS-",
  nextBillNumber: 1,
  packagingEnabled: false,
  packagingAmount: 0,
  taxEnabled: false,
  taxRate: 0,
  paymentMethods: {
    cash: true,
    card: true,
    upi: true,
    split: false,
  },
  allowBalanceDue: false,
};

export function getPosSettings() {
  try {
    const savedSettings = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...DEFAULT_POS_SETTINGS,
      ...savedSettings,
      paymentMethods: {
        ...DEFAULT_POS_SETTINGS.paymentMethods,
        ...(savedSettings.paymentMethods || {}),
      },
    };
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
}

export function savePosSettings(settings) {
  const normalizedSettings = {
    ...DEFAULT_POS_SETTINGS,
    ...settings,
    paymentMethods: {
      ...DEFAULT_POS_SETTINGS.paymentMethods,
      ...(settings.paymentMethods || {}),
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
  return normalizedSettings;
}

export async function loadPosSettings() {
  const response = await apiRequest("/api/pos/settings", { skipGlobalError: true });
  if (!response?.settings || response.success === false) throw new Error("The POS settings response was invalid.");
  return savePosSettings(response.settings);
}

export async function updatePosSettings(settings) {
  const response = await apiRequest("/api/pos/settings", {
    method: "PUT",
    skipGlobalError: true,
    body: JSON.stringify(settings),
  });
  if (!response?.settings || response.success === false) throw new Error("The POS settings response was invalid.");
  return savePosSettings(response.settings);
}