import { Box, Typography } from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import TableBarRoundedIcon from "@mui/icons-material/TableBarRounded";
import KitchenRoundedIcon from "@mui/icons-material/KitchenRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import "./PageIntro.css";

const PAGE_COPY = {
  dashboard: ["Dashboard", "Monitor your restaurant's business performance and analytics.", DashboardRoundedIcon],
  menu: ["Menu management", "Organize menu categories, items, pricing, and availability.", RestaurantMenuRoundedIcon],
  inventory: ["Inventory management", "Monitor stock, purchases, consumption, and availability.", Inventory2RoundedIcon],
  "inventory-purchases": ["Inventory purchases", "Record supplier purchases and manage incoming stock.", Inventory2RoundedIcon],
  billing: ["Billing & POS", "Create customer bills, take orders, and manage payments.", PointOfSaleRoundedIcon],
  "table-orders": ["Table orders", "Fire table orders to separate kitchen stations.", TableBarRoundedIcon],
  kitchen: ["Kitchen display", "Receive live kitchen tickets and update item progress.", KitchenRoundedIcon],
  reports: ["Purchases & sales", "Analyze bills, sales activity, and purchase performance.", AssessmentRoundedIcon],
  notifications: ["Notifications", "View important business updates and operational alerts.", NotificationsNoneRoundedIcon],
  "financial-health": ["Financial health", "Review revenue, expenses, reserves, and profitability.", AccountBalanceWalletOutlinedIcon],
  staff: ["Staff management", "Manage employees, roles, profit shares, and wallets.", GroupsOutlinedIcon],
  customers: ["Customer management", "Manage customer profiles, visits, billing, and preferences.", PersonSearchOutlinedIcon],
  "cash-drawer": ["Daily opening cash", "Manage the cash float, drawer activity, and day-end count.", PointOfSaleRoundedIcon],
  orders: ["Orders management", "Track, update, and fulfil customer orders.", ReceiptLongOutlinedIcon],
  settings: ["Settings", "Configure restaurant details and application preferences.", SettingsOutlinedIcon],
  profile: ["My profile", "Manage your account and application preferences.", PersonOutlineRoundedIcon],
};

export default function PageIntro({ page }) {
  const [title, description, Icon] = PAGE_COPY[page] || PAGE_COPY.dashboard;
  const isPrimaryPageHeading = ["dashboard", "cash-drawer"].includes(page);

  return (
    <Box className="page-intro">
      <Box className="page-intro__copy">
        <Typography component={isPrimaryPageHeading ? "h1" : "p"}>{title}</Typography>
        <Typography>{description}</Typography>
      </Box>
      <Box className="page-intro__icon" aria-hidden="true">
        <Icon />
      </Box>
    </Box>
  );
}
