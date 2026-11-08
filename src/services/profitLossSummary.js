import { FINANCIAL_EXPENSE_CATEGORIES } from "./financialExpenses";

const EMPTY_BILLS = [];

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function saleRefunds(sale) {
  if (Array.isArray(sale.refunds)) {
    return sale.refunds.reduce((sum, refund) => sum + amount(refund.amount ?? refund.total), 0);
  }
  return amount(sale.refundAmount ?? sale.refundTotal ?? sale.refund);
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function summarizeProfitLoss(report, expenses = []) {
  const salesBills = report?.sales?.bills || EMPTY_BILLS;
  const purchaseBills = (report?.purchases?.bills || EMPTY_BILLS)
    .filter((purchase) => purchase.status !== "Cancelled");
  const grossSales = salesBills.length
    ? salesBills.reduce((sum, sale) => {
      if (sale.subtotal != null) return sum + amount(sale.subtotal);
      return sum + amount(sale.total) + amount(sale.discount) + saleRefunds(sale) - amount(sale.packaging) - amount(sale.tax);
    }, 0)
    : amount(report?.sales?.total);
  const discounts = salesBills.reduce((sum, sale) => sum + amount(sale.discount) + saleRefunds(sale), 0);
  const packagingCharges = salesBills.reduce((sum, sale) => sum + amount(sale.packaging), 0);
  const taxesCollected = salesBills.reduce((sum, sale) => sum + amount(sale.tax), 0);
  const ingredientCosts = Number.isFinite(Number(report?.purchases?.total))
    ? amount(report.purchases.total)
    : purchaseBills.reduce((sum, purchase) => sum + amount(purchase.total), 0);
  const from = dateOnly(report?.from);
  const to = dateOnly(report?.to || report?.from);
  const periodExpenses = expenses.filter((expense) => (
    (!from || expense.date >= from) && (!to || expense.date <= to)
  ));
  const expenseTotals = FINANCIAL_EXPENSE_CATEGORIES.reduce((totals, category) => {
    totals[category.value] = periodExpenses
      .filter((expense) => expense.category === category.value)
      .reduce((sum, expense) => sum + amount(expense.amount), 0);
    return totals;
  }, {});
  const netSales = grossSales - discounts + packagingCharges;
  const totalCostOfGoods = ingredientCosts + expenseTotals.packaging;
  const grossProfit = netSales - totalCostOfGoods;
  const operatingExpenses = expenseTotals.staff + expenseTotals.utilities + expenseTotals.other;
  const totalCosts = totalCostOfGoods + operatingExpenses;
  const netProfit = netSales - totalCosts;

  return {
    salesBills,
    purchaseBills,
    expenses: periodExpenses,
    grossSales,
    discounts,
    packagingCharges,
    taxesCollected,
    netSales,
    ingredientCosts,
    expenseTotals,
    totalCostOfGoods,
    grossProfit,
    operatingExpenses,
    totalCosts,
    netProfit,
    profitMargin: netSales > 0 ? (netProfit / netSales) * 100 : 0,
  };
}
