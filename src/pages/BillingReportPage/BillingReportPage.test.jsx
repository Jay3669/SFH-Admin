import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import BillingReportPage from "./BillingReportPage";
import { getBillingReport } from "../../services/billingReport";
import { closeCashDrawer, getCashDrawerSessions } from "../../services/cashDrawer";
import { recordPurchasePayment, receivePurchase } from "../../services/inventoryService";
import { voidPosSale } from "../../services/posService";

jest.mock("../../services/billingReport", () => ({
  getBillingReport: jest.fn(),
}));

jest.mock("../../services/inventoryService", () => ({
  recordPurchasePayment: jest.fn(),
  receivePurchase: jest.fn(),
}));

jest.mock("../../services/cashDrawer", () => ({
  closeCashDrawer: jest.fn(),
  getCashDrawerSessions: jest.fn(),
}));

jest.mock("../../services/posService", () => ({
  voidPosSale: jest.fn(),
}));

function createReport(period) {
  return {
    period,
    from: "2026-11-07",
    to: "2026-11-07",
    purchases: {
      count: 1,
      total: 250,
      bills: [{
        id: "1",
        billNumber: "PO-123",
        invoice: "INV-4",
        supplier: "Fresh Foods",
        item: "Tomatoes",
        quantity: 10,
        unit: "kg",
        unitPrice: 25,
        receivedQuantity: 5,
        paidAmount: 100,
        due: 150,
        status: "Partially received",
        expiry: "2026-12-01",
        payments: [{ amount: 100, reference: "PAY-1", date: "2026-11-07T06:00:00.000Z" }],
        date: "2026-11-07T06:00:00.000Z",
        total: 250,
      }],
    },
    sales: {
      count: 1,
      total: 400,
      bills: [{
        id: "sale-1",
        billNumber: "POS-10",
        items: [{ name: "Paneer Bowl", quantity: 2, total: 400 }],
        date: "2026-11-07T06:30:00.000Z",
        paymentMethod: "Cash",
        status: "Paid",
        orderType: "Dine-in",
        subtotal: 400,
        discount: 0,
        packaging: 0,
        tax: 0,
        amountPaid: 400,
        changeDue: 0,
        balanceDue: 0,
        tenders: [{ method: "Cash", amount: 400 }],
        total: 400,
      }, {
        id: "sale-2",
        billNumber: "POS-11",
        items: [{ name: "Paneer Bowl", quantity: 1, total: 200 }],
        date: "2026-11-07T06:35:00.000Z",
        paymentMethod: "Cash",
        status: "Voided",
        orderType: "Dine-in",
        subtotal: 200,
        discount: 0,
        packaging: 0,
        tax: 0,
        amountPaid: 200,
        changeDue: 0,
        balanceDue: 0,
        tenders: [{ method: "Cash", amount: 200 }],
        total: 200,
        voidAudit: {
          reason: "Duplicate entry",
          previousStatus: "Paid",
          amount: 200,
          requestedBy: "3",
          approvedBy: "1",
          voidedAt: "2026-11-07T07:00:00.000Z",
        },
      }],
    },
    grandTotal: 650,
  };
}

beforeEach(() => {
  window.print = jest.fn();
  getBillingReport.mockImplementation(async (period) => createReport(period));
  getCashDrawerSessions.mockResolvedValue([{
    id: "drawer-1",
    date: "2026-11-07",
    status: "open",
    cashierName: "Test Cashier",
    expectedCash: 450,
  }]);
  closeCashDrawer.mockResolvedValue({ success: true });
  voidPosSale.mockResolvedValue({ success: true, sale: { id: "sale-1", status: "Voided" } });
});

test("shows purchase, sales, and grand totals and their bills", async () => {
  render(<BillingReportPage />);

  expect(await screen.findByText("PO-123")).toBeInTheDocument();
  expect(screen.getAllByText("₹250.00")).toHaveLength(2);
  expect(screen.getByText(/Fresh Foods/)).toBeInTheDocument();
  expect(screen.getByText("₹650.00")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /sales/i }));
  expect(screen.getByText("POS-10")).toBeInTheDocument();
  expect(screen.getAllByText("₹400.00")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "POS-10" }));
  expect(await screen.findByRole("heading", { name: /sales bill details/i })).toBeInTheDocument();
  expect(screen.getByText(/Paneer Bowl × 2/)).toBeInTheDocument();
  expect(screen.getByText("Subtotal")).toBeInTheDocument();
});

test("loads the selected reporting period", async () => {
  render(<BillingReportPage />);

  await screen.findByText("PO-123");
  fireEvent.click(screen.getByRole("button", { name: "Weekly" }));

  await waitFor(() => expect(getBillingReport).toHaveBeenLastCalledWith("weekly"));
  expect(screen.getByRole("group", { name: /report period/i })).toContainElement(
    screen.getByRole("button", { name: "Weekly" })
  );
});

test("shows void audit details in the sales report", async () => {
  render(<BillingReportPage />);
  await screen.findByText("PO-123");
  fireEvent.click(screen.getByRole("tab", { name: /sales/i }));
  fireEvent.click(screen.getByRole("button", { name: /voided/i }));
  fireEvent.click(await screen.findByRole("button", { name: "POS-11" }));

  const dialog = await screen.findByRole("dialog", { name: /sales bill details/i });
  expect(within(dialog).getByText("Duplicate entry")).toBeInTheDocument();
  expect(within(dialog).getByText("Approved by")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /void bill/i })).not.toBeInTheDocument();
});

test("voids a bill only after a reason and supervisor PIN are supplied", async () => {
  render(<BillingReportPage />);
  await screen.findByText("PO-123");
  fireEvent.click(screen.getByRole("tab", { name: /sales/i }));
  fireEvent.click(screen.getByRole("button", { name: "POS-10" }));
  fireEvent.click(await screen.findByRole("button", { name: /void bill/i }));

  fireEvent.change(screen.getByRole("textbox", { name: /reason for void/i }), {
    target: { value: "Duplicate entry" },
  });
  fireEvent.change(screen.getByLabelText(/supervisor pin/i), {
    target: { value: "1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: /confirm void/i }));

  await waitFor(() => expect(voidPosSale).toHaveBeenCalledWith("sale-1", {
    reason: "Duplicate entry",
    pin: "1234",
  }));
  expect(await screen.findByText(/POS-10 was voided and recorded/i)).toBeInTheDocument();
});

test("filters purchases by payment status and opens the complete purchase details", async () => {
  render(<BillingReportPage />);
  await screen.findByText("PO-123");

  fireEvent.click(screen.getByRole("button", { name: /pending/i }));
  expect(screen.getByText("PO-123")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /cleared/i }));
  expect(screen.queryByText("PO-123")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /all purchases/i }));
  fireEvent.click(screen.getByRole("button", { name: "PO-123" }));

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Fresh Foods")).toBeInTheDocument();
  expect(within(dialog).getByText("Tomatoes")).toBeInTheDocument();
  expect(within(dialog).getByText(/PAY-1/)).toBeInTheDocument();
  expect(within(dialog).getByText("Outstanding")).toBeInTheDocument();
});

test("records purchase payments and receives stock from purchase details", async () => {
  render(<BillingReportPage />);
  await screen.findByText("PO-123");
  fireEvent.click(screen.getByRole("button", { name: "PO-123" }));
  fireEvent.click(await screen.findByRole("button", { name: /record payment/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /payment amount/i }), { target: { value: "50" } });
  fireEvent.change(screen.getByRole("textbox", { name: /payment reference/i }), { target: { value: "BANK-2" } });
  fireEvent.click(screen.getByRole("button", { name: /save payment/i }));

  await waitFor(() => expect(recordPurchasePayment).toHaveBeenCalledWith("1", "50", "BANK-2"));
  expect(await screen.findByText(/supplier payment recorded/i)).toBeInTheDocument();

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await screen.findByRole("button", { name: "PO-123" });
  fireEvent.click(screen.getByRole("button", { name: "PO-123" }));
  fireEvent.click(await screen.findByRole("button", { name: /receive remaining stock/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm receipt/i }));
  await waitFor(() => expect(receivePurchase).toHaveBeenCalledWith("1", 5));
});

test("launches the existing purchase and sales creation flows from their tabs", async () => {
  const onNavigate = jest.fn();
  render(<BillingReportPage onNavigate={onNavigate} />);
  await screen.findByText("PO-123");

  fireEvent.click(screen.getByRole("button", { name: /new purchase/i }));
  expect(onNavigate).toHaveBeenLastCalledWith("inventory-purchases");

  fireEvent.click(screen.getByRole("tab", { name: /sales/i }));
  fireEvent.click(screen.getByRole("button", { name: /new sale/i }));
  expect(onNavigate).toHaveBeenLastCalledWith("billing");
});

test("shows the Z report and closes only the current cashier shift after confirmation", async () => {
  render(<BillingReportPage />);
  await screen.findByText("PO-123");

  fireEvent.click(screen.getByRole("button", { name: /z report & day close/i }));
  const reportDialog = await screen.findByRole("dialog", { name: /day-close z report/i });
  await within(reportDialog).findByText("Gross sales");
  expect(within(reportDialog).getByText("Gross sales")).toBeInTheDocument();
  expect(within(reportDialog).getByText("System cash expected")).toBeInTheDocument();
  fireEvent.click(within(reportDialog).getByRole("button", { name: /finalize cashier shift/i }));

  const confirmation = await screen.findByRole("dialog", { name: /confirm cashier shift close/i });
  fireEvent.change(within(confirmation).getByRole("spinbutton", { name: /physical cash counted/i }), { target: { value: "500" } });
  fireEvent.change(within(confirmation).getByRole("spinbutton", { name: /cash taken/i }), { target: { value: "50" } });
  fireEvent.click(within(confirmation).getByRole("button", { name: /confirm shift close/i }));

  await waitFor(() => expect(closeCashDrawer).toHaveBeenCalledWith("drawer-1", { actualCash: 500, cashTaken: 50 }));
  expect(await screen.findByText(/does not lock the restaurant-wide business day/i)).toBeInTheDocument();
});
