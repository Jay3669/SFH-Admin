import { useEffect, useMemo, useRef, useState } from "react";
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import { apiRequest } from "../../services/apiService";
import {
  addCashDrawerMovement,
  closeCashDrawer,
  getCashDrawerSessions,
  handoverCashDrawer,
  openCashDrawer,
} from "../../services/cashDrawer";
import "./CashDrawerPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
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

function movementTotals(movements = []) {
  return movements.reduce((totals, movement) => {
    totals[movement.direction] += Number(movement.amount);
    return totals;
  }, { in: 0, out: 0 });
}

function expectedCash(session) {
  const totals = movementTotals(session?.movements);
  return Math.max(0, Number(session?.openingAmount || 0) + Number(session?.cashSales || 0) + totals.in - totals.out);
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <Card className={`cash-drawer__stat is-${tone}`} elevation={0}>
      <Box className="cash-drawer__stat-icon"><Icon /></Box>
      <Box><Typography>{label}</Typography><strong>{value}</strong><span>{detail}</span></Box>
    </Card>
  );
}

function CashMovementDialog({ open, draft, setDraft, error, busy, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Record cash movement</DialogTitle>
      <DialogContent className="cash-drawer__dialog-content">
        <Typography className="cash-drawer__dialog-note">Cash outs are recorded as petty cash or payouts and adjust the expected closing balance.</Typography>
        <Box className="cash-drawer__movement-types">
          <Button className={draft.direction === "in" ? "is-selected" : ""} startIcon={<ArrowDownwardRoundedIcon />} onClick={() => setDraft({ ...draft, direction: "in" })}>Cash in</Button>
          <Button className={draft.direction === "out" ? "is-selected" : ""} startIcon={<ArrowUpwardRoundedIcon />} onClick={() => setDraft({ ...draft, direction: "out" })}>Cash out</Button>
        </Box>
        <TextField autoFocus required type="number" label="Amount (₹)" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }} />
        <TextField required label="Reason" placeholder="e.g. Petty cash purchase" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button disabled={busy} variant="contained" onClick={onSave}>Save movement</Button></DialogActions>
    </Dialog>
  );
}

function Reconciliation({ counted, setCounted, taken, setTaken, error, busy, title, actionLabel, onClose, onSave, children }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className="cash-drawer__dialog-content">
        <Typography className="cash-drawer__dialog-note">Enter the physical count without an expected balance. Expected cash and any variance are shown after the count is submitted.</Typography>
        <TextField autoFocus required type="number" label="Physical cash counted (₹)" value={counted} onChange={(event) => setCounted(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
        <TextField required type="number" label="Cash taken out / deposit (₹)" value={taken} onChange={(event) => setTaken(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
        {children}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button disabled={busy} variant="contained" onClick={onSave}>{actionLabel}</Button></DialogActions>
    </Dialog>
  );
}

export default function CashDrawerPage() {
  const [sessions, setSessions] = useState([]);
  const [cashDate, setCashDate] = useState(localDate);
  const [selectedDrawerId, setSelectedDrawerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [handoverCount, setHandoverCount] = useState("");
  const [handoverCashTaken, setHandoverCashTaken] = useState("");
  const [nextCashierId, setNextCashierId] = useState("");
  const [cashiers, setCashiers] = useState([]);
  const [handoverError, setHandoverError] = useState("");
  const openingPromptShown = useRef(false);
  const openingPromptDate = useRef(cashDate);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCashDrawerSessions()
      .then((drawerSessions) => {
        if (active) {
          setSessions(drawerSessions);
          setError("");
          if (!openingPromptShown.current) {
            openingPromptShown.current = true;
            const activeShift = drawerSessions.find((entry) => entry.status === "open");
            if (activeShift) {
              setCashDate(activeShift.date);
            } else if (!drawerSessions.some((entry) => entry.date === openingPromptDate.current && entry.status === "open")) {
              setOpeningDialogOpen(true);
            }
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load cash-drawer sessions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const session = sessions.find((entry) => entry.id === selectedDrawerId)
    || sessions.find((entry) => entry.date === cashDate && entry.status === "open")
    || sessions.find((entry) => entry.status === "open")
    || sessions.find((entry) => entry.date === cashDate)
    || null;
  const isClosed = session?.status === "closed";
  const totals = useMemo(() => movementTotals(session?.movements), [session]);
  const expected = session ? Number(session.expectedCash ?? expectedCash(session)) : 0;
  const isCurrentBusinessDate = cashDate === localDate();
  const closingVariance = isClosed ? Number(session.variance ?? (Number(session.closingCount) - Number(session.expectedAtClose))) : 0;
  const retainedCash = isClosed ? Number(session.closingCount) - Number(session.cashTaken) : 0;

  async function completeAction(action, message, closeDialog) {
    setBusy(true);
    try {
      await action();
      setError("");
      setNotice(message);
      closeDialog(false);
      setSelectedDrawerId("");
      setReloadKey((key) => key + 1);
    } finally {
      setBusy(false);
    }
  }

  async function startDrawer() {
    if (!openingAmount.trim()) {
      setOpeningError("Enter an opening cash amount of zero or more.");
      return;
    }
    const openingBalance = Number(openingAmount);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setOpeningError("Enter an opening cash amount of zero or more.");
      return;
    }
    setOpeningError("");
    try {
      await completeAction(
        () => openCashDrawer({ businessDate: cashDate, openingBalance }),
        `Cash drawer opened with ${CURRENCY.format(openingBalance)}.`,
        setOpeningDialogOpen
      );
    } catch (requestError) {
      setOpeningError(requestError.message || "Unable to open the cash drawer.");
    }
  }

  async function saveMovement() {
    const amount = Number(movementDraft.amount);
    const description = movementDraft.description.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !description) {
      setMovementError("Enter an amount greater than zero and a reason for the cash movement.");
      return;
    }
    if (movementDraft.direction === "out" && amount > expected) {
      setMovementError("Cash paid out cannot exceed the expected cash currently in the drawer.");
      return;
    }
    setMovementError("");
    try {
      await completeAction(
        () => addCashDrawerMovement(session.id, { ...movementDraft, amount, description }),
        "Cash movement recorded.",
        setMovementDialogOpen
      );
    } catch (requestError) {
      setMovementError(requestError.message || "Unable to record the cash movement.");
    }
  }

  async function finishShift() {
    if (!closingCount.trim() || !cashTaken.trim()) {
      setCloseError("Enter both the physical cash count and the cash taken amount.");
      return;
    }
    const actualCash = Number(closingCount);
    const taken = Number(cashTaken);
    if (!Number.isFinite(actualCash) || actualCash < 0 || !Number.isFinite(taken) || taken < 0) {
      setCloseError("Enter valid non-negative amounts for the physical count and cash taken.");
      return;
    }
    if (taken > actualCash) {
      setCloseError("Cash taken out cannot exceed the physical cash counted.");
      return;
    }
    setCloseError("");
    try {
      await completeAction(
        () => closeCashDrawer(session.id, { actualCash, cashTaken: taken }),
        `Shift closed. Variance: ${CURRENCY.format(actualCash - expected)}.`,
        setCloseDialogOpen
      );
    } catch (requestError) {
      setCloseError(requestError.message || "Unable to close the cash drawer.");
    }
  }

  async function beginHandover() {
    setHandoverError("");
    try {
      const response = await apiRequest("/api/pos/cash-drawers/cashiers", { skipGlobalError: true });
      if (!Array.isArray(response?.cashiers)) throw new Error("The cashier list response was invalid.");
      const activeCashiers = response.cashiers;
      if (!activeCashiers.length) throw new Error("No other active staff member is available for handover.");
      setCashiers(activeCashiers);
      setNextCashierId(String(activeCashiers[0].id));
      setHandoverCount("");
      setHandoverCashTaken("");
      setHandoverDialogOpen(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to load active staff for handover.");
    }
  }

  async function finishHandover() {
    if (!handoverCount.trim() || !handoverCashTaken.trim()) {
      setHandoverError("Enter both the physical cash count and the cash taken amount.");
      return;
    }
    const actualCash = Number(handoverCount);
    const taken = Number(handoverCashTaken);
    if (!Number.isFinite(actualCash) || actualCash < 0 || !Number.isFinite(taken) || taken < 0) {
      setHandoverError("Enter valid non-negative amounts for the physical count and cash taken.");
      return;
    }
    if (taken > actualCash || !nextCashierId) {
      setHandoverError(taken > actualCash ? "Cash taken out cannot exceed the physical cash counted." : "Select the receiving cashier.");
      return;
    }
    setHandoverError("");
    try {
      await completeAction(
        () => handoverCashDrawer(session.id, { actualCash, cashTaken: taken, nextCashierId }),
        "Shift handed over and the next cashier's drawer is open.",
        setHandoverDialogOpen
      );
    } catch (requestError) {
      setHandoverError(requestError.message || "Unable to hand over the cash drawer.");
    }
  }

  const history = [...sessions].sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  return (
    <Box className="cash-drawer app-content-width">
      <Box className="cash-drawer__heading">
        <Box><Typography className="cash-drawer__eyebrow">DAILY OPERATIONS / CASH CONTROL</Typography><Typography component="h1">Cash drawer &amp; shift handover</Typography><Typography>Enter the opening float, record cash-outs, and reconcile a blind count at shift end.</Typography></Box>
        <Box className="cash-drawer__heading-actions">
          <TextField label="Business date" type="date" value={cashDate} disabled={sessions.some((entry) => entry.status === "open")} onChange={(event) => { setSelectedDrawerId(""); setCashDate(event.target.value); }} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Refresh drawer</Button>
        </Box>
      </Box>

      <Alert severity="info" className="cash-drawer__demo-note">Shifts and cash movements are saved on the server and linked to your signed-in account. Cash sales include only this cashier&apos;s POS tenders during the shift.</Alert>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      {loading ? <Box className="cash-drawer__loading"><CircularProgress size={26} /><Typography>Loading cash-drawer sessions…</Typography></Box> : (
        <>
          <Box className="cash-drawer__date-strip"><Box><Typography>BUSINESS DATE</Typography><strong>{formatDate(cashDate)}</strong></Box><Box className={`cash-drawer__status${session?.status === "open" ? " is-open" : isClosed ? " is-closed" : ""}`}><span />{session?.status === "open" ? "Shift open" : isClosed ? "Shift closed" : "Not opened"}</Box></Box>

          {!session && isCurrentBusinessDate && (
            <Card className="cash-drawer__start-card" elevation={0}>
              <Box className="cash-drawer__start-icon"><LockOpenRoundedIcon /></Box>
              <Typography component="h2">Start a cashier shift</Typography>
              <Typography>Count the cash float before service. Sales are tracked from this point until the shift is closed or handed over.</Typography>
              <Box className="cash-drawer__opening-preview"><span>Opening float</span><strong>{CURRENCY.format(Number(openingAmount) || 0)}</strong></Box>
              <Button variant="contained" size="large" startIcon={<LockOpenRoundedIcon />} disabled={busy} onClick={() => { setOpeningAmount(""); setOpeningError(""); setOpeningDialogOpen(true); }}>Enter opening cash</Button>
            </Card>
          )}
          {!session && !isCurrentBusinessDate && <Alert severity="info">Historical dates are read-only. Select today&apos;s business date to open a cashier shift.</Alert>}

          {session && (
            <>
              <Box className="cash-drawer__stats">
                <StatCard icon={SavingsOutlinedIcon} label="Opening cash" value={CURRENCY.format(session.openingAmount)} detail={`Started ${new Date(session.openedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`} tone="opening" />
                <StatCard icon={PointOfSaleRoundedIcon} label="Cash sales" value={CURRENCY.format(session.cashSales)} detail="This cashier · sales less change" tone="sales" />
                <StatCard icon={ArrowDownwardRoundedIcon} label="Cash added" value={CURRENCY.format(totals.in)} detail={`${session.movements.filter((entry) => entry.direction === "in").length} cash-in entries`} tone="in" />
                <StatCard icon={PaymentsOutlinedIcon} label={isClosed ? "Expected at close" : "Expected in drawer"} value={CURRENCY.format(isClosed ? session.expectedAtClose : expected)} detail={`Cash out ${CURRENCY.format(totals.out)}`} tone="expected" />
              </Box>

              {isClosed ? (
                <Card className="cash-drawer__closed-card" elevation={0}>
                  <Box className="cash-drawer__closed-heading"><Box className="cash-drawer__closed-icon"><LockClockOutlinedIcon /></Box><Box><Typography component="h2">Shift closed</Typography><Typography>Closed {new Date(session.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {formatDate(session.date)}</Typography></Box></Box>
                  <Box className="cash-drawer__reconciliation">
                    <Box><span>Expected cash</span><strong>{CURRENCY.format(session.expectedAtClose)}</strong></Box>
                    <Box><span>Physical count</span><strong>{CURRENCY.format(session.closingCount)}</strong></Box>
                    <Box><span>Variance</span><strong className={closingVariance === 0 ? "is-balanced" : closingVariance < 0 ? "is-short" : "is-over"}>{closingVariance > 0 ? "+" : ""}{CURRENCY.format(closingVariance)}</strong></Box>
                    <Box><span>Cash taken out</span><strong className="is-taken">{CURRENCY.format(session.cashTaken)}</strong></Box>
                    <Box><span>Cash remaining</span><strong>{CURRENCY.format(retainedCash)}</strong></Box>
                  </Box>
                  <Typography className="cash-drawer__locked-note">Closed by {session.cashierName || "the cashier"}{session.handoverRecipientName ? ` · handed over to ${session.handoverRecipientName}` : ""}. This shift record is read-only.</Typography>
                </Card>
              ) : (
                <Card className="cash-drawer__live-card" elevation={0}>
                  <Box className="cash-drawer__live-heading">
                    <Box><Typography component="h2">Shift in progress · {session.cashierName || "Cashier"}</Typography><Typography>Expected physical cash = opening float + cash sales + cash in − cash out.</Typography></Box>
                    <Box><span>EXPECTED CASH NOW</span><strong>{CURRENCY.format(expected)}</strong></Box>
                  </Box>
                  <Box className="cash-drawer__live-breakdown">
                    <Box><span>Opening float</span><strong>{CURRENCY.format(session.openingAmount)}</strong></Box>
                    <Box><span>Cash sales</span><strong>+ {CURRENCY.format(session.cashSales)}</strong></Box>
                    <Box><span>Cash added</span><strong>+ {CURRENCY.format(totals.in)}</strong></Box>
                    <Box><span>Cash paid out</span><strong>− {CURRENCY.format(totals.out)}</strong></Box>
                  </Box>
                  <Box className="cash-drawer__live-actions">
                    <Button variant="outlined" startIcon={<AddRoundedIcon />} disabled={busy} onClick={() => { setMovementDraft({ direction: "out", amount: "", description: "" }); setMovementError(""); setMovementDialogOpen(true); }}>Record cash movement</Button>
                    <Button variant="outlined" disabled={busy} onClick={beginHandover}>Hand over shift</Button>
                    <Button variant="contained" startIcon={<LockClockOutlinedIcon />} disabled={busy} onClick={() => { setClosingCount(""); setCashTaken(""); setCloseError(""); setCloseDialogOpen(true); }}>Close shift &amp; count drawer</Button>
                  </Box>
                </Card>
              )}

              <Card className="cash-drawer__activity" elevation={0}>
                <Box className="cash-drawer__section-heading"><Box><Typography component="h2">Cash drawer activity</Typography><Typography>Opening float, cashier-specific cash sales, and audited manual movements.</Typography></Box></Box>
                <Box className="cash-drawer__activity-list">
                  <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-opening"><LockOpenRoundedIcon /></Box><Box><strong>Opening cash</strong><span>{session.cashierName} · {new Date(session.openedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></Box><strong>{CURRENCY.format(session.openingAmount)}</strong></Box>
                  <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-sales"><PointOfSaleRoundedIcon /></Box><Box><strong>Cash sales{isClosed ? " (at close)" : ""}</strong><span>This cashier · {formatDate(cashDate)}</span></Box><strong>+ {CURRENCY.format(session.cashSales)}</strong></Box>
                  {session.movements.map((movement) => <Box className="cash-drawer__activity-row" key={movement.id}><Box className={`cash-drawer__activity-icon is-${movement.direction}`}>{movement.direction === "in" ? <ArrowDownwardRoundedIcon /> : <ArrowUpwardRoundedIcon />}</Box><Box><strong>{movement.description}</strong><span>{movement.direction === "in" ? "Cash added" : "Cash paid out"} · {new Date(movement.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></Box><strong className={movement.direction === "in" ? "is-in" : "is-out"}>{movement.direction === "in" ? "+" : "−"} {CURRENCY.format(movement.amount)}</strong></Box>)}
                  {session.logs?.filter((log) => ["handed_over", "handover_received"].includes(log.event)).map((log) => <Box className="cash-drawer__activity-row" key={log.id}><Box className="cash-drawer__activity-icon"><LockClockOutlinedIcon /></Box><Box><strong>{log.event === "handed_over" ? "Shift handed over" : "Shift handover received"}</strong><span>{log.description} · {new Date(log.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></Box><strong>{CURRENCY.format(log.amount || 0)}</strong></Box>)}
                  {isClosed && <Box className="cash-drawer__activity-row"><Box className="cash-drawer__activity-icon is-taken"><ArrowUpwardRoundedIcon /></Box><Box><strong>Cash taken out / deposit</strong><span>Recorded at close</span></Box><strong className="is-out">− {CURRENCY.format(session.cashTaken)}</strong></Box>}
                </Box>
              </Card>
            </>
          )}

          {history.length > 0 && <Card className="cash-drawer__history" elevation={0}>
            <Box className="cash-drawer__section-heading"><Box><Typography component="h2">Previous shift sessions</Typography><Typography>Server-recorded shift openings, handovers, and closing counts.</Typography></Box></Box>
            <Box className="cash-drawer__history-list">{history.filter((entry) => entry.id !== session?.id).slice(0, 7).map((entry) => <Button className="cash-drawer__history-row" key={entry.id} onClick={() => { setSelectedDrawerId(entry.id); setCashDate(entry.date); }}><Box><strong>{formatDate(entry.date)} · {entry.cashierName || "Cashier"}</strong><span>{entry.status === "closed" ? "Closed" : "Open"} · Opening {CURRENCY.format(entry.openingAmount)}</span></Box><Box><strong>{entry.status === "closed" ? `Taken ${CURRENCY.format(entry.cashTaken)}` : "View open drawer"}</strong><span>{entry.status === "closed" ? `Variance ${CURRENCY.format(Number(entry.variance ?? (Number(entry.closingCount) - Number(entry.expectedAtClose))))}` : "Shift in progress"}</span></Box></Button>)}</Box>
          </Card>}
        </>
      )}

      <Dialog open={openingDialogOpen} onClose={() => setOpeningDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enter opening cash</DialogTitle>
        <DialogContent className="cash-drawer__dialog-content">
          <Typography className="cash-drawer__dialog-note">Count the cash you are putting into the till before service. Cash sales for this account are tracked from the time the drawer opens.</Typography>
          <TextField autoFocus required type="number" label="Opening cash amount (₹)" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          <Box className="cash-drawer__opening-report"><span>Business date</span><strong>{formatDate(cashDate)}</strong></Box>
          {openingError && <Alert severity="error">{openingError}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setOpeningDialogOpen(false)}>Cancel</Button><Button disabled={busy} variant="contained" onClick={startDrawer}>Start shift</Button></DialogActions>
      </Dialog>

      <CashMovementDialog open={movementDialogOpen} draft={movementDraft} setDraft={setMovementDraft} error={movementError} busy={busy} onClose={() => setMovementDialogOpen(false)} onSave={saveMovement} />
      {closeDialogOpen && <Reconciliation
        counted={closingCount}
        setCounted={setClosingCount}
        taken={cashTaken}
        setTaken={setCashTaken}
        error={closeError}
        busy={busy}
        title="Close cashier shift"
        actionLabel="Confirm close & record count"
        onClose={() => setCloseDialogOpen(false)}
        onSave={finishShift}
      />}
      {handoverDialogOpen && <Reconciliation
        counted={handoverCount}
        setCounted={setHandoverCount}
        taken={handoverCashTaken}
        setTaken={setHandoverCashTaken}
        error={handoverError}
        busy={busy}
        title="Hand over cashier shift"
        actionLabel="Confirm handover"
        onClose={() => setHandoverDialogOpen(false)}
        onSave={finishHandover}
      >
        <FormControl required>
          <InputLabel id="cash-drawer-next-cashier-label">Receiving cashier</InputLabel>
          <Select labelId="cash-drawer-next-cashier-label" label="Receiving cashier" value={nextCashierId} onChange={(event) => setNextCashierId(event.target.value)}>
            {cashiers.map((cashier) => <MenuItem key={cashier.id} value={String(cashier.id)}>{[cashier.first_name, cashier.last_name].filter(Boolean).join(" ")} · {cashier.role}</MenuItem>)}
          </Select>
        </FormControl>
      </Reconciliation>}
    </Box>
  );
}
