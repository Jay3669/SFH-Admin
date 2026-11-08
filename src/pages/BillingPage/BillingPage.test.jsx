import { fireEvent, render, screen, within } from "@testing-library/react";
import BillingPage from "./BillingPage";

jest.mock("../../services/menuService", () => ({
  listMenuCategories: jest.fn(),
  listMenuItems: jest.fn(),
}));

jest.mock("../../services/inventoryService", () => ({
  completePosSale: jest.fn(),
}));

jest.mock("../../services/posSettings", () => {
  const actual = jest.requireActual("../../services/posSettings");
  return { ...actual, loadPosSettings: jest.fn() };
});

jest.mock("../../services/posService", () => ({
  createPosSale: jest.fn(),
  listRecentPosSales: jest.fn(),
}));

const menuService = require("../../services/menuService");
const inventoryService = require("../../services/inventoryService");
const posSettingsService = require("../../services/posSettings");
const posService = require("../../services/posService");

beforeEach(() => {
  window.localStorage.clear();
  menuService.listMenuCategories.mockResolvedValue([{ id: "cat-1", name: "Mains" }]);
  menuService.listMenuItems.mockResolvedValue([{
    menu_item_id: "item-1",
    name: "Paneer Bowl",
    category_id: "cat-1",
    price: "200.00",
    is_available: true,
    food_type: "Veg",
  }]);
  inventoryService.completePosSale.mockResolvedValue({ success: true });
  posSettingsService.loadPosSettings.mockImplementation(async () => posSettingsService.getPosSettings());
  posService.listRecentPosSales.mockResolvedValue([]);
  posService.createPosSale.mockImplementation(async (payload) => {
    const settings = posSettingsService.getPosSettings();
    const configuredMenuItems = await menuService.listMenuItems();
    const items = payload.items.map((line) => {
      const menuItem = configuredMenuItems.find((item) => String(item.menu_item_id) === line.menuItemId);
      return { id: line.menuItemId, name: menuItem.name, quantity: line.quantity, price: Number(menuItem.price) };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = payload.discountAmount;
    const packaging = settings.packagingEnabled && payload.orderType === "Takeaway" ? Number(payload.packagingAmount) : 0;
    const tax = settings.taxEnabled ? (subtotal - discount + packaging) * Number(settings.taxRate) / 100 : 0;
    const total = subtotal - discount + packaging + tax;
    const amountTendered = payload.tenders.reduce((sum, tender) => sum + tender.amount, 0);
    const amountPaid = Math.min(total, amountTendered);
    const cashTendered = payload.tenders.filter((tender) => tender.method === "Cash").reduce((sum, tender) => sum + tender.amount, 0);
    const nonCashTendered = amountTendered - cashTendered;
    return {
      id: "sale-1",
      number: `${settings.billNumberPrefix}${settings.nextBillNumber}`,
      items,
      subtotal,
      discount,
      orderType: payload.orderType,
      packaging,
      tax,
      total,
      paymentMethod: payload.paymentMethod,
      tenders: payload.tenders,
      amountTendered,
      amountPaid,
      changeDue: Math.max(0, cashTendered - Math.max(0, total - nonCashTendered)),
      balanceDue: total - amountPaid,
      stockWarnings: [],
    };
  });
});

test("builds a bill, calculates cash change, and records the POS sale", async () => {
  render(<BillingPage />);

  const addButton = await screen.findByRole("button", { name: /add Paneer Bowl to bill/i });
  fireEvent.click(addButton);
  fireEvent.click(addButton);
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "500" } });

  expect(within(screen.getByText("Amount due").parentElement).getByText("₹400.00")).toBeInTheDocument();
  expect(screen.getByText(/change/i).parentElement).toHaveTextContent("₹100.00");
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  const receipt = await screen.findByRole("dialog");
  expect(within(receipt).getByText(/Bill complete/i)).toBeInTheDocument();
  expect(within(within(receipt).getByText(/Total · Cash/i).parentElement).getByText("₹400.00")).toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    idempotencyKey: expect.any(String),
    items: [{ menuItemId: "item-1", quantity: 2 }],
    orderType: "Dine-in",
    discountAmount: 0,
    paymentMethod: "Cash",
    tenders: [{ method: "Cash", amount: 500 }],
  }));
});

test("fills exact cash amount when selected", async () => {
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));

  fireEvent.click(screen.getByRole("button", { name: /exact amount/i }));

  expect(screen.getByRole("spinbutton", { name: /cash received/i })).toHaveValue(200);
  expect(screen.getByText(/change/i).parentElement).toHaveTextContent("₹0.00");
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  await screen.findByRole("dialog");
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    paymentMethod: "Cash",
    tenders: [{ method: "Cash", amount: 200 }],
  }));
});

test("applies packaging and tax and accepts a split cash and UPI tender", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    packagingEnabled: true,
    packagingAmount: 20,
    taxEnabled: true,
    taxRate: 10,
    paymentMethods: { cash: true, card: true, upi: true, split: true },
    allowBalanceDue: false,
  }));

  render(<BillingPage />);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /order type/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Takeaway" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /packaging charge/i }), { target: { value: "20" } });
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.click(screen.getByLabelText("Split"));

  const methods = screen.getAllByRole("combobox", { name: "Method" });
  fireEvent.mouseDown(methods[1]);
  fireEvent.click(await screen.findByRole("option", { name: "UPI" }));
  const amounts = screen.getAllByRole("spinbutton", { name: /amount \(₹\)/i });
  fireEvent.change(amounts[0], { target: { value: "100" } });
  fireEvent.change(amounts[1], { target: { value: "142" } });

  expect(within(screen.getByText("Amount due").parentElement).getByText("₹242.00")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  const receipt = await screen.findByRole("dialog");
  expect(within(receipt).getByText("Packaging")).toBeInTheDocument();
  expect(within(receipt).getByText("Tax")).toBeInTheDocument();
  expect(within(receipt).getByText("Cash payment")).toBeInTheDocument();
  expect(within(receipt).getByText("UPI payment")).toBeInTheDocument();
  expect(within(receipt).getByText("₹242.00")).toBeInTheDocument();
  expect(within(receipt).getByText("Takeaway")).toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({ packagingAmount: 20 }));
});

test("limits split payments to the three enabled payment methods", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: true, card: true, upi: true, split: true },
  }));

  render(<BillingPage />);
  fireEvent.click(screen.getByLabelText("Split"));

  const addPaymentButton = screen.getByRole("button", { name: /add payment method/i });
  fireEvent.click(addPaymentButton);

  expect(screen.getAllByRole("spinbutton", { name: /amount \(₹\)/i })).toHaveLength(3);
  expect(addPaymentButton).toBeDisabled();
  fireEvent.click(addPaymentButton);
  expect(screen.getAllByRole("spinbutton", { name: /amount \(₹\)/i })).toHaveLength(3);
});

test("limits split payments to the number of enabled methods", () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: true, card: true, upi: false, split: true },
  }));

  render(<BillingPage />);
  fireEvent.click(screen.getByLabelText("Split"));

  expect(screen.getAllByRole("spinbutton", { name: /amount \(₹\)/i })).toHaveLength(2);
  expect(screen.getByRole("button", { name: /add payment method/i })).toBeDisabled();
});

test("does not apply packaging to a Dine-in order", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    packagingEnabled: true,
    taxEnabled: true,
    taxRate: 10,
    paymentMethods: { cash: true, card: false, upi: false, split: false },
  }));

  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "220" } });

  expect(within(screen.getByText("Amount due").parentElement).getByText("₹220.00")).toBeInTheDocument();
  expect(screen.queryByText("Packaging")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  const receipt = await screen.findByRole("dialog");
  expect(within(receipt).getByText("Dine-in")).toBeInTheDocument();
  expect(within(receipt).queryByText("Packaging")).not.toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({ orderType: "Dine-in" }));
});

test("allows an outstanding balance when enabled in settings", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: true, card: false, upi: false, split: false },
    allowBalanceDue: true,
  }));

  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  const receipt = await screen.findByRole("dialog");
  expect(within(receipt).getByText("Balance remaining")).toBeInTheDocument();
  expect(within(receipt).getByText("₹150.00")).toBeInTheDocument();
});

test("only shows payment methods enabled in Settings", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: false, card: true, upi: false, split: false },
  }));

  render(<BillingPage />);

  expect(await screen.findByLabelText("Card")).toBeInTheDocument();
  expect(screen.queryByLabelText("Cash")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("UPI")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Split")).not.toBeInTheDocument();
});