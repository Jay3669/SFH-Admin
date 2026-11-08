import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CashDrawerPage, { getCashSalesTotal } from "./CashDrawerPage";
import { getBillingReport } from "../../services/billingReport";

jest.mock("../../services/billingReport", () => ({
  getBillingReport: jest.fn(),
}));

const REPORT_DATE = "2026-11-07";

function createReport() {
  return {
    period: "daily",
    from: REPORT_DATE,
    to: REPORT_DATE,
    purchases: { count: 0, total: 0, bills: [] },
    sales: {
      count: 3,
      total: 1100,
      bills: [
        { id: "cash", status: "Paid", tenders: [{ method: "Cash", amount: 100 }], changeDue: 20 },
        { id: "split", status: "Paid", tenders: [{ method: "Cash", amount: 50 }, { method: "UPI", amount: 100 }], changeDue: 0 },
        { id: "cancelled", status: "Cancelled", tenders: [{ method: "Cash", amount: 900 }], changeDue: 0 },
      ],
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  getBillingReport.mockResolvedValue(createReport());
});

test("counts only captured cash tenders, subtracts change, and ignores non-cash or cancelled sales", () => {
  expect(getCashSalesTotal(createReport())).toBe(130);
});

test("opens with a float, records cash activity, reconciles closing count and records cash taken", async () => {
  render(<CashDrawerPage />);
  expect(await screen.findByText("Not opened")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Enter opening cash" }));
  const openingDialog = screen.getByRole("dialog");
  fireEvent.change(within(openingDialog).getByRole("spinbutton", { name: "Opening cash amount (₹)" }), { target: { value: "500" } });
  fireEvent.click(within(openingDialog).getByRole("button", { name: "Start drawer" }));
  expect(await screen.findByText("Drawer in progress")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getAllByText("₹630.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const movementDialog = screen.getByRole("dialog");
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Cash out" }));
  fireEvent.change(within(movementDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "80" } });
  fireEvent.change(within(movementDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Petty cash purchase" } });
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Save movement" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("Petty cash purchase")).toBeInTheDocument();
  expect(screen.getAllByText("₹550.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const cashInDialog = screen.getByRole("dialog");
  fireEvent.click(within(cashInDialog).getByRole("button", { name: "Cash in" }));
  fireEvent.change(within(cashInDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "30" } });
  fireEvent.change(within(cashInDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Change float top-up" } });
  fireEvent.click(within(cashInDialog).getByRole("button", { name: "Save movement" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getAllByText("₹580.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: /close day & take cash/i }));
  const closeDialog = screen.getByRole("dialog");
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Physical cash counted (₹)" }), { target: { value: "580" } });
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Cash taken out / bank deposit (₹)" }), { target: { value: "500" } });
  expect(within(closeDialog).getByText("₹0.00")).toBeInTheDocument();
  fireEvent.click(within(closeDialog).getByRole("button", { name: /confirm close/i }));

  expect(await screen.findAllByText("Day closed")).toHaveLength(2);
  expect(screen.getByText("Cash left in drawer")).toBeInTheDocument();
  expect(screen.getAllByText("₹500.00")).not.toHaveLength(0);
  expect(JSON.parse(window.localStorage.getItem("sfhDailyCashDrawer"))[0]).toEqual(expect.objectContaining({
    date: REPORT_DATE,
    openingAmount: 500,
    cashSalesAtClose: 130,
    expectedAtClose: 580,
    closingCount: 580,
    cashTaken: 500,
    status: "closed",
  }));
  expect(screen.queryByRole("button", { name: /close day & take cash/i })).not.toBeInTheDocument();
}, 15000);

test("prevents cash payouts beyond expected drawer balance and cash taken beyond the physical count", async () => {
  render(<CashDrawerPage />);
  await screen.findByText("Not opened");
  fireEvent.click(screen.getByRole("button", { name: "Enter opening cash" }));
  fireEvent.change(within(screen.getByRole("dialog")).getByRole("spinbutton", { name: "Opening cash amount (₹)" }), { target: { value: "10" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Start drawer" }));
  await screen.findByText("Drawer in progress");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const movementDialog = screen.getByRole("dialog");
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Cash out" }));
  fireEvent.change(within(movementDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "1000" } });
  fireEvent.change(within(movementDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Overdraw" } });
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Save movement" }));
  expect(await within(movementDialog).findByText(/cannot exceed the expected cash/i)).toBeInTheDocument();
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /close day & take cash/i }));
  const closeDialog = screen.getByRole("dialog");
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Physical cash counted (₹)" }), { target: { value: "50" } });
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Cash taken out / bank deposit (₹)" }), { target: { value: "60" } });
  fireEvent.click(within(closeDialog).getByRole("button", { name: /confirm close/i }));
  expect(await within(closeDialog).findByText(/cannot exceed the physical cash counted/i)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("sfhDailyCashDrawer"))[0].status).toBe("open");
}, 15000);

test("reports cash sales load failures and keeps opening unavailable until retry succeeds", async () => {
  getBillingReport.mockRejectedValueOnce(new Error("Sales report unavailable"));
  render(<CashDrawerPage />);
  expect(await screen.findByText("Sales report unavailable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enter opening cash" })).toBeDisabled();
  getBillingReport.mockResolvedValueOnce(createReport());
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Not opened")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enter opening cash" })).toBeEnabled();
});
