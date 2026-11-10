import { fireEvent, render, screen, within } from "@testing-library/react";
import SettingsPage from "./SettingsPage";

jest.mock("../../services/posSettings", () => ({
  DEFAULT_POS_SETTINGS: {
    billNumberPrefix: "POS-",
    nextBillNumber: 1,
    packagingEnabled: false,
    packagingAmount: 0,
    taxEnabled: false,
    taxRate: 0,
    paymentMethods: { cash: true, card: true, upi: true, split: false },
    allowBalanceDue: false,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
  },
  getPosSettings: jest.fn(),
  loadPosSettings: jest.fn(),
  updatePosSettings: jest.fn(),
}));

const posSettings = require("../../services/posSettings");

beforeEach(() => {
  window.localStorage.clear();
  posSettings.getPosSettings.mockReturnValue({ ...posSettings.DEFAULT_POS_SETTINGS, paymentMethods: { ...posSettings.DEFAULT_POS_SETTINGS.paymentMethods } });
  posSettings.loadPosSettings.mockResolvedValue({ ...posSettings.DEFAULT_POS_SETTINGS, paymentMethods: { ...posSettings.DEFAULT_POS_SETTINGS.paymentMethods } });
  posSettings.updatePosSettings.mockImplementation(async (settings) => settings);
});

test("saves packaging, tax, payment methods, and balance settings for POS", async () => {
  render(<SettingsPage />);

  await screen.findByText("Loading saved POS settings…").then(() => {});
  fireEvent.change(screen.getByRole("textbox", { name: /bill number prefix/i }), { target: { value: "SFH-" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: /next bill number/i }), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("switch", { name: /packaging charge enabled/i }));
  fireEvent.click(screen.getByRole("switch", { name: /^tax enabled$/i }));
  fireEvent.change(screen.getByRole("spinbutton", { name: /tax rate/i }), { target: { value: "5" } });
  fireEvent.click(screen.getByRole("button", { name: /Payments/ }));
  fireEvent.click(screen.getByRole("switch", { name: /split payments enabled/i }));
  fireEvent.click(screen.getByRole("button", { name: /Balance rules/ }));
  fireEvent.click(screen.getByRole("switch", { name: /allow remaining balance/i }));
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  expect(await screen.findByText(/settings saved and applied/i)).toBeInTheDocument();
  expect(posSettings.updatePosSettings).toHaveBeenCalledWith(expect.objectContaining({
    billNumberPrefix: "SFH-",
    nextBillNumber: "42",
    packagingEnabled: true,
    taxEnabled: true,
    taxRate: "5",
    paymentMethods: expect.objectContaining({ split: true }),
    allowBalanceDue: true,
  }));
});

test("saves date and time display preferences to shared POS settings", async () => {
  render(<SettingsPage />);

  await screen.findByText("Loading saved POS settings…");
  fireEvent.click(screen.getByRole("button", { name: /date & time/i }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /date format/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Year-Month-Day (2026-11-09)" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /time format/i }));
  fireEvent.click(await screen.findByRole("option", { name: /24-hour/i }));
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  expect(await screen.findByText(/settings saved and applied/i)).toBeInTheDocument();
  expect(posSettings.updatePosSettings).toHaveBeenCalledWith(expect.objectContaining({
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24-hour",
  }));
});

test("saves a named-month date format to shared POS settings", async () => {
  render(<SettingsPage />);

  await screen.findByText("Loading saved POS settings…");
  fireEvent.click(screen.getByRole("button", { name: /date & time/i }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /date format/i }));
  fireEvent.click(await screen.findByRole("option", { name: "11 Nov 2026" }));
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  expect(await screen.findByText(/settings saved and applied/i)).toBeInTheDocument();
  expect(posSettings.updatePosSettings).toHaveBeenCalledWith(expect.objectContaining({
    dateFormat: "DD MMM YYYY",
  }));
});

test("shows sample teammates and saves page-action permission changes locally", async () => {
  render(<SettingsPage />);
  await screen.findByText("Loading saved POS settings…");
  fireEvent.click(screen.getByRole("button", { name: /team & permissions/i }));

  expect(screen.getByRole("heading", { name: "Team & permissions" })).toBeInTheDocument();
  expect(screen.getAllByText("Maya Shah")).toHaveLength(2);
  expect(screen.getByText("Arjun Patel")).toBeInTheDocument();
  expect(screen.getByText("Priya Nair")).toBeInTheDocument();
  expect(screen.getByText(/does not create accounts or enforce access on the server/i)).toBeInTheDocument();

  const permission = screen.getByRole("checkbox", { name: "Grant Delete access to Billing & POS" });
  expect(permission).not.toBeChecked();
  fireEvent.click(permission);

  expect(permission).toBeChecked();
  const savedMembers = JSON.parse(window.localStorage.getItem("sfhTeamPermissions"));
  const maya = savedMembers.find((member) => member.name === "Maya Shah");
  expect(maya.permissions.billing.delete).toBe(true);
});

test("adds a teammate with a starting role and browser-local permissions", async () => {
  render(<SettingsPage />);
  await screen.findByText("Loading saved POS settings…");
  fireEvent.click(screen.getByRole("button", { name: /team & permissions/i }));
  fireEvent.click(screen.getByRole("button", { name: /add teammate/i }));

  const dialog = screen.getByRole("dialog", { name: /add a teammate/i });
  fireEvent.change(within(dialog).getByRole("textbox", { name: /full name/i }), { target: { value: "Sam Rivera" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: /email address/i }), { target: { value: "sam@example.com" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /add teammate/i }));

  await screen.findByRole("heading", { name: "Sam Rivera" });
  const savedMembers = JSON.parse(window.localStorage.getItem("sfhTeamPermissions"));
  expect(savedMembers).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Sam Rivera", email: "sam@example.com", role: "Cashier" }),
  ]));
}, 15000);