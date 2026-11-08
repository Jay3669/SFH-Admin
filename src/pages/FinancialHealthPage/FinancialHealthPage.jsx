import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { getBillingReport } from "../../services/billingReport";
import {
  FINANCIAL_EXPENSE_CATEGORIES,
  listFinancialExpenses,
  saveFinancialExpenses,
} from "../../services/financialExpenses";
import { saveMonthlyBillReserve } from "../../services/monthlyBillReserve";
import { summarizeProfitLoss } from "../../services/profitLossSummary";
import MonthlyBillsReserve from "./MonthlyBillsReserve";
import "./FinancialHealthPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PDF_CURRENCY = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatReportDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
}

function formatMonthForExpense(value) {
  const date = new Date(`${value}-01T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function pdfDateRange(report) {
  if (!report?.from && !report?.to) return "Date range not provided";
  const from = formatReportDate(report.from);
  const to = formatReportDate(report.to || report.from);
  return from === to ? from : `${from} - ${to}`;
}

function makeFileName(period, report) {
  const endDate = dateOnly(report?.to) || new Date().toISOString().slice(0, 10);
  return `sfh-profit-loss-${period}-${endDate}.pdf`;
}

function createProfitLossPdf(report, period, summary, pdf = new jsPDF()) {
  const left = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const right = pageWidth - left;
  const financialRows = [
    ["Gross sales", summary.grossSales],
    ["Discounts & refunds", -summary.discounts],
    ["Packaging charges", summary.packagingCharges],
    ["Net sales (tax excluded)", summary.netSales],
    ["Taxes collected (excluded from revenue)", summary.taxesCollected],
    ["Ingredient costs (recorded purchases proxy)", -summary.ingredientCosts],
    ["Packaging & disposables", -summary.expenseTotals.packaging],
    ["Gross profit", summary.grossProfit],
    ["Staff & salaries", -summary.expenseTotals.staff],
    ["Utilities & rent", -summary.expenseTotals.utilities],
    ["Other expenses", -summary.expenseTotals.other],
    ["Total costs & operating expenses", -summary.totalCosts],
    ["Estimated net profit / (loss)", summary.netProfit],
  ];

  pdf.setFillColor(32, 40, 58);
  pdf.rect(0, 0, pageWidth, 43, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text("Profit & Loss", left, 19);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Financial health report", left, 27);
  pdf.text(`${period.charAt(0).toUpperCase()}${period.slice(1)} | ${pdfDateRange(report)}`, left, 35);

  let y = 57;
  pdf.setTextColor(37, 51, 72);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Income statement", left, y);
  y += 11;
  financialRows.forEach(([label, value], index) => {
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
    if ([3, 7, 11, 12].includes(index)) {
      pdf.setDrawColor(220, 226, 232);
      pdf.line(left, y - 5, right, y - 5);
      pdf.setFont("helvetica", "bold");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    pdf.setFontSize(9);
    pdf.text(label, left, y);
    const formattedValue = `${value < 0 ? "− " : ""}INR ${PDF_CURRENCY.format(Math.abs(value))}`;
    pdf.text(formattedValue, right, y, { align: "right" });
    y += 8;
  });

  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Expense entries", left, y);
  y += 9;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  if (!summary.expenses.length) {
    pdf.text("No operating expense entries were recorded for this period.", left, y);
    y += 7;
  } else {
    summary.expenses.forEach((expense) => {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }
      const category = FINANCIAL_EXPENSE_CATEGORIES.find((item) => item.value === expense.category)?.label || "Expense";
      pdf.text(`${expense.name} | ${category} | ${formatReportDate(expense.date)}`, left, y);
      pdf.text(`INR ${PDF_CURRENCY.format(amount(expense.amount))}`, right, y, { align: "right" });
      y += 7;
    });
  }
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Management estimate: recorded purchases are used as an ingredient-cost proxy; purchases may differ from inventory consumed.", left, y);
  pdf.text("Taxes collected are shown separately and excluded from net sales. Expense entries are stored in this browser only.", left, y + 6);

  const pageCount = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 230, 235);
    pdf.line(left, 286, right, 286);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(125, 135, 148);
    pdf.text("Surya Food Hub | Financial report", left, 292);
    pdf.text(`Page ${page} of ${pageCount}`, right, 292, { align: "right" });
  }
  return pdf;
}

function StatementRow({ label, value, bold = false, tone = "" }) {
  return (
    <Box className={`financial-health__statement-row${bold ? " is-bold" : ""}${tone ? ` is-${tone}` : ""}`}>
      <Typography>{label}</Typography>
      <strong>{value}</strong>
    </Box>
  );
}

function ExpenseDialog({ open, draft, setDraft, error, onClose, onSave, editing }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
      <DialogContent className="financial-health__expense-form">
        <TextField
          autoFocus
          required
          label="Expense name"
          placeholder="e.g. November staff wages"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          slotProps={{ htmlInput: { maxLength: 100 } }}
        />
        <FormControl required>
          <InputLabel id="financial-expense-category-label">Category</InputLabel>
          <Select
            labelId="financial-expense-category-label"
            label="Category"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          >
            {FINANCIAL_EXPENSE_CATEGORIES.map((category) => (
              <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          required
          label="Amount"
          type="number"
          value={draft.amount}
          onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
          slotProps={{ htmlInput: { min: "0.01", step: "0.01" } }}
        />
        <TextField
          required
          label="Expense date"
          type="date"
          value={draft.date}
          onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Typography className="financial-health__form-note">Saved in this browser only; entries are not synced to other devices.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>{editing ? "Save changes" : "Save expense"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FinancialHealthPage({ pdfFactory = () => new jsPDF() }) {
  const [period, setPeriod] = useState("monthly");
  const [report, setReport] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [financialDataLoaded, setFinancialDataLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseDraft, setExpenseDraft] = useState({ name: "", category: "staff", amount: "", date: "" });
  const [expenseFormError, setExpenseFormError] = useState("");
  const [deletingExpense, setDeletingExpense] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    setFinancialDataLoaded(false);
    Promise.all([getBillingReport(period), Promise.resolve().then(listFinancialExpenses)])
      .then(([result, savedExpenses]) => {
        if (active) {
          setReport(result);
          setExpenses(savedExpenses);
          setFinancialDataLoaded(true);
        }
      })
      .catch((loadError) => {
        if (active) {
          setFinancialDataLoaded(false);
          setError(loadError.message || "Unable to load the financial health report.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [period, reloadKey]);

  const summary = useMemo(() => summarizeProfitLoss(report, expenses), [report, expenses]);
  const displayRange = useMemo(() => {
    if (!report) return "";
    const from = formatReportDate(report.from);
    const to = formatReportDate(report.to || report.from);
    return from === to ? from : `${from} – ${to}`;
  }, [report]);
  const expenseCategories = useMemo(
    () => Object.fromEntries(FINANCIAL_EXPENSE_CATEGORIES.map((category) => [category.value, category.label])),
    []
  );
  const costBars = [
    { label: "Ingredients", value: summary.ingredientCosts, color: "ingredients" },
    { label: "Packaging", value: summary.expenseTotals.packaging, color: "packaging" },
    { label: "Staff", value: summary.expenseTotals.staff, color: "staff" },
    { label: "Utilities & other", value: summary.expenseTotals.utilities + summary.expenseTotals.other, color: "operating" },
    { label: "Profit / (loss)", value: summary.netProfit, color: "profit" },
  ];

  function generatePdf() {
    if (!report) return null;
    return createProfitLossPdf(report, period, summary, pdfFactory());
  }

  function downloadPdf() {
    try {
      generatePdf()?.save(makeFileName(period, report));
      setError("");
      setNotice("Your Profit & Loss PDF has been downloaded.");
    } catch (pdfError) {
      setError(pdfError.message || "Unable to create the PDF. Please try again.");
    }
  }

  async function shareOnWhatsApp() {
    try {
      const pdf = generatePdf();
      if (!pdf) return;
      const fileName = makeFileName(period, report);
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      const message = `Surya Food Hub Profit & Loss (${period})\n${displayRange}\nNet sales: ${CURRENCY.format(summary.netSales)}\nTaxes collected: ${CURRENCY.format(summary.taxesCollected)}\nTotal costs and expenses: ${CURRENCY.format(summary.totalCosts)}\nEstimated ${summary.netProfit >= 0 ? "profit" : "loss"}: ${CURRENCY.format(Math.abs(summary.netProfit))}\n\nRecorded purchases are an ingredient-cost proxy. Expense entries are saved in this browser only.`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Surya Food Hub Profit & Loss", text: message, files: [file] });
        setNotice("Choose WhatsApp in the share menu to send the PDF.");
      } else {
        pdf.save(fileName);
        const url = `https://wa.me/?text=${encodeURIComponent(`${message}\n\nThe PDF was downloaded. Please attach it to this chat.`)}`;
        const shareWindow = window.open(url, "_blank");
        if (!shareWindow) {
          setNotice("The PDF was downloaded. Open WhatsApp and attach it to your message.");
        } else {
          shareWindow.opener = null;
          setNotice("The PDF was downloaded and WhatsApp opened with a ready-to-send summary. Attach the PDF to your message.");
        }
      }
      setError("");
    } catch (shareError) {
      if (shareError.name === "AbortError") return;
      setError(shareError.message || "Unable to prepare the WhatsApp share. Download the PDF and try again.");
    }
  }

  function openExpenseDialog(expense = null) {
    setEditingExpenseId(expense?.id || "");
    setExpenseFormError("");
    setExpenseDraft(expense
      ? { name: expense.name, category: expense.category, amount: String(expense.amount), date: expense.date }
      : { name: "", category: "staff", amount: "", date: dateOnly(report?.to) || new Date().toISOString().slice(0, 10) });
    setExpenseDialogOpen(true);
  }

  function saveExpense() {
    const name = expenseDraft.name.trim();
    const value = Number(expenseDraft.amount);
    if (!name || !expenseDraft.date || !FINANCIAL_EXPENSE_CATEGORIES.some((category) => category.value === expenseDraft.category) || !Number.isFinite(value) || value <= 0) {
      setExpenseFormError("Enter an expense name, valid category, date, and amount greater than zero.");
      return;
    }
    const entry = {
      id: editingExpenseId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name,
      category: expenseDraft.category,
      amount: value,
      date: expenseDraft.date,
    };
    const nextExpenses = editingExpenseId
      ? expenses.map((expense) => expense.id === editingExpenseId ? entry : expense)
      : [...expenses, entry];
    try {
      saveFinancialExpenses(nextExpenses);
      setExpenses(nextExpenses);
      setExpenseDialogOpen(false);
      setError("");
      setNotice(editingExpenseId ? "Expense updated." : "Expense saved.");
    } catch (saveError) {
      setExpenseFormError(saveError.message || "Unable to save the expense.");
    }
  }

  function confirmDeleteExpense() {
    const nextExpenses = expenses.filter((expense) => expense.id !== deletingExpense.id);
    try {
      saveFinancialExpenses(nextExpenses);
      setExpenses(nextExpenses);
      setDeletingExpense(null);
      setError("");
      setNotice("Expense deleted.");
    } catch (saveError) {
      setDeletingExpense(null);
      setError(saveError.message || "Unable to delete the expense.");
    }
  }

  function recordMonthlyBillPayment(nextReserve, transaction) {
    if (!financialDataLoaded) throw new Error("Load the financial report and saved expenses before recording a bill payment.");
    const billName = transaction.billType === "rent" ? "Shop rent" : "Electricity bill";
    const expense = {
      id: transaction.id,
      name: `${formatMonthForExpense(transaction.billMonth)} ${billName}`,
      category: "utilities",
      amount: Number(transaction.amount),
      date: transaction.date,
    };
    const nextExpenses = [...expenses, expense];
    let expensesSaved = false;
    try {
      saveFinancialExpenses(nextExpenses);
      expensesSaved = true;
      saveMonthlyBillReserve(nextReserve);
      setExpenses(nextExpenses);
      setError("");
      return true;
    } catch (saveError) {
      if (expensesSaved) {
        try {
          saveFinancialExpenses(expenses);
        } catch (rollbackError) {
          throw new Error(`${saveError.message || "Unable to record the bill payment."} The expense entry could not be rolled back: ${rollbackError.message}`);
        }
      }
      throw saveError;
    }
  }

  const expenseRows = summary.expenses;

  return (
    <Box className="financial-health app-content-width">
      <Box className="financial-health__page-heading">
        <Box>
          <Typography className="financial-health__eyebrow">FINANCIAL HEALTH</Typography>
          <Typography component="h1">Profit &amp; Loss</Typography>
          <Typography className="financial-health__subtitle">A clear picture of your restaurant&apos;s earnings and costs.</Typography>
        </Box>
        <Box className="financial-health__hero-actions">
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadPdf} disabled={!report || loading}>
            Download summary
          </Button>
          <Button variant="contained" color="secondary" startIcon={<ShareRoundedIcon />} onClick={shareOnWhatsApp} disabled={!report || loading}>
            Share PDF on WhatsApp
          </Button>
        </Box>
      </Box>

      <Box className="financial-health__toolbar">
        <Box>
          <Typography component="h2">Reporting period</Typography>
          <Typography>{displayRange || "Choose a period to view the report"}</Typography>
        </Box>
        <ToggleButtonGroup exclusive size="small" value={period} aria-label="Profit and loss period" onChange={(_, value) => { if (value) { setPeriod(value); setNotice(""); } }}>
          {PERIODS.map((option) => <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshRoundedIcon />} onClick={() => setReloadKey((current) => current + 1)}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <MonthlyBillsReserve canRecordPayment={financialDataLoaded} onRecordPayment={recordMonthlyBillPayment} />
      {loading ? (
        <Box className="financial-health__loading"><CircularProgress size={28} /><Typography>Loading financial report…</Typography></Box>
      ) : report && (
        <>
          <Box className={`financial-health__profit-banner${summary.netProfit < 0 ? " is-loss" : ""}`}>
            <Box className="financial-health__profit-icon"><AssessmentOutlinedIcon /></Box>
            <Box>
              <Typography className="financial-health__banner-label">ESTIMATED NET {summary.netProfit < 0 ? "LOSS" : "PROFIT"} · {period.toUpperCase()}</Typography>
              <Typography className="financial-health__banner-value">{CURRENCY.format(Math.abs(summary.netProfit))}</Typography>
              <Typography className="financial-health__banner-detail">{summary.profitMargin.toFixed(1)}% net margin · {displayRange}</Typography>
            </Box>
            <Typography className="financial-health__banner-note">Net sales minus recorded costs and expenses</Typography>
          </Box>

          <Alert severity="info" icon={<AssessmentOutlinedIcon />}>
            This management estimate uses recorded purchases as an ingredient-cost proxy. Purchase totals may differ from ingredients consumed. Taxes collected are shown separately and excluded from net sales. Expenses you add are saved in this browser only.
          </Alert>

          <Box className="financial-health__dashboard">
            <Card className="financial-health__statement" elevation={0}>
              <Box className="financial-health__section-heading">
                <Box><Typography component="h2">Income statement</Typography><Typography>Breakdown for {displayRange || period}.</Typography></Box>
                <Chip label={period.charAt(0).toUpperCase() + period.slice(1)} size="small" />
              </Box>
              <Box className="financial-health__statement-section">
                <Box className="financial-health__section-title"><Typography>REVENUE</Typography><strong>{CURRENCY.format(summary.grossSales)}</strong></Box>
                <StatementRow label="Gross sales" value={CURRENCY.format(summary.grossSales)} />
                <StatementRow label="Discounts & refunds" value={`− ${CURRENCY.format(summary.discounts)}`} />
                <StatementRow label="Packaging charges" value={`+ ${CURRENCY.format(summary.packagingCharges)}`} />
                <StatementRow label="Taxes collected (excluded from revenue)" value={CURRENCY.format(summary.taxesCollected)} />
                <StatementRow label="Net sales" value={CURRENCY.format(summary.netSales)} bold />
              </Box>

              <Box className="financial-health__statement-section">
                <Box className="financial-health__section-title"><Typography>COST OF GOODS SOLD</Typography><strong>{CURRENCY.format(summary.totalCostOfGoods)}</strong></Box>
                <StatementRow label="Ingredient costs (recorded purchases proxy)" value={`− ${CURRENCY.format(summary.ingredientCosts)}`} />
                <StatementRow label="Packaging & disposables" value={`− ${CURRENCY.format(summary.expenseTotals.packaging)}`} />
                <StatementRow label="Gross profit" value={CURRENCY.format(summary.grossProfit)} bold tone="positive" />
              </Box>

              <Box className="financial-health__statement-section">
                <Box className="financial-health__section-title"><Typography>OPERATING EXPENSES</Typography><strong>{CURRENCY.format(summary.operatingExpenses)}</strong></Box>
                {FINANCIAL_EXPENSE_CATEGORIES.filter((category) => category.section === "operating").map((category) => (
                  <StatementRow key={category.value} label={category.label} value={`− ${CURRENCY.format(summary.expenseTotals[category.value])}`} />
                ))}
                <StatementRow label="Total costs & operating expenses" value={`− ${CURRENCY.format(summary.totalCosts)}`} bold />
                <StatementRow
                  label={summary.netProfit < 0 ? "Estimated net loss" : "Estimated net profit"}
                  value={`${summary.netProfit < 0 ? "− " : ""}${CURRENCY.format(Math.abs(summary.netProfit))}`}
                  bold
                  tone={summary.netProfit < 0 ? "negative" : "final"}
                />
              </Box>
            </Card>

            <Box className="financial-health__side-panels">
              <Card className="financial-health__side-card" elevation={0}>
                <Typography component="h2">Profit margin</Typography>
                <Typography className="financial-health__side-subtitle">Net profit as a share of net sales</Typography>
                <Box
                  className="financial-health__margin-gauge"
                  role="img"
                  aria-label={`${summary.profitMargin.toFixed(1)} percent net margin`}
                  style={{ "--progress": `${Math.min(Math.max(summary.profitMargin, 0), 100) * 1.8}deg` }}
                >
                  <Box><strong>{summary.profitMargin.toFixed(1)}%</strong><Typography>Net margin</Typography></Box>
                </Box>
                <Typography className="financial-health__margin-caption">{CURRENCY.format(summary.netProfit)} estimated {summary.netProfit < 0 ? "loss" : "profit"}</Typography>
              </Card>
              <Card className="financial-health__side-card" elevation={0}>
                <Typography component="h2">Costs at a glance</Typography>
                <Typography className="financial-health__side-subtitle">Share of net sales for this period</Typography>
                <Box className="financial-health__cost-bars">
                  {costBars.map((bar) => (
                    <Box className="financial-health__cost-row" key={bar.label}>
                      <Typography>{bar.label}</Typography>
                      <Box className="financial-health__cost-track"><Box className={`is-${bar.color}`} style={{ width: `${Math.min(Math.max(summary.netSales ? Math.abs(bar.value) / summary.netSales * 100 : 0, bar.value ? 2 : 0), 100)}%` }} /></Box>
                      <strong>{summary.netSales ? `${Math.round(Math.abs(bar.value) / summary.netSales * 100)}%` : "—"}</strong>
                    </Box>
                  ))}
                </Box>
              </Card>
            </Box>
          </Box>

          <Card className="financial-health__expense-ledger" elevation={0}>
            <Box className="financial-health__section-heading">
              <Box><Typography component="h2">Expense entries</Typography><Typography>Record packaging, salaries, utilities, rent, and other costs.</Typography></Box>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openExpenseDialog()}>Add expense</Button>
            </Box>
            {expenseRows.length ? (
              <Box className="financial-health__expense-table">
                <Box className="financial-health__expense-table-head"><span>Expense</span><span>Category</span><span>Date</span><span>Amount</span><span>Actions</span></Box>
                {expenseRows.map((expense) => (
                  <Box className="financial-health__expense-table-row" key={expense.id}>
                    <strong>{expense.name}</strong>
                    <span>{expenseCategories[expense.category] || "Other expenses"}</span>
                    <span>{formatReportDate(expense.date)}</span>
                    <strong>{CURRENCY.format(amount(expense.amount))}</strong>
                    <Box className="financial-health__expense-actions">
                      <Button size="small" aria-label={`Edit ${expense.name}`} startIcon={<EditOutlinedIcon />} onClick={() => openExpenseDialog(expense)}>Edit</Button>
                      <Button size="small" color="error" aria-label={`Delete ${expense.name}`} startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDeletingExpense(expense)}>Delete</Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box className="financial-health__empty-expenses">
                <Typography>No additional expenses recorded for this period.</Typography>
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => openExpenseDialog()}>Record an expense</Button>
              </Box>
            )}
          </Card>
        </>
      )}

      <ExpenseDialog
        open={expenseDialogOpen}
        draft={expenseDraft}
        setDraft={setExpenseDraft}
        error={expenseFormError}
        editing={Boolean(editingExpenseId)}
        onClose={() => setExpenseDialogOpen(false)}
        onSave={saveExpense}
      />
      <ConfirmationDialog
        open={Boolean(deletingExpense)}
        title="Delete expense?"
        message={<Typography>This will remove “{deletingExpense?.name}” from this browser and update the report.</Typography>}
        confirmLabel="Delete expense"
        destructive
        icon={<DeleteOutlineRoundedIcon />}
        onCancel={() => setDeletingExpense(null)}
        onConfirm={confirmDeleteExpense}
      />
    </Box>
  );
}
