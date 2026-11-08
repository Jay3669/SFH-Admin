import { fireEvent, render, screen, within } from "@testing-library/react";
import MonthlyBillsReserve from "./MonthlyBillsReserve";
import {
  getDailyReserveTarget,
  getDaysUntilDue,
  saveMonthlyBillReserve,
} from "../../services/monthlyBillReserve";

function nextMonthValue() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  window.localStorage.clear();
});

test("saves monthly rent and electricity targets, records a daily share and a payment", async () => {
  const onRecordPayment = jest.fn((nextData) => {
    saveMonthlyBillReserve(nextData);
    return true;
  });
  render(<MonthlyBillsReserve canRecordPayment onRecordPayment={onRecordPayment} />);

  const monthlyAmounts = screen.getAllByRole("spinbutton", { name: "Monthly bill amount (₹)" });
  fireEvent.change(monthlyAmounts[0], { target: { value: "30000" } });
  fireEvent.change(monthlyAmounts[1], { target: { value: "3000" } });
  const dueDates = screen.getAllByLabelText("Payment due date");
  const rentDueDate = `${nextMonthValue()}-30`;
  const electricityDueDate = `${nextMonthValue()}-20`;
  fireEvent.change(dueDates[0], { target: { value: rentDueDate } });
  fireEvent.change(dueDates[1], { target: { value: electricityDueDate } });
  fireEvent.click(screen.getByRole("button", { name: "Save monthly targets" }));

  expect(await screen.findByText(/monthly targets saved/i)).toBeInTheDocument();
  const rentDailyTarget = Math.round(getDailyReserveTarget(30000, rentDueDate, 0, todayValue()) * 100) / 100;
  const electricityDailyTarget = Math.round(getDailyReserveTarget(3000, electricityDueDate, 0, todayValue()) * 100) / 100;
  expect(screen.getByText(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(rentDailyTarget))).toBeInTheDocument();
  expect(screen.getByText(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(electricityDailyTarget))).toBeInTheDocument();
  expect(screen.getByText(new RegExp(`Due in ${getDaysUntilDue(rentDueDate, todayValue())} days`))).toBeInTheDocument();

  const rentCard = screen.getByRole("heading", { name: "Shop rent" }).closest(".monthly-reserve__bill");
  fireEvent.click(within(rentCard).getByRole("button", { name: "Record today's reserve" }));
  expect(await within(rentCard).findByRole("button", { name: "Today's reserve recorded" })).toBeDisabled();

  fireEvent.click(within(rentCard).getByRole("button", { name: "Record payment" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("spinbutton", { name: "Payment amount (₹)" })).toHaveValue(rentDailyTarget);
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm payment" }));

  expect(await screen.findByText(/payment recorded and added to profit & loss expenses/i)).toBeInTheDocument();
  expect(onRecordPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      plans: expect.arrayContaining([
        expect.objectContaining({ billType: "rent", amount: 30000, billMonth: nextMonthValue(), dueDate: rentDueDate }),
        expect.objectContaining({ billType: "electricity", amount: 3000, billMonth: nextMonthValue(), dueDate: electricityDueDate }),
      ]),
      transactions: expect.arrayContaining([
        expect.objectContaining({ type: "deposit", billType: "rent", amount: rentDailyTarget }),
        expect.objectContaining({ type: "payment", billType: "rent", amount: rentDailyTarget }),
      ]),
    }),
    expect.objectContaining({ type: "payment", billType: "rent", amount: rentDailyTarget })
  );
  expect(JSON.parse(window.localStorage.getItem("sfhMonthlyBillReserve")).transactions).toHaveLength(2);
});

test("does not allow recording a bill payment before the expense ledger is ready", async () => {
  render(<MonthlyBillsReserve canRecordPayment={false} onRecordPayment={jest.fn()} />);
  const amounts = screen.getAllByRole("spinbutton", { name: "Monthly bill amount (₹)" });
  fireEvent.change(amounts[0], { target: { value: "30000" } });
  fireEvent.change(amounts[1], { target: { value: "3000" } });
  fireEvent.click(screen.getByRole("button", { name: "Save monthly targets" }));
  await screen.findByText(/monthly targets saved/i);

  const rentCard = screen.getByRole("heading", { name: "Shop rent" }).closest(".monthly-reserve__bill");
  expect(within(rentCard).getByRole("button", { name: "Record payment" })).toBeDisabled();
});
