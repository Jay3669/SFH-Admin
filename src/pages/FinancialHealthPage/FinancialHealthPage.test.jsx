import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import FinancialHealthPage from "./FinancialHealthPage";
import { getBillingReport } from "../../services/billingReport";
import { getDailyReserveTarget } from "../../services/monthlyBillReserve";

jest.mock("../../services/billingReport", () => ({
  getBillingReport: jest.fn(),
}));

const mockPdf = {
  internal: {
    pageSize: { getWidth: () => 210 },
    getNumberOfPages: () => 1,
  },
  setFillColor: jest.fn(),
  rect: jest.fn(),
  setTextColor: jest.fn(),
  setFont: jest.fn(),
  setFontSize: jest.fn(),
  text: jest.fn(),
  line: jest.fn(),
  setDrawColor: jest.fn(),
  roundedRect: jest.fn(),
  splitTextToSize: jest.fn((text) => [text]),
  addPage: jest.fn(),
  setPage: jest.fn(),
  output: jest.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
  save: jest.fn(),
};

function createReport(period) {
  return {
    period,
    from: "2026-11-01",
    to: "2026-11-07",
    purchases: {
      count: 2,
      total: 250,
      bills: [
        { id: "p1", billNumber: "PO-123", supplier: "Fresh Foods", date: "2026-11-04", total: 200, status: "Received" },
        { id: "p2", billNumber: "PO-124", supplier: "Market", date: "2026-11-05", total: 50, status: "Ordered" },
      ],
    },
    sales: {
      count: 3,
      total: 900,
      bills: [
        { id: "s1", billNumber: "POS-101", date: "2026-11-04", subtotal: 300, discount: 20, packaging: 10, tax: 25, total: 315, status: "Paid" },
        { id: "s2", billNumber: "POS-102", date: "2026-11-05", subtotal: 400, discount: 0, packaging: 15, tax: 36, total: 451, status: "Paid" },
        { id: "s3", billNumber: "POS-103", date: "2026-11-06", subtotal: 200, discount: 5, refundAmount: 3, packaging: 0, tax: 18, total: 213, status: "Partially paid" },
      ],
    },
  };
}

let pdfFactory;

beforeEach(() => {
  window.localStorage.clear();
  getBillingReport.mockImplementation(async (period) => createReport(period));
  pdfFactory = jest.fn(() => mockPdf);
  Object.values(mockPdf).forEach((value) => {
    if (jest.isMockFunction(value)) value.mockClear();
  });
  mockPdf.splitTextToSize.mockImplementation((text) => [text]);
  mockPdf.output.mockImplementation(() => new Blob(["pdf"], { type: "application/pdf" }));
  window.open = jest.fn(() => ({ opener: window }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("shows sales, tax, purchase costs, and the final profit for the selected period", async () => {
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);

  await screen.findByText("Taxes collected (excluded from revenue)");
  expect(screen.getAllByText("₹900.00")).toHaveLength(2);
  expect(screen.getByText("− ₹28.00")).toBeInTheDocument();
  expect(screen.getByText("+ ₹25.00")).toBeInTheDocument();
  expect(screen.getByText("₹79.00")).toBeInTheDocument();
  expect(screen.getByText("Discounts & refunds")).toBeInTheDocument();
  expect(screen.getByText("Ingredient costs (recorded purchases proxy)")).toBeInTheDocument();
  expect(screen.getAllByText("₹647.00")).toHaveLength(3);
  expect(screen.getByText(/purchase totals may differ from ingredients consumed/i)).toBeInTheDocument();
  expect(getBillingReport).toHaveBeenLastCalledWith("monthly");

  fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
  await waitFor(() => expect(getBillingReport).toHaveBeenLastCalledWith("yearly"));
});

test("adds, edits, and deletes expense entries and recalculates net profit", async () => {
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);
  await screen.findByRole("heading", { name: "Income statement" });

  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Expense name" }), { target: { value: "November wages" } });
  fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: "Category" }));
  fireEvent.click(screen.getByRole("option", { name: "Staff & salaries" }));
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Amount" }), { target: { value: "100" } });
  fireEvent.change(dialog.querySelector('input[type="date"]'), { target: { value: "2026-11-06" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));

  expect(await screen.findByText("November wages")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(JSON.parse(window.localStorage.getItem("sfhFinancialExpenses"))).toEqual([
    expect.objectContaining({ name: "November wages", category: "staff", amount: 100, date: "2026-11-06" }),
  ]);
  expect(screen.getAllByText("₹547.00")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Edit November wages" }));
  const editDialog = screen.getByRole("dialog");
  fireEvent.change(within(editDialog).getByRole("spinbutton", { name: "Amount" }), { target: { value: "125" } });
  fireEvent.click(within(editDialog).getByRole("button", { name: "Save changes" }));
  expect(await screen.findAllByText("₹522.00")).toHaveLength(2);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Delete November wages" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete expense" }));
  expect(await screen.findByText("No additional expenses recorded for this period.")).toBeInTheDocument();
  expect(window.localStorage.getItem("sfhFinancialExpenses")).toBe("[]");
  expect(screen.getAllByText("₹647.00")).toHaveLength(3);
}, 15000);

test("includes categorized expenses only within the selected report dates", async () => {
  window.localStorage.setItem("sfhFinancialExpenses", JSON.stringify([
    { id: "e1", name: "Takeaway supplies", category: "packaging", amount: 20, date: "2026-11-02" },
    { id: "e2", name: "Staff wages", category: "staff", amount: 100, date: "2026-11-03" },
    { id: "e3", name: "Electricity and rent", category: "utilities", amount: 50, date: "2026-11-04" },
    { id: "e4", name: "Repairs", category: "other", amount: 10, date: "2026-11-05" },
    { id: "e5", name: "Prior period expense", category: "other", amount: 700, date: "2026-10-31" },
  ]));
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);

  await screen.findByText("Estimated net profit");
  expect(screen.getAllByText("₹467.00")).toHaveLength(2);
  expect(screen.getByText("Takeaway supplies")).toBeInTheDocument();
  expect(screen.getByText("Staff wages")).toBeInTheDocument();
  expect(screen.getByText("Electricity and rent")).toBeInTheDocument();
  expect(screen.getByText("Repairs")).toBeInTheDocument();
  expect(screen.queryByText("Prior period expense")).not.toBeInTheDocument();
});

test("records a next-month rent payment in both the reserve ledger and Profit & Loss expenses", async () => {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const billMonthDate = new Date(`${today}T12:00:00`);
  billMonthDate.setDate(1);
  billMonthDate.setMonth(billMonthDate.getMonth() + 1);
  const billMonthLabel = billMonthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const billMonth = `${billMonthDate.getFullYear()}-${String(billMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const rentDueDate = `${billMonth}-20`;
  const expectedRentDeposit = Math.round(getDailyReserveTarget(30000, rentDueDate, 0, today) * 100) / 100;
  getBillingReport.mockResolvedValue({ ...createReport("monthly"), from: today, to: today });
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);

  await screen.findByRole("heading", { name: "Income statement" });
  const monthlyAmounts = screen.getAllByRole("spinbutton", { name: "Monthly bill amount (₹)" });
  fireEvent.change(monthlyAmounts[0], { target: { value: "30000" } });
  fireEvent.change(monthlyAmounts[1], { target: { value: "3000" } });
  const dueDates = screen.getAllByLabelText("Payment due date");
  fireEvent.change(dueDates[0], { target: { value: rentDueDate } });
  fireEvent.click(screen.getByRole("button", { name: "Save monthly targets" }));
  await screen.findByText(/monthly targets saved/i);

  const rentCard = screen.getByRole("heading", { name: "Shop rent" }).closest(".monthly-reserve__bill");
  fireEvent.click(within(rentCard).getByRole("button", { name: "Record today's reserve" }));
  await waitFor(() => expect(within(rentCard).getByRole("button", { name: "Record payment" })).toBeEnabled());
  fireEvent.click(within(rentCard).getByRole("button", { name: "Record payment" }));
  const paymentDialog = screen.getByRole("dialog");
  fireEvent.click(within(paymentDialog).getByRole("button", { name: "Confirm payment" }));

  expect(await screen.findByText(`${billMonthLabel} Shop rent`)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("sfhFinancialExpenses"))).toEqual([
    expect.objectContaining({ name: expect.stringMatching(/Shop rent$/), category: "utilities", amount: expectedRentDeposit, date: today }),
  ]);
  expect(JSON.parse(window.localStorage.getItem("sfhMonthlyBillReserve")).transactions).toHaveLength(2);
});

test("downloads a full statement PDF including tax, expenses, and the final result", async () => {
  window.localStorage.setItem("sfhFinancialExpenses", JSON.stringify([
    { id: "e1", name: "November wages", category: "staff", amount: 100, date: "2026-11-06" },
  ]));
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);
  await screen.findByRole("heading", { name: "Income statement" });

  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));

  expect(pdfFactory).toHaveBeenCalled();
  expect(mockPdf.save).toHaveBeenCalledWith("sfh-profit-loss-monthly-2026-11-07.pdf");
  expect(mockPdf.text).toHaveBeenCalledWith("Taxes collected (excluded from revenue)", expect.any(Number), expect.any(Number));
  expect(mockPdf.text).toHaveBeenCalledWith("Staff & salaries", expect.any(Number), expect.any(Number));
  expect(mockPdf.text).toHaveBeenCalledWith("November wages | Staff & salaries | 06 Nov 2026", expect.any(Number), expect.any(Number));
  expect(await screen.findByText(/profit & loss pdf has been downloaded/i)).toBeInTheDocument();
});

test("downloads the PDF and opens WhatsApp with a ready-to-send profit summary", async () => {
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);
  await screen.findByRole("heading", { name: "Income statement" });

  fireEvent.click(screen.getByRole("button", { name: /share pdf on whatsapp/i }));

  await waitFor(() => expect(window.open).toHaveBeenCalledWith(expect.stringContaining("wa.me"), "_blank"));
  const shareUrl = window.open.mock.calls[0][0];
  expect(decodeURIComponent(shareUrl)).toContain("Estimated profit: ₹647.00");
  expect(mockPdf.save).toHaveBeenCalled();
  expect(await screen.findByText(/attach the pdf to your message/i)).toBeInTheDocument();
});

test("shows report loading errors and allows retry", async () => {
  getBillingReport.mockRejectedValueOnce(new Error("Report unavailable"));
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);

  expect(await screen.findByText("Report unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));

  await screen.findByRole("heading", { name: "Income statement" });
  expect(screen.getAllByText("₹647.00")).toHaveLength(3);
});

test("surfaces unreadable local expense data and allows retry after it is corrected", async () => {
  window.localStorage.setItem("sfhFinancialExpenses", "{broken");
  render(<FinancialHealthPage pdfFactory={pdfFactory} />);

  expect(await screen.findByText(/saved expenses could not be read/i)).toBeInTheDocument();
  window.localStorage.setItem("sfhFinancialExpenses", "[]");
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(await screen.findByRole("heading", { name: "Income statement" })).toBeInTheDocument();
});
