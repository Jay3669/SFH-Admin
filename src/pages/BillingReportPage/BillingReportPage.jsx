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
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { getBillingReport } from "../../services/billingReport";
import { closeCashDrawer, getCashDrawerSessions } from "../../services/cashDrawer";
import { recordPurchasePayment, receivePurchase } from "../../services/inventoryService";
import { voidPosSale } from "../../services/posService";
import { formatDate, formatDateTime } from "../../utils/dateTimeFormat";
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
  { value: "voided", label: "Voided" },
];
const EMPTY_BILLS = [];

function displayDate(value) {
  if (!value) return "—";
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatDate(value, undefined, { timeZone: "Asia/Kolkata" })
    : formatDateTime(value, undefined, { timeZone: "Asia/Kolkata" });
}

function purchasePaymentStatus(purchase) {
  if (purchase.status === "Cancelled") return "Cancelled";
  return purchase.due > 0 ? "Pending" : "Cleared";
}

function isVoidedSale(sale) {
  return /^(voided|void|cancelled)$/i.test(sale.status || "");
}

function summarizeDayClose(report) {
  const bills = report?.sales?.bills || [];
  const voidBills = bills.filter((sale) => /void|cancel/i.test(sale.status || ""));
  const validBills = bills.filter((sale) => !/void|cancel/i.test(sale.status || ""));
  const tenders = { Cash: 0, Card: 0, UPI: 0 };
  validBills.forEach((sale) => {
    if (sale.tenders?.length) {
      sale.tenders.forEach((tender) => {
        const method = tender.method in tenders ? tender.method : "";
        if (method) {
          const amount = Number(tender.amount) || 0;
          tenders[method] += method === "Cash" ? Math.max(0, amount - (Number(sale.changeDue) || 0)) : amount;
        }
      });
    } else {
      const method = sale.paymentMethod in tenders ? sale.paymentMethod : "";
      if (method) tenders[method] += Number(sale.amountPaid ?? sale.total) || 0;
    }
  });
  const grossSales = validBills.reduce((sum, sale) => sum + (Number(sale.subtotal) || 0), 0);
  const discounts = validBills.reduce((sum, sale) => sum + (Number(sale.discount) || 0), 0);
  return {
    grossSales,
    netSales: Math.max(0, grossSales - discounts),
    taxes: validBills.reduce((sum, sale) => sum + (Number(sale.tax) || 0), 0),
    discounts,
    voidCount: voidBills.length,
    voidTotal: voidBills.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
    tenders,
  };
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
      {sale.voidAudit && (
        <>
          <Typography className="billing-report__detail-heading">Void audit</Typography>
          <Box className="billing-report__detail-grid">
            <DetailRow label="Reason" value={sale.voidAudit.reason} />
            <DetailRow label="Previous status" value={sale.voidAudit.previousStatus} />
            <DetailRow label="Amount" value={CURRENCY.format(sale.voidAudit.amount)} />
            <DetailRow label="Voided at" value={displayDate(sale.voidAudit.voidedAt)} />
            <DetailRow label="Requested by" value={sale.voidAudit.requestedBy} />
            <DetailRow label="Approved by" value={sale.voidAudit.approvedBy} />
          </Box>
        </>
      )}
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
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPin, setVoidPin] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [purchaseAction, setPurchaseAction] = useState("");
  const [actionAmount, setActionAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [zReportOpen, setZReportOpen] = useState(false);
  const [zReport, setZReport] = useState(null);
  const [zDrawer, setZDrawer] = useState(null);
  const [zReportLoading, setZReportLoading] = useState(false);
  const [zReportError, setZReportError] = useState("");
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);
  const [physicalCash, setPhysicalCash] = useState("");
  const [cashTaken, setCashTaken] = useState("0");
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingError, setClosingError] = useState("");

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
    if (salesFilter === "voided") return isVoidedSale(sale);
    return salesFilter === "paid" ? sale.status === "Paid" : sale.status === "Partially paid";
  }), [sales, salesFilter]);
  const zTotals = useMemo(() => summarizeDayClose(zReport), [zReport]);

  async function openZReport() {
    setZReportOpen(true);
    setZReportLoading(true);
    setZReportError("");
    try {
      const [dailyReport, drawers] = await Promise.all([
        getBillingReport("daily"),
        getCashDrawerSessions(),
      ]);
      setZReport(dailyReport);
      setZDrawer(drawers.find((drawer) => drawer.date === dailyReport.from && drawer.status === "open")
        || drawers.find((drawer) => drawer.date === dailyReport.from)
        || null);
      setPhysicalCash("");
      setCashTaken("0");
    } catch (loadError) {
      setZReportError(loadError.message || "Unable to load the day-close report.");
    } finally {
      setZReportLoading(false);
    }
  }

  async function finalizeCashierShift() {
    const actualCash = Number(physicalCash);
    const taken = Number(cashTaken);
    if (!zDrawer || zDrawer.status !== "open") {
      setClosingError("There is no open cashier shift to finalize.");
      return;
    }
    if (!physicalCash.trim() || !cashTaken.trim() || !Number.isFinite(actualCash) || actualCash < 0
      || !Number.isFinite(taken) || taken < 0 || taken > actualCash) {
      setClosingError("Enter a valid physical count and cash-taken amount no greater than the count.");
      return;
    }
    setClosingBusy(true);
    setClosingError("");
    try {
      await closeCashDrawer(zDrawer.id, { actualCash, cashTaken: taken });
      setCloseConfirmationOpen(false);
      setNotice("Cashier shift closed. This does not lock the restaurant-wide business day.");
      try {
        const drawers = await getCashDrawerSessions();
        setZDrawer(drawers.find((drawer) => drawer.id === zDrawer.id) || null);
      } catch (refreshError) {
        setZReportError(`Shift was closed, but the drawer summary could not refresh: ${refreshError.message}`);
      }
    } catch (closeError) {
      setClosingError(closeError.message || "Unable to close the cashier shift.");
    } finally {
      setClosingBusy(false);
    }
  }

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

  async function submitVoidSale(event) {
    event.preventDefault();
    if (!voidingSale) return;
    const reason = voidReason.trim();
    if (!reason) {
      setVoidError("Enter a reason for voiding this bill.");
      return;
    }
    if (!/^\d{4}$/.test(voidPin)) {
      setVoidError("Enter the supervisor's 4-digit PIN.");
      return;
    }
    setVoidLoading(true);
    setVoidError("");
    try {
      await voidPosSale(voidingSale.id, { reason, pin: voidPin });
      setVoidingSale(null);
      setSelectedSale(null);
      setVoidReason("");
      setVoidPin("");
      setNotice(`${voidingSale.billNumber} was voided and recorded in the audit trail.`);
      setReloadKey((current) => current + 1);
    } catch (voidFailure) {
      setVoidError(voidFailure.message || "Unable to void this bill.");
    } finally {
      setVoidLoading(false);
    }
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
        <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={openZReport}>Z report &amp; day close</Button>
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
            <Card elevation={0}><CardContent><Typography>Sales total</Typography><Typography component="p">{CURRENCY.format(report.sales.total)}</Typography><Typography>{report.sales.count} active · {sales.filter(isVoidedSale).length} voided bills</Typography></CardContent></Card>
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
                        {filter.label} ({filter.value === "all" ? sales.length : filter.value === "voided" ? sales.filter(isVoidedSale).length : sales.filter((sale) => filter.value === "paid" ? sale.status === "Paid" : sale.status === "Partially paid").length})
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
        <DialogActions>
          {selectedSale && !isVoidedSale(selectedSale) && (
            <Button color="error" onClick={() => {
              setVoidingSale(selectedSale);
              setVoidReason("");
              setVoidPin("");
              setVoidError("");
            }}>Void bill</Button>
          )}
          <Button onClick={() => setSelectedSale(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(voidingSale)} onClose={() => { if (!voidLoading) setVoidingSale(null); }} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitVoidSale}>
          <DialogTitle>Void sales bill</DialogTitle>
          <DialogContent className="billing-report__dialog-content">
            {voidError && <Alert severity="error">{voidError}</Alert>}
            <Typography>{voidingSale?.billNumber} · {CURRENCY.format(voidingSale?.total || 0)}</Typography>
            <TextField
              autoFocus
              required
              fullWidth
              multiline
              minRows={2}
              label="Reason for void"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <TextField
              required
              fullWidth
              type="password"
              label="Supervisor PIN"
              value={voidPin}
              onChange={(event) => setVoidPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4, pattern: "\\d{4}" } }}
            />
            <Alert severity="warning">This records a void and excludes the bill from sales totals. Any cash refund must be reconciled separately.</Alert>
          </DialogContent>
          <DialogActions>
            <Button disabled={voidLoading} onClick={() => setVoidingSale(null)}>Cancel</Button>
            <Button disabled={voidLoading || !voidReason.trim() || !/^\d{4}$/.test(voidPin)} type="submit" variant="contained" color="error">
              {voidLoading ? "Voiding…" : "Confirm void"}
            </Button>
          </DialogActions>
        </Box>
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

      <Dialog open={zReportOpen} onClose={() => { if (!closingBusy) setZReportOpen(false); }} fullWidth maxWidth="sm">
        <DialogTitle>Day-close Z report</DialogTitle>
        <DialogContent className="billing-report__dialog-content">
          {zReportError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={openZReport}>Retry</Button>}>{zReportError}</Alert>}
          {zReportLoading ? <Box className="billing-report__loading"><CircularProgress size={26} /><Typography>Loading day totals…</Typography></Box> : zReport && (
            <Box className="billing-report__z-receipt">
              <Typography component="h2">Daily reconciliation</Typography>
              <Typography className="billing-report__z-date">{displayDate(zReport.from)} · {zReport.sales.count} sale bills</Typography>
              <DetailRow label="Gross sales" value={CURRENCY.format(zTotals.grossSales)} />
              <DetailRow label="Discounts" value={`− ${CURRENCY.format(zTotals.discounts)}`} />
              <DetailRow label="Net sales" value={CURRENCY.format(zTotals.netSales)} />
              <DetailRow label="Taxes collected" value={CURRENCY.format(zTotals.taxes)} />
              <Typography className="billing-report__detail-heading">Tender breakdown</Typography>
              {Object.entries(zTotals.tenders).map(([method, totalAmount]) => (
                <DetailRow key={method} label={method} value={CURRENCY.format(totalAmount)} />
              ))}
              <Typography className="billing-report__detail-heading">Voids / losses</Typography>
              <DetailRow label={`${zTotals.voidCount} void or cancelled bills`} value={CURRENCY.format(zTotals.voidTotal)} />
              <Typography className="billing-report__detail-heading">Cash drawer reconciliation</Typography>
              {zDrawer ? (
                <>
                  <DetailRow label="Cashier shift" value={`${zDrawer.cashierName || "Cashier"} · ${zDrawer.status}`} />
                  <DetailRow label="System cash expected" value={CURRENCY.format(zDrawer.expectedCash)} />
                  <DetailRow
                    label={zDrawer.status === "closed" ? "Physical cash counted" : "Physical cash"}
                    value={zDrawer.actualCash === null ? "Count during shift close" : CURRENCY.format(zDrawer.actualCash)}
                  />
                  {zDrawer.status === "closed" && <DetailRow label="Cash variance" value={CURRENCY.format(zDrawer.variance || 0)} />}
                </>
              ) : <Typography className="billing-report__empty">No cashier shift was found for this business date.</Typography>}
              <Alert severity="warning">Closing a cashier shift does not lock sales or other shifts for the restaurant-wide business day.</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="billing-report__z-actions">
          <Button startIcon={<PrintRoundedIcon />} onClick={() => window.print()} disabled={!zReport || zReportLoading}>Print Z-Chit</Button>
          <Button onClick={() => window.print()} disabled={!zReport || zReportLoading}>Export / Save as PDF</Button>
          {zDrawer?.status === "open" && <Button variant="contained" onClick={() => { setClosingError(""); setCloseConfirmationOpen(true); }}>Finalize cashier shift</Button>}
          <Button onClick={() => setZReportOpen(false)} disabled={closingBusy}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeConfirmationOpen} onClose={() => { if (!closingBusy) setCloseConfirmationOpen(false); }} fullWidth maxWidth="xs">
        <DialogTitle>Confirm cashier shift close</DialogTitle>
        <DialogContent className="billing-report__dialog-content">
          <Alert severity="warning">This closes only {zDrawer?.cashierName || "the current cashier"}’s shift. It does not lock the business day or stop other cashiers from trading.</Alert>
          <DetailRow label="System cash expected" value={CURRENCY.format(zDrawer?.expectedCash || 0)} />
          <TextField autoFocus required fullWidth type="number" label="Physical cash counted (₹)" value={physicalCash} onChange={(event) => setPhysicalCash(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          <TextField required fullWidth type="number" label="Cash taken / deposit (₹)" value={cashTaken} onChange={(event) => setCashTaken(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          {physicalCash !== "" && <DetailRow label="Variance" value={CURRENCY.format(Number(physicalCash) - Number(zDrawer?.expectedCash || 0))} />}
          {closingError && <Alert severity="error">{closingError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseConfirmationOpen(false)} disabled={closingBusy}>Cancel</Button>
          <Button variant="contained" color="error" disabled={closingBusy} onClick={finalizeCashierShift}>{closingBusy ? "Closing…" : "Confirm shift close"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
