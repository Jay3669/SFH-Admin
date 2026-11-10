import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  acceptAggregatorOrder,
  assignAggregatorRider,
  fireAggregatorOrder,
  getAggregatorOrders,
} from "../../services/featureServices";
import { listDiningTables, listKitchenKots } from "../../services/kotService";
import { listRecentPosSales } from "../../services/posService";
import { formatTime } from "../../utils/dateTimeFormat";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function playChime() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;
  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.12, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.35);
  oscillator.onended = () => context.close();
}

export default function AggregatorOrdersPage({ onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [kots, setKots] = useState([]);
  const [posBills, setPosBills] = useState([]);
  const [channel, setChannel] = useState("online");
  const [riderDrafts, setRiderDrafts] = useState({});
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const knownIds = useRef(null);
  const soundEnabledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [current, currentTables, currentKots, currentBills] = await Promise.all([
        getAggregatorOrders(),
        listDiningTables(),
        listKitchenKots("All"),
        listRecentPosSales(50),
      ]);
      const newOrderArrived = knownIds.current && current.some((order) => order.status === "new" && !knownIds.current.has(String(order.aggregator_order_id)));
      if (newOrderArrived && soundEnabledRef.current) playChime();
      knownIds.current = new Set(current.map((order) => String(order.aggregator_order_id)));
      setOrders(current);
      setTables(currentTables);
      setKots(currentKots);
      setPosBills(currentBills);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load online orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(refresh, 20000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  function enableSounds() {
    playChime();
    soundEnabledRef.current = true;
    setSoundsEnabled(true);
  }

  async function perform(order, action) {
    const id = String(order.aggregator_order_id);
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      if (action === "accept") await acceptAggregatorOrder(id);
      if (action === "fire") await fireAggregatorOrder(id);
      if (action === "rider") {
        const riderName = (riderDrafts[id] || order.rider_name || "").trim();
        await assignAggregatorRider(id, riderName);
      }
      setNotice(action === "fire" ? "Order sent to kitchen." : action === "rider" ? "Rider assignment saved." : "Order accepted.");
      await refresh();
    } catch (actionError) {
      setError(actionError.message || "Unable to update this order.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
        <Box>
          <Typography variant="overline" color="primary">UNIFIED POS QUEUE</Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>Orders across all channels</Typography>
          <Typography color="text.secondary">Dine-in, takeaway, Swiggy, and Zomato orders refresh together every 20 seconds.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button startIcon={<NotificationsActiveRoundedIcon />} variant={soundsEnabled ? "outlined" : "contained"} onClick={enableSounds}>{soundsEnabled ? "Sound enabled" : "Enable alerts"}</Button>
          <Button startIcon={<RefreshRoundedIcon />} onClick={refresh}>Refresh</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <Card variant="outlined" sx={{ p: 1.5 }}><Typography color="text.secondary">Active dine-in tables</Typography><Typography variant="h5" fontWeight={800}>{tables.filter((table) => table.status === "occupied").length}</Typography></Card>
        <Card variant="outlined" sx={{ p: 1.5 }}><Typography color="text.secondary">Recent takeaway bills</Typography><Typography variant="h5" fontWeight={800}>{posBills.filter((bill) => bill.orderType === "Takeaway").length}</Typography></Card>
        <Card variant="outlined" sx={{ p: 1.5 }}><Typography color="text.secondary">New aggregator orders</Typography><Typography variant="h5" fontWeight={800}>{orders.filter((order) => order.status === "new").length}</Typography></Card>
      </Box>
      <Tabs value={channel} onChange={(event, value) => setChannel(value)} aria-label="Order channels">
        <Tab value="online" label={`Swiggy & Zomato (${orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length})`} />
        <Tab value="dine-in" label={`Dine-in (${tables.filter((table) => table.status === "occupied").length})`} />
        <Tab value="takeaway" label={`Takeaway (${posBills.filter((bill) => bill.orderType === "Takeaway").length})`} />
      </Tabs>
      {loading && <Typography>Loading online orders…</Typography>}
      {channel === "online" && !loading && !orders.length && <Alert severity="info">No aggregator orders received yet.</Alert>}
      {channel === "online" && orders.map((order) => {
        const id = String(order.aggregator_order_id);
        const statusColor = order.status === "new" ? "warning" : order.status === "fired" ? "success" : "info";
        return (
          <Card key={id} variant="outlined" sx={{ p: 2, display: "grid", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>{order.provider} · {order.external_order_id}</Typography>
                <Typography color="text.secondary">{order.customer_name || "Customer"}{order.customer_phone ? ` · ${order.customer_phone}` : ""} · {formatTime(order.createdAt)}</Typography>
              </Box>
              <Chip color={statusColor} label={order.status} />
            </Box>
            <Divider />
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {order.items.map((item, index) => <Typography key={`${item.menuItemId}-${index}`}>{item.quantity} × {item.name || `Item ${item.menuItemId}`} {item.notes ? `· ${item.notes}` : ""}</Typography>)}
              <Typography fontWeight={800}>Order total · {CURRENCY.format(Number(order.total_amount))}</Typography>
            </Box>
            {order.status !== "new" && <Typography variant="body2" color="text.secondary">Rider: {order.rider_name || "Not assigned"}</Typography>}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              {order.status === "new" && <Button variant="contained" disabled={busyId === id} onClick={() => perform(order, "accept")}>Accept order</Button>}
              {order.status === "accepted" && <Button variant="contained" disabled={busyId === id} onClick={() => perform(order, "fire")}>Fire to kitchen</Button>}
              {["accepted", "fired"].includes(order.status) && <>
                <TextField size="small" label="Rider name" value={riderDrafts[id] ?? order.rider_name ?? ""} onChange={(event) => setRiderDrafts((current) => ({ ...current, [id]: event.target.value }))} inputProps={{ maxLength: 120 }} />
                <Button disabled={busyId === id || !(riderDrafts[id] ?? order.rider_name ?? "").trim()} onClick={() => perform(order, "rider")}>Assign rider</Button>
              </>}
              {busyId === id && <Typography role="status">Saving…</Typography>}
            </Box>
          </Card>
        );
      })}
      {channel === "dine-in" && <>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Typography variant="h6">Dining tables and active KOTs</Typography>
          <Button onClick={() => onNavigate?.("table-orders")}>Open table view</Button>
        </Box>
        {tables.filter((table) => table.status !== "vacant").map((table) => (
          <Card key={table.tableName} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", gap: 1 }}>
            <Box>
              <Typography fontWeight={800}>{table.tableName} · {table.status}</Typography>
              <Typography color="text.secondary">{kots.filter((kot) => kot.tableName === table.tableName && kot.orderType === "Dine-in").length} active kitchen tickets</Typography>
            </Box>
            <Button onClick={() => onNavigate?.("table-orders")}>Manage</Button>
          </Card>
        ))}
        {!tables.some((table) => table.status !== "vacant") && <Alert severity="info">No active dine-in tables.</Alert>}
      </>}
      {channel === "takeaway" && <>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Typography variant="h6">Recent takeaway POS bills</Typography>
          <Button onClick={() => onNavigate?.("billing")}>Open POS billing</Button>
        </Box>
        {posBills.filter((bill) => bill.orderType === "Takeaway").map((bill) => (
          <Card key={bill.id} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", gap: 1 }}>
            <Box><Typography fontWeight={800}>{bill.number}</Typography><Typography color="text.secondary">{bill.items.length} lines · {bill.status}</Typography></Box>
            <Typography fontWeight={800}>{CURRENCY.format(Number(bill.total))}</Typography>
          </Card>
        ))}
        {!posBills.some((bill) => bill.orderType === "Takeaway") && <Alert severity="info">No recent takeaway POS bills.</Alert>}
      </>}
    </Box>
  );
}
