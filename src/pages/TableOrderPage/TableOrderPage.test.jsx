import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TableOrderPage from "./TableOrderPage";
import { listMenuCategories, listMenuItems } from "../../services/menuService";
import {
  fireKot,
  createDiningTable,
  listDiningTables,
  transferDiningTable,
  updateDiningTableStatus,
} from "../../services/kotService";

let mockSocketHandlers;

jest.mock("../../services/menuService", () => ({
  listMenuCategories: jest.fn(),
  listMenuItems: jest.fn(),
}));

jest.mock("../../services/kotService", () => ({
  fireKot: jest.fn(),
  createDiningTable: jest.fn(),
  listDiningTables: jest.fn(),
  transferDiningTable: jest.fn(),
  updateDiningTableStatus: jest.fn(),
  connectKitchenSocket: () => ({
    on: jest.fn((event, handler) => { mockSocketHandlers[event] = handler; }),
    disconnect: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  window.localStorage.clear();
  mockSocketHandlers = {};
  listMenuCategories.mockResolvedValue([{ category_id: 1, category_name: "Mains" }]);
  listMenuItems.mockResolvedValue([
    { menu_item_id: 12, name: "Tandoori Chicken", price: "320.00", category_id: 1, kitchen_station: "Tandoor" },
  ]);
  fireKot.mockResolvedValue([
    { id: "1", number: "KOT-000001", station: "Tandoor", tableName: "Table 4", items: [] },
  ]);
  listDiningTables.mockResolvedValue([]);
  createDiningTable.mockResolvedValue({});
  transferDiningTable.mockResolvedValue({ kots: [] });
  updateDiningTableStatus.mockResolvedValue({});
});

test("fires a table order and confirms its station KOT", async () => {
  render(<TableOrderPage />);

  fireEvent.click(await screen.findByRole("button", { name: "Add Tandoori Chicken to table order" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Table name or number" }), { target: { value: "Table 4" } });
  fireEvent.click(screen.getByRole("button", { name: "Fire / KOT" }));

  await waitFor(() => expect(fireKot).toHaveBeenCalledWith(expect.objectContaining({
    tableName: "Table 4",
    items: [{ menuItemId: "12", quantity: 1 }],
    idempotencyKey: expect.any(String),
  })));
  expect(await screen.findByText(/KOT-000001 · Tandoor/)).toBeInTheDocument();
});

test("restores a saved draft for the selected table", async () => {
  listDiningTables.mockResolvedValue([{
    id: "table-4",
    tableName: "Table 4",
    status: "vacant",
    kots: [],
  }]);
  window.localStorage.setItem("sfh:table-order-draft:table-4", JSON.stringify([
    { id: "12", name: "Tandoori Chicken", price: 320, category: "Mains", quantity: 3 },
  ]));
  render(<TableOrderPage />);

  fireEvent.change(await screen.findByRole("textbox", { name: "Table name or number" }), {
    target: { value: "Table 4" },
  });

  expect(await screen.findByText("3 items in order")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
});

test("saves table-order changes after the debounce interval", async () => {
  listDiningTables.mockResolvedValue([{
    id: "table-4",
    tableName: "Table 4",
    status: "vacant",
    kots: [],
  }]);
  render(<TableOrderPage />);
  const tableInput = await screen.findByRole("textbox", { name: "Table name or number" });
  await screen.findByRole("button", { name: "Add Tandoori Chicken to table order" });
  jest.useFakeTimers();

  fireEvent.change(tableInput, { target: { value: "Table 4" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Tandoori Chicken to table order" }));
  act(() => jest.advanceTimersByTime(1500));

  expect(JSON.parse(window.localStorage.getItem("sfh:table-order-draft:table-4"))).toEqual([
    expect.objectContaining({ id: "12", name: "Tandoori Chicken", quantity: 1 }),
  ]);
  jest.useRealTimers();
});

test("caps table-order item quantities at 99", async () => {
  render(<TableOrderPage />);
  const addButton = await screen.findByRole("button", { name: "Add Tandoori Chicken to table order" });
  for (let index = 0; index < 100; index += 1) fireEvent.click(addButton);

  expect(screen.getByText("99 items in order")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Increase Tandoori Chicken" })).toBeDisabled();
});

test("applies live table status events without replacing active KOTs", async () => {
  listDiningTables.mockResolvedValue([{
    id: "table-4",
    tableName: "Table 4",
    status: "occupied",
    kots: [{
      id: "kot-1",
      number: "KOT-000001",
      station: "Tandoor",
      status: "pending",
      createdAt: new Date().toISOString(),
      items: [{ id: "item-1", menuItemId: "12", name: "Tandoori Chicken", quantity: 1 }],
    }],
  }]);
  render(<TableOrderPage />);

  await screen.findByRole("button", { name: /Table 4, occupied/i });
  act(() => mockSocketHandlers["table:settled"]({
    table: { id: "table-4", tableName: "Table 4", status: "dirty/cleaning", kots: [] },
  }));

  expect(await screen.findByRole("button", { name: /Table 4, dirty\/cleaning/i })).toBeInTheDocument();
  expect(screen.getByText("1 active KOT")).toBeInTheDocument();
});

test("moves active table tickets to a vacant destination and refreshes the table list", async () => {
  listDiningTables
    .mockResolvedValueOnce([
      { id: "1", tableName: "Table 4", status: "occupied", kots: [] },
      { id: "2", tableName: "Table 5", status: "vacant", kots: [] },
    ])
    .mockResolvedValueOnce([
      { id: "1", tableName: "Table 4", status: "vacant", kots: [] },
      { id: "2", tableName: "Table 5", status: "occupied", kots: [] },
    ]);
  render(<TableOrderPage />);

  fireEvent.click(await screen.findByRole("button", { name: /Table 4, occupied/i }));
  fireEvent.click(screen.getByRole("button", { name: "Move Table" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Destination table" }));
  fireEvent.click(await screen.findByRole("option", { name: "Table 5" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Transfer of Table 4 to Table 5" }));

  await waitFor(() => expect(transferDiningTable).toHaveBeenCalledWith("Table 4", "Table 5", "move"));
  await waitFor(() => expect(listDiningTables).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("Table 5")).toBeInTheDocument();
});

test("transfers only the selected KOT items when requested", async () => {
  listDiningTables.mockResolvedValueOnce([
    {
      id: "1",
      tableName: "Table 4",
      status: "occupied",
      kots: [{
        id: "kot-1",
        number: "KOT-000001",
        station: "Tandoor",
        status: "pending",
        createdAt: new Date().toISOString(),
        items: [{ id: "21", menuItemId: "12", name: "Tandoori Chicken", quantity: 1 }],
      }],
    },
    { id: "2", tableName: "Table 5", status: "vacant", kots: [] },
  ]);
  render(<TableOrderPage />);

  fireEvent.click(await screen.findByRole("button", { name: /Table 4, occupied/i }));
  fireEvent.click(screen.getByRole("button", { name: "Move Table" }));
  fireEvent.click(screen.getByRole("radio", { name: "Select specific items to move" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Tandoori Chicken × 1" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Destination table" }));
  fireEvent.click(await screen.findByRole("option", { name: "Table 5" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Transfer of Table 4 to Table 5" }));

  await waitFor(() => expect(transferDiningTable).toHaveBeenCalledWith(
    "Table 4",
    "Table 5",
    "move",
    { itemIds: ["21"] },
  ));
});

test("offers the table billing and cleaning lifecycle", async () => {
  listDiningTables
    .mockResolvedValueOnce([{ id: "1", tableName: "Table 4", status: "occupied", kots: [] }])
    .mockResolvedValueOnce([{ id: "1", tableName: "Table 4", status: "billed", kots: [] }]);
  render(<TableOrderPage />);

  fireEvent.click(await screen.findByRole("button", { name: /Table 4, occupied/i }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Billed" }));

  await waitFor(() => expect(updateDiningTableStatus).toHaveBeenCalledWith("Table 4", "billed"));
  expect(await screen.findByRole("button", { name: "Start Cleaning" })).toBeInTheDocument();
});

test("adds a vacant table to the live table list", async () => {
  listDiningTables
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "3", tableName: "Patio 1", status: "vacant", kots: [] }]);
  render(<TableOrderPage />);

  fireEvent.change(await screen.findByRole("textbox", { name: "New table name" }), {
    target: { value: "Patio 1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add Table" }));

  await waitFor(() => expect(createDiningTable).toHaveBeenCalledWith("Patio 1"));
  expect(await screen.findByText("Patio 1")).toBeInTheDocument();
});

test("prints the selected table's active kitchen tickets from its context menu", async () => {
  listDiningTables.mockResolvedValue([{
    id: "1",
    tableName: "Table 4",
    status: "occupied",
    kots: [{
      id: "kot-1",
      number: "KOT-000001",
      station: "Tandoor",
      tableName: "Table 4",
      createdAt: new Date().toISOString(),
      items: [{ id: "item-1", name: "Tandoori Chicken", quantity: 1 }],
    }],
  }]);
  window.print = jest.fn();
  render(<TableOrderPage />);

  fireEvent.contextMenu(await screen.findByRole("button", { name: /Table 4, occupied/i }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Print KOT" }));

  await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  expect(screen.getByText("KOT-000001")).toBeInTheDocument();
});
