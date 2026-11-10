import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import AdminLayout from "./AdminLayout";
import theme from "../../styles/theme";

test("Inventory & stock remains the only inventory sidebar destination", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="inventory"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Inventory content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  expect(screen.queryByRole("button", { name: /load recipes/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /inventory & stock/i }));

  expect(onNavigate).toHaveBeenCalledWith("inventory");
});

test("Billing & POS sidebar item opens the billing workspace", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="inventory"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Inventory content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /billing & pos/i }));

  expect(onNavigate).toHaveBeenCalledWith("billing");
});

test("Purchases & sales sidebar item opens the billing report", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="inventory"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Inventory content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /purchases & sales/i }));

  expect(onNavigate).toHaveBeenCalledWith("reports");
});

test("Notifications sidebar item and header bell open the inbox", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Dashboard content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /^notifications$/i }));
  expect(onNavigate).toHaveBeenCalledWith("notifications");

  fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
  expect(onNavigate).toHaveBeenLastCalledWith("notifications");
});

test("Toolbar account opens the profile", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Dashboard content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /open profile/i }));

  expect(onNavigate).toHaveBeenCalledWith("profile");
});

test("Financial health sidebar item opens the Profit & Loss report", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Dashboard content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /financial health/i }));
  expect(onNavigate).toHaveBeenCalledWith("financial-health");
});

test("staff and customer management sidebar items open their workspaces", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Dashboard content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /staff management/i }));
  expect(onNavigate).toHaveBeenLastCalledWith("staff");

  fireEvent.click(screen.getByRole("button", { name: /customer management/i }));
  expect(onNavigate).toHaveBeenLastCalledWith("customers");
});

test("Daily opening cash sidebar item opens the cash drawer workspace", () => {
  const onNavigate = jest.fn();

  render(
    <ThemeProvider theme={theme}>
      <AdminLayout
        user={{ name: "Test Admin" }}
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
      >
        <div>Dashboard content</div>
      </AdminLayout>
    </ThemeProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /daily opening cash/i }));
  expect(onNavigate).toHaveBeenCalledWith("cash-drawer");
});
