import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CashDrawerPage from "./CashDrawerPage";
import {
  addCashDrawerMovement,
  closeCashDrawer,
  getCashDrawerSessions,
  handoverCashDrawer,
  openCashDrawer,
} from "../../services/cashDrawer";
import { apiRequest } from "../../services/apiService";

jest.mock("../../services/cashDrawer", () => ({
  addCashDrawerMovement: jest.fn(),
  closeCashDrawer: jest.fn(),
  getCashDrawerSessions: jest.fn(),
  handoverCashDrawer: jest.fn(),
  openCashDrawer: jest.fn(),
}));

jest.mock("../../services/apiService", () => ({
  apiRequest: jest.fn(),
}));

const today = (() => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
})();

let sessions;

function openSession(openingAmount = 500) {
  return {
    id: "drawer-1",
    date: today,
    cashierId: "7",
    cashierName: "Cashier One",
    openingAmount,
    openedAt: new Date().toISOString(),
    status: "open",
    movements: [],
    cashSales: 130,
    expectedCash: openingAmount + 130,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sessions = [];
  getCashDrawerSessions.mockImplementation(() => Promise.resolve(sessions));
  openCashDrawer.mockImplementation(({ openingBalance }) => {
    const drawer = openSession(openingBalance);
    sessions = [drawer];
    return Promise.resolve({ drawer });
  });
  addCashDrawerMovement.mockImplementation((drawerId, movement) => {
    sessions = sessions.map((drawer) => drawer.id === drawerId ? {
      ...drawer,
      movements: [...drawer.movements, {
        ...movement,
        id: `movement-${drawer.movements.length + 1}`,
        at: new Date().toISOString(),
      }],
      expectedCash: drawer.expectedCash + (movement.direction === "in" ? movement.amount : -movement.amount),
    } : drawer);
    return Promise.resolve({ success: true });
  });
  closeCashDrawer.mockImplementation((drawerId, payload) => {
    sessions = sessions.map((drawer) => drawer.id === drawerId ? {
      ...drawer,
      status: "closed",
      closedAt: new Date().toISOString(),
      closingCount: payload.actualCash,
      actualCash: payload.actualCash,
      expectedAtClose: drawer.expectedCash,
      variance: payload.actualCash - drawer.expectedCash,
      cashTaken: payload.cashTaken,
    } : drawer);
    return Promise.resolve({ success: true });
  });
});

test("records opening float, cash movements, and blind shift close through the API", async () => {
  render(<CashDrawerPage />);
  const openingDialog = await screen.findByRole("dialog");
  fireEvent.change(within(openingDialog).getByRole("spinbutton", { name: "Opening cash amount (₹)" }), { target: { value: "500" } });
  fireEvent.click(within(openingDialog).getByRole("button", { name: "Start shift" }));

  expect(await screen.findByText(/Shift in progress/)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(openCashDrawer).toHaveBeenCalledWith({ businessDate: today, openingBalance: 500 }));
  expect(screen.getAllByText("₹630.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const movementDialog = screen.getByRole("dialog");
  fireEvent.change(within(movementDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "80" } });
  fireEvent.change(within(movementDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Petty cash purchase" } });
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Save movement" }));
  await waitFor(() => expect(addCashDrawerMovement).toHaveBeenCalledWith("drawer-1", {
    direction: "out",
    amount: 80,
    description: "Petty cash purchase",
  }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByText("Petty cash purchase")).toBeInTheDocument();
  expect(screen.getAllByText("₹550.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const cashInDialog = screen.getByRole("dialog");
  fireEvent.click(within(cashInDialog).getByRole("button", { name: "Cash in" }));
  fireEvent.change(within(cashInDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "30" } });
  fireEvent.change(within(cashInDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Change float top-up" } });
  fireEvent.click(within(cashInDialog).getByRole("button", { name: "Save movement" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(addCashDrawerMovement).toHaveBeenLastCalledWith("drawer-1", {
    direction: "in",
    amount: 30,
    description: "Change float top-up",
  }));
  expect(await screen.findByText("Change float top-up")).toBeInTheDocument();
  expect(screen.getAllByText("₹580.00")).not.toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: /close shift & count drawer/i }));
  const closeDialog = screen.getByRole("dialog");
  expect(within(closeDialog).queryByText("Expected cash")).not.toBeInTheDocument();
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Physical cash counted (₹)" }), { target: { value: "580" } });
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Cash taken out / deposit (₹)" }), { target: { value: "500" } });
  fireEvent.click(within(closeDialog).getByRole("button", { name: /confirm close/i }));

  await waitFor(() => expect(closeCashDrawer).toHaveBeenCalledWith("drawer-1", { actualCash: 580, cashTaken: 500 }));
  expect(await screen.findAllByText("Shift closed")).toHaveLength(2);
  expect(screen.getByText("Cash remaining")).toBeInTheDocument();
});

test("rejects cash-outs beyond expected balance and cash taken beyond the blind count", async () => {
  render(<CashDrawerPage />);
  const openingDialog = await screen.findByRole("dialog");
  fireEvent.change(within(openingDialog).getByRole("spinbutton", { name: "Opening cash amount (₹)" }), { target: { value: "10" } });
  fireEvent.click(within(openingDialog).getByRole("button", { name: "Start shift" }));
  await screen.findByText(/Shift in progress/);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Record cash movement" }));
  const movementDialog = screen.getByRole("dialog");
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Cash out" }));
  fireEvent.change(within(movementDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "1000" } });
  fireEvent.change(within(movementDialog).getByRole("textbox", { name: "Reason" }), { target: { value: "Overdraw" } });
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Save movement" }));
  expect(await within(movementDialog).findByText(/cannot exceed the expected cash/i)).toBeInTheDocument();
  expect(addCashDrawerMovement).not.toHaveBeenCalled();
  fireEvent.click(within(movementDialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /close shift & count drawer/i }));
  const closeDialog = screen.getByRole("dialog");
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Physical cash counted (₹)" }), { target: { value: "50" } });
  fireEvent.change(within(closeDialog).getByRole("spinbutton", { name: "Cash taken out / deposit (₹)" }), { target: { value: "60" } });
  fireEvent.click(within(closeDialog).getByRole("button", { name: /confirm close/i }));
  expect(await within(closeDialog).findByText(/cannot exceed the physical cash counted/i)).toBeInTheDocument();
  expect(closeCashDrawer).not.toHaveBeenCalled();
});

test("hands over the drawer and starts the next cashier with remaining counted cash", async () => {
  render(<CashDrawerPage />);
  const openingDialog = await screen.findByRole("dialog");
  fireEvent.change(within(openingDialog).getByRole("spinbutton", { name: "Opening cash amount (₹)" }), { target: { value: "500" } });
  fireEvent.click(within(openingDialog).getByRole("button", { name: "Start shift" }));
  await screen.findByText(/Shift in progress/);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  apiRequest.mockResolvedValue({
    success: true,
    cashiers: [{ id: "8", first_name: "Cashier", last_name: "Two", role: "Employee" }],
  });

  fireEvent.click(screen.getByRole("button", { name: "Hand over shift" }));
  const handoverDialog = await screen.findByRole("dialog");
  expect(within(handoverDialog).queryByText("Expected cash")).not.toBeInTheDocument();
  fireEvent.change(within(handoverDialog).getByRole("spinbutton", { name: "Physical cash counted (₹)" }), { target: { value: "620" } });
  fireEvent.change(within(handoverDialog).getByRole("spinbutton", { name: "Cash taken out / deposit (₹)" }), { target: { value: "100" } });
  fireEvent.click(within(handoverDialog).getByRole("button", { name: "Confirm handover" }));

  await waitFor(() => expect(handoverCashDrawer).toHaveBeenCalledWith("drawer-1", {
    actualCash: 620,
    cashTaken: 100,
    nextCashierId: "8",
  }));
});
