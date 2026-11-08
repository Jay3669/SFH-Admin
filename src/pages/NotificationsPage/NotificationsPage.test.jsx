import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import NotificationsPage from "./NotificationsPage";

test("shows sample notifications and filters the inbox by unread status and category", () => {
  render(<NotificationsPage onNavigate={jest.fn()} />);

  expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
  expect(screen.getByText("Fresh tomatoes are running low")).toBeInTheDocument();
  expect(screen.getByText("Paneer batch expires tomorrow")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^unread/i }));
  expect(screen.getByText("Fresh tomatoes are running low")).toBeInTheDocument();
  expect(screen.queryByText("Your workspace is ready for today")).not.toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole("combobox", { name: /category/i }));
  fireEvent.click(screen.getByRole("option", { name: "Billing" }));
  expect(screen.getByText("Payment recorded for POS-1048")).toBeInTheDocument();
  expect(screen.queryByText("Fresh tomatoes are running low")).not.toBeInTheDocument();
});

test("opens notification details, marks it read, and navigates to its destination", async () => {
  const onNavigate = jest.fn();
  render(<NotificationsPage onNavigate={onNavigate} />);

  fireEvent.click(screen.getByRole("button", { name: /open fresh tomatoes are running low/i }));
  const dialog = screen.getByRole("dialog", { name: /fresh tomatoes are running low/i });
  expect(within(dialog).getByText(/only 1.8 kg remains/i)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: /^close$/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: /mark fresh tomatoes are running low as unread/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /open fresh tomatoes are running low/i }));
  const updatedDialog = screen.getByRole("dialog", { name: /fresh tomatoes are running low/i });

  fireEvent.click(within(updatedDialog).getByRole("button", { name: /review inventory/i }));
  expect(onNavigate).toHaveBeenCalledWith("inventory");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("archives notifications and restores them from the archived filter", () => {
  render(<NotificationsPage onNavigate={jest.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /archive fresh tomatoes are running low/i }));
  fireEvent.click(screen.getByRole("button", { name: /archived/i }));
  expect(screen.getByText("Fresh tomatoes are running low")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /restore fresh tomatoes are running low/i }));
  expect(screen.queryByText("Fresh tomatoes are running low")).not.toBeInTheDocument();
  expect(screen.getByText("Nothing archived yet")).toBeInTheDocument();
});

test("opens notification preferences and updates a preference toggle", async () => {
  render(<NotificationsPage onNavigate={jest.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /preferences/i }));
  const dialog = screen.getByRole("dialog", { name: /notification preferences/i });
  const inAppSwitch = within(dialog).getByRole("switch", { name: /in-app notifications/i });
  expect(inAppSwitch).toBeChecked();
  fireEvent.click(inAppSwitch);
  expect(inAppSwitch).not.toBeChecked();
  fireEvent.click(within(dialog).getByRole("button", { name: /done/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
