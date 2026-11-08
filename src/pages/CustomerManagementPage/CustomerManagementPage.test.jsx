import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CustomerManagementPage from "./CustomerManagementPage";

beforeEach(() => {
  window.localStorage.clear();
});

test("adds a customer, records visits and spend, edits the profile, then deletes it", async () => {
  render(<CustomerManagementPage />);
  fireEvent.click(screen.getAllByRole("button", { name: "Add customer" })[0]);
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Full name" }), { target: { value: "Mira Shah" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Phone number" }), { target: { value: "9876543210" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Email address" }), { target: { value: "mira@example.com" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Preferences and notes" }), { target: { value: "Vegetarian, mild spice" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add customer" }));

  expect(await screen.findByRole("heading", { name: "Mira Shah" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("Vegetarian, mild spice")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Record visit" }));
  const visitDialog = screen.getByRole("dialog");
  fireEvent.change(within(visitDialog).getByRole("spinbutton", { name: "Visit spend (₹)" }), { target: { value: "450" } });
  fireEvent.change(within(visitDialog).getByRole("textbox", { name: "Visit note (optional)" }), { target: { value: "Dinner" } });
  fireEvent.click(within(visitDialog).getByRole("button", { name: "Save visit" }));

  expect(await screen.findByText("Customer visit recorded.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findAllByText("₹450.00")).not.toHaveLength(0);
  expect(screen.getByText("Dinner")).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("sfhCustomerManagement"))[0]).toEqual(expect.objectContaining({ visits: 1, spend: 450, notes: "Vegetarian, mild spice" }));

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const editDialog = screen.getByRole("dialog");
  fireEvent.change(within(editDialog).getByRole("textbox", { name: "Full name" }), { target: { value: "Mira S." } });
  fireEvent.click(within(editDialog).getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("heading", { name: "Mira S." })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(JSON.parse(window.localStorage.getItem("sfhCustomerManagement"))[0]).toEqual(expect.objectContaining({ visits: 1, spend: 450 }));

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete customer" }));
  expect(await screen.findByText("Customer record deleted.")).toBeInTheDocument();
  expect(window.localStorage.getItem("sfhCustomerManagement")).toBe("[]");
}, 15000);

test("searches and filters customers and prevents duplicate phone numbers", async () => {
  window.localStorage.setItem("sfhCustomerManagement", JSON.stringify([
    { id: "c1", name: "Mira Shah", phone: "9000000001", email: "", birthday: "", notes: "", visits: 4, spend: 1200, joinedAt: "2026-01-01", lastVisit: "2026-11-06", visitHistory: [] },
    { id: "c2", name: "Kiran Rao", phone: "9000000002", email: "", birthday: "", notes: "", visits: 0, spend: 0, joinedAt: "2026-11-01", lastVisit: "", visitHistory: [] },
  ]));
  render(<CustomerManagementPage />);

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Customer segment" }));
  fireEvent.click(screen.getByRole("option", { name: "Returning" }));
  expect(screen.getByText("Mira Shah")).toBeInTheDocument();
  expect(screen.queryByText("Kiran Rao")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Full name" }), { target: { value: "Duplicate" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Phone number" }), { target: { value: "9000000001" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add customer" }));
  expect(await within(dialog).findByText(/already exists/i)).toBeInTheDocument();
});
