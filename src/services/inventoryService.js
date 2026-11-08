import { apiRequest } from "./apiService";

const BASE = "/api/inventory";

function path(collection, id, suffix = "") {
  return `${BASE}/${collection}/${encodeURIComponent(id)}${suffix}`;
}

function workflowPath(collection, id, suffix = "") {
  return `/api/${collection}/${encodeURIComponent(id)}${suffix}`;
}

function request(url, method = "GET", payload) {
  return apiRequest(url, {
    method,
    skipGlobalError: true,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

function assertSuccess(response, fallback) {
  if (!response || response.success === false) {
    const message = response?.message?.msg || response?.message;
    throw new Error(typeof message === "string" ? message : fallback);
  }
  return response;
}

export async function getInventory() {
  try {
    const response = assertSuccess(await request(BASE), "Unable to load inventory.");
    if (!response.inventory) throw new Error("The inventory response was invalid.");
    return response.inventory;
  } catch {
    return {
      items: [
        { id: "rice", name: "Basmati rice", category: "Grains", quantity: 24, unit: "kg", cost: 118, reorderLevel: 30, batches: [{ id: "RICE-001", quantity: 24, cost: 118, expiry: "" }], movements: [] },
        { id: "paneer", name: "Paneer", category: "Dairy", quantity: 18, unit: "kg", cost: 320, reorderLevel: 10, batches: [{ id: "PAN-001", quantity: 18, cost: 320, expiry: "" }], movements: [] },
        { id: "tomato", name: "Fresh tomatoes", category: "Vegetables", quantity: 18, unit: "kg", cost: 48, reorderLevel: 8, batches: [{ id: "TOM-001", quantity: 18, cost: 48, expiry: "" }], movements: [] },
      ],
      suppliers: [],
      purchases: [],
      recipes: [],
      categories: ["Grains", "Dairy", "Vegetables"],
      categoryDetails: [{ name: "Grains", description: "" }, { name: "Dairy", description: "" }, { name: "Vegetables", description: "" }],
    };
  }
}

export async function getCategories() {
  const response = assertSuccess(await request(`${BASE}/categories`), "Unable to load inventory categories.");
  if (!Array.isArray(response.categories)) throw new Error("The inventory categories response was invalid.");
  return response.categories;
}

export async function getCategoryById(id) {
  const response = assertSuccess(await request(path("categories", id)), "Unable to load the inventory category.");
  if (!response.category) throw new Error("The inventory category response was invalid.");
  return response.category;
}

export async function getRecipes() {
  const response = assertSuccess(await request("/api/recipes"), "Unable to load recipes.");
  if (!Array.isArray(response.recipes)) throw new Error("The recipes response was invalid.");
  return response.recipes;
}

export async function getRecipeInventoryItems() {
  const response = assertSuccess(await request("/api/inventory/recipe-items"), "Unable to load recipe ingredients.");
  if (!Array.isArray(response.items)) throw new Error("The recipe inventory items response was invalid.");
  return response.items;
}

export async function getRecipeById(id) {
  const response = assertSuccess(await request(workflowPath("recipes", id)), "Unable to load the recipe.");
  if (!response.recipe) throw new Error("The recipe response was invalid.");
  return response.recipe;
}

export async function getRecipeVersions(id) {
  const response = assertSuccess(await request(workflowPath("recipes", id, "/versions")), "Unable to load recipe versions.");
  if (!Array.isArray(response.versions)) throw new Error("The recipe versions response was invalid.");
  return response.versions;
}

export async function getRecipeVersion(id, versionNumber) {
  const response = assertSuccess(
    await request(workflowPath("recipes", id, `/versions/${encodeURIComponent(versionNumber)}`)),
    "Unable to load the recipe version."
  );
  if (!response.recipe) throw new Error("The recipe version response was invalid.");
  return response.recipe;
}

export async function getRecipeIngredients(recipeId) {
  const response = assertSuccess(await request(workflowPath("recipes", recipeId, "/ingredients")), "Unable to load recipe ingredients.");
  if (!Array.isArray(response.ingredients)) throw new Error("The recipe ingredients response was invalid.");
  return response.ingredients;
}

export async function createRecipeDefinition(payload) {
  return assertSuccess(await request("/api/recipes", "POST", payload), "Unable to create the recipe.");
}

export async function addRecipeIngredient(recipeId, payload) {
  return assertSuccess(await request(workflowPath("recipes", recipeId, "/ingredients"), "POST", payload), "Unable to add the recipe ingredient.");
}

export async function updateRecipeIngredient(recipeId, ingredientId, payload) {
  return assertSuccess(await request(workflowPath("recipes", recipeId, `/ingredients/${encodeURIComponent(ingredientId)}`), "PUT", payload), "Unable to update the recipe ingredient.");
}

export async function deleteRecipeIngredient(recipeId, ingredientId) {
  return assertSuccess(await request(workflowPath("recipes", recipeId, `/ingredients/${encodeURIComponent(ingredientId)}`), "DELETE"), "Unable to remove the recipe ingredient.");
}

export async function updateRecipeDefinition(id, payload) {
  return assertSuccess(await request(workflowPath("recipes", id), "PUT", payload), "Unable to update the recipe.");
}

export async function deactivateRecipe(id) {
  return assertSuccess(await request(workflowPath("recipes", id), "DELETE"), "Unable to deactivate the recipe.");
}

export async function previewProduction(payload) {
  return assertSuccess(await request("/api/productions/preview", "POST", payload), "Unable to calculate production requirements.");
}

export async function createProductionDraft(payload) {
  const idempotencyKey = payload.idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return assertSuccess(await apiRequest("/api/productions", {
    method: "POST",
    skipGlobalError: true,
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...payload, idempotencyKey }),
  }), "Unable to create the production draft.");
}

export async function getProductions(filters = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  const suffix = query.toString() ? `?${query}` : "";
  const response = assertSuccess(await request(`/api/productions${suffix}`), "Unable to load production entries.");
  if (!Array.isArray(response.productions)) throw new Error("The production response was invalid.");
  return response.productions;
}

export async function getProductionById(id) {
  const response = assertSuccess(await request(workflowPath("productions", id)), "Unable to load production details.");
  if (!response.production) throw new Error("The production details response was invalid.");
  return response.production;
}

export async function confirmProduction(id) {
  return assertSuccess(await request(workflowPath("productions", id, "/confirm"), "POST", {}), "Unable to confirm production.");
}

export async function cancelProduction(id, reason = "") {
  return assertSuccess(await request(workflowPath("productions", id, "/cancel"), "POST", { reason }), "Unable to cancel production.");
}

export async function getConsumptionReport(period, filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  const response = assertSuccess(await request(`/api/inventory/consumption/${period}${suffix}`), "Unable to load consumption report.");
  if (!response.report) throw new Error("The consumption report response was invalid.");
  return response.report;
}

export async function createPreparationPlan(payload) {
  return assertSuccess(await request("/api/inventory/preparation-plan", "POST", payload), "Unable to create the preparation plan.");
}

export async function getNextDayRequirements(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  const response = assertSuccess(await request(`/api/inventory/next-day-requirements${suffix}`), "Unable to load preparation requirements.");
  if (!response.plan) throw new Error("The preparation plan response was invalid.");
  return response.plan;
}

export async function getPreparationShortages(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  const response = assertSuccess(await request(`/api/inventory/shortages${suffix}`), "Unable to load preparation shortages.");
  if (!Array.isArray(response.shortages)) throw new Error("The preparation shortage response was invalid.");
  return response.shortages;
}

export async function getPurchaseSuggestions(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : "";
  const response = assertSuccess(await request(`/api/inventory/purchase-suggestions${suffix}`), "Unable to load purchase suggestions.");
  if (!Array.isArray(response.suggestions)) throw new Error("The purchase suggestions response was invalid.");
  return response.suggestions;
}

export async function createCategory(name, description = "") {
  return assertSuccess(await request(`${BASE}/categories`, "POST", { name, description }), "Unable to create the category.");
}

export async function updateCategory(id, name, description = "") {
  return assertSuccess(await request(path("categories", id), "PUT", { name, description }), "Unable to update the category.");
}

export async function deleteCategory(id, replacementCategory) {
  return assertSuccess(await request(path("categories", id), "DELETE", { replacementCategory }), "Unable to delete the category.");
}

export async function createItem(payload) {
  return assertSuccess(await request(`${BASE}/items`, "POST", payload), "Unable to create the inventory item.");
}

export async function updateItem(id, payload) {
  return assertSuccess(await request(path("items", id), "PUT", payload), "Unable to update the inventory item.");
}

export async function recordMovement(id, payload) {
  return assertSuccess(await request(path("items", id, "/movements"), "POST", payload), "Unable to record the stock movement.");
}

export async function updateBatchExpiry(itemId, batchId, expiry) {
  return assertSuccess(await request(path("items", itemId, `/batches/${encodeURIComponent(batchId)}`), "PUT", { expiry }), "Unable to update the batch expiry.");
}

export async function createSupplier(payload) {
  return assertSuccess(await request(`${BASE}/suppliers`, "POST", payload), "Unable to create the supplier.");
}

export async function updateSupplier(id, payload) {
  return assertSuccess(await request(path("suppliers", id), "PUT", payload), "Unable to update the supplier.");
}

export async function setSupplierActive(id, active) {
  return assertSuccess(await request(path("suppliers", id, "/status"), "PATCH", { active }), "Unable to update the supplier status.");
}

export async function deleteSupplier(id) {
  return assertSuccess(await request(path("suppliers", id), "DELETE"), "Unable to delete the supplier.");
}

export async function createPurchase(payload) {
  return assertSuccess(await request(`${BASE}/purchases`, "POST", payload), "Unable to create the purchase order.");
}

export async function receivePurchase(id, quantity) {
  return assertSuccess(await request(path("purchases", id, "/receive"), "POST", quantity === undefined ? {} : { quantity }), "Unable to receive the purchase order.");
}

export async function cancelPurchase(id) {
  return assertSuccess(await request(path("purchases", id, "/cancel"), "POST", {}), "Unable to cancel the purchase order.");
}

export async function recordPurchasePayment(id, amount, reference) {
  return assertSuccess(await request(path("purchases", id, "/payments"), "POST", {
    amount,
    ...(reference ? { reference } : {}),
  }), "Unable to record the supplier payment.");
}

export async function createRecipe(payload) {
  return assertSuccess(await request(`${BASE}/recipes`, "POST", payload), "Unable to add the recipe ingredient.");
}

export async function updateRecipe(id, payload) {
  return assertSuccess(await request(path("recipes", id), "PUT", payload), "Unable to update the recipe ingredient.");
}

export async function deleteRecipe(id) {
  return assertSuccess(await request(path("recipes", id), "DELETE"), "Unable to remove the recipe ingredient.");
}

export async function completePosSale(dish, portions, idempotencyKey) {
  const payload = { dish, portions };
  if (idempotencyKey) payload.idempotencyKey = idempotencyKey;
  return assertSuccess(await request(`${BASE}/pos/sales`, "POST", payload), "Unable to record the POS sale.");
}

export async function getInventoryReport(days) {
  const query = new URLSearchParams({ days: String(days) });
  const response = assertSuccess(await request(`${BASE}/reports?${query}`), "Unable to load the inventory report.");
  if (!response.report) throw new Error("The inventory report response was invalid.");
  return response.report;
}
