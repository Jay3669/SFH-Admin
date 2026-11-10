import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, IconButton, InputAdornment,
  InputLabel, MenuItem, Select, Tab, Tabs, TextField, Typography,
  Pagination,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { getOrders, saveOrders } from "../../services/ordersManagement";
import { formatTime } from "../../utils/dateTimeFormat";
import "./OrdersManagementPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const STATUSES = ["New", "Preparing", "Ready", "Out for delivery", "Completed", "Cancelled"];
const EMPTY_ORDER = { customer: "", phone: "", type: "Dine-in", table: "", status: "New", payment: "Pending", itemsText: "", notes: "" };

function orderTotal(order) {
  return order.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function displayTime(value) {
  return formatTime(value);
}

export default function OrdersManagementPage() {
  const [orders, setOrders] = useState(() => {
    try { return getOrders(); } catch { return []; }
  });
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [selectedId, setSelectedId] = useState(() => orders[0]?.id || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_ORDER);
  const [editingId, setEditingId] = useState("");
  const [formError, setFormError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selectedOrder = orders.find((order) => order.id === selectedId) || null;
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${order.id} ${order.customer} ${order.phone}`.toLowerCase().includes(query);
    return matchesSearch && (status === "All" || order.status === status) && (type === "All" || order.type === type);
  }).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt)), [orders, search, status, type]);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, status, type]);

  const activeCount = orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length;
  const revenue = orders.filter((order) => order.status !== "Cancelled").reduce((sum, order) => sum + orderTotal(order), 0);

  function persist(nextOrders, message) {
    try {
      saveOrders(nextOrders);
      setOrders(nextOrders);
      setNotice(message);
      setError("");
      return true;
    } catch (saveError) {
      setError(saveError.message || "Unable to save orders.");
      return false;
    }
  }

  function openCreate(order = null) {
    setEditingId(order?.id || "");
    setFormError("");
    setDraft(order ? {
      customer: order.customer, phone: order.phone, type: order.type, table: order.table || "",
      status: order.status, payment: order.payment,
      itemsText: order.items.map((item) => `${item.name}|${item.quantity}|${item.price}`).join("\n"),
      notes: order.notes || "",
    } : EMPTY_ORDER);
    setDialogOpen(true);
  }

  function saveOrder() {
    if (!draft.customer.trim()) {
      setFormError("Enter a customer name.");
      return;
    }
    const itemRows = draft.itemsText.split("\n").map((row) => row.trim()).filter(Boolean);
    const items = [];
    for (const row of itemRows) {
      const [name, quantity, price] = row.split("|").map((value) => value.trim());
      if (!name || !Number.isFinite(Number(quantity)) || Number(quantity) < 1 || !Number.isFinite(Number(price)) || Number(price) < 0) {
        setFormError("Use one item per line: Item name | quantity | price.");
        return;
      }
      items.push({ name, quantity: Number(quantity), price: Number(price) });
    }
    if (!items.length) {
      setFormError("Add at least one order item.");
      return;
    }
    const id = editingId || `ORD-${String(Math.max(1048, ...orders.map((order) => Number(order.id.replace("ORD-", "")) || 0)) + 1).padStart(4, "0")}`;
    const existing = orders.find((order) => order.id === editingId);
    const order = {
      id, customer: draft.customer.trim(), phone: draft.phone.trim(), type: draft.type,
      table: draft.type === "Dine-in" ? draft.table.trim() : "", status: draft.status,
      payment: draft.payment, placedAt: existing?.placedAt || new Date().toISOString(), items, notes: draft.notes.trim(),
    };
    const nextOrders = editingId ? orders.map((entry) => entry.id === editingId ? order : entry) : [order, ...orders];
    if (persist(nextOrders, editingId ? `${id} updated.` : `${id} created.`)) {
      setSelectedId(id);
      setDialogOpen(false);
    }
  }

  function updateStatus(nextStatus) {
    if (!selectedOrder) return;
    if (persist(orders.map((order) => order.id === selectedOrder.id ? { ...order, status: nextStatus } : order), `${selectedOrder.id} moved to ${nextStatus}.`)) {
      setDetailsOpen(false);
    }
  }

  function copyOrder(order) {
    const text = `${order.id} | ${order.customer} | ${order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")} | ${CURRENCY.format(orderTotal(order))}`;
    navigator.clipboard?.writeText(text);
    setNotice(`${order.id} copied.`);
  }

  return (
    <Box className="orders-page">
      <Box className="orders-page__heading">
        <Box><Typography className="orders-page__eyebrow">OPERATIONS</Typography><Typography component="h1">Orders management</Typography><Typography>Track, fulfil, and update every customer order.</Typography></Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openCreate()}>Create order</Button>
      </Box>

      {(notice || loadError || error) && <Alert className="orders-page__notice" severity={error || loadError ? "error" : "success"} onClose={() => { setNotice(""); setLoadError(""); setError(""); }}>{error || loadError || notice}</Alert>}

      <Box className="orders-page__stats">
        <Card elevation={0}><Box className="orders-stat__icon blue"><ReceiptLongOutlinedIcon /></Box><Box><Typography>Total orders</Typography><strong>{orders.length}</strong><span>All recorded orders</span></Box></Card>
        <Card elevation={0}><Box className="orders-stat__icon amber"><RestaurantRoundedIcon /></Box><Box><Typography>Active orders</Typography><strong>{activeCount}</strong><span>Need attention</span></Box></Card>
        <Card elevation={0}><Box className="orders-stat__icon green"><ShoppingBagOutlinedIcon /></Box><Box><Typography>Order value</Typography><strong>{CURRENCY.format(revenue)}</strong><span>Excluding cancelled</span></Box></Card>
        <Card elevation={0}><Box className="orders-stat__icon purple"><LocalShippingOutlinedIcon /></Box><Box><Typography>Delivery</Typography><strong>{orders.filter((order) => order.type === "Delivery" && !["Completed", "Cancelled"].includes(order.status)).length}</strong><span>Currently in progress</span></Box></Card>
      </Box>

      <Card className="orders-workspace" elevation={0}>
        <Box className="orders-toolbar">
          <Tabs value={status} onChange={(event, value) => setStatus(value)} variant="scrollable" scrollButtons="auto">
            {["All", "New", "Preparing", "Ready", "Out for delivery"].map((value) => <Tab key={value} value={value} label={value === "All" ? "All orders" : value} />)}
          </Tabs>
          <Box className="orders-toolbar__filters">
            <TextField size="small" placeholder="Search order or customer" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }} />
            <FormControl size="small"><InputLabel>Order type</InputLabel><Select label="Order type" value={type} onChange={(event) => setType(event.target.value)}><MenuItem value="All">All types</MenuItem><MenuItem value="Dine-in">Dine-in</MenuItem><MenuItem value="Takeaway">Takeaway</MenuItem><MenuItem value="Delivery">Delivery</MenuItem></Select></FormControl>
          </Box>
        </Box>
        <Box className="orders-table" role="table" aria-label="Orders">
          <Box className="orders-table__head" role="row"><span>Order</span><span>Customer</span><span>Type</span><span>Status</span><span>Total</span><span /></Box>
          {paginatedOrders.map((order) => (
            <Box className={`orders-table__row ${selectedId === order.id ? "is-selected" : ""}`} role="row" key={order.id} onClick={() => setSelectedId(order.id)}>
              <Box className="orders-table__order"><strong>{order.id}</strong><span>{displayTime(order.placedAt)} · {order.items.length} items</span></Box>
              <Box><strong>{order.customer}</strong><span>{order.type === "Dine-in" ? order.table || "Table not set" : order.phone || "No phone"}</span></Box>
              <Chip className={`orders-type is-${order.type.toLowerCase()}`} size="small" label={order.type} />
              <Chip className={`orders-status is-${statusClass(order.status)}`} size="small" label={order.status} />
              <strong className="orders-table__total">{CURRENCY.format(orderTotal(order))}</strong>
              <Box className="orders-table__actions">
                <IconButton aria-label={`View ${order.id}`} onClick={(event) => { event.stopPropagation(); setSelectedId(order.id); setDetailsOpen(true); }}><MoreVertRoundedIcon /></IconButton>
              </Box>
            </Box>
          ))}
          {!filteredOrders.length && <Box className="orders-table__empty"><ReceiptLongOutlinedIcon /><Typography>No orders match these filters.</Typography></Box>}
        </Box>
        {filteredOrders.length > pageSize && <Box className="orders-pagination"><Pagination color="primary" count={Math.ceil(filteredOrders.length / pageSize)} page={page} onChange={(_, value) => setPage(value)} /></Box>}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? `Edit ${editingId}` : "Create new order"}</DialogTitle>
        <DialogContent className="orders-dialog__content">
          <Box className="orders-dialog__two-col">
            <TextField autoFocus required label="Customer name" value={draft.customer} onChange={(event) => setDraft({ ...draft, customer: event.target.value })} />
            <TextField label="Phone number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
          </Box>
          <Box className="orders-dialog__two-col">
            <FormControl><InputLabel>Order type</InputLabel><Select label="Order type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><MenuItem value="Dine-in">Dine-in</MenuItem><MenuItem value="Takeaway">Takeaway</MenuItem><MenuItem value="Delivery">Delivery</MenuItem></Select></FormControl>
            <TextField label={draft.type === "Dine-in" ? "Table" : "Reference"} value={draft.table} disabled={draft.type !== "Dine-in"} onChange={(event) => setDraft({ ...draft, table: event.target.value })} />
          </Box>
          <Box className="orders-dialog__two-col">
            <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{STATUSES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            <FormControl><InputLabel>Payment</InputLabel><Select label="Payment" value={draft.payment} onChange={(event) => setDraft({ ...draft, payment: event.target.value })}>{["Pending", "Cash", "Paid", "Online"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
          </Box>
          <TextField required multiline minRows={4} label="Items" value={draft.itemsText} onChange={(event) => setDraft({ ...draft, itemsText: event.target.value })} helperText="One item per line: Item name | quantity | price" />
          <TextField multiline minRows={2} label="Kitchen / delivery notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={saveOrder}>{editingId ? "Save changes" : "Create order"}</Button></DialogActions>
      </Dialog>

      <Dialog open={detailsOpen && Boolean(selectedOrder)} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="sm">
        {selectedOrder && <>
          <DialogTitle className="orders-details__title"><Box><Typography component="span">{selectedOrder.id}</Typography><Chip className={`orders-status is-${statusClass(selectedOrder.status)}`} size="small" label={selectedOrder.status} /></Box><Box><IconButton aria-label={`Copy ${selectedOrder.id}`} onClick={() => copyOrder(selectedOrder)}><ContentCopyRoundedIcon /></IconButton><IconButton aria-label={`Edit ${selectedOrder.id}`} onClick={() => { setDetailsOpen(false); openCreate(selectedOrder); }}><EditRoundedIcon /></IconButton></Box></DialogTitle>
          <DialogContent className="orders-details">
            <Box className="orders-details__customer"><Typography>{selectedOrder.customer}</Typography><span>{selectedOrder.type}{selectedOrder.table ? ` · ${selectedOrder.table}` : ""} · {selectedOrder.phone || "No phone"}</span></Box>
            <Divider />
            <Box className="orders-details__items">{selectedOrder.items.map((item, index) => <Box key={`${item.name}-${index}`}><span>{item.quantity}×</span><strong>{item.name}</strong><b>{CURRENCY.format(item.quantity * item.price)}</b></Box>)}</Box>
            <Box className="orders-details__total"><span>Total</span><strong>{CURRENCY.format(orderTotal(selectedOrder))}</strong></Box>
            {selectedOrder.notes && <Alert severity="info">Note: {selectedOrder.notes}</Alert>}
            <FormControl fullWidth><InputLabel>Update status</InputLabel><Select label="Update status" value={selectedOrder.status} onChange={(event) => updateStatus(event.target.value)}>{STATUSES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
          </DialogContent>
          <DialogActions><Button color="error" disabled={selectedOrder.status === "Cancelled"} onClick={() => updateStatus("Cancelled")}>Cancel order</Button><Button variant="contained" onClick={() => setDetailsOpen(false)}>Done</Button></DialogActions>
        </>}
      </Dialog>
    </Box>
  );
}
