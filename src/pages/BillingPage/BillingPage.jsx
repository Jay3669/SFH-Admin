import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalDiningRoundedIcon from "@mui/icons-material/LocalDiningRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { listMenuCategories, listMenuItems } from "../../services/menuService";
import { getPosSettings, loadPosSettings } from "../../services/posSettings";
import { createPosSale, listRecentPosSales } from "../../services/posService";
import "./BillingPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function itemId(item) {
  return String(item.menu_item_id ?? item.id);
}

function normalizeMenuItem(item, categories) {
  const categoryId = String(item.category_id ?? item.category?.category_id ?? "");
  const category = categories.find((entry) => String(entry.category_id ?? entry.id) === categoryId);
  return {
    id: itemId(item),
    name: String(item.name || "Menu item"),
    description: item.description || "",
    category: item.category_name || item.category?.category_name || category?.category_name || category?.name || "Menu",
    price: Number(item.price),
    imageUrl: item.image_url || "",
    foodType: item.food_type || "",
    available: item.is_available !== false && item.is_available !== 0 && item.is_available !== "false",
  };
}

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialPaymentMethod(settings) {
  if (settings.paymentMethods.cash) return "Cash";
  if (settings.paymentMethods.card) return "Card";
  if (settings.paymentMethods.upi) return "UPI";
  if (settings.paymentMethods.split) return "Split";
  return "";
}

export default function BillingPage() {
  const [settings, setSettings] = useState(getPosSettings);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All items");
  const [orderType, setOrderType] = useState("Dine-in");
  const [packagingCharge, setPackagingCharge] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(() => initialPaymentMethod(getPosSettings()));
  const [cashReceived, setCashReceived] = useState("");
  const [splitPayments, setSplitPayments] = useState(() => {
    const savedSettings = getPosSettings();
    const enabledMethods = ["Cash", "Card", "UPI"].filter((method) => savedSettings.paymentMethods[method.toLowerCase()]);
    return enabledMethods.slice(0, 2).map((method, index) => ({ id: index + 1, method, amount: "" }));
  });
  const [discount, setDiscount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [partialNotice, setPartialNotice] = useState("");
  const [completedBill, setCompletedBill] = useState(null);
  const [recentBills, setRecentBills] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([listMenuCategories(), listMenuItems(), loadPosSettings(), listRecentPosSales()])
      .then(([categories, items, posSettings, bills]) => {
        if (active) {
          setMenuItems(items.map((item) => normalizeMenuItem(item, categories)).filter((item) => item.available && Number.isFinite(item.price) && item.price > 0));
          setSettings(posSettings);
          setRecentBills(bills);
          setPaymentMethod((current) => {
            const enabled = current === "Split"
              ? posSettings.paymentMethods.split
              : posSettings.paymentMethods[current.toLowerCase()];
            return enabled ? current : initialPaymentMethod(posSettings);
          });
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load the menu.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["All items", ...new Set(menuItems.map((item) => item.category))], [menuItems]);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuItems.filter((item) => (
      (activeCategory === "All items" || item.category === activeCategory)
      && (!query || `${item.name} ${item.description}`.toLowerCase().includes(query))
    ));
  }, [activeCategory, menuItems, search]);
  const subtotal = cart.reduce((total, row) => total + row.price * row.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const packagingAmount = settings.packagingEnabled && orderType === "Takeaway"
    ? Math.max(0, Number(packagingCharge) || 0)
    : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount) + packagingAmount;
  const taxAmount = settings.taxEnabled ? taxableAmount * Math.max(0, Number(settings.taxRate) || 0) / 100 : 0;
  const total = Math.max(0, subtotal - discountAmount + packagingAmount + taxAmount);
  const amountTendered = Number(cashReceived) || 0;
  const splitTotal = splitPayments.reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const nonCashSplitTotal = splitPayments.filter((row) => row.method !== "Cash").reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const cashSplitTotal = splitPayments.filter((row) => row.method === "Cash").reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const paidAmount = paymentMethod === "Split" ? splitTotal : paymentMethod === "Cash" ? amountTendered : total;
  const changeDue = paymentMethod === "Cash"
    ? Math.max(0, amountTendered - total)
    : paymentMethod === "Split"
      ? Math.max(0, cashSplitTotal - Math.max(0, total - nonCashSplitTotal))
      : 0;
  const balanceDue = Math.max(0, total - paidAmount);
  const enabledPaymentMethods = ["Cash", "Card", "UPI"].filter((method) => settings.paymentMethods[method.toLowerCase()]);
  const splitHasValidRows = splitPayments.length >= 2 && splitPayments.every((row) => Number(row.amount) > 0);
  const splitHasValidTotal = settings.allowBalanceDue || splitTotal >= total;
  const splitHasValidChange = splitTotal <= total || cashSplitTotal > 0;
  const tenderIsValid = paymentMethod === "Split"
    ? splitHasValidRows && splitHasValidTotal && splitHasValidChange
    : paymentMethod === "Cash"
      ? settings.allowBalanceDue || amountTendered >= total
      : Boolean(paymentMethod);
  const canComplete = Boolean(cart.length) && Boolean(paymentMethod) && !saving && tenderIsValid;

  function choosePaymentMethod(method) {
    setPaymentMethod(method);
    if (method === "Split" && splitPayments.length < 2) {
      const methods = enabledPaymentMethods.slice(0, 2);
      setSplitPayments(methods.map((payment, index) => ({ id: Date.now() + index, method: payment, amount: "" })));
    }
  }

  function updateSplitPayment(id, key, value) {
    setSplitPayments((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  }

  function addSplitPayment() {
    setSplitPayments((current) => {
      if (current.length >= enabledPaymentMethods.length) return current;
      const nextMethod = enabledPaymentMethods.find((method) => !current.some((row) => row.method === method)) || enabledPaymentMethods[0];
      return [...current, { id: Date.now(), method: nextMethod, amount: "" }];
    });
  }

  function addToCart(item) {
    setError("");
    setCart((current) => {
      const existing = current.find((row) => row.id === item.id);
      return existing
        ? current.map((row) => row.id === item.id ? { ...row, quantity: row.quantity + 1 } : row)
        : [...current, { ...item, quantity: 1 }];
    });
  }

  function adjustQuantity(id, amount) {
    setCart((current) => current
      .map((row) => row.id === id ? { ...row, quantity: row.quantity + amount } : row)
      .filter((row) => row.quantity > 0));
  }

  async function completeBill() {
    if (!cart.length || saving) return;
    if (!tenderIsValid) {
      setError(settings.allowBalanceDue ? "Enter a valid payment amount for every split line." : "Payment must cover the full bill total.");
      return;
    }

    setError("");
    setPartialNotice("");
    setSaving(true);
    const idempotencyKey = newIdempotencyKey();
    const tenders = paymentMethod === "Split"
      ? splitPayments.map((row) => ({ method: row.method, amount: Number(row.amount) })).filter((row) => row.amount > 0)
      : paymentMethod === "Cash"
        ? amountTendered > 0 ? [{ method: "Cash", amount: amountTendered }] : []
        : [{ method: paymentMethod, amount: total }];
    try {
      const bill = await createPosSale({
        idempotencyKey,
        items: cart.map((row) => ({ menuItemId: row.id, quantity: row.quantity })),
        orderType,
        packagingAmount,
        discountAmount,
        paymentMethod,
        tenders,
      });
      setCompletedBill(bill);
      setRecentBills((current) => [bill, ...current.filter((entry) => entry.id !== bill.id)].slice(0, 5));
      setPartialNotice(bill.stockWarnings?.join(" ") || "");
      setCart([]);
      setDiscount("");
      setPackagingCharge("");
      setCashReceived("");
      setSplitPayments((current) => current.map((row) => ({ ...row, amount: "" })));
    } catch (saveError) {
      setError(saveError.message || "Unable to complete the bill.");
    } finally {
      setSaving(false);
    }
  }

  function printBill() {
    window.print();
  }

  return (
    <Box className="billing-page">
      <Box className="billing-page__header">
        <Box>
          <Typography className="billing-page__eyebrow">FRONT COUNTER</Typography>
          <Typography component="h1">Billing &amp; POS</Typography>
          <Typography>Build an order, collect payment, and close the sale.</Typography>
        </Box>
        <Box className="billing-page__header-stat"><ShoppingBagOutlinedIcon /><Box><strong>{cart.reduce((count, row) => count + row.quantity, 0)}</strong><span>items in bill</span></Box></Box>
      </Box>

      {(error || partialNotice) && <Alert severity={partialNotice ? "warning" : "error"} onClose={() => { setError(""); setPartialNotice(""); }}>
        {error}{partialNotice && <Typography component="span" display="block">{partialNotice}</Typography>}
      </Alert>}

      <Box className="billing-layout">
        <Box className="billing-catalog">
          <Card className="billing-catalog__panel" elevation={0}>
            <Box className="billing-catalog__toolbar">
              <Box><Typography component="h2">Menu</Typography><Typography>{menuItems.length} available items</Typography></Box>
              <TextField
                className="billing-search"
                size="small"
                placeholder="Search menu"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{ htmlInput: { "aria-label": "Search menu" }, input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
              />
            </Box>
            <Box className="billing-categories" aria-label="Menu categories">
              {categories.map((category) => <Button key={category} size="small" className={activeCategory === category ? "is-active" : ""} onClick={() => setActiveCategory(category)}>{category}</Button>)}
            </Box>
            {loading ? <Box className="billing-empty"><Typography>Loading menu…</Typography></Box> : visibleItems.length ? (
              <Box className="billing-product-grid">
                {visibleItems.map((item) => (
                  <Card className="billing-product" elevation={0} key={item.id}>
                    <Box className="billing-product__image" style={item.imageUrl ? { backgroundImage: `url("${item.imageUrl}")` } : undefined}>
                      {!item.imageUrl && <LocalDiningRoundedIcon />}
                      <Chip size="small" label={item.foodType || "Menu item"} />
                    </Box>
                    <Box className="billing-product__body">
                      <Box><Typography component="h3">{item.name}</Typography><Typography>{item.category}</Typography></Box>
                      <Box className="billing-product__footer"><strong>{CURRENCY.format(item.price)}</strong><IconButton aria-label={`Add ${item.name} to bill`} title="Add to bill" onClick={() => addToCart(item)}><AddRoundedIcon /></IconButton></Box>
                    </Box>
                  </Card>
                ))}
              </Box>
            ) : <Box className="billing-empty"><LocalDiningRoundedIcon /><Typography component="h3">No menu items found</Typography><Typography>Try a different search or category.</Typography></Box>}
          </Card>
        </Box>

        <Card className="billing-ticket" elevation={0}>
          <Box className="billing-ticket__heading"><Box><Typography component="h2">Current bill</Typography><Typography>{new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</Typography></Box><Chip label={`${cart.length} lines`} size="small" /></Box>
          {cart.length ? <Box className="billing-ticket__lines">
            {cart.map((row) => (
              <Box className="billing-line" key={row.id}>
                <Box className="billing-line__copy"><Typography>{row.name}</Typography><Typography>{CURRENCY.format(row.price)} each</Typography></Box>
                <ButtonGroup size="small" className="billing-line__quantity" aria-label={`${row.name} quantity`}>
                  <IconButton aria-label={`Decrease ${row.name}`} onClick={() => adjustQuantity(row.id, -1)}><RemoveRoundedIcon fontSize="small" /></IconButton>
                  <span>{row.quantity}</span>
                  <IconButton aria-label={`Increase ${row.name}`} onClick={() => adjustQuantity(row.id, 1)}><AddRoundedIcon fontSize="small" /></IconButton>
                </ButtonGroup>
                <strong className="billing-line__total">{CURRENCY.format(row.price * row.quantity)}</strong>
                <IconButton aria-label={`Remove ${row.name}`} className="billing-line__remove" onClick={() => setCart((current) => current.filter((entry) => entry.id !== row.id))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box> : <Box className="billing-ticket__empty"><ShoppingBagOutlinedIcon /><Typography>Start a bill</Typography><Typography>Add an item from the menu.</Typography></Box>}

          <Box className="billing-ticket__checkout">
            <FormControl size="small">
              <InputLabel id="billing-order-type-label">Order type</InputLabel>
              <Select
                labelId="billing-order-type-label"
                label="Order type"
                value={orderType}
                onChange={(event) => setOrderType(event.target.value)}
              >
                <MenuItem value="Dine-in">Dine-in</MenuItem>
                <MenuItem value="Takeaway">Takeaway</MenuItem>
              </Select>
            </FormControl>
            {settings.packagingEnabled && orderType === "Takeaway" && (
              <TextField
                size="small"
                type="number"
                label="Packaging charge (₹)"
                value={packagingCharge}
                onChange={(event) => setPackagingCharge(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
              />
            )}
            <TextField size="small" type="number" label="Discount (₹)" value={discount} onChange={(event) => setDiscount(event.target.value)} slotProps={{ htmlInput: { min: 0, max: subtotal, step: "any" } }} />
            <Box className="billing-totals">
              <Box><span>Subtotal</span><strong>{CURRENCY.format(subtotal)}</strong></Box>
              <Box><span>Discount</span><strong>− {CURRENCY.format(discountAmount)}</strong></Box>
              {settings.packagingEnabled && orderType === "Takeaway" && <Box><span>Packaging</span><strong>{CURRENCY.format(packagingAmount)}</strong></Box>}
              {settings.taxEnabled && <Box><span>Tax · {Number(settings.taxRate) || 0}%</span><strong>{CURRENCY.format(taxAmount)}</strong></Box>}
              <Box className="billing-totals__due"><span>Amount due</span><strong>{CURRENCY.format(total)}</strong></Box>
            </Box>
            <FormControl>
              <Typography className="billing-payment__label">Payment method</Typography>
              <RadioGroup row value={paymentMethod} onChange={(event) => choosePaymentMethod(event.target.value)} aria-label="Payment method">
                {enabledPaymentMethods.map((method) => <FormControlLabel key={method} value={method} control={<Radio size="small" />} label={method} />)}
                {settings.paymentMethods.split && <FormControlLabel value="Split" control={<Radio size="small" />} label="Split" />}
              </RadioGroup>
            </FormControl>
            {paymentMethod === "Cash" && <Box className="billing-cash-row">
              <Box className="billing-cash-row__input">
                <TextField size="small" type="number" label="Cash received (₹)" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                <Button size="small" onClick={() => setCashReceived(total.toFixed(2))}>Exact Amount</Button>
              </Box>
              <Typography>Change <strong>{CURRENCY.format(changeDue)}</strong></Typography>
            </Box>}
            {paymentMethod === "Split" && <Box className="billing-split-payments">
              <Typography>Split tender</Typography>
              {splitPayments.map((row) => (
                <Box className="billing-split-row" key={row.id}>
                  <FormControl size="small">
                    <InputLabel id={`split-method-${row.id}`}>Method</InputLabel>
                    <Select labelId={`split-method-${row.id}`} label="Method" value={row.method} onChange={(event) => updateSplitPayment(row.id, "method", event.target.value)}>
                      {enabledPaymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" label="Amount (₹)" value={row.amount} onChange={(event) => updateSplitPayment(row.id, "amount", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                  {splitPayments.length > 2 && <IconButton aria-label={`Remove ${row.method} payment`} onClick={() => setSplitPayments((current) => current.filter((entry) => entry.id !== row.id))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>}
                </Box>
              ))}
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={addSplitPayment} disabled={splitPayments.length >= enabledPaymentMethods.length}>Add payment method</Button>
              <Typography className="billing-split-total">Entered {CURRENCY.format(splitTotal)}{balanceDue > 0 ? ` · Remaining ${CURRENCY.format(balanceDue)}` : " · Fully covered"}</Typography>
              {changeDue > 0 && <Typography className="billing-split-total">Cash change {CURRENCY.format(changeDue)}</Typography>}
            </Box>}
            {settings.allowBalanceDue && balanceDue > 0 && paymentMethod !== "Split" && <Typography className="billing-balance-due">Remaining balance {CURRENCY.format(balanceDue)}</Typography>}
            <Button className="billing-complete" variant="contained" color="secondary" fullWidth disabled={!canComplete} onClick={completeBill} startIcon={saving ? undefined : <CheckCircleRoundedIcon />}>{saving ? "Recording sale…" : "Complete bill"}</Button>
            <Typography className="billing-ticket__note">Completing a bill records each item and deducts its recipe ingredients from stock.</Typography>
          </Box>
        </Card>
      </Box>

      {recentBills.length > 0 && <Box className="billing-recent">
        <Typography component="h2">Recent bills · this session</Typography>
        <Box className="billing-recent__list">{recentBills.map((bill) => <Card elevation={0} key={bill.number}><Box><strong>{bill.number}</strong><span>{bill.items.length} lines · {bill.paymentMethod}</span></Box><strong>{CURRENCY.format(bill.total)}</strong></Card>)}</Box>
      </Box>}

      <Dialog open={Boolean(completedBill)} onClose={() => setCompletedBill(null)} fullWidth maxWidth="xs" className="billing-receipt">
        {completedBill && <>
          <DialogTitle><Box className="billing-receipt__title"><CheckCircleRoundedIcon /><Box><Typography component="h2">Bill complete</Typography><Typography>{completedBill.number}</Typography></Box></Box></DialogTitle>
          <DialogContent className="billing-receipt__content">
            <Box className="billing-receipt__line"><span>Order type</span><strong>{completedBill.orderType}</strong></Box>
            {completedBill.items.map((row) => <Box className="billing-receipt__line" key={row.id}><span>{row.quantity} × {row.name}</span><strong>{CURRENCY.format(row.quantity * row.price)}</strong></Box>)}
            <Box className="billing-receipt__line"><span>Subtotal</span><strong>{CURRENCY.format(completedBill.subtotal)}</strong></Box>
            <Box className="billing-receipt__line"><span>Discount</span><strong>− {CURRENCY.format(completedBill.discount)}</strong></Box>
            {completedBill.packaging > 0 && <Box className="billing-receipt__line"><span>Packaging</span><strong>{CURRENCY.format(completedBill.packaging)}</strong></Box>}
            {completedBill.tax > 0 && <Box className="billing-receipt__line"><span>Tax</span><strong>{CURRENCY.format(completedBill.tax)}</strong></Box>}
            <Box className="billing-receipt__line is-total"><span>Total · {completedBill.paymentMethod}</span><strong>{CURRENCY.format(completedBill.total)}</strong></Box>
            {completedBill.tenders.map((tender, index) => <Box className="billing-receipt__line" key={`${tender.method}-${index}`}><span>{tender.method} payment</span><strong>{CURRENCY.format(tender.amount)}</strong></Box>)}
            {completedBill.paymentMethod === "Cash" && <Box className="billing-receipt__line"><span>Change</span><strong>{CURRENCY.format(completedBill.changeDue)}</strong></Box>}
            {completedBill.changeDue > 0 && completedBill.paymentMethod === "Split" && <Box className="billing-receipt__line"><span>Change</span><strong>{CURRENCY.format(completedBill.changeDue)}</strong></Box>}
            {completedBill.balanceDue > 0 && <Box className="billing-receipt__line is-balance"><span>Balance remaining</span><strong>{CURRENCY.format(completedBill.balanceDue)}</strong></Box>}
          </DialogContent>
          <DialogActions><Button onClick={printBill}>Print</Button><Button variant="contained" onClick={() => setCompletedBill(null)}>New bill</Button></DialogActions>
        </>}
      </Dialog>
    </Box>
  );
}