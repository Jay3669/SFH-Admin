import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import StaffManagementPage from "./StaffManagementPage";
import { getBillingReport } from "../../services/billingReport";

jest.mock("../../services/billingReport", () => ({
  getBillingReport: jest.fn(),
}));

function createReport() {
  return {
    period: "daily",
    from: "2026-11-07",
    to: "2026-11-07",
    purchases: { count: 1, total: 100, bills: [{ id: "p1", total: 100, status: "Received" }] },
    sales: { count: 1, total: 1000, bills: [{ id: "s1", subtotal: 1000, discount: 0, packaging: 0, tax: 0, total: 1000 }] },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  getBillingReport.mockResolvedValue(createReport());
});

test("onboards staff with multiple roles, guards share percentage, distributes once, and records wallet entries", async () => {
  render(<StaffManagementPage />);
  await screen.findByText("Today's estimated profit");

  fireEvent.click(screen.getByRole("button", { name: "Add team member" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Full name" }), { target: { value: "Asha Rao" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Phone number" }), { target: { value: "9876543210" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Server" }));
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Cashier" }));
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Daily profit share (%)" }), { target: { value: "25" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add team member" }));

  expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const state = JSON.parse(window.localStorage.getItem("sfhStaffManagement"));
  expect(state.staff[0]).toEqual(expect.objectContaining({ name: "Asha Rao", roles: ["Server", "Cashier"], sharePercent: 25, status: "Active" }));

  fireEvent.click(screen.getByRole("tab", { name: "Daily profit share" }));
  expect(await screen.findByText("DAILY NET PROFIT · 2026-11-07")).toBeInTheDocument();
  expect(await screen.findAllByText("₹225.00")).not.toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Distribute daily shares" }));
  expect(await screen.findByText(/daily profit shares recorded for 1 team members/i)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("sfhStaffManagement")).transactions).toEqual([
    expect.objectContaining({ staffId: state.staff[0].id, type: "profit_share", amount: 225, date: "2026-11-07" }),
  ]);
  expect(screen.getByRole("button", { name: "Distribute daily shares" })).toBeDisabled();

  fireEvent.click(screen.getByRole("tab", { name: "Wallets & ledger" }));
  expect(await screen.findAllByText("₹225.00")).not.toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Record wallet entry" }));
  const walletDialog = screen.getByRole("dialog");
  fireEvent.change(within(walletDialog).getByRole("spinbutton", { name: "Amount (₹)" }), { target: { value: "25" } });
  fireEvent.change(within(walletDialog).getByRole("textbox", { name: "Description" }), { target: { value: "Cash withdrawal" } });
  fireEvent.mouseDown(within(walletDialog).getByRole("combobox", { name: "Transaction" }));
  fireEvent.click(screen.getByRole("option", { name: "Record withdrawal" }));
  fireEvent.click(within(walletDialog).getByRole("button", { name: "Save ledger entry" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(JSON.parse(window.localStorage.getItem("sfhStaffManagement")).transactions).toHaveLength(2);
  expect(screen.getByText("−₹25.00")).toBeInTheDocument();
}, 15000);

test("rejects active profit-share totals above 100 percent", async () => {
  window.localStorage.setItem("sfhStaffManagement", JSON.stringify({
    staff: [{ id: "existing", name: "Existing staff", email: "", phone: "9000000000", roles: ["Chef"], status: "Active", sharePercent: 70, joinedAt: "2026-01-01" }],
    transactions: [],
  }));
  render(<StaffManagementPage />);
  await screen.findByText("Existing staff");
  fireEvent.click(screen.getByRole("button", { name: "Add team member" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Full name" }), { target: { value: "Second staff" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Phone number" }), { target: { value: "9000000001" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Server" }));
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Daily profit share (%)" }), { target: { value: "40" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add team member" }));

  expect(await within(dialog).findByText(/must not exceed 100%/i)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("sfhStaffManagement")).staff).toHaveLength(1);
});
