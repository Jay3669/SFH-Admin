import { useCallback, useEffect, useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import ApiLoader from "./components/ApiLoader/ApiLoader";
import ApiErrorSnackbar from "./components/ApiLoader/ApiErrorSnackbar";
import SessionExpiredDialog from "./components/SessionExpiredDialog/SessionExpiredDialog";
import AdminLayout from "./layouts/AdminLayout/AdminLayout";
import DashboardPage from "./pages/DashboardPage/DashboardPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import MenuManagementPage from "./pages/MenuManagementPage/MenuManagementPage";
import InventoryPage from "./pages/InventoryPage/InventoryPage";
import BillingPage from "./pages/BillingPage/BillingPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import BillingReportPage from "./pages/BillingReportPage/BillingReportPage";
import NotificationsPage from "./pages/NotificationsPage/NotificationsPage";
import FinancialHealthPage from "./pages/FinancialHealthPage/FinancialHealthPage";
import StaffManagementPage from "./pages/StaffManagementPage/StaffManagementPage";
import CustomerManagementPage from "./pages/CustomerManagementPage/CustomerManagementPage";
import CashDrawerPage from "./pages/CashDrawerPage/CashDrawerPage";
import OrdersManagementPage from "./pages/OrdersManagementPage/OrdersManagementPage";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import { getStoredAdmin, logoutAdmin } from "./services/authService";
import { createAppTheme } from "./styles/theme";
import "./styles/global.css";
import "./styles/responsive.css";

const DASHBOARD_PATH = "/admin/dashboard";
const MENU_PATH = "/admin/menu";
const INVENTORY_PATH = "/admin/inventory";
const INVENTORY_PURCHASES_PATH = "/admin/inventory/purchases";
const BILLING_PATH = "/admin/billing";
const SETTINGS_PATH = "/admin/settings";
const REPORTS_PATH = "/admin/reports";
const NOTIFICATIONS_PATH = "/admin/notifications";
const FINANCIAL_HEALTH_PATH = "/admin/financial-health";
const STAFF_PATH = "/admin/staff";
const CUSTOMERS_PATH = "/admin/customers";
const CASH_DRAWER_PATH = "/admin/cash-drawer";
const ORDERS_PATH = "/admin/orders";
const PROFILE_PATH = "/admin/profile";
const LOGIN_PATH = "/sfh/login";
const THEME_STORAGE_KEY = "sfhAdminTheme";
const NOTIFICATION_COUNT_STORAGE_KEY = "sfhUnreadNotificationCount";
const INITIAL_NOTIFICATION_COUNT = 3;

function getInitialNotificationCount() {
  const storedCount = Number.parseInt(window.localStorage.getItem(NOTIFICATION_COUNT_STORAGE_KEY) || "", 10);
  return Number.isFinite(storedCount) && storedCount >= 0 ? storedCount : INITIAL_NOTIFICATION_COUNT;
}

function getInitialThemeMode() {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getPageFromPath(pathname) {
  if (pathname === MENU_PATH) return "menu";
  if (pathname === INVENTORY_PURCHASES_PATH) return "inventory-purchases";
  if (pathname === INVENTORY_PATH) return "inventory";
  if (pathname === BILLING_PATH) return "billing";
  if (pathname === SETTINGS_PATH) return "settings";
  if (pathname === REPORTS_PATH) return "reports";
  if (pathname === NOTIFICATIONS_PATH) return "notifications";
  if (pathname === FINANCIAL_HEALTH_PATH) return "financial-health";
  if (pathname === STAFF_PATH) return "staff";
  if (pathname === CUSTOMERS_PATH) return "customers";
  if (pathname === CASH_DRAWER_PATH) return "cash-drawer";
  if (pathname === ORDERS_PATH) return "orders";
  if (pathname === PROFILE_PATH) return "profile";
  return "dashboard";
}

function getPathForPage(page) {
  if (page === "menu") return MENU_PATH;
  if (page === "inventory-purchases") return INVENTORY_PURCHASES_PATH;
  if (page === "inventory") return INVENTORY_PATH;
  if (page === "billing") return BILLING_PATH;
  if (page === "settings") return SETTINGS_PATH;
  if (page === "reports") return REPORTS_PATH;
  if (page === "notifications") return NOTIFICATIONS_PATH;
  if (page === "financial-health") return FINANCIAL_HEALTH_PATH;
  if (page === "staff") return STAFF_PATH;
  if (page === "customers") return CUSTOMERS_PATH;
  if (page === "cash-drawer") return CASH_DRAWER_PATH;
  if (page === "orders") return ORDERS_PATH;
  if (page === "profile") return PROFILE_PATH;
  return DASHBOARD_PATH;
}

function App() {
  const [user, setUser] = useState(getStoredAdmin);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(getInitialNotificationCount);
  const [themeMode, setThemeMode] = useState(() => {
    const initialMode = getInitialThemeMode();
    document.documentElement.setAttribute("data-admin-theme", initialMode);
    return initialMode;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", themeMode);
  }, [themeMode]);
  const [activePage, setActivePage] = useState(() =>
    getPageFromPath(window.location.pathname)
  );

  useEffect(() => {
    const handleLocationChange = () => {
      const storedUser = getStoredAdmin();
      setUser(storedUser);
      const currentPage = getPageFromPath(window.location.pathname);
      setActivePage(currentPage);
      const expectedPath = storedUser ? getPathForPage(currentPage) : LOGIN_PATH;
      if (window.location.pathname !== expectedPath) {
        window.history.replaceState({}, "", expectedPath);
      }
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  useEffect(() => {
    const authenticated = Boolean(getStoredAdmin());
    const expectedPath = authenticated ? getPathForPage(activePage) : LOGIN_PATH;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, "", expectedPath);
    }
  }, [activePage, user]);

  function handleLogin(adminUser) {
    setUser(adminUser);
    setActivePage("dashboard");
    window.history.pushState({}, "", DASHBOARD_PATH);
  }

  function handleNavigate(page) {
    setActivePage(page);
    window.history.pushState({}, "", getPathForPage(page));
  }

  function handleLogout() {
    logoutAdmin();
    setUser(null);
    window.history.pushState({}, "", LOGIN_PATH);
  }

  function handleThemeChange(mode) {
    setThemeMode(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }

  const handleUnreadNotificationCountChange = useCallback((count) => {
    setNotificationUnreadCount(count);
    window.localStorage.setItem(NOTIFICATION_COUNT_STORAGE_KEY, String(count));
  }, []);

  const theme = createAppTheme(themeMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {user ? (
        <AdminLayout
          user={user}
          activePage={activePage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          themeMode={themeMode}
          onThemeChange={handleThemeChange}
          notificationUnreadCount={notificationUnreadCount}
        >
          {activePage === "menu" ? (
            <MenuManagementPage />
          ) : activePage === "inventory" || activePage === "inventory-purchases" ? (
            <InventoryPage key={activePage} initialTab={activePage === "inventory-purchases" ? "purchases" : "stock"} />
          ) : activePage === "billing" ? (
            <BillingPage />
          ) : activePage === "settings" ? (
            <SettingsPage />
          ) : activePage === "reports" ? (
            <BillingReportPage onNavigate={handleNavigate} />
          ) : activePage === "notifications" ? (
            <NotificationsPage
              onNavigate={handleNavigate}
              initialUnreadCount={notificationUnreadCount}
              onUnreadCountChange={handleUnreadNotificationCountChange}
            />
          ) : activePage === "financial-health" ? (
            <FinancialHealthPage />
          ) : activePage === "staff" ? (
            <StaffManagementPage />
          ) : activePage === "customers" ? (
            <CustomerManagementPage />
          ) : activePage === "cash-drawer" ? (
            <CashDrawerPage />
          ) : activePage === "orders" ? (
            <OrdersManagementPage />
          ) : activePage === "profile" ? (
            <ProfilePage user={user} onThemeChange={handleThemeChange} themeMode={themeMode} />
          ) : (
            <DashboardPage user={user} />
          )}
        </AdminLayout>
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
      <ApiLoader />
      <ApiErrorSnackbar />
      <SessionExpiredDialog />
    </ThemeProvider>
  );
}

export default App;
