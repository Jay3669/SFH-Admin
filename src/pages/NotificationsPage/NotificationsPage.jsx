import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CircleNotificationsOutlinedIcon from "@mui/icons-material/CircleNotificationsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import "./NotificationsPage.css";

const INITIAL_NOTIFICATIONS = [
  {
    id: "stock-tomatoes",
    category: "Inventory",
    priority: "High",
    title: "Fresh tomatoes are running low",
    message: "Only 1.8 kg remains, below the 3 kg reorder point. Review stock and plan a restock before the next service.",
    time: "10 min ago",
    unread: true,
    archived: false,
    action: "Review inventory",
    destination: "inventory",
    icon: Inventory2OutlinedIcon,
  },
  {
    id: "expiry-paneer",
    category: "Inventory",
    priority: "High",
    title: "Paneer batch expires tomorrow",
    message: "Batch PN-204 has 4.5 kg on hand and reaches its expiry date tomorrow. Check the batch before accepting new stock.",
    time: "42 min ago",
    unread: true,
    archived: false,
    action: "Check batches",
    destination: "inventory",
    icon: WarningAmberRoundedIcon,
  },
  {
    id: "sale-pos-1048",
    category: "Billing",
    priority: "Normal",
    title: "Payment recorded for POS-1048",
    message: "A sale of ₹1,240.00 was completed with Cash and UPI. The bill is available in your sales report.",
    time: "2 hr ago",
    unread: true,
    archived: false,
    action: "View sales",
    destination: "reports",
    icon: PointOfSaleOutlinedIcon,
  },
  {
    id: "daily-summary",
    category: "System",
    priority: "Low",
    title: "Your workspace is ready for today",
    message: "Your menu, inventory, and billing workspace is up to date. You can review current stock alerts from Inventory & stock.",
    time: "Today · 8:00 AM",
    unread: false,
    archived: false,
    action: "Open dashboard",
    destination: "dashboard",
    icon: CircleNotificationsOutlinedIcon,
  },
  {
    id: "sale-pos-1042",
    category: "Billing",
    priority: "Normal",
    title: "A new sale was recorded",
    message: "Bill POS-1042 was completed for ₹860.00. View the bill and payment breakdown in Purchases & sales.",
    time: "Yesterday · 6:24 PM",
    unread: false,
    archived: false,
    action: "View sales",
    destination: "reports",
    icon: PointOfSaleOutlinedIcon,
  },
  {
    id: "stock-count",
    category: "Inventory",
    priority: "Low",
    title: "Stock count updated",
    message: "Your team recorded a stock adjustment for Basmati rice. Review the movement history if you need more detail.",
    time: "Yesterday · 3:10 PM",
    unread: false,
    archived: false,
    action: "Review inventory",
    destination: "inventory",
    icon: Inventory2OutlinedIcon,
  },
];

const CATEGORIES = ["All types", "Inventory", "Billing", "System"];

const DEFAULT_PREFERENCES = {
  inApp: true,
  criticalInventory: true,
  billingUpdates: true,
  dailySummary: false,
};

function NotificationIcon({ notification, className = "" }) {
  const Icon = notification.icon;
  return (
    <Avatar className={`notifications-item__icon is-${notification.category.toLowerCase()} ${className}`}>
      <Icon />
    </Avatar>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <Card className="notifications-stat" elevation={0}>
      <Box className={`notifications-stat__icon is-${tone}`}><Icon /></Box>
      <Box className="notifications-stat__content">
        <Typography>{label}</Typography>
        <Box className="notifications-stat__value">{value}</Box>
        <Typography>{detail}</Typography>
      </Box>
    </Card>
  );
}

export default function NotificationsPage({
  onNavigate,
  initialUnreadCount = 3,
  onUnreadCountChange,
}) {
  const [notifications, setNotifications] = useState(() =>
    INITIAL_NOTIFICATIONS.map((notification) => {
      if (!notification.unread) return notification;
      const unreadIndex = INITIAL_NOTIFICATIONS
        .slice(0, INITIAL_NOTIFICATIONS.indexOf(notification) + 1)
        .filter((item) => item.unread).length;
      return unreadIndex <= initialUnreadCount ? notification : { ...notification, unread: false };
    })
  );
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("All types");
  const [search, setSearch] = useState("");
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  const unreadCount = notifications.filter((notification) => notification.unread && !notification.archived).length;
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);
  const urgentCount = notifications.filter((notification) => notification.priority === "High" && !notification.archived).length;
  const archivedCount = notifications.filter((notification) => notification.archived).length;
  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (filter === "unread" && (!notification.unread || notification.archived)) return false;
      if (filter === "archived" && !notification.archived) return false;
      if (filter !== "archived" && notification.archived) return false;
      if (category !== "All types" && notification.category !== category) return false;
      return !query || `${notification.title} ${notification.message} ${notification.category}`.toLowerCase().includes(query);
    });
  }, [category, filter, notifications, search]);

  function updateNotification(id, updates) {
    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, ...updates } : notification
    )));
    setSelectedNotification((current) => (
      current?.id === id ? { ...current, ...updates } : current
    ));
  }

  function openNotification(notification) {
    if (notification.unread) updateNotification(notification.id, { unread: false });
    setSelectedNotification({ ...notification, unread: false });
  }

  function markAllAsRead() {
    setNotifications((current) => current.map((notification) => (
      notification.archived ? notification : { ...notification, unread: false }
    )));
  }

  function openDestination(notification) {
    updateNotification(notification.id, { unread: false });
    setSelectedNotification(null);
    onNavigate(notification.destination);
  }

  function resetFilters() {
    setFilter("all");
    setCategory("All types");
    setSearch("");
  }

  return (
    <Box className="notifications-page app-content-width">
      <Box className="notifications-hero">
        <Box className="notifications-hero__copy">
          <Chip label="INTERACTIVE DEMO" size="small" />
          <Typography component="h1">Notifications</Typography>
          <Typography>Explore an example inbox for inventory, billing, and workspace updates.</Typography>
        </Box>
        <Box className="notifications-hero__actions">
          <Button
            variant="outlined"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => setPreferencesOpen(true)}
          >
            Preferences
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CheckRoundedIcon />}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </Box>
      </Box>

      <Box className="notifications-stats">
        <StatCard icon={NotificationsActiveOutlinedIcon} label="Unread" value={unreadCount} detail="Need your attention" tone="orange" />
        <StatCard icon={WarningAmberRoundedIcon} label="Priority alerts" value={urgentCount} detail="Inventory needs a look" tone="red" />
        <StatCard icon={ArchiveOutlinedIcon} label="Archived" value={archivedCount} detail="Kept for later" tone="blue" />
      </Box>

      <Card className="notifications-inbox" elevation={0}>
        <Box className="notifications-inbox__heading">
          <Box>
            <Typography component="h2">Your inbox</Typography>
            <Typography>{filter === "archived" ? "Notifications you have archived" : "Stay on top of what is happening"}</Typography>
          </Box>
          <Badge badgeContent={unreadCount} color="warning" max={99} className="notifications-inbox__badge">
            <Chip label={`${filteredNotifications.length} ${filteredNotifications.length === 1 ? "update" : "updates"}`} />
          </Badge>
        </Box>

        <Box className="notifications-controls">
          <ToggleButtonGroup
            exclusive
            value={filter}
            onChange={(_, value) => value && setFilter(value)}
            aria-label="Notification status"
            className="notifications-tabs"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="unread">Unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}</ToggleButton>
            <ToggleButton value="archived">Archived{archivedCount > 0 ? ` · ${archivedCount}` : ""}</ToggleButton>
          </ToggleButtonGroup>
          <Box className="notifications-controls__filters">
            <TextField
              size="small"
              placeholder="Search notifications"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{ htmlInput: { "aria-label": "Search notifications" }, input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
            />
            <FormControl size="small" className="notifications-category">
              <InputLabel id="notification-category-label">Category</InputLabel>
              <Select
                labelId="notification-category-label"
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((item) => <MenuItem value={item} key={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box className="notifications-list" aria-live="polite">
          {filteredNotifications.length ? filteredNotifications.map((notification) => (
            <Box
              key={notification.id}
              className={`notifications-item${notification.unread ? " is-unread" : ""}`}
            >
              <Button
                className="notifications-item__main"
                onClick={() => openNotification(notification)}
                aria-label={`Open ${notification.title}`}
              >
                <NotificationIcon notification={notification} />
                <Box className="notifications-item__content">
                  <Box className="notifications-item__title">
                    <Typography component="h3">{notification.title}</Typography>
                    {notification.unread && <Box className="notifications-item__unread" aria-label="Unread" />}
                  </Box>
                  <Typography className="notifications-item__message">{notification.message}</Typography>
                  <Box className="notifications-item__meta">
                    <Chip label={notification.category} size="small" />
                    {notification.priority === "High" && <Chip label="Priority" size="small" className="is-priority" />}
                    <span>{notification.time}</span>
                  </Box>
                </Box>
              </Button>
              <Box className="notifications-item__actions">
                <IconButton
                  aria-label={notification.unread ? `Mark ${notification.title} as read` : `Mark ${notification.title} as unread`}
                  title={notification.unread ? "Mark as read" : "Mark as unread"}
                  onClick={() => updateNotification(notification.id, { unread: !notification.unread })}
                >
                  {notification.unread ? <CheckRoundedIcon /> : <CircleNotificationsOutlinedIcon />}
                </IconButton>
                <IconButton
                  aria-label={notification.archived ? `Restore ${notification.title}` : `Archive ${notification.title}`}
                  title={notification.archived ? "Restore" : "Archive"}
                  onClick={() => updateNotification(notification.id, { archived: !notification.archived, unread: false })}
                >
                  <ArchiveOutlinedIcon />
                </IconButton>
              </Box>
            </Box>
          )) : (
            <Box className="notifications-empty">
              <Box className="notifications-empty__icon"><NotificationsActiveOutlinedIcon /></Box>
              <Typography component="h3">{filter === "archived" ? "Nothing archived yet" : filter === "unread" ? "You are all caught up" : "No matching notifications"}</Typography>
              <Typography>{filter === "unread" ? "New updates will appear here when they need your attention." : "Try changing the search or category filters."}</Typography>
              {(search || category !== "All types") && <Button onClick={resetFilters}>Clear filters</Button>}
            </Box>
          )}
        </Box>
        <Box className="notifications-inbox__footer">
          <Typography>Showing {filteredNotifications.length} of {notifications.filter((notification) => filter === "archived" ? notification.archived : !notification.archived).length} notifications</Typography>
          <Button size="small" onClick={markAllAsRead} disabled={unreadCount === 0}>Mark all as read</Button>
        </Box>
      </Card>

      <Dialog
        open={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="notification-detail-title"
      >
        {selectedNotification && <>
          <DialogTitle className="notifications-detail__title">
            <NotificationIcon notification={selectedNotification} />
            <Box>
              <Typography component="h2" id="notification-detail-title">{selectedNotification.title}</Typography>
              <Typography>{selectedNotification.category} · {selectedNotification.time}</Typography>
            </Box>
          </DialogTitle>
          <DialogContent className="notifications-detail__content">
            <Chip label={selectedNotification.priority === "High" ? "Priority alert" : `${selectedNotification.priority} priority`} className={selectedNotification.priority === "High" ? "is-priority" : ""} />
            <Typography>{selectedNotification.message}</Typography>
            <Divider />
            <Typography className="notifications-detail__note">This sample notification is part of the frontend demo. Notification delivery and preferences are not connected to a live service.</Typography>
          </DialogContent>
          <DialogActions className="notifications-detail__actions">
            <Button onClick={() => updateNotification(selectedNotification.id, { archived: !selectedNotification.archived, unread: false })}>
              {selectedNotification.archived ? "Restore" : "Archive"}
            </Button>
            <Button onClick={() => setSelectedNotification(null)}>Close</Button>
            <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => openDestination(selectedNotification)}>{selectedNotification.action}</Button>
          </DialogActions>
        </>}
      </Dialog>

      <Dialog
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="notification-preferences-title"
      >
        <DialogTitle id="notification-preferences-title">Notification preferences</DialogTitle>
        <DialogContent className="notifications-preferences">
          <Typography>Preview notification settings for this demo session.</Typography>
          <FormControlLabel control={<Switch checked={preferences.inApp} onChange={(event) => setPreferences((current) => ({ ...current, inApp: event.target.checked }))} />} label="In-app notifications" />
          <FormControlLabel control={<Switch checked={preferences.criticalInventory} onChange={(event) => setPreferences((current) => ({ ...current, criticalInventory: event.target.checked }))} />} label="Priority inventory alerts" />
          <FormControlLabel control={<Switch checked={preferences.billingUpdates} onChange={(event) => setPreferences((current) => ({ ...current, billingUpdates: event.target.checked }))} />} label="Billing updates" />
          <FormControlLabel control={<Switch checked={preferences.dailySummary} onChange={(event) => setPreferences((current) => ({ ...current, dailySummary: event.target.checked }))} />} label="Daily summary" />
          <Typography className="notifications-detail__note">These settings are for display only and are not saved to a notification service.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPreferencesOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
