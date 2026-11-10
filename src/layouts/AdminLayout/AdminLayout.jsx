import { useState } from "react";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import TableBarRoundedIcon from "@mui/icons-material/TableBarRounded";
import KitchenRoundedIcon from "@mui/icons-material/KitchenRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import DeliveryDiningRoundedIcon from "@mui/icons-material/DeliveryDiningRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import logo from "../../assets/branding/shf-logo.png";
import PageIntro from "../../components/PageIntro/PageIntro";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import "./AdminLayout.css";

const DRAWER_WIDTH = 240;

export default function AdminLayout({
  user,
  activePage,
  onNavigate,
  onLogout,
  themeMode = "light",
  onThemeChange,
  notificationUnreadCount = 0,
  dateTimeSettingsVersion = 0,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("lg"));
  const showAdminWorkspace = !["employee", "manager"].includes(user?.role);

  const drawer = (
    <Box className="admin-sidebar">
      <Box className="admin-sidebar__brand">
        <img src={logo} alt="" />
        <Box>
          <Typography className="admin-sidebar__brand-name">Surya Food Hub</Typography>
          <Typography className="admin-sidebar__brand-caption">{showAdminWorkspace ? "ADMIN PORTAL" : "STAFF PORTAL"}</Typography>
        </Box>
      </Box>
      <Typography className="admin-sidebar__section-label">WORKSPACE</Typography>
      <List className="admin-sidebar__nav" disablePadding>
        {showAdminWorkspace ? (
          <>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "dashboard" ? "is-active" : ""
          }`}
          selected={activePage === "dashboard"}
          onClick={() => {
            onNavigate("dashboard");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <DashboardRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "menu" ? "is-active" : ""
          }`}
          selected={activePage === "menu"}
          onClick={() => {
            onNavigate("menu");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <RestaurantMenuRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Menu management" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "promotions" ? "is-active" : ""}`}
          selected={activePage === "promotions"}
          onClick={() => { onNavigate("promotions"); setMobileOpen(false); }}
        >
          <ListItemIcon><LocalOfferRoundedIcon /></ListItemIcon>
          <ListItemText primary="Happy hour" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "qr-codes" ? "is-active" : ""}`}
          selected={activePage === "qr-codes"}
          onClick={() => { onNavigate("qr-codes"); setMobileOpen(false); }}
        >
          <ListItemIcon><QrCode2RoundedIcon /></ListItemIcon>
          <ListItemText primary="Table QR codes" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "inventory" || activePage === "inventory-purchases" ? "is-active" : ""
          }`}
          selected={activePage === "inventory" || activePage === "inventory-purchases"}
          onClick={() => {
            onNavigate("inventory");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <Inventory2RoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Inventory & stock" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "billing" ? "is-active" : ""
          }`}
          selected={activePage === "billing"}
          onClick={() => {
            onNavigate("billing");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <PointOfSaleRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Billing & POS" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "table-orders" ? "is-active" : ""}`}
          selected={activePage === "table-orders"}
          onClick={() => {
            onNavigate("table-orders");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><TableBarRoundedIcon /></ListItemIcon>
          <ListItemText primary="Table orders" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "kitchen" ? "is-active" : ""}`}
          selected={activePage === "kitchen"}
          onClick={() => {
            onNavigate("kitchen");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><KitchenRoundedIcon /></ListItemIcon>
          <ListItemText primary="Kitchen display" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "reports" ? "is-active" : ""
          }`}
          selected={activePage === "reports"}
          onClick={() => {
            onNavigate("reports");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <AssessmentRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Purchases & sales" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "orders" ? "is-active" : ""}`}
          selected={activePage === "orders"}
          onClick={() => {
            onNavigate("orders");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><ReceiptLongOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Orders Management" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "aggregator-orders" ? "is-active" : ""}`}
          selected={activePage === "aggregator-orders"}
          onClick={() => { onNavigate("aggregator-orders"); setMobileOpen(false); }}
        >
          <ListItemIcon><DeliveryDiningRoundedIcon /></ListItemIcon>
          <ListItemText primary="Swiggy & Zomato" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "kitchen-analytics" ? "is-active" : ""}`}
          selected={activePage === "kitchen-analytics"}
          onClick={() => { onNavigate("kitchen-analytics"); setMobileOpen(false); }}
        >
          <ListItemIcon><QueryStatsRoundedIcon /></ListItemIcon>
          <ListItemText primary="Kitchen analytics" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "financial-health" ? "is-active" : ""
          }`}
          selected={activePage === "financial-health"}
          onClick={() => {
            onNavigate("financial-health");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <AccountBalanceWalletOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Financial health" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "staff" ? "is-active" : ""}`}
          selected={activePage === "staff"}
          onClick={() => {
            onNavigate("staff");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><GroupsOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Staff management" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "customers" ? "is-active" : ""}`}
          selected={activePage === "customers"}
          onClick={() => {
            onNavigate("customers");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><PersonSearchOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Customer management" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${activePage === "cash-drawer" ? "is-active" : ""}`}
          selected={activePage === "cash-drawer"}
          onClick={() => {
            onNavigate("cash-drawer");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon><PointOfSaleOutlinedIcon /></ListItemIcon>
          <ListItemText primary="Daily opening cash" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "notifications" ? "is-active" : ""
          }`}
          selected={activePage === "notifications"}
          onClick={() => {
            onNavigate("notifications");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <NotificationsNoneRoundedIcon />
          </ListItemIcon>
          <ListItemText primary="Notifications" />
        </ListItemButton>
        <ListItemButton
          className={`admin-sidebar__nav-item ${
            activePage === "settings" ? "is-active" : ""
          }`}
          selected={activePage === "settings"}
          onClick={() => {
            onNavigate("settings");
            setMobileOpen(false);
          }}
        >
          <ListItemIcon>
            <SettingsOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
          </>
        ) : (
          <>
            <ListItemButton
              className={`admin-sidebar__nav-item ${activePage === "billing" ? "is-active" : ""}`}
              selected={activePage === "billing"}
              onClick={() => { onNavigate("billing"); setMobileOpen(false); }}
            >
              <ListItemIcon><PointOfSaleRoundedIcon /></ListItemIcon>
              <ListItemText primary="Billing & POS" />
            </ListItemButton>
            <ListItemButton
              className={`admin-sidebar__nav-item ${activePage === "table-orders" ? "is-active" : ""}`}
              selected={activePage === "table-orders"}
              onClick={() => { onNavigate("table-orders"); setMobileOpen(false); }}
            >
              <ListItemIcon><TableBarRoundedIcon /></ListItemIcon>
              <ListItemText primary="Table orders" />
            </ListItemButton>
            <ListItemButton
              className={`admin-sidebar__nav-item ${activePage === "kitchen" ? "is-active" : ""}`}
              selected={activePage === "kitchen"}
              onClick={() => { onNavigate("kitchen"); setMobileOpen(false); }}
            >
              <ListItemIcon><KitchenRoundedIcon /></ListItemIcon>
              <ListItemText primary="Kitchen display" />
            </ListItemButton>
            <ListItemButton
              className={`admin-sidebar__nav-item ${activePage === "cash-drawer" ? "is-active" : ""}`}
              selected={activePage === "cash-drawer"}
              onClick={() => { onNavigate("cash-drawer"); setMobileOpen(false); }}
            >
              <ListItemIcon><PointOfSaleOutlinedIcon /></ListItemIcon>
              <ListItemText primary="Cash drawer & shift" />
            </ListItemButton>
          </>
        )}
      </List>
      <Box className="admin-sidebar__bottom">
        <Divider />
        <Box
          className="admin-sidebar__profile"
          role="button"
          tabIndex={0}
          aria-label="Open my profile"
          onClick={() => {
            onNavigate("profile");
            setMobileOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onNavigate("profile");
              setMobileOpen(false);
            }
          }}
        >
          <Avatar className="admin-sidebar__avatar">
            {(user?.name || "A").charAt(0).toUpperCase()}
          </Avatar>
          <Box className="admin-sidebar__profile-details">
            <Typography noWrap className="admin-sidebar__user-name">
              {user?.name || "Administrator"}
            </Typography>
            <Typography noWrap className="admin-sidebar__user-role">
              {user?.role || "Administrator"}
            </Typography>
          </Box>
          <IconButton
            aria-label="Sign out"
            className="admin-sidebar__logout"
            onClick={(event) => {
              event.stopPropagation();
              setLogoutConfirmOpen(true);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <LogoutRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box className="admin-shell" data-date-time-settings-version={dateTimeSettingsVersion}>
      <ConfirmationDialog
        open={logoutConfirmOpen}
        title="Sign out of your account?"
        message={<Typography>Are you sure you want to sign out? You will need to log in again to continue.</Typography>}
        confirmLabel="Sign out"
        destructive
        icon={<LogoutRoundedIcon />}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          onLogout();
        }}
      />
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              maxWidth: "86vw",
              boxSizing: "border-box",
            },
          }}
        >
          {drawer}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          {drawer}
        </Drawer>
      )}
      <Box className="admin-shell__main">
        <AppBar position="sticky" className="admin-header" elevation={0}>
          <Toolbar className="admin-header__toolbar">
            {isMobile && (
              <IconButton
                edge="start"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
                className="admin-header__menu"
              >
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Box className="admin-header__title">
              <Typography variant="h6">
                {activePage === "menu"
                  ? "Menu Management"
                  : activePage === "inventory" || activePage === "inventory-purchases"
                    ? "Inventory & stock"
                    : activePage === "billing"
                      ? "Billing & POS"
                      : activePage === "table-orders"
                        ? "Table orders"
                        : activePage === "kitchen"
                          ? "Kitchen display"
                      : activePage === "settings"
                        ? "Settings"
                        : activePage === "reports"
                          ? "Purchases & sales"
                          : activePage === "notifications"
                            ? "Notifications"
                            : activePage === "financial-health"
                              ? "Financial health"
                              : activePage === "staff"
                                ? "Staff management"
                                : activePage === "customers"
                                  ? "Customer management"
                                  : activePage === "cash-drawer"
                                    ? "Daily opening cash"
                                    : activePage === "orders"
                                      ? "Orders management"
                                      : activePage === "profile"
                                        ? "My profile"
                    : "Dashboard" }
              </Typography>
              <Typography variant="caption">
                {activePage === "menu"
                  ? "Organize your menu and categories"
                  : activePage === "inventory" || activePage === "inventory-purchases"
                    ? "Manage inventory and stock"
                    : activePage === "billing"
                      ? "Take orders and close bills"
                      : activePage === "table-orders"
                        ? "Send table orders to kitchen stations"
                        : activePage === "kitchen"
                          ? "Monitor and update live kitchen tickets"
                      : activePage === "settings"
                        ? "Configure billing options"
                        : activePage === "reports"
                          ? "Review bills and period totals"
                          : activePage === "notifications"
                            ? "Updates from your workspace"
                            : activePage === "financial-health"
                              ? "Profit & loss overview"
                              : activePage === "staff"
                                ? "Team, roles, profit shares, and wallets"
                                : activePage === "customers"
                                  ? "Guest profiles, visits, and preferences"
                                  : activePage === "cash-drawer"
                                    ? "Cash float, drawer activity, and day-end count"
                                    : activePage === "orders"
                                      ? "Track and fulfil customer orders"
                                    : activePage === "profile"
                                      ? "Account and preferences"
                    : "Your operation at a glance"}
              </Typography>
            </Box>
            <Box className="admin-header__actions">
              <IconButton
                aria-label="Open notifications"
                className="admin-header__notifications"
                onClick={() => onNavigate("notifications")}
                color={activePage === "notifications" ? "primary" : "default"}
              >
                <Badge
                  badgeContent={notificationUnreadCount}
                  color="warning"
                  max={99}
                  showZero={false}
                >
                  <NotificationsNoneRoundedIcon />
                </Badge>
              </IconButton>
              <IconButton
                className="admin-header__theme-toggle"
                aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} theme`}
                onClick={() => onThemeChange(themeMode === "dark" ? "light" : "dark")}
              >
                {themeMode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              </IconButton>
              <Box
                component="button"
                type="button"
                className="admin-header__account"
                aria-label="Open profile"
                onClick={() => onNavigate("profile")}
              >
                <Avatar className="admin-header__avatar">
                  {(user?.name || "A").charAt(0).toUpperCase()}
                </Avatar>
                <Box className="admin-header__account-details">
                  <Typography noWrap>{user?.name || "Administrator"}</Typography>
                  <Typography noWrap variant="caption">Admin</Typography>
                </Box>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>
        <Box component="main" className="admin-shell__content">
          <PageIntro page={activePage} />
          <Box key={activePage} className="admin-page-transition">
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}