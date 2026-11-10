import { io } from "socket.io-client";
import { apiRequest } from "./apiService";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5050";

function assertKots(response) {
  if (!Array.isArray(response?.kots) || response.success === false) {
    throw new Error("The KOT response was invalid.");
  }
  return response.kots;
}

export async function fireKot(payload) {
  const response = await apiRequest("/api/pos/kots", {
    method: "POST",
    skipGlobalError: true,
    headers: { "Idempotency-Key": payload.idempotencyKey },
    body: JSON.stringify(payload),
  });
  return assertKots(response);
}

export async function listDiningTables() {
  const response = await apiRequest("/api/pos/tables", { skipGlobalError: true });
  if (!Array.isArray(response?.tables) || response.success === false) {
    throw new Error("The table list response was invalid.");
  }
  return response.tables;
}

export async function createDiningTable(tableName) {
  const response = await apiRequest("/api/pos/tables", {
    method: "POST",
    skipGlobalError: true,
    body: JSON.stringify({ tableName }),
  });
  if (!response?.table || response.success === false) {
    throw new Error("The new table response was invalid.");
  }
  return response.table;
}

export async function transferDiningTable(tableName, destinationTable, action, options = {}) {
  if (!["move", "merge"].includes(action)) throw new Error("The table transfer action was invalid.");
  const itemIds = options.itemIds;
  if (itemIds !== undefined && (!Array.isArray(itemIds) || itemIds.length === 0)) {
    throw new Error("Select at least one KOT item to transfer.");
  }
  const response = await apiRequest(
    `/api/pos/tables/${encodeURIComponent(tableName)}/${action}`,
    {
      method: "POST",
      skipGlobalError: true,
      body: JSON.stringify({ destinationTable, ...(itemIds ? { itemIds } : {}) }),
    }
  );
  if (!Array.isArray(response?.kots) || response.success === false) {
    throw new Error("The table transfer response was invalid.");
  }
  return response;
}

export async function updateDiningTableStatus(tableName, status) {
  const response = await apiRequest(
    `/api/pos/tables/${encodeURIComponent(tableName)}/status`,
    {
      method: "PATCH",
      skipGlobalError: true,
      body: JSON.stringify({ status }),
    }
  );
  if (!response?.table || response.success === false) {
    throw new Error("The table status response was invalid.");
  }
  return response.table;
}

export async function listKitchenKots(station) {
  const query = new URLSearchParams();
  if (station && station !== "All") query.set("station", station);
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : "";
  return assertKots(await apiRequest(`/api/pos/kots${suffix}`, { skipGlobalError: true }));
}

export async function updateKotItemStatus(kotNumber, itemId, status) {
  const response = await apiRequest(`/api/pos/kots/${encodeURIComponent(kotNumber)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    skipGlobalError: true,
    body: JSON.stringify({ status }),
  });
  if (!response?.kot || response.success === false) throw new Error("The updated KOT response was invalid.");
  return response.kot;
}

export function connectKitchenSocket() {
  const token = window.localStorage.getItem("authToken");
  if (!token) throw new Error("A valid session is required to connect to the kitchen display.");
  return io(API_BASE_URL, { auth: { token } });
}
