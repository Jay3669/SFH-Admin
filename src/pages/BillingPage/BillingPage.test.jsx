import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BillingPage from "./BillingPage";

jest.setTimeout(15000);

const mockSocketHandlers = {};

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
  setManagerPin: jest.fn(),
}));

jest.mock("../../services/kotService", () => ({
  connectKitchenSocket: () => ({
    on: jest.fn((event, handler) => { mockSocketHandlers[event] = handler; }),
    disconnect: jest.fn(),
  }),
}));

jest.mock("../../services/featureServices", () => ({
  listActivePromotions: jest.fn(),
  resendWhatsAppBill: jest.fn(),
}));

const menuService = require("../../services/menuService");
const inventoryService = require("../../services/inventoryService");
const posSettingsService = require("../../services/posSettings");
const posService = require("../../services/posService");
const featureServices = require("../../services/featureServices");

beforeEach(() => {
  window.localStorage.clear();
  window.print = jest.fn();
  Object.keys(mockSocketHandlers).forEach((event) => delete mockSocketHandlers[event]);
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
  featureServices.listActivePromotions.mockResolvedValue([]);
  featureServices.resendWhatsAppBill.mockResolvedValue({ status: "sent" });
  posService.setManagerPin.mockResolvedValue({ success: true });
  posService.createPosSale.mockImplementation(async (payload) => {
    const settings = posSettingsService.getPosSettings();
    const configuredMenuItems = await menuService.listMenuItems();
    const items = payload.items.map((line) => {
      const menuItem = configuredMenuItems.find((item) => String(item.menu_item_id) === line.menuItemId);
      return {
        id: line.menuItemId,
        name: menuItem.name,
        quantity: line.quantity,
        price: Number(menuItem.price),
        ...(line.notes ? { notes: line.notes } : {}),
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const compItemIds = payload.compItemIds || [];
    items.forEach((item) => { item.comp = compItemIds.includes(item.id); });
    const compAmount = items.filter((item) => item.comp).reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = payload.discountAmount + compAmount;
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
      stockDeductionStatus: amountPaid >= total ? "pending" : "awaiting_payment",
      stockWarnings: [],
    };
  });
});

test("requires a manager PIN and reason for a discount above ten percent", async () => {
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /discount/i }), { target: { value: "25" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "175" } });
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  expect(await screen.findByText(/manager authorization required/i)).toBeInTheDocument();
  expect(posService.createPosSale).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /reason code/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Promotion" }));
  fireEvent.change(screen.getByLabelText("Manager PIN"), { target: { value: "2468" } });
  fireEvent.click(screen.getByRole("button", { name: /approve and complete/i }));

  await screen.findByText(/bill complete/i);
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    discountAmount: 25,
    discountAuthorization: { pin: "2468", reasonCode: "promotion" },
  }));
});

test("marks a full cart line comp/NC and includes it in the authorized sale", async () => {
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.click(screen.getByRole("button", { name: /comp Paneer Bowl/i }));
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  expect(await screen.findByText(/manager authorization required/i)).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /reason code/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Service recovery" }));
  fireEvent.change(screen.getByLabelText("Manager PIN"), { target: { value: "1357" } });
  fireEvent.click(screen.getByRole("button", { name: /approve and complete/i }));

  const receipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(receipt).getByText(/Paneer Bowl · NC/i)).toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    discountAmount: 0,
    compItemIds: ["item-1"],
    discountAuthorization: { pin: "1357", reasonCode: "service_recovery" },
  }));
});

test("allows an Admin or Manager to set a PIN after confirming their password", async () => {
  window.localStorage.setItem("sfhAdminUser", JSON.stringify({ role: "manager" }));
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /set approval pin/i }));
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "current-password" } });
  fireEvent.change(screen.getByLabelText("New 4-digit PIN"), { target: { value: "2468" } });
  fireEvent.change(screen.getByLabelText("Confirm 4-digit PIN"), { target: { value: "2468" } });
  fireEvent.click(screen.getByRole("button", { name: /save pin/i }));

  await screen.findByText(/manager approval pin saved/i);
  expect(posService.setManagerPin).toHaveBeenCalledWith({
    currentPassword: "current-password",
    pin: "2468",
    confirmPin: "2468",
  });
});

test("supports acronym search and saves an item preparation note with the bill", async () => {
  menuService.listMenuItems.mockResolvedValue([{
    menu_item_id: "item-1",
    name: "Chicken Biryani Mini",
    category_id: "cat-1",
    price: "200.00",
    is_available: true,
  }]);
  render(<BillingPage />);

  const search = await screen.findByRole("textbox", { name: "Search menu" });
  fireEvent.change(search, { target: { value: "CBM" } });
  fireEvent.click(await screen.findByRole("button", { name: /add Chicken Biryani Mini to bill/i }));
  fireEvent.click(screen.getByRole("button", { name: /add note for Chicken Biryani Mini/i }));
  fireEvent.change(screen.getByRole("textbox", { name: "Kitchen note" }), { target: { value: "Less spicy, no ice" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Item preparation note" })).not.toBeInTheDocument());
  expect(screen.getByText("Less spicy, no ice")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /exact amount/i }));
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));
  fireEvent.click(await screen.findByRole("button", { name: /print & finish/i }));

  await waitFor(() => expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    items: [{ menuItemId: "item-1", quantity: 1, notes: "Less spicy, no ice" }],
  })));
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
  fireEvent.click(await screen.findByRole("button", { name: /print & finish/i }));

  const receipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(receipt).getByText(/Bill complete/i)).toBeInTheDocument();
  expect(within(receipt).getByText(/Ingredient stock deduction queued/i)).toBeInTheDocument();
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

test("removes a menu item from billing immediately when it is marked out of stock", async () => {
  render(<BillingPage />);
  expect(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i })).toBeInTheDocument();

  act(() => mockSocketHandlers["menu:item-updated"]({
    menu_item_id: "item-1",
    name: "Paneer Bowl",
    category_name: "Mains",
    price: "200.00",
    is_available: false,
  }));

  expect(screen.queryByRole("button", { name: /add Paneer Bowl to bill/i })).not.toBeInTheDocument();
});

test("fills exact cash amount when selected", async () => {
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));

  fireEvent.click(screen.getByRole("button", { name: /exact amount/i }));

  expect(screen.getByRole("spinbutton", { name: /cash received/i })).toHaveValue(200);
  expect(screen.getByText(/change/i).parentElement).toHaveTextContent("₹0.00");
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(screen.getByRole("button", { name: /print & finish/i }));
  await screen.findByRole("dialog", { name: /bill complete/i });
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

  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  const completedReceipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(completedReceipt).getByText("Packaging")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("Tax")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("Cash payment")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("UPI payment")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("₹242.00")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("Takeaway")).toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({ packagingAmount: 20 }));
}, 15000);

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

test("splits a bill equally between the requested number of people", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: true, card: true, upi: true, split: true },
  }));
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.click(screen.getByLabelText("Split"));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /split by/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Equal shares" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /number of people/i }), { target: { value: "3" } });

  expect(screen.getByText("Person 1 · ₹66.67")).toBeInTheDocument();
  expect(screen.getByText("Person 2 · ₹66.67")).toBeInTheDocument();
  expect(screen.getByText("Person 3 · ₹66.66")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(screen.getByRole("button", { name: /print & finish/i }));
  await screen.findByRole("dialog", { name: /bill complete/i });
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    paymentMethod: "Split",
    tenders: [
      { method: "Cash", amount: 66.67 },
      { method: "Cash", amount: 66.67 },
      { method: "Cash", amount: 66.66 },
    ],
  }));
}, 15000);

test("splits selected bill items between payers and records tender references", async () => {
  menuService.listMenuItems.mockResolvedValue([
    { menu_item_id: "item-1", name: "Paneer Bowl", category_id: "cat-1", price: "200.00", is_available: true },
    { menu_item_id: "item-2", name: "Dal Bowl", category_id: "cat-1", price: "100.00", is_available: true },
  ]);
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    paymentMethods: { cash: true, card: true, upi: true, split: true },
  }));
  render(<BillingPage />);
  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.click(screen.getByRole("button", { name: /add Dal Bowl to bill/i }));
  fireEvent.click(screen.getByLabelText("Split"));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /split by/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Selected items" }));

  const payerSelects = screen.getAllByRole("combobox", { name: "Paid by" });
  fireEvent.mouseDown(payerSelects[0]);
  fireEvent.click(await screen.findByRole("option", { name: "Person 1" }));
  fireEvent.mouseDown(payerSelects[1]);
  fireEvent.click(await screen.findByRole("option", { name: "Person 2" }));

  const personTwoMethod = screen.getByRole("combobox", { name: "Person 2 payment method" });
  fireEvent.mouseDown(personTwoMethod);
  fireEvent.click(await screen.findByRole("option", { name: "UPI" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Person 2 reference" }), { target: { value: "UPI-456" } });
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));

  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  const completedReceipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(completedReceipt).getByText(/UPI payment · UPI-456/i)).toBeInTheDocument();
  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    paymentMethod: "Split",
    tenders: [
      { method: "Cash", amount: 200 },
      { method: "UPI", amount: 100, transactionRef: "UPI-456" },
    ],
  }));
}, 20000);

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

  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  const completedReceipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(completedReceipt).getByText("Dine-in")).toBeInTheDocument();
  expect(within(completedReceipt).queryByText("Packaging")).not.toBeInTheDocument();
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

  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  const completedReceipt = await screen.findByRole("dialog", { name: /bill complete/i });
  expect(within(completedReceipt).getByText("Balance remaining")).toBeInTheDocument();
  expect(within(completedReceipt).getByText("₹150.00")).toBeInTheDocument();
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

test("includes the server-verified happy-hour amount in a new sale", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    taxEnabled: false,
    paymentMethods: { cash: true, card: false, upi: false, split: false },
  }));
  featureServices.listActivePromotions.mockResolvedValue([
    { categoryId: "cat-1", discountPercent: 20, name: "After work" },
  ]);
  render(<BillingPage />);

  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  expect(await screen.findByText("Happy hour")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "160" } });
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));
  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  await screen.findByRole("dialog", { name: /bill complete/i });

  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    discountAmount: 0,
    promotionalDiscountAmount: 40,
  }));
});

test("sends a consented customer phone with the paid POS sale", async () => {
  window.localStorage.setItem("sfhPosSettings", JSON.stringify({
    taxEnabled: false,
    paymentMethods: { cash: true, card: false, upi: false, split: false },
  }));
  render(<BillingPage />);

  fireEvent.click(await screen.findByRole("button", { name: /add Paneer Bowl to bill/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /cash received/i }), { target: { value: "200" } });
  fireEvent.click(screen.getByRole("button", { name: /complete bill/i }));
  const paymentDialog = await screen.findByRole("dialog", { name: /complete payment/i });
  fireEvent.click(within(paymentDialog).getByLabelText(/send whatsapp bill/i));
  fireEvent.change(within(paymentDialog).getByRole("textbox", { name: /customer mobile number/i }), { target: { value: "9000000000" } });
  fireEvent.click(within(paymentDialog).getByRole("button", { name: /print & finish/i }));
  await screen.findByRole("dialog", { name: /bill complete/i });

  expect(posService.createPosSale).toHaveBeenCalledWith(expect.objectContaining({
    customerPhone: "9000000000",
    whatsappOptIn: true,
  }));
});