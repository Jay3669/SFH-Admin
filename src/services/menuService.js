import { apiRequest } from "./apiService";
import { API_ENDPOINTS } from "./endpoints";

function assertSuccessful(response, fallback) {
  if (!response || response.success === false) {
    const message = response?.message?.msg || response?.message;
    throw new Error(typeof message === "string" ? message : fallback);
  }
  return response;
}

function getIdPath(collection, id) {
  return `${collection}/${encodeURIComponent(id)}`;
}

async function getAllPages(path, property, fallback) {
  const firstResponse = assertSuccessful(
    await apiRequest(path),
    fallback
  );
  if (!Array.isArray(firstResponse[property])) {
    throw new Error(fallback);
  }

  const results = [...firstResponse[property]];
  const pages = Math.max(1, Number(firstResponse.pagination?.pages) || 1);
  const limit = Number(firstResponse.pagination?.limit) || 20;

  for (let page = 2; page <= pages; page += 1) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const separator = path.includes("?") ? "&" : "?";
    const response = assertSuccessful(
      await apiRequest(`${path}${separator}${query.toString()}`),
      fallback
    );
    if (!Array.isArray(response[property])) {
      throw new Error(fallback);
    }
    results.push(...response[property]);
  }

  return results;
}

export function listMenuCategories() {
  return getAllPages(
    API_ENDPOINTS.menuCategories,
    "categories",
    "The menu categories response was invalid."
  );
}

export function getMenuCategory(id) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuCategories, id)).then((response) => {
    assertSuccessful(response, "Unable to load this category.");
    if (!response.category) throw new Error("The category response was invalid.");
    return response.category;
  });
}

export function createMenuCategory(payload) {
  return apiRequest(API_ENDPOINTS.menuCategories, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => {
    assertSuccessful(response, "Unable to create the category.");
    if (!response.category) throw new Error("The category response was invalid.");
    return response.category;
  });
}

export function updateMenuCategory(id, payload) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuCategories, id), {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((response) => {
    assertSuccessful(response, "Unable to update the category.");
    if (!response.category) throw new Error("The category response was invalid.");
    return response.category;
  });
}

export function deleteMenuCategory(id) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuCategories, id), {
    method: "DELETE",
  }).then((response) =>
    assertSuccessful(response, "Unable to delete the category.")
  );
}

export function listMenuItems(filters = {}) {
  const query = new URLSearchParams();
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.foodType) query.set("food_type", filters.foodType);
  if (filters.isAvailable) {
    query.set("is_available", filters.isAvailable);
  }
  if (filters.sort) query.set("sort", filters.sort);

  const queryString = query.toString();
  const path = queryString
    ? `${API_ENDPOINTS.menuItems}?${queryString}`
    : API_ENDPOINTS.menuItems;
  return getAllPages(
    path,
    "items",
    "The menu items response was invalid."
  );
}

export function getMenuItem(id) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuItems, id)).then((response) => {
    assertSuccessful(response, "Unable to load this menu item.");
    if (!response.item) throw new Error("The menu item response was invalid.");
    return response.item;
  });
}

export function createMenuItem(payload) {
  return apiRequest(API_ENDPOINTS.menuItems, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => {
    assertSuccessful(response, "Unable to create the menu item.");
    if (!response.item) throw new Error("The menu item response was invalid.");
    return response.item;
  });
}

export function updateMenuItem(id, payload) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuItems, id), {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((response) => {
    assertSuccessful(response, "Unable to update the menu item.");
    if (!response.item) throw new Error("The menu item response was invalid.");
    return response.item;
  });
}

export function deleteMenuItem(id) {
  return apiRequest(getIdPath(API_ENDPOINTS.menuItems, id), {
    method: "DELETE",
  }).then((response) =>
    assertSuccessful(response, "Unable to delete the menu item.")
  );
}
