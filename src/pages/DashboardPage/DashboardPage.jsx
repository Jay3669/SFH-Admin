import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import { getBillingReport } from "../../services/billingReport";
import { getInventory } from "../../services/inventoryService";
import { getCustomers } from "../../services/customerManagement";
import { getOrders } from "../../services/ordersManagement";
import { listFinancialExpenses } from "../../services/financialExpenses";
import "./DashboardPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const RANGE_OPTIONS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "Last 7 days"],
  ["month", "Last 30 days"],
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["year", "This year"],
  ["custom", "Custom range"],
];

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function saleDate(sale) {
  return new Date(sale?.createdAt || sale?.date || sale?.completedAt || sale?.timestamp || 0);
}

function billTotal(sale) {
  return amount(sale?.total ?? sale?.grandTotal ?? sale?.amount ?? sale?.billTotal);
}

function paymentTotals(sale) {
  const payments = sale?.payments || sale?.paymentBreakdown || [];
  const result = { cash: 0, upi: 0, card: 0, pending: 0 };
  if (Array.isArray(payments)) {
    payments.forEach((payment) => {
      const method = String(payment.method || payment.type || payment.mode || "").toLowerCase();
      result[method.includes("upi") ? "upi" : method.includes("card") ? "card" : method.includes("cash") ? "cash" : "pending"] += amount(payment.amount);
    });
  } else {
    result.cash = amount(sale?.cash);
    result.upi = amount(sale?.upi);
    result.card = amount(sale?.card);
  }
  const paymentMethod = String(sale?.paymentMethod || sale?.payment || "").toLowerCase();
  if (!result.cash && !result.upi && !result.card && paymentMethod) {
    result[paymentMethod.includes("upi") ? "upi" : paymentMethod.includes("card") ? "card" : paymentMethod.includes("cash") ? "cash" : "pending"] = billTotal(sale);
  }
  return result;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function rangeFor(key, customFrom, customTo) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = startOfDay(now);
  if (key === "yesterday") start = new Date(start.getTime() - 86400000);
  if (key === "week" || key === "month") start = new Date(start.getTime() - (key === "week" ? 6 : 29) * 86400000);
  if (key === "this-month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "last-month") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end.setTime(new Date(now.getFullYear(), now.getMonth(), 0).setHours(23, 59, 59, 999)); }
  if (key === "year") start = new Date(now.getFullYear(), 0, 1);
  if (key === "custom") { start = startOfDay(customFrom ? new Date(`${customFrom}T00:00:00`) : now); end.setTime(new Date(`${customTo || customFrom || now.toISOString().slice(0, 10)}T23:59:59.999`).getTime()); }
  if (key === "yesterday") { end.setTime(new Date(start).setHours(23, 59, 59, 999)); }
  return { start, end };
}

function previousRange({ start, end }) {
  const duration = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - duration - 1), end: new Date(start.getTime() - 1) };
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function StatCard({ label, value, comparison, icon: Icon, tone }) {
  const positive = comparison >= 0;
  const TrendIcon = positive ? TrendingUpRoundedIcon : TrendingDownRoundedIcon;
  return (
    <Card className="dashboard-stat" elevation={0}>
      <CardContent>
        <Box className="dashboard-stat__summary">
          <Box><Typography className="dashboard-stat__label">{label}</Typography><Typography className="dashboard-stat__value">{value}</Typography></Box>
          <Box className={`dashboard-stat__icon is-${tone}`}><Icon /></Box>
        </Box>
        <Typography className={`dashboard-stat__change ${positive ? "is-positive" : "is-negative"}`}>
          <TrendIcon /> {Math.abs(comparison).toFixed(1)}% vs previous period
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage({ user }) {
  const [range, setRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [inventory, setInventory] = useState({ items: [] });
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recent, setRecent] = useState([]);

  async function load() {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      getBillingReport("monthly"),
      getInventory(),
      Promise.resolve().then(getCustomers),
      Promise.resolve().then(getOrders),
      Promise.resolve().then(listFinancialExpenses),
      import("../../services/posService").then(({ listRecentPosSales }) => listRecentPosSales(8)),
    ]);
    const [reportResult, inventoryResult, customerResult, orderResult, expenseResult, recentResult] = results;
    if (reportResult.status === "rejected") setError(reportResult.reason?.message || "Dashboard analytics could not be loaded.");
    else setReport(reportResult.value);
    if (inventoryResult.status === "fulfilled") setInventory(inventoryResult.value);
    if (customerResult.status === "fulfilled") setCustomers(customerResult.value);
    if (orderResult.status === "fulfilled") setOrders(orderResult.value);
    if (expenseResult.status === "fulfilled") setExpenses(expenseResult.value);
    if (recentResult.status === "fulfilled") setRecent(recentResult.value);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const view = useMemo(() => {
    const currentRange = rangeFor(range, customFrom, customTo);
    const previous = previousRange(currentRange);
    const sales = (report?.sales?.bills || []).filter((sale) => {
      const date = saleDate(sale);
      return date >= currentRange.start && date <= currentRange.end;
    });
    const priorSales = (report?.sales?.bills || []).filter((sale) => {
      const date = saleDate(sale);
      return date >= previous.start && date <= previous.end;
    });
    const salesTotal = sales.reduce((sum, sale) => sum + billTotal(sale), 0);
    const priorTotal = priorSales.reduce((sum, sale) => sum + billTotal(sale), 0);
    const payments = sales.reduce((totals, sale) => {
      const split = paymentTotals(sale);
      totals.cash += split.cash; totals.upi += split.upi; totals.card += split.card; totals.pending += split.pending;
      return totals;
    }, { cash: 0, upi: 0, card: 0, pending: 0 });
    const periodExpenses = expenses.filter((expense) => {
      const date = new Date(expense.date);
      return date >= currentRange.start && date <= currentRange.end;
    });
    const expenseTotal = periodExpenses.reduce((sum, expense) => sum + amount(expense.amount), 0);
    const stockValue = (inventory.items || []).reduce((sum, item) => sum + amount(item.quantity) * amount(item.cost ?? item.unitCost ?? item.averageCost), 0);
    const lowStock = (inventory.items || []).filter((item) => amount(item.quantity) > 0 && amount(item.quantity) <= amount(item.reorderLevel));
    const outOfStock = (inventory.items || []).filter((item) => amount(item.quantity) <= 0);
    const itemSales = {};
    sales.forEach((sale) => (sale.items || []).forEach((item) => {
      const name = item.name || item.itemName || "Unknown item";
      itemSales[name] = (itemSales[name] || 0) + amount(item.quantity || 1);
    }));
    const topItems = Object.entries(itemSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const grouped = {};
    sales.forEach((sale) => {
      const key = saleDate(sale).toISOString().slice(0, 10);
      grouped[key] = (grouped[key] || 0) + billTotal(sale);
    });
    const chart = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
    const max = Math.max(...chart.map(([, value]) => value), 1);
    const periodOrders = orders.filter((order) => {
      const date = new Date(order.placedAt);
      return date >= currentRange.start && date <= currentRange.end;
    });
    return { currentRange, sales, salesTotal, priorTotal, payments, expenseTotal, stockValue, lowStock, outOfStock, topItems, chart, max, periodOrders };
  }, [range, customFrom, customTo, report, inventory, orders, expenses]);

  const priorExpense = expenses.reduce((sum, expense) => sum + amount(expense.amount), 0) / Math.max(expenses.length ? 30 : 1, 1);
  const stats = [
    ["Today's total sales", CURRENCY.format(view.salesTotal), percentChange(view.salesTotal, view.priorTotal), AccountBalanceWalletRoundedIcon, "gold"],
    ["Today's orders", String(view.sales.length), percentChange(view.sales.length, view.periodOrders.length), ReceiptLongRoundedIcon, "orange"],
    ["Total customers", String(customers.length), 0, PeopleRoundedIcon, "navy"],
    ["Today's profit", CURRENCY.format(view.salesTotal - view.expenseTotal), percentChange(view.salesTotal - view.expenseTotal, priorExpense), TrendingUpRoundedIcon, "green"],
    ["Today's expenses", CURRENCY.format(view.expenseTotal), 0, WalletRoundedIcon, "orange"],
    ["Pending payments", CURRENCY.format(view.payments.pending), 0, ShoppingBagRoundedIcon, "navy"],
    ["Cash collection", CURRENCY.format(view.payments.cash), 0, AccountBalanceWalletRoundedIcon, "green"],
    ["UPI collection", CURRENCY.format(view.payments.upi), 0, CreditCardRoundedIcon, "gold"],
    ["Card collection", CURRENCY.format(view.payments.card), 0, CreditCardRoundedIcon, "orange"],
    ["Available stock value", CURRENCY.format(view.stockValue), 0, Inventory2RoundedIcon, "navy"],
  ];
  const paymentMax = Math.max(view.payments.cash, view.payments.upi, view.payments.card, 1);
  const orderTypes = view.periodOrders.reduce((result, order) => {
    const type = String(order.type || "Other").toLowerCase();
    result[type.includes("dine") ? "Dine-in" : type.includes("take") ? "Takeaway" : "Delivery"] += 1;
    return result;
  }, { "Dine-in": 0, Takeaway: 0, Delivery: 0 });

  return (
    <Box className="dashboard-page app-content-width">
      <Box className="dashboard-hero">
        <Box><Chip label="RESTAURANT ANALYTICS" size="small" /><Typography component="h1">Good to see you, {user?.name?.split(" ")[0] || "Admin"}</Typography><Typography>Monitor sales, orders, collections and inventory in real time.</Typography></Box>
        <Box className="dashboard-range-controls">
          <FormControl size="small"><Select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Dashboard date range">
            {RANGE_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </Select></FormControl>
          {range === "custom" && <><TextField type="date" size="small" label="From" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField type="date" size="small" label="To" value={customTo} onChange={(event) => setCustomTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></>}
        </Box>
      </Box>

      {loading && <Box className="dashboard-state"><CircularProgress size={32} /><Typography>Loading analytics…</Typography></Box>}
      {!loading && error && <Alert severity="error" action={<Chip label="Retry" onClick={load} />}>{error}</Alert>}

      {!loading && <><Box className="dashboard-stats">{stats.map(([label, value, comparison, icon, tone]) => <StatCard key={label} label={label} value={value} comparison={comparison} icon={icon} tone={tone} />)}</Box>
        <Box className="dashboard-analytics-grid">
          <Card className="dashboard-chart-card" elevation={0}><CardContent><Box className="dashboard-chart-card__heading"><Box><Typography component="h2">Sales trend</Typography><Typography>Revenue within the selected period</Typography></Box><TrendingUpRoundedIcon /></Box>
            {view.chart.length ? <Box className="dashboard-bar-chart">{view.chart.map(([date, value]) => <Box className="dashboard-bar-chart__item" key={date}><span>{CURRENCY.format(value)}</span><Box className="dashboard-bar-chart__bar" style={{ height: `${Math.max(8, value / view.max * 100)}%` }} /><Typography>{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Typography></Box>)}</Box> : <Box className="dashboard-no-data">No sales recorded for this period.</Box>}
          </CardContent></Card>
          <Card className="dashboard-chart-card" elevation={0}><CardContent><Typography component="h2">Payment collection</Typography><Typography className="dashboard-chart-card__subtitle">Cash, UPI and card totals</Typography>
            <Box className="dashboard-payment-bars">{[["Cash", view.payments.cash, "cash"], ["UPI", view.payments.upi, "upi"], ["Card", view.payments.card, "card"]].map(([label, value, tone]) => <Box key={label}><Box><Typography>{label}</Typography><strong>{CURRENCY.format(value)}</strong></Box><Box className="dashboard-payment-track"><span className={`is-${tone}`} style={{ width: `${value / paymentMax * 100}%` }} /></Box></Box>)}</Box>
          </CardContent></Card>
        </Box>

        <Box className="dashboard-secondary-grid">
          <Card className="dashboard-table-card" elevation={0}><Box className="dashboard-card-heading"><Box><Typography component="h2">Recent orders</Typography><Typography>Latest sales activity</Typography></Box></Box><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Order</TableCell><TableCell>Customer</TableCell><TableCell>Status</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody>{recent.length ? recent.slice(0, 8).map((sale) => <TableRow key={sale.id || sale.billNumber}><TableCell>{sale.billNumber || sale.id || "—"}</TableCell><TableCell>{sale.customerName || sale.customer?.name || "Walk-in"}</TableCell><TableCell><Chip size="small" label={sale.status || "Completed"} /></TableCell><TableCell align="right">{CURRENCY.format(billTotal(sale))}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} align="center">No recent transactions</TableCell></TableRow>}</TableBody></Table></TableContainer></Card>
          <Card className="dashboard-side-card" elevation={0}><Typography component="h2">Order mix</Typography><Box className="dashboard-order-list">{Object.entries(orderTypes).map(([label, count]) => <Box key={label}><Typography>{label}</Typography><strong>{count}</strong></Box>)}</Box></Card>
          <Card className="dashboard-side-card" elevation={0}><Typography component="h2">Inventory alerts</Typography><Box className="dashboard-inventory-alerts"><Box><span>{view.lowStock.length}</span><Typography>Low stock</Typography></Box><Box><span>{view.outOfStock.length}</span><Typography>Out of stock</Typography></Box></Box></Card>
        </Box>

        <Box className="dashboard-secondary-grid dashboard-secondary-grid--wide">
          <Card className="dashboard-table-card" elevation={0}><Box className="dashboard-card-heading"><Box><Typography component="h2">Top-selling items</Typography><Typography>By quantity in the selected period</Typography></Box></Box><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Quantity</TableCell></TableRow></TableHead><TableBody>{view.topItems.length ? view.topItems.map(([name, quantity]) => <TableRow key={name}><TableCell>{name}</TableCell><TableCell align="right">{quantity}</TableCell></TableRow>) : <TableRow><TableCell colSpan={2} align="center">No menu sales in this period</TableCell></TableRow>}</TableBody></Table></TableContainer></Card>
          <Card className="dashboard-side-card" elevation={0}><Typography component="h2">Stock alerts</Typography>{view.lowStock.length || view.outOfStock.length ? [...view.lowStock, ...view.outOfStock].slice(0, 6).map((item) => <Box className="dashboard-stock-row" key={item.id || item.name}><Typography>{item.name}</Typography><Chip size="small" color={amount(item.quantity) <= 0 ? "error" : "warning"} label={`${amount(item.quantity)} ${item.unit || ""}`} /></Box>) : <Typography className="dashboard-no-data">No stock alerts.</Typography>}</Card>
        </Box>
      </>}
    </Box>
  );
}
