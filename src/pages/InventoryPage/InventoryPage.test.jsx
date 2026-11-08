import { fireEvent, render, screen, waitForElementToBeRemoved, within } from "@testing-library/react";

jest.setTimeout(60000);

let mockInventoryData;

jest.mock("../../services/inventoryService", () => ({
  __esModule: true,
  getInventory: jest.fn(),
  getInventoryReport: jest.fn(),
  getRecipeInventoryItems: jest.fn(),
  getRecipes: jest.fn(),
  getProductions: jest.fn(),
  getProductionById: jest.fn(),
  recordMovement: jest.fn(),
  createItem: jest.fn(),
  createRecipeDefinition: jest.fn(),
  createRecipe: jest.fn(),
  completePosSale: jest.fn(),
  createSupplier: jest.fn(),
  updateSupplier: jest.fn(),
  deleteSupplier: jest.fn(),
  setSupplierActive: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

const inventoryServiceMock = require("../../services/inventoryService");
jest.mock("../../services/menuService", () => ({ listMenuItems: jest.fn() }));
const menuServiceMock = require("../../services/menuService");
const InventoryPage = require("./InventoryPage").default;

function createInventoryData() {
  const makeItem = (id, name, category, quantity, unit, cost, reorderLevel) => ({
    id, name, category, quantity, unit, cost, reorderLevel,
    batches: quantity > 0 ? [{ id: `${id}-batch`, quantity, cost, expiry: "", receivedAt: 1 }] : [],
    movements: [],
  });
  return {
    categories: ["Dairy", "Fruits", "Grains", "Meat & poultry", "Oils", "Packaging", "Vegetables"],
    categoryDetails: ["Dairy", "Fruits", "Grains", "Meat & poultry", "Oils", "Packaging", "Vegetables"]
      .map((name, index) => ({ id: String(index + 1), name, description: "" })),
    items: [
      makeItem("rice", "Basmati rice", "Grains", 24, "kg", 118, 10),
      makeItem("oil", "Cooking oil", "Oils", 8, "L", 142, 10),
      makeItem("chicken", "Chicken", "Meat & poultry", 3.5, "kg", 280, 5),
      makeItem("tomatoes", "Tomatoes", "Vegetables", 4, "kg", 42, 4),
    ],
    suppliers: [
      { id: "sup-1", name: "Fresh Farms Co.", contact: "Anil Kumar", phone: "+91 98765 43210", email: "orders@freshfarms.in", terms: "Net 7 days", active: true },
      { id: "sup-2", name: "City Wholesale Market", contact: "Meera Shah", phone: "+91 98220 11223", email: "sales@citywholesale.in", terms: "Due on receipt", active: true },
      { id: "sup-3", name: "Dairy Direct", contact: "Ravi Nair", phone: "+91 98900 76543", email: "hello@dairydirect.in", terms: "Net 15 days", active: true },
    ],
    purchases: [
      { id: "PO-1048", purchaseId: "1", supplierId: "sup-1", supplier: "Fresh Farms Co.", itemId: "chicken", item: "Chicken", quantity: 5, unit: "kg", unitPrice: 280, date: "2026-11-06", status: "Received", invoice: "FF-8194", paidAmount: 1400, due: 0 },
    ],
    recipes: [
      { id: "recipe-1", dish: "Chicken Biryani", itemId: "rice", quantity: 0.15, unit: "kg" },
      { id: "recipe-2", dish: "Chicken Biryani", itemId: "chicken", quantity: 0.2, unit: "kg" },
      { id: "recipe-3", dish: "Chicken Biryani", itemId: "oil", quantity: 0.02, unit: "L" },
      { id: "recipe-4", dish: "Chicken 65", itemId: "chicken", quantity: 0.25, unit: "kg" },
      { id: "recipe-5", dish: "Chicken 65", itemId: "oil", quantity: 0.05, unit: "L" },
    ],
  };
}

async function renderInventory() {
  render(<InventoryPage />);
  await screen.findByRole("tab", { name: /stock items/i });
}

beforeEach(() => {
  mockInventoryData = createInventoryData();
  const snapshot = () => JSON.parse(JSON.stringify(mockInventoryData));
  inventoryServiceMock.getInventory.mockImplementation(async () => snapshot());
  inventoryServiceMock.getRecipeInventoryItems.mockResolvedValue([
    { id: "rice", name: "Basmati rice", unit: "kg" },
    { id: "chicken", name: "Chicken", unit: "kg" },
  ]);
  inventoryServiceMock.getRecipes.mockResolvedValue([]);
  inventoryServiceMock.getProductions.mockResolvedValue([]);
  inventoryServiceMock.getProductionById.mockResolvedValue({});
  inventoryServiceMock.recordMovement.mockResolvedValue({ success: true });
  inventoryServiceMock.createRecipeDefinition.mockResolvedValue({ success: true });
  menuServiceMock.listMenuItems.mockResolvedValue([{ id: "menu-1", name: "Chicken Biryani" }]);
  inventoryServiceMock.getInventoryReport.mockImplementation(async () => ({
    currentStockValue: 0,
    purchaseSpend: 0,
    consumptionValue: 0,
    receiptCount: 0,
  }));
  inventoryServiceMock.createItem.mockResolvedValue({ success: true });
  inventoryServiceMock.completePosSale.mockImplementation(async (dish, portions) => {
    const ingredients = mockInventoryData.recipes.filter((recipe) => recipe.dish === dish);
    const requirements = ingredients.map((recipe) => ({
      recipe,
      item: mockInventoryData.items.find((item) => item.id === recipe.itemId),
      quantity: recipe.quantity * portions,
    }));
    const unavailable = requirements.find(({ item, quantity }) => !item || item.quantity < quantity);
    if (unavailable) throw new Error(`Not enough ${unavailable.item?.name || "stock"} for ${portions} ${dish} servings. Sale was not recorded.`);
    requirements.forEach(({ item, quantity }) => {
      item.quantity -= quantity;
      item.batches[0].quantity -= quantity;
      item.movements.unshift({ type: "POS consumption", quantity, unit: item.unit, reason: `Completed POS bill · ${portions} × ${dish}`, date: "Just now", timestamp: Date.now() });
    });
  });
  inventoryServiceMock.createSupplier.mockImplementation(async (payload) => {
    mockInventoryData.suppliers.unshift({ ...payload, id: `sup-${Date.now()}`, active: true });
  });
  inventoryServiceMock.updateSupplier.mockImplementation(async (id, payload) => {
    mockInventoryData.suppliers = mockInventoryData.suppliers.map((supplier) => supplier.id === id ? { ...supplier, ...payload } : supplier);
  });
  inventoryServiceMock.deleteSupplier.mockImplementation(async (id) => {
    const hasHistory = mockInventoryData.purchases.some((purchase) => purchase.supplierId === id);
    mockInventoryData.suppliers = hasHistory
      ? mockInventoryData.suppliers.map((supplier) => supplier.id === id ? { ...supplier, active: false } : supplier)
      : mockInventoryData.suppliers.filter((supplier) => supplier.id !== id);
  });
  inventoryServiceMock.setSupplierActive.mockImplementation(async (id, active) => {
    mockInventoryData.suppliers = mockInventoryData.suppliers.map((supplier) => supplier.id === id ? { ...supplier, active } : supplier);
  });
  inventoryServiceMock.createCategory.mockImplementation(async (name, description) => {
    mockInventoryData.categories.push(name);
    mockInventoryData.categories.sort();
    mockInventoryData.categoryDetails.push({ id: String(Date.now()), name, description });
  });
  inventoryServiceMock.updateCategory.mockImplementation(async (from, to, description) => {
    mockInventoryData.categories = mockInventoryData.categories.map((category) => category === from ? to : category).sort();
    mockInventoryData.categoryDetails = mockInventoryData.categoryDetails.map((category) =>
      category.name === from ? { ...category, name: to, description } : category
    );
    mockInventoryData.items.forEach((item) => { if (item.category === from) item.category = to; });
  });
  inventoryServiceMock.deleteCategory.mockImplementation(async (name, replacement) => {
    mockInventoryData.categories = mockInventoryData.categories.filter((category) => category !== name);
    mockInventoryData.categoryDetails = mockInventoryData.categoryDetails.filter((category) => category.name !== name);
    mockInventoryData.items.forEach((item) => { if (item.category === name) item.category = replacement; });
  });
});

describe("InventoryPage recipe stock flow", () => {
  test("defaults production date to the current local date", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));

    const now = new Date();
    const expectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(await screen.findByLabelText(/production date/i)).toHaveValue(expectedDate);
  });

  test("views a production's ingredient quantities, costs, and total cost", async () => {
    inventoryServiceMock.getProductions.mockResolvedValue([{
      id: "production-1",
      productionNumber: "PR-001",
      productionDate: "2026-11-07",
      recipeName: "Chicken Biryani",
      productionQuantity: 5,
      productionUnit: "kg",
      status: "Confirmed",
      totalCost: 650,
    }]);
    inventoryServiceMock.getProductionById.mockResolvedValue({
      id: "production-1",
      productionNumber: "PR-001",
      productionDate: "2026-11-07",
      recipeName: "Chicken Biryani",
      productionQuantity: 5,
      productionUnit: "kg",
      status: "Confirmed",
      totalCost: 650,
      ingredients: [{
        id: "consumed-rice",
        ingredientName: "Basmati rice",
        actualQuantity: 2,
        unit: "kg",
        unitCost: 120,
        totalCost: 240,
      }],
    });

    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /view PR-001 details/i }));

    const productionDialog = await screen.findByRole("dialog");
    expect(await within(productionDialog).findByText("Basmati rice")).toBeInTheDocument();
    expect(within(productionDialog).getByText("₹240.00")).toBeInTheDocument();
    expect(within(productionDialog).getByText("₹650.00")).toBeInTheDocument();
    expect(inventoryServiceMock.getProductionById).toHaveBeenCalledWith("production-1");
  });

  test("shows recipe summary and ingredient costs in the view dialog", async () => {
    inventoryServiceMock.getRecipes.mockResolvedValue([{
      id: "versioned-recipe-1",
      name: "Chicken Biryani",
      menuItemName: "Chicken Biryani",
      version: 2,
      status: "Active",
      baseProductionQuantity: 0.5,
      productionUnit: "kg",
      totalRecipeCost: 150,
      ingredients: [{
        id: "recipe-rice",
        itemId: "rice",
        name: "Basmati rice",
        quantity: 0.2,
        unit: "kg",
        inventoryUnit: "kg",
        unitCost: 100,
        totalCost: 20,
      }],
    }]);

    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /^Recipes$/i }));

    expect(await screen.findByText("₹150.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view Chicken Biryani details/i }));
    const recipeDialog = await screen.findByRole("dialog");
    expect(within(recipeDialog).getByText("Overall recipe cost")).toBeInTheDocument();
    expect(within(recipeDialog).getByText("Basmati rice")).toBeInTheDocument();
    expect(within(recipeDialog).getByText("₹20.00")).toBeInTheDocument();
  });

  test("creates a menu recipe with multiple ingredients for the default half-kilogram batch", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));
    fireEvent.click(await screen.findByRole("tab", { name: /^Recipes$/i }));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: /menu item/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Chicken Biryani" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /inventory ingredient/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Basmati rice (kg)" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /required quantity/i }), { target: { value: "0.2" } });
    fireEvent.click(screen.getAllByRole("button", { name: /add ingredient/i })[0]);
    fireEvent.mouseDown(screen.getAllByRole("combobox", { name: /inventory ingredient/i })[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Chicken (kg)" }));
    fireEvent.change(screen.getAllByRole("spinbutton", { name: /required quantity/i })[1], { target: { value: "0.15" } });
    fireEvent.click(screen.getAllByRole("button", { name: /add ingredient/i })[0]);
    expect(screen.getAllByRole("combobox", { name: /inventory ingredient/i })).toHaveLength(3);
    const recipeEditor = screen.getByRole("button", { name: /create recipe/i }).closest("form");
    fireEvent.click(within(recipeEditor).getAllByRole("button", { name: "Remove" })[2]);
    fireEvent.click(within(recipeEditor).getByRole("button", { name: /create recipe/i }));

    expect(await screen.findByText("Recipe created.")).toBeInTheDocument();
    expect(inventoryServiceMock.createRecipeDefinition).toHaveBeenCalledWith({
      menuItemId: "menu-1",
      name: "Chicken Biryani",
      baseProductionQuantity: 0.5,
      productionUnit: "kg",
      status: "Active",
      instructions: "",
      ingredients: [
        { itemId: "rice", quantity: 0.2, unit: "kg" },
        { itemId: "chicken", quantity: 0.15, unit: "kg" },
      ],
    });
  });

  test("deducts each configured ingredient after a completed POS bill", async () => {
    await renderInventory();

    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /record pos sale/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /complete bill & deduct/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    fireEvent.click(screen.getByRole("tab", { name: /stock items/i }));

    const riceRow = screen.getByRole("row", { name: /Basmati rice/i });
    const chickenRow = screen.getByRole("row", { name: /^Chicken /i });
    const oilRow = screen.getByRole("row", { name: /Cooking oil/i });
    expect(within(riceRow).getByText("23.85 kg")).toBeInTheDocument();
    expect(within(chickenRow).getByText("3.3 kg")).toBeInTheDocument();
    expect(within(oilRow).getByText("7.98 L")).toBeInTheDocument();
  });

  test("does not partially deduct stock when a recipe cannot be fulfilled", async () => {
    await renderInventory();

    fireEvent.click(screen.getByRole("tab", { name: /^Recipes & production$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /record pos sale/i })[1]);
    fireEvent.change(screen.getByRole("spinbutton", { name: /number of servings/i }), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /complete bill & deduct/i }));

    expect(await screen.findByText(/Not enough Chicken/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    fireEvent.click(screen.getByRole("tab", { name: /stock items/i }));
    const chickenRow = screen.getByRole("row", { name: /^Chicken /i });
    expect(within(chickenRow).getByText("3.5 kg")).toBeInTheDocument();
  });

  test("treats opening stock cost as total value and shows derived unit cost", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("button", { name: /^add item$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /item name/i }), { target: { value: "Mutton" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /opening stock/i }), { target: { value: "10" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /reorder point/i }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /opening stock total cost/i }), { target: { value: "9000" } });

    expect(screen.getByText("Unit cost: ₹900 per kg")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add item$/i }));

    expect(await screen.findByText("Inventory item added.")).toBeInTheDocument();
    expect(inventoryServiceMock.createItem).toHaveBeenCalledWith(expect.objectContaining({
      name: "Mutton",
      quantity: 10,
      unit: "kg",
      openingTotalCost: 9000,
    }));
  });

  test("saves millilitres as the recipe unit for an item stocked in litres", async () => {
    await renderInventory();

    fireEvent.click(screen.getByRole("tab", { name: /recipes/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add ingredient$/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /menu item \/ dish/i }), { target: { value: "Soup" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /inventory ingredient/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Cooking oil (L)" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /quantity per serving/i }), { target: { value: "200" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /recipe unit/i }));
    fireEvent.click(await screen.findByRole("option", { name: "ml" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add ingredient$/i }));

    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(inventoryServiceMock.createRecipe).toHaveBeenCalledWith({ dish: "Soup", itemId: "oil", quantity: 200, unit: "ml" });
  });
});

describe("InventoryPage wastage flow", () => {
  test("opens the stock movement dialog with Wastage selected", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /stock items/i }));
    fireEvent.click(screen.getByRole("button", { name: "Record wastage for Basmati rice" }));

    const movementDialog = await screen.findByRole("dialog");
    expect(within(movementDialog).getByRole("heading", { name: /record stock movement/i })).toBeInTheDocument();
    expect(within(movementDialog).getByRole("combobox", { name: /movement type/i })).toHaveTextContent("Wastage");
    expect(within(movementDialog).getByText(/deducts the quantity from available stock/i)).toBeInTheDocument();
  });
});

describe("InventoryPage supplier management", () => {
  test("adds, edits, views, and deletes a supplier without purchase history", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /suppliers/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /add supplier/i })[0]);

    fireEvent.change(screen.getByRole("textbox", { name: /supplier \/ business name/i }), { target: { value: "Corner Market" } });
    fireEvent.change(screen.getByRole("textbox", { name: /contact person/i }), { target: { value: "Sam Lee" } });
    fireEvent.change(screen.getByRole("textbox", { name: /phone number/i }), { target: { value: "555-0182" } });
    fireEvent.change(screen.getByRole("textbox", { name: /email address/i }), { target: { value: "sam@example.com" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /add supplier/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    const supplierRow = await screen.findByRole("row", { name: /Corner Market/ });
    fireEvent.click(within(supplierRow).getByRole("button", { name: /view Corner Market/i }));
    expect((await screen.findAllByText("sam@example.com")).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    fireEvent.click(within(supplierRow).getByRole("button", { name: /edit Corner Market/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /contact person/i }), { target: { value: "Sam Rivera" } });
    fireEvent.click(screen.getByRole("button", { name: /save supplier/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(await screen.findByText("Sam Rivera")).toBeInTheDocument();

    const updatedRow = screen.getByRole("row", { name: /Corner Market/ });
    fireEvent.click(within(updatedRow).getByRole("button", { name: /delete Corner Market/i }));
    expect(await screen.findByRole("heading", { name: /delete supplier/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^delete supplier$/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.queryByRole("row", { name: /Corner Market/ })).not.toBeInTheDocument();
  });

  test("archives suppliers with purchase history instead of deleting linked records", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /suppliers/i }));
    const supplierRow = screen.getByRole("row", { name: /Fresh Farms Co\./ });
    fireEvent.click(within(supplierRow).getByRole("button", { name: /delete Fresh Farms Co\./i }));

    expect(await screen.findByRole("heading", { name: /archive supplier/i })).toBeInTheDocument();
    expect(screen.getByText(/purchase record.*archived/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /archive supplier/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    const archivedRow = screen.getByRole("row", { name: /Fresh Farms Co\./ });
    expect(within(archivedRow).getByText("Archived")).toBeInTheDocument();
  });
});

describe("InventoryPage category management", () => {
  test("creates, renames, and deletes an empty category", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /categories/i }));
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /category name/i }), { target: { value: "Dry goods" } });
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), { target: { value: "Shelf-stable ingredients" } });
    fireEvent.click(screen.getByRole("button", { name: /create category/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(await screen.findByText("Dry goods")).toBeInTheDocument();
    expect(await screen.findByText("Shelf-stable ingredients")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit Dry goods/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /category name/i }), { target: { value: "Pantry goods" } });
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), { target: { value: "Dry pantry ingredients" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(await screen.findByText("Pantry goods")).toBeInTheDocument();
    expect(await screen.findByText("Dry pantry ingredients")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete Pantry goods/i }));
    expect(await screen.findByRole("heading", { name: /delete stock category/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete category/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(screen.queryByText("Pantry goods")).not.toBeInTheDocument();
  });

  test("moves linked stock items to a chosen category before deletion", async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole("tab", { name: /categories/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete Vegetables/i }));
    expect(await screen.findByText(/contains 1 stock item/i)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: /move stock items to/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Fruits" }));
    fireEvent.click(screen.getByRole("button", { name: /delete category/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    fireEvent.click(screen.getByRole("tab", { name: /stock items/i }));
    const tomatoesRow = screen.getByRole("row", { name: /Tomatoes/i });
    expect(within(tomatoesRow).getByText("Fruits")).toBeInTheDocument();
    expect(screen.queryByText("Vegetables")).not.toBeInTheDocument();
  });
});
