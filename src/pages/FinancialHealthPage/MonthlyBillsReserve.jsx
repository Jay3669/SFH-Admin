import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import {
  getDailyReserveTarget,
  getDaysUntilDue,
  getMonthlyBillBalance,
  getMonthlyBillReserve,
  saveMonthlyBillReserve,
} from "../../services/monthlyBillReserve";
import "./MonthlyBillsReserve.css";
import { formatDate as formatConfiguredDate, formatMonthYear } from "../../utils/dateTimeFormat";

const MONEY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const BILL_TYPES = [
  { id: "rent", label: "Shop rent" },
  { id: "electricity", label: "Electricity bill" },
];

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextMonth() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month) {
  if (!month) return month;
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : formatMonthYear(date);
}

function formatDate(value) {
  return formatConfiguredDate(value);
}

function makeId() {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MonthlyBillsReserve({ canRecordPayment, onRecordPayment }) {
  const [data, setData] = useState({ plans: [], transactions: [] });
  const [billMonth, setBillMonth] = useState(nextMonth);
  const [drafts, setDrafts] = useState({});
  const [deposits, setDeposits] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let savedData;
    try {
      savedData = getMonthlyBillReserve();
      setData(savedData);
      setDrafts(Object.fromEntries(BILL_TYPES.map(({ id }) => {
        const plan = savedData.plans.find((item) => item.billType === id && item.billMonth === billMonth);
        return [id, plan
          ? { amount: String(plan.amount), dueDate: plan.dueDate }
          : { amount: "", dueDate: `${billMonth}-01` }];
      })));
      setDataLoaded(true);
      setError("");
    } catch (loadError) {
      setDataLoaded(false);
      setError(loadError.message || "Unable to load monthly bill reserve.");
    }
  }, [billMonth]);

  const today = localDate();

  function updateDraft(billType, field, value) {
    setDrafts((current) => ({
      ...current,
      [billType]: { ...(current[billType] || { amount: "", dueDate: `${billMonth}-01` }), [field]: value },
    }));
  }

  function savePlan() {
    try {
      const newPlans = BILL_TYPES.map(({ id, label }) => {
        const amount = Number(drafts[id]?.amount);
        const dueDate = drafts[id]?.dueDate;
        if (!Number.isFinite(amount) || amount <= 0 || !dueDate || dueDate.slice(0, 7) !== billMonth) {
          throw new Error(`Enter a monthly amount and a valid due date in ${formatMonth(billMonth)} for ${label.toLowerCase()}.`);
        }
        return { billType: id, billMonth, amount, dueDate };
      });
      const nextData = {
        ...data,
        plans: [...data.plans.filter((plan) => plan.billMonth !== billMonth), ...newPlans],
      };
      saveMonthlyBillReserve(nextData);
      setData(nextData);
      setError("");
      setNotice(`Monthly targets saved for ${formatMonth(billMonth)}.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save monthly bill targets.");
    }
  }

  function recordDeposit(plan) {
    const balance = getMonthlyBillBalance(data, plan.billType, plan.billMonth);
    const amount = Number(deposits[plan.billType] ?? getDailyReserveTarget(plan.amount, plan.dueDate, balance, today).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a daily reserve amount greater than zero.");
      return;
    }
    if (data.transactions.some((item) => item.type === "deposit" && item.billType === plan.billType && item.billMonth === plan.billMonth && item.date === today)) {
      setError(`Today's ${plan.billType} reserve has already been recorded.`);
      return;
    }
    const nextData = {
      ...data,
      transactions: [...data.transactions, {
        id: makeId(),
        type: "deposit",
        billType: plan.billType,
        billMonth: plan.billMonth,
        amount,
        date: today,
      }],
    };
    try {
      saveMonthlyBillReserve(nextData);
      setData(nextData);
      setError("");
      setNotice(`${MONEY.format(amount)} added to the ${plan.billType} reserve.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to record today's reserve.");
    }
  }

  function openPayment(plan) {
    const balance = getMonthlyBillBalance(data, plan.billType, plan.billMonth);
    setPaymentBill(plan);
    setPaymentAmount(String(Math.min(plan.amount, Math.max(balance, 0))));
    setPaymentError("");
  }

  function recordPayment() {
    const amount = Number(paymentAmount);
    const balance = getMonthlyBillBalance(data, paymentBill.billType, paymentBill.billMonth);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setPaymentError(`Enter an amount greater than zero and no more than the saved balance of ${MONEY.format(Math.max(balance, 0))}.`);
      return;
    }
    const transaction = {
      id: makeId(),
      type: "payment",
      billType: paymentBill.billType,
      billMonth: paymentBill.billMonth,
      amount,
      date: today,
    };
    const nextData = { ...data, transactions: [...data.transactions, transaction] };
    try {
      if (!onRecordPayment(nextData, transaction)) return;
      setData(nextData);
      setPaymentBill(null);
      setError("");
      setNotice(`${MONEY.format(amount)} payment recorded and added to Profit & Loss expenses.`);
    } catch (saveError) {
      setPaymentError(saveError.message || "Unable to record this bill payment.");
    }
  }

  return (
    <Card className="monthly-reserve" elevation={0}>
      <Box className="monthly-reserve__heading">
        <Box>
          <Typography className="monthly-reserve__eyebrow">PLAN AHEAD</Typography>
          <Typography component="h2">Rent &amp; electricity reserve</Typography>
              <Typography>Set each bill&apos;s payment date, save a daily share, then record payment when due.</Typography>
        </Box>
        <SavingsOutlinedIcon />
      </Box>
      <Alert severity="info">
        This browser-only tracker recalculates the daily target from the unpaid bill amount and days remaining until its due date. Deposits and payments are manual records; no money is moved automatically.
      </Alert>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Box className="monthly-reserve__plan-toolbar">
        <TextField
          label="Bill month"
          type="month"
          value={billMonth}
          onChange={(event) => setBillMonth(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="contained" disabled={!dataLoaded} onClick={savePlan}>Save monthly targets</Button>
      </Box>

      <Box className="monthly-reserve__bills">
        {BILL_TYPES.map(({ id, label }) => {
          const plan = data.plans.find((item) => item.billType === id && item.billMonth === billMonth);
          const balance = plan ? getMonthlyBillBalance(data, id, billMonth) : 0;
          const daysUntilDue = plan ? getDaysUntilDue(plan.dueDate, today) : 0;
          const dailyTarget = plan ? getDailyReserveTarget(plan.amount, plan.dueDate, balance, today) : 0;
          const dueStatus = daysUntilDue < 0
            ? `Overdue by ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? "day" : "days"}`
            : daysUntilDue === 0
              ? "Due today"
              : `Due in ${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"}`;
          const isDepositedToday = data.transactions.some((item) => item.type === "deposit" && item.billType === id && item.billMonth === billMonth && item.date === today);
          const billTransactions = data.transactions
            .filter((item) => item.billType === id && item.billMonth === billMonth)
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <Box className="monthly-reserve__bill" key={id}>
              <Box className="monthly-reserve__bill-heading">
                <Box><Typography component="h3">{label}</Typography><Typography>{plan ? `${formatDate(plan.dueDate)} · ${dueStatus}` : `Payment date · ${formatMonth(billMonth)}`}</Typography></Box>
                <strong>{MONEY.format(Math.max(balance, 0))}<span> saved</span></strong>
              </Box>
              <Box className="monthly-reserve__fields">
                <TextField
                  label="Monthly bill amount (₹)"
                  type="number"
                  value={drafts[id]?.amount || ""}
                  onChange={(event) => updateDraft(id, "amount", event.target.value)}
                  slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }}
                />
                <TextField
                  label="Payment due date"
                  type="date"
                  value={drafts[id]?.dueDate || ""}
                  onChange={(event) => updateDraft(id, "dueDate", event.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: `${billMonth}-01`, max: `${billMonth}-${String(new Date(Number(billMonth.slice(0, 4)), Number(billMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}` } }}
                />
              </Box>
              {plan ? (
                <>
                  <Box className="monthly-reserve__daily">
                    <Box><span>Suggested daily reserve · {daysUntilDue < 0 ? "due date passed" : `${daysUntilDue + 1} saving ${daysUntilDue === 0 ? "day" : "days"} including today`}</span><strong>{MONEY.format(dailyTarget)}</strong></Box>
                    <TextField
                      label="Today's amount (₹)"
                      type="number"
                      value={deposits[id] ?? dailyTarget.toFixed(2)}
                      onChange={(event) => setDeposits((current) => ({ ...current, [id]: event.target.value }))}
                      slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }}
                    />
                    <Button variant="outlined" disabled={!dataLoaded || isDepositedToday} onClick={() => recordDeposit(plan)}>
                      {isDepositedToday ? "Today's reserve recorded" : "Record today's reserve"}
                    </Button>
                  </Box>
                  <Box className="monthly-reserve__payment">
                    <Typography>{balance >= plan.amount ? "Bill target saved" : `${MONEY.format(Math.max(plan.amount - balance, 0))} left to save`}</Typography>
                    <Button variant="contained" disabled={!dataLoaded || !canRecordPayment || balance <= 0} onClick={() => openPayment(plan)}>Record payment</Button>
                  </Box>
                  {billTransactions.length > 0 && (
                    <Box className="monthly-reserve__history">
                      {billTransactions.slice(0, 4).map((transaction) => (
                        <Box key={transaction.id}>
                          <span>{transaction.type === "deposit" ? "Added to reserve" : "Bill payment"} · {transaction.date}</span>
                          <strong>{transaction.type === "payment" ? "− " : "+ "}{MONEY.format(transaction.amount)}</strong>
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
              ) : (
                <Typography className="monthly-reserve__empty">Save both bill targets to start recording daily reserves.</Typography>
              )}
            </Box>
          );
        })}
      </Box>

      <Dialog open={Boolean(paymentBill)} onClose={() => setPaymentBill(null)} fullWidth maxWidth="xs">
        <DialogTitle>Record {paymentBill?.billType === "rent" ? "shop rent" : "electricity"} payment</DialogTitle>
        <DialogContent className="monthly-reserve__payment-form">
          <Typography>Saved balance: {MONEY.format(Math.max(paymentBill ? getMonthlyBillBalance(data, paymentBill.billType, paymentBill.billMonth) : 0, 0))}. Recording payment also adds it to the utilities &amp; rent expenses in Profit &amp; Loss.</Typography>
          <TextField
            autoFocus
            label="Payment amount (₹)"
            type="number"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }}
          />
          {paymentError && <Alert severity="error">{paymentError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentBill(null)}>Cancel</Button>
          <Button variant="contained" onClick={recordPayment}>Confirm payment</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
