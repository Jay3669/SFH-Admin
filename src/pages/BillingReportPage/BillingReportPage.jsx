import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { getBillingReport } from "../../services/billingReport";
import { recordPurchasePayment, receivePurchase } from "../../services/inventoryService";
import "./BillingReportPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const PURCHASE_FILTERS = [
  { value: "all", label: "All purchases" },
  { value: "pending", label: "Pending" },
  { value: "cleared", label: "Cleared" },
  { value: "cancelled", label: "Cancelled" },
];
const SALES_FILTERS = [
  { value: "all", label: "All sales" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially paid" },
];
const EMPTY_BILLS = [];

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
}

function purchasePaymentStatus(purchase) {
  if (purchase.status === "Cancelled") return "Cancelled";
  return purchase.due > 0 ? "Pending" : "Cleared";
}

function DetailRow({ label, value }) {
  return <Box className="billing-report__detail-row"><Typography>{label}</Typography><Typography>{value}</Typography></Box>;
}

function SalesDetails({ sale }) {
  return (
    <>
      <Box className="billing-report__detail-grid">
        <DetailRow label="Bill number" value={sale.billNumber} />
        <DetailRow label="Date" value={displayDate(sale.date)} />
        <DetailRow label="Order type" value={sale.orderType || "—"} />
        <DetailRow label="Status" value={sale.status} />
      </Box>
      <Typography className="billing-report__detail-heading">Items</Typography>
      <Table size="small" aria-label="Sales bill items">
        <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead>
        <TableBody>{sale.items.map((item, index) => (
          <TableRow key={`${item.name}-${index}`}>
            <TableCell>{item.name}</TableCell>
            <TableCell align="right">{item.quantity}</TableCell>
            <TableCell align="right">{CURRENCY.format(item.total / item.quantity)}</TableCell>
            <TableCell align="right">{CURRENCY.format(item.total)}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
      <Box className="billing-report__detail-totals">
        <DetailRow label="Subtotal" value={CURRENCY.format(sale.subtotal)} />
        <DetailRow label="Discount" value={`− ${CURRENCY.format(sale.discount)}`} />
        <DetailRow label="Packaging" value={CURRENCY.format(sale.packaging)} />
        <DetailRow label="Tax" value={CURRENCY.format(sale.tax)} />
        <DetailRow label="Bill total" value={CURRENCY.format(sale.total)} />
      </Box>
      <Typography className="billing-report__detail-heading">Payments</Typography>
      {sale.tenders?.length ? sale.tenders.map((tender, index) => (
        <DetailRow key={`${tender.method}-${index}`} label={tender.method} value={CURRENCY.format(tender.amount)} />
      )) : <DetailRow label="Payment method" value={sale.paymentMethod || "—"} />}
      <Box className="billing-report__detail-totals">
        <DetailRow label="Amount paid" value={CURRENCY.format(sale.amountPaid)} />
        <DetailRow label="Change" value={CURRENCY.format(sale.changeDue)} />
        <DetailRow label="Balance due" value={CURRENCY.format(sale.balanceDue)} />
      </Box>
    </>
  );
}

function PurchaseDetails({ purchase }) {
  return (
    <>
      <Box className="billing-report__detail-grid">
        <DetailRow label="Order number" value={purchase.billNumber} />
        <DetailRow label="Invoice reference" value={purchase.invoice || "—"} />
        <DetailRow label="Supplier" value={purchase.supplier} />
        <DetailRow label="Order date" value={displayDate(purchase.date)} />
        <DetailRow label="Delivery status" value={`${purchase.status} · ${purchase.receivedQuantity} / ${purchase.quantity} ${purchase.unit}`} />
        <DetailRow label="Expiry date" value={purchase.expiry || "—"} />
      </Box>
      <Typography className="billing-report__detail-heading">Purchased item</Typography>
      <Box className="billing-report__detail-grid">
        <DetailRow label="Item" value={purchase.item} />
        <DetailRow label="Quantity" value={`${purchase.quantity} ${purchase.unit}`} />
        <DetailRow label="Unit price" value={CURRENCY.format(purchase.unitPrice)} />
        <DetailRow label="Purchase total" value={CURRENCY.format(purchase.total)} />
      </Box>
      <Typography className="billing-report__detail-heading">Payments</Typography>
      {purchase.payments?.length ? purchase.payments.map((payment, index) => (
        <DetailRow key={`${payment.date}-${index}`} label={`${displayDate(payment.date)}${payment.reference ? ` · ${payment.reference}` : ""}`} value={CURRENCY.format(payment.amount)} />
      )) : <Typography className="billing-report__empty">No payments recorded.</Typography>}
      <Box className="billing-report__detail-totals">
        <DetailRow label="Paid" value={CURRENCY.format(purchase.paidAmount)} />
        <DetailRow label="Outstanding" value={CURRENCY.format(purchase.due)} />
        <DetailRow label="Payment status" value={purchasePaymentStatus(purchase)} />
      </Box>
    </>
  );
}

export default function BillingReportPage({ onNavigate }) {
  const [period, setPeriod] = useState("daily");
  const [tab, setTab] = useState("purchases");
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [purchaseAction, setPurchaseAction] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    getBillingReport(period)
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load the billing report.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [period, reloadKey]);

  const purchases = report?.purchases.bills || EMPTY_BILLS;
  const sales = report?.sales.bills || EMPTY_BILLS;
  const filteredPurchases = useMemo(() => purchases.filter((purchase) => {
    if (purchaseFilter === "all") return true;
    if (purchaseFilter === "cancelled") return purchase.status === "Cancelled";
    return purchasePaymentStatus(purchase).toLowerCase() === purchaseFilter;
  }), [purchases, purchaseFilter]);
  const filteredSales = useMemo(() => sales.filter((sale) => {
    if (salesFilter === "all") return true;
    return salesFilter === "paid" ? sale.status === "Paid" : sale.status === "Partially paid";
  }), [sales, salesFilter]);

  async function submitPurchaseAction(event) {
    event.preventDefault();
    if (!selectedPurchase) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (purchaseAction === "payment") {
        await recordPurchasePayment(selectedPurchase.id, actionAmount, paymentReference);
        setNotice("Supplier payment recorded.");
      } else {
        await receivePurchase(selectedPurchase.id, Number(actionAmount));
        setNotice("Purchase delivery received and stock updated.");
      }
      setPurchaseAction("");
      setSelectedPurchase(null);
      setReloadKey((current) => current + 1);
    } catch (actionFailure) {
      setActionError(actionFailure.message || "Unable to complete the purchase action.");
    } finally {
      setActionLoading(false);
    }
  }

  function openPurchaseAction(action) {
    setPurchaseAction(action);
    setActionAmount(action === "payment"
      ? String(selectedPurchase.due)
      : String(selectedPurchase.quantity - selectedPurchase.receivedQuantity));
    setPaymentReference("");
    setActionError("");
  }

  return (
    <Box className="billing-report app-content-width">
      <Box className="billing-report__intro">
        <Box>
          <Chip label="PURCHASES & SALES" size="small" />
          <Typography component="h1">Bills & totals</Typography>
          <Typography>Review purchase and sales bills by day, week, or month.</Typography>
        </Box>
        <ToggleButtonGroup exclusive size="small" value={period} aria-label="Report period" onChange={(_, value) => { if (value) setPeriod(value); }}>
          {PERIODS.map((option) => <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshRoundedIcon />} onClick={() => setReloadKey((current) => current + 1)}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {loading ? (
        <Box className="billing-report__loading"><CircularProgress size={28} /><Typography>Loading bills…</Typography></Box>
      ) : report && (
        <>
          <Typography className="billing-report__range">{displayDate(report.from)} – {displayDate(report.to)}</Typography>
          <Box className="billing-report__totals">
            <Card elevation={0}><CardContent><Typography>Purchase total</Typography><Typography component="p">{CURRENCY.format(report.purchases.total)}</Typography><Typography>{report.purchases.count} active purchases</Typography></CardContent></Card>
            <Card elevation={0}><CardContent><Typography>Sales total</Typography><Typography component="p">{CURRENCY.format(report.sales.total)}</Typography><Typography>{report.sales.count} sales bills</Typography></CardContent></Card>
            <Card className="billing-report__grand" elevation={0}><CardContent><Typography>Grand total · purchases + sales</Typography><Typography component="p">{CURRENCY.format(report.grandTotal)}</Typography><Typography>{report.purchases.count + report.sales.count} active bills</Typography></CardContent></Card>
          </Box>
          <Card className="billing-report__list" elevation={0}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Purchases and sales">
              <Tab value="purchases" label={`Purchases (${purchases.length})`} />
              <Tab value="sales" label={`Sales (${sales.length})`} />
            </Tabs>
            <Box className="billing-report__tab-action">
            <Button variant="contained" size="small" onClick={() => onNavigate?.(tab === "purchases" ? "inventory-purchases" : "billing")}>
              {tab === "purchases" ? "New purchase" : "New sale"}
            </Button>
            </Box>
            {tab === "purchases" ? (
              <>
                <Box className="billing-report__filters" aria-label="Purchase status">
                  <ToggleButtonGroup exclusive size="small" value={purchaseFilter} onChange={(_, value) => { if (value) setPurchaseFilter(value); }}>
                    {PURCHASE_FILTERS.map((filter) => (
                      <ToggleButton key={filter.value} value={filter.value}>
                        {filter.label} ({filter.value === "all" ? purchases.length : purchases.filter((purchase) => filter.value === "cancelled" ? purchase.status === "Cancelled" : purchasePaymentStatus(purchase).toLowerCase() === filter.value).length})
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
                {filteredPurchases.length ? (
                  <Box className="billing-report__table-wrap"><Table size="small" aria-label="Purchase bills">
                    <TableHead><TableRow><TableCell>Purchase / invoice</TableCell><TableCell>Supplier / item</TableCell><TableCell>Date</TableCell><TableCell>Payment</TableCell><TableCell align="right">Total · due</TableCell></TableRow></TableHead>
                    <TableBody>{filteredPurchases.map((purchase) => (
                      <TableRow key={purchase.id} hover className="billing-report__clickable-row" onClick={() => setSelectedPurchase(purchase)}>
                        <TableCell><Button className="billing-report__row-link" onClick={() => setSelectedPurchase(purchase)}>{purchase.billNumber}</Button><Typography className="billing-report__muted">Invoice {purchase.invoice || "—"}</Typography></TableCell>
                        <TableCell>{purchase.supplier}<Typography className="billing-report__muted">{purchase.item} · {purchase.quantity} {purchase.unit}</Typography></TableCell>
                        <TableCell>{displayDate(purchase.date)}</TableCell>
                        <TableCell><Chip size="small" label={purchasePaymentStatus(purchase)} /></TableCell>
                        <TableCell align="right">{CURRENCY.format(purchase.total)}<Typography className="billing-report__muted">Due {CURRENCY.format(purchase.due)}</Typography></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table></Box>
                ) : <Typography className="billing-report__empty">No purchases match this filter and period.</Typography>}
              </>
            ) : (
              <>
                <Box className="billing-report__filters" aria-label="Sales status">
                  <ToggleButtonGroup exclusive size="small" value={salesFilter} onChange={(_, value) => { if (value) setSalesFilter(value); }}>
                    {SALES_FILTERS.map((filter) => (
                      <ToggleButton key={filter.value} value={filter.value}>
                        {filter.label} ({filter.value === "all" ? sales.length : sales.filter((sale) => filter.value === "paid" ? sale.status === "Paid" : sale.status === "Partially paid").length})
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
                {filteredSales.length ? (
                  <Box className="billing-report__table-wrap"><Table size="small" aria-label="Sales bills">
                    <TableHead><TableRow><TableCell>Bill</TableCell><TableCell>Items</TableCell><TableCell>Date</TableCell><TableCell>Payment</TableCell><TableCell align="right">Total · due</TableCell></TableRow></TableHead>
                    <TableBody>{filteredSales.map((sale) => (
                      <TableRow key={sale.id} hover className="billing-report__clickable-row" onClick={() => setSelectedSale(sale)}>
                        <TableCell><Button className="billing-report__row-link" onClick={() => setSelectedSale(sale)}>{sale.billNumber}</Button><Typography className="billing-report__muted">{sale.orderType}</Typography></TableCell>
                        <TableCell>{sale.items.map((item) => `${item.name} × ${item.quantity}`).join(", ") || "—"}</TableCell>
                        <TableCell>{displayDate(sale.date)}</TableCell>
                        <TableCell><Chip size="small" label={sale.status} /></TableCell>
                        <TableCell align="right">{CURRENCY.format(sale.total)}<Typography className="billing-report__muted">Due {CURRENCY.format(sale.balanceDue)}</Typography></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table></Box>
                ) : <Typography className="billing-report__empty">No sales match this filter and period.</Typography>}
              </>
            )}
          </Card>
        </>
      )}

      <Dialog open={Boolean(selectedPurchase) && !purchaseAction} onClose={() => setSelectedPurchase(null)} fullWidth maxWidth="sm">
        <DialogTitle>Purchase details</DialogTitle>
        <DialogContent className="billing-report__dialog-content">{selectedPurchase && <PurchaseDetails purchase={selectedPurchase} />}</DialogContent>
        <DialogActions className="billing-report__dialog-actions">
          <Button onClick={() => setSelectedPurchase(null)}>Close</Button>
          {selectedPurchase?.due > 0 && selectedPurchase?.status !== "Cancelled" && <Button onClick={() => openPurchaseAction("payment")}>Record payment</Button>}
          {selectedPurchase && ["Ordered", "Partially received"].includes(selectedPurchase.status) && selectedPurchase.quantity > selectedPurchase.receivedQuantity && <Button variant="contained" onClick={() => openPurchaseAction("receive")}>Receive remaining stock</Button>}
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(selectedSale)} onClose={() => setSelectedSale(null)} fullWidth maxWidth="sm">
        <DialogTitle>Sales bill details</DialogTitle>
        <DialogContent className="billing-report__dialog-content">{selectedSale && <SalesDetails sale={selectedSale} />}</DialogContent>
        <DialogActions><Button onClick={() => setSelectedSale(null)}>Close</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(purchaseAction)} onClose={() => { if (!actionLoading) setPurchaseAction(""); }} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitPurchaseAction}>
          <DialogTitle>{purchaseAction === "payment" ? "Record supplier payment" : "Receive purchase stock"}</DialogTitle>
          <DialogContent className="billing-report__dialog-content">
            {actionError && <Alert severity="error">{actionError}</Alert>}
            <Typography>{selectedPurchase?.billNumber} · {selectedPurchase?.supplier}</Typography>
            {purchaseAction === "payment" ? (
              <>
                <TextField autoFocus required fullWidth type="number" label="Payment amount (₹)" value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} slotProps={{ htmlInput: { min: 0.01, max: selectedPurchase?.due, step: "0.01" } }} />
                <TextField fullWidth label="Payment reference (optional)" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} />
                <Typography>Outstanding balance: {CURRENCY.format(selectedPurchase?.due || 0)}</Typography>
              </>
            ) : (
              <>
                <TextField autoFocus required fullWidth type="number" label={`Quantity (${selectedPurchase?.unit})`} value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} slotProps={{ htmlInput: { min: 0.001, max: (selectedPurchase?.quantity || 0) - (selectedPurchase?.receivedQuantity || 0), step: "any" } }} />
                <Typography>Stock is updated when the receipt is confirmed.</Typography>
              </>
            )}
          </DialogContent>
          <DialogActions><Button disabled={actionLoading} onClick={() => setPurchaseAction("")}>Cancel</Button><Button disabled={actionLoading} type="submit" variant="contained">{actionLoading ? "Saving…" : purchaseAction === "payment" ? "Save payment" : "Confirm receipt"}</Button></DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
