import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import LockClockOutlinedIcon from "@mui/icons-material/LockClockOutlined";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import { getBillingReport } from "../../services/billingReport";
import { getCashDrawerSessions, saveCashDrawerSessions } from "../../services/cashDrawer";
import "./CashDrawerPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function id() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCashSalesTotal(report) {
  return (report?.sales?.bills || []).reduce((total, sale) => {
    if (["cancelled", "void"].includes(String(sale.status || "").toLowerCase())) return total;
    const changeDue = Math.max(0, Number(sale.changeDue) || 0);
    if (Array.isArray(sale.tenders)) {
      const cashTender = sale.tenders
        .filter((tender) => String(tender.method || "").toLowerCase() === "cash")
        .reduce((sum, tender) => sum + Math.max(0, Number(tender.amount) || 0), 0);
      return total + Math.max(0, cashTender - Math.min(changeDue, cashTender));
    }
    if (String(sale.paymentMethod || "").toLowerCase() !== "cash") return total;
    const paid = Number.isFinite(Number(sale.amountPaid)) ? Number(sale.amountPaid) : Number(sale.total) || 0;
    return total + Math.max(0, paid - Math.min(changeDue, paid));
  }, 0);
}

function movementTotals(movements = []) {
  return movements.reduce((totals, movement) => {
    totals[movement.direction] += Number(movement.amount);
    return totals;
  }, { in: 0, out: 0 });
}

function expectedCash(session, cashSales) {
  const totals = movementTotals(session?.movements);
  return Math.max(0, Number(session?.openingAmount || 0) + cashSales + totals.in - totals.out);
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <Card className={`cash-drawer__stat is-${tone}`} elevation={0}>
      <Box className="cash-drawer__stat-icon"><Icon /></Box>
      <Box><Typography>{label}</Typography><strong>{value}</strong><span>{detail}</span></Box>
    </Card>
  );
}

function CashMovementDialog({ open, draft, setDraft, error, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Record cash movement</DialogTitle>
      <DialogContent className="cash-drawer__dialog-content">
        <Typography className="cash-drawer__dialog-note">Record cash added to the drawer or cash paid out. This adjusts the expected closing balance.</Typography>
        <Box className="cash-drawer__movement-types">
          <Button className={draft.direction === "in" ? "is-selected" : ""} startIcon={<ArrowDownwardRoundedIcon />} onClick={() => setDraft({ ...draft, direction: "in" })}>Cash in</Button>
          <Button className={draft.direction === "out" ? "is-selected" : ""} startIcon={<ArrowUpwardRoundedIcon />} onClick={() => setDraft({ ...draft, direction: "out" })}>Cash out</Button>
        </Box>
        <TextField autoFocus required type="number" label="Amount (₹)" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }} />
        <TextField required label="Reason" placeholder="e.g. Petty cash purchase" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave}>Save movement</Button></DialogActions>
    </Dialog>
  );
}

function CloseDrawerDialog({ open, counted, setCounted, taken, setTaken, expected, error, onClose, onSave }) {
  const countedAmount = Number(counted);
  const pickupAmount = Number(taken);
  const variance = Number.isFinite(countedAmount) ? countedAmount - expected : 0;
  const retained = Number.isFinite(countedAmount) && Number.isFinite(pickupAmount) ? countedAmount - pickupAmount : 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Close today&apos;s cash drawer</DialogTitle>
      <DialogContent className="cash-drawer__dialog-content">
        <Typography className="cash-drawer__dialog-note">Count the physical cash, then record how much you are taking out of the drawer for safe keeping or deposit.</Typography>
        <Box className="cash-drawer__close-summary">
          <Box><span>Expected cash</span><strong>{CURRENCY.format(expected)}</strong></Box>
          <Box><span>Count variance</span><strong className={variance === 0 ? "" : variance < 0 ? "is-short" : "is-over"}>{CURRENCY.format(variance)}</strong></Box>
        </Box>
        <TextField autoFocus required type="number" label="Physical cash counted (₹)" value={counted} onChange={(event) => setCounted(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
        <TextField required type="number" label="Cash taken out / bank deposit (₹)" value={taken} onChange={(event) => setTaken(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
        <Alert severity="info">Cash remaining in drawer after pickup: {CURRENCY.format(Math.max(0, retained))}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography className="cash-drawer__dialog-note">Closing the drawer is final for this date. Check the count and pickup amount before confirming.</Typography>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button color="primary" variant="contained" onClick={onSave}>Confirm close &amp; record cash taken</Button></DialogActions>
    </Dialog>
  );
}

export default function CashDrawerPage() {
  const [sessions, setSessions] = useState([]);
  const [cashDate, setCashDate] = useState(localDate);
  const [reportDate, setReportDate] = useState("");
  const [cashSales, setCashSales] = useState(0);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingError, setOpeningError] = useState("");
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementDraft, setMovementDraft] = useState({ direction: "out", amount: "", description: "" });
  const [movementError, setMovementError] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingCount, setClosingCount] = useState("");
  const [cashTaken, setCashTaken] = useState("");
  const [closeError, setCloseError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReportLoaded(false);
    setReportError("");
    setStorageError("");
    try {
      setSessions(getCashDrawerSessions());
    } catch (loadError) {
      setStorageError(loadError.message || "Unable to load cash-drawer sessions.");
    }
    getBillingReport("daily")
      .then((report) => {
        if (!active) return;
        const reportDate = String(report.to || localDate()).slice(0, 10);
        setCashDate(reportDate);
        setReportDate(reportDate);
        setCashSales(getCashSalesTotal(report));
        setReportLoaded(true);
      })
      .catch((loadError) => {
        if (active) setReportError(loadError.message || "Unable to load today's cash sales.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const session = sessions.find((entry) => entry.date === cashDate) || null;
  const drawerOpen = session?.status === "open";
  const isClosed = session?.status === "closed";
  const reportMatchesDate = reportLoaded && reportDate === cashDate;
  const sessionCashSales = reportMatchesDate
    ? cashSales
    : Number(session?.cashSalesAtClose ?? session?.cashSalesAtOpen ?? 0);
  const totals = useMemo(() => movementTotals(session?.movements), [session]);
  const expected = session ? expectedCash(session, sessionCashSales) : 0;
  const closingVariance = isClosed ? Number(session.closingCount) - Number(session.expectedAtClose) : 0;
  const retainedCash = isClosed ? Number(session.closingCount) - Number(session.cashTaken) : 0;

  function persist(nextSessions, message) {
    try {
      saveCashDrawerSessions(nextSessions);
      setSessions(nextSessions);
      setError("");
      setStorageError("");
      setNotice(message);
      return true;
    } catch (saveError) {
      setError(saveError.message || "Unable to save cash-drawer data.");
      return false;
    }
  }

  function openDrawer() {
    const value = Number(openingAmount);
    if (!reportMatchesDate) {
      setOpeningError("Load today's sales report before opening the drawer so cash sales can be reconciled.");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setOpeningError("Enter an opening cash amount of zero or more.");
      return;
    }
    if (sessions.some((entry) => entry.date === cashDate)) {
      setOpeningError("A drawer session already exists for this date.");
      return;
    }
    const nextSession = {
      id: id(),
      date: cashDate,
      openingAmount: value,
      cashSalesAtOpen: cashSales,
      openedAt: new Date().toISOString(),
      status: "open",
      movements: [],
    };
    if (persist([...sessions, nextSession], `Cash drawer opened with ${CURRENCY.format(value)}.`)) setOpeningDialogOpen(false);
  }

  function addMovement() {
    const value = Number(movementDraft.amount);
    const description = movementDraft.description.trim();
    if (!Number.isFinite(value) || value <= 0 || !description) {
      setMovementError("Enter an amount greater than zero and a reason for the cash movement.");
      return;
    }
    if (!reportMatchesDate) {
      setMovementError("Refresh the daily sales report for this business date before recording cash movements.");
      return;
    }
    const currentExpected = expectedCash(session, sessionCashSales);
    if (movementDraft.direction === "out" && value > currentExpected) {
      setMovementError("Cash paid out cannot exceed the expected cash currently in the drawer.");
      return;
    }
    const movement = {
      id: id(),
      direction: movementDraft.direction,
      amount: value,
      description,
      at: new Date().toISOString(),
    };
    const updated = { ...session, cashSalesAtOpen: cashSales, movements: [...session.movements, movement] };
    if (persist(sessions.map((entry) => entry.id === session.id ? updated : entry), "Cash movement recorded.")) setMovementDialogOpen(false);
  }

  function closeDrawer() {
    const counted = Number(closingCount);
    const taken = Number(cashTaken);
    if (!reportMatchesDate) {
      setCloseError("Refresh the daily sales report for this business date before closing the drawer.");
      return;
    }
    if (!Number.isFinite(counted) || counted < 0 || !Number.isFinite(taken) || taken < 0) {
      setCloseError("Enter valid non-negative amounts for the physical count and cash taken.");
      return;
    }
    if (taken > counted) {
      setCloseError("Cash taken out cannot exceed the physical cash counted.");
      return;
    }
    const closedAt = new Date().toISOString();
    const updated = {
      ...session,
      status: "closed",
      closedAt,
      closingCount: counted,
      cashTaken: taken,
      expectedAtClose: expected,
      cashSalesAtClose: sessionCashSales,
    };
    if (persist(sessions.map((entry) => entry.id === session.id ? updated : entry), `Drawer closed. ${CURRENCY.format(taken)} recorded as cash taken out.`)) setCloseDialogOpen(false);
  }

  function refreshSales() {
    setReloadKey((key) => key + 1);
    setNotice("");
  }

  const history = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Box className="cash-drawer app-content-width">
      <Box className="cash-drawer__heading">
        <Box><Typography className="cash-drawer__eyebrow">DAILY OPERATIONS / CASH CONTROL</Typography><Typography component="h1">Daily opening cash</Typography><Typography>Set the starting float, track cash movements, then count and take cash out at day end.</Typography></Box>
        <Box className="cash-drawer__heading-actions">
          <TextField label="Business date" type="date" value={cashDate} onChange={(event) => setCashDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={refreshSales} disabled={loading}>Refresh cash sales</Button>
        </Box>
      </Box>

      <Alert severity="info" className="cash-drawer__demo-note">Local demo: opening floats and drawer counts are stored in this browser. Cash sales come from today&apos;s sales report. This tracker does not move money or replace your accounting records.</Alert>
      {reportError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={refreshSales}>Retry</Button>}>{reportError}</Alert>}
      {storageError && <Alert severity="error">{storageError}</Alert>}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {loading ? <Box className="cash-drawer__loading"><CircularProgress size={26} /><Typography>Loading today&apos;s cash and drawer session…</Typography></Box> : (
        <>
          <Box className="cash-drawer__date-strip"><Box><Typography>BUSINESS DATE</Typography><strong>{formatDate(cashDate)}</strong></Box><Box className={`cash-drawer__status${drawerOpen ? " is-open" : isClosed ? " is-closed" : ""}`}><span />{drawerOpen ? "Drawer open" : isClosed ? "Day closed" : "Not opened"}</Box></Box>

          {!reportLoaded && !reportError && <Alert severity="warning">Cash sales are still loading. Opening and closing actions are unavailable until the sales report is ready.</Alert>}
          {reportError && <Alert severity="warning">Cash sales could not be verified. Refresh the report before opening or closing this drawer.</Alert>}
          {reportLoaded && !reportMatchesDate && <Alert severity="warning">The sales report is for {formatDate(reportDate)}, not {formatDate(cashDate)}. Historical sessions are read-only here because date-specific sales are unavailable.</Alert>}

          {!session && (
            <Card className="cash-drawer__start-card" elevation={0}>
              <Box className="cash-drawer__start-icon"><LockOpenRoundedIcon /></Box>
              <Typography component="h2">Start today&apos;s cash drawer</Typography>
              <Typography>Count the cash float you are putting into the drawer before service begins.</Typography>
              <Box className="cash-drawer__opening-preview"><span>Opening float</span><strong>{CURRENCY.format(Number(openingAmount) || 0)}</strong></Box>
              <Button variant="contained" size="large" startIcon={<LockOpenRoundedIcon />} disabled={!reportMatchesDate || Boolean(reportError) || Boolean(storageError)} onClick={() => { setOpeningAmount(""); setOpeningError(""); setOpeningDialogOpen(true); }}>Enter opening cash</Button>
            </Card>
          )}

          {session && (
            <>
              <Box className="cash-drawer__stats">
                <StatCard icon={SavingsOutlinedIcon} label="Opening cash" value={CURRENCY.format(session.openingAmount)} detail={`Started ${new Date(session.openedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`} tone="opening" />
                <StatCard icon={PointOfSaleRoundedIcon} label="Cash sales" value={CURRENCY.format(isClosed ? session.cashSalesAtClose : sessionCashSales)} detail="Sales less change returned" tone="sales" />
                <StatCard icon={ArrowDownwardRoundedIcon} label="Cash added" value={CURRENCY.format(totals.in)} detail={`${session.movements.filter((entry) => entry.direction === "in").length} cash-in entries`} tone="in" />
                <StatCard icon={PaymentsOutlinedIcon} label={isClosed ? "Expected at close" : "Expected in drawer"} value={CURRENCY.format(isClosed ? session.expectedAtClose : expected)} detail={`Cash out ${CURRENCY.format(totals.out)}`} tone="expected" />
              </Box>

              {isClosed ? (
                <Card className="cash-drawer__closed-card" elevation={0}>
                  <Box className="cash-drawer__closed-heading"><Box className="cash-drawer__closed-icon"><LockClockOutlinedIcon /></Box><Box><Typography component="h2">Day closed</Typography><Typography>Closed {new Date(session.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {formatDate(session.date)}</Typography></Box></Box>
                  <Box className="cash-drawer__reconciliation">
                    <Box><span>Expected cash</span><strong>{CURRENCY.format(session.expectedAtClose)}</strong></Box>
                    <Box><span>Physical count</span><strong>{CURRENCY.format(session.closingCount)}</strong></Box>
                    <Box><span>Variance</span><strong className={closingVariance === 0 ? "is-balanced" : closingVariance < 0 ? "is-short" : "is-over"}>{closingVariance > 0 ? "+" : ""}{CURRENCY.format(closingVariance)}</strong></Box>
                    <Box><span>Cash taken out</span><strong className="is-taken">{CURRENCY.format(session.cashTaken)}</strong></Box>
                    <Box><span>Cash left in drawer</span><strong>{CURRENCY.format(retainedCash)}</strong></Box>
                  </Box>
                  <Typography className="cash-drawer__locked-note">This drawer is closed and cannot be changed. Cash sales are saved as {CURRENCY.format(session.cashSalesAtClose)} at close.</Typography>
                </Card>
              ) : (
                <Card className="cash-drawer__live-card" elevation={0}>
                  <Box className="cash-drawer__live-heading">
                    <Box><Typography component="h2">Drawer in progress</Typography><Typography>Expected physical cash = opening float + cash sales + cash in − cash out.</Typography></Box>
                    <Box><span>EXPECTED CASH NOW</span><strong>{CURRENCY.format(expected)}</strong></Box>
                  </Box>
                  <Box className="cash-drawer__live-breakdown">
                    <Box><span>Opening float</span><strong>{CURRENCY.format(session.openingAmount)}</strong></Box>
                    <Box><span>Cash sales</span><strong>+ {CURRENCY.format(sessionCashSales)}</strong></Box>
                    <Box><span>Cash added</span><strong>+ {CURRENCY.format(totals.in)}</strong></Box>
                    <Box><span>Cash paid out</span><strong>− {CURRENCY.format(totals.out)}</strong></Box>
                  </Box>
                  <Box className="cash-drawer__live-actions">
                    <Button variant="outlined" startIcon={<AddRoundedIcon />} disabled={!reportMatchesDate || Boolean(reportError)} onClick={() => { setMovementDraft({ direction: "in", amount: "", description: "" }); setMovementError(""); setMovementDialogOpen(true); }}>Record cash movement</Button>
                    <Button variant="contained" startIcon={<LockClockOutlinedIcon />} disabled={!reportMatchesDate || Boolean(reportError)} onClick={() => { setClosingCount(""); setCashTaken(""); setCloseError(""); setCloseDialogOpen(true); }}>Close day &amp; take cash</Button>
                  </Box>
                </Card>
              )}

              <Card className="cash-drawer__activity" elevation={0}>
                <Box className="cash-drawer__section-heading"><Box><Typography component="h2">Cash drawer activity</Typography><Typography>Opening float, cash sales, and manual cash movements.</Typography></Box></Box>
                <Box className="cash-drawer__activity-list">
                  <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-opening"><LockOpenRoundedIcon /></Box><Box><strong>Opening cash</strong><span>{new Date(session.openedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></Box><strong>{CURRENCY.format(session.openingAmount)}</strong></Box>
                  <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-sales"><PointOfSaleRoundedIcon /></Box><Box><strong>Cash sales{isClosed ? " (at close)" : ""}</strong><span>Sales report · {formatDate(cashDate)}</span></Box><strong>+ {CURRENCY.format(isClosed ? session.cashSalesAtClose : sessionCashSales)}</strong></Box>
                  {session.movements.map((movement) => <Box className="cash-drawer__activity-row" key={movement.id}><Box className={`cash-drawer__activity-icon is-${movement.direction}`} >{movement.direction === "in" ? <ArrowDownwardRoundedIcon /> : <ArrowUpwardRoundedIcon />}</Box><Box><strong>{movement.description}</strong><span>{movement.direction === "in" ? "Cash added" : "Cash paid out"} · {new Date(movement.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></Box><strong className={movement.direction === "in" ? "is-in" : "is-out"}>{movement.direction === "in" ? "+" : "−"} {CURRENCY.format(movement.amount)}</strong></Box>)}
                  {isClosed && <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-taken"><ArrowUpwardRoundedIcon /></Box><Box><strong>Cash taken out / deposit</strong><span>Recorded at day close</span></Box><strong className="is-out">− {CURRENCY.format(session.cashTaken)}</strong></Box>}
                </Box>
              </Card>
            </>
          )}

          {history.length > 0 && <Card className="cash-drawer__history" elevation={0}>
            <Box className="cash-drawer__section-heading"><Box><Typography component="h2">Previous drawer sessions</Typography><Typography>Daily opening and closing records saved on this browser.</Typography></Box></Box>
            <Box className="cash-drawer__history-list">{history.filter((entry) => entry.date !== cashDate).slice(0, 7).map((entry) => <Button className="cash-drawer__history-row" key={entry.id} onClick={() => setCashDate(entry.date)}><Box><strong>{formatDate(entry.date)}</strong><span>{entry.status === "closed" ? "Closed" : "Open"} · Opening {CURRENCY.format(entry.openingAmount)}</span></Box><Box><strong>{entry.status === "closed" ? `Taken ${CURRENCY.format(entry.cashTaken)}` : "View open drawer"}</strong><span>{entry.status === "closed" ? `Variance ${CURRENCY.format(Number(entry.closingCount) - Number(entry.expectedAtClose))}` : "Session in progress"}</span></Box></Button>)}</Box>
          </Card>}
        </>
      )}

      <Dialog open={openingDialogOpen} onClose={() => setOpeningDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enter opening cash</DialogTitle>
        <DialogContent className="cash-drawer__dialog-content">
          <Typography className="cash-drawer__dialog-note">Count the cash you are putting into the till before service. Cash sales will be added to this opening float throughout the day.</Typography>
          <TextField autoFocus required type="number" label="Opening cash amount (₹)" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          <Box className="cash-drawer__opening-report"><span>Cash sales loaded</span><strong>{reportMatchesDate ? CURRENCY.format(cashSales) : "Unavailable"}</strong></Box>
          {openingError && <Alert severity="error">{openingError}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpeningDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={openDrawer}>Start drawer</Button></DialogActions>
      </Dialog>

      <CashMovementDialog open={movementDialogOpen} draft={movementDraft} setDraft={setMovementDraft} error={movementError} onClose={() => setMovementDialogOpen(false)} onSave={addMovement} />
      <CloseDrawerDialog
        open={closeDialogOpen}
        counted={closingCount}
        setCounted={setClosingCount}
        taken={cashTaken}
        setTaken={setCashTaken}
        expected={expected}
        error={closeError}
        onClose={() => setCloseDialogOpen(false)}
        onSave={closeDrawer}
      />
    </Box>
  );
}
