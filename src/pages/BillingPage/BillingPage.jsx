import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
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
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalDiningRoundedIcon from "@mui/icons-material/LocalDiningRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { listMenuCategories, listMenuItems } from "../../services/menuService";
import { getPosSettings, loadPosSettings } from "../../services/posSettings";
import { createPosSale, listRecentPosSales, setManagerPin } from "../../services/posService";
import { getStoredAdmin } from "../../services/authService";
import { connectKitchenSocket } from "../../services/kotService";
import { listActivePromotions, resendWhatsAppBill } from "../../services/featureServices";
import { formatDate } from "../../utils/dateTimeFormat";
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
    categoryId,
    name: String(item.name || "Menu item"),
    description: item.description || "",
    shortCode: String(item.short_code || item.shortCode || item.code || ""),
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

function indianPhoneDigits(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

function allocateAmount(total, rows) {
  const totalCents = Math.round(total * 100);
  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!rows.length || weightTotal <= 0) return {};
  const shares = rows.map((row) => {
    const exactCents = totalCents * row.weight / weightTotal;
    return { id: row.id, cents: Math.floor(exactCents), remainder: exactCents % 1 };
  });
  let remainingCents = totalCents - shares.reduce((sum, share) => sum + share.cents, 0);
  for (const share of [...shares].sort((left, right) => right.remainder - left.remainder)) {
    if (remainingCents <= 0) break;
    share.cents += 1;
    remainingCents -= 1;
  }
  return Object.fromEntries(shares.map((share) => [share.id, share.cents / 100]));
}

function splitEvenly(total, count) {
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;
  return Array.from({ length: count }, (_, index) => (baseCents + (index < remainderCents ? 1 : 0)) / 100);
}

function initialPaymentMethod(settings) {
  if (settings.paymentMethods.cash) return "Cash";
  if (settings.paymentMethods.card) return "Card";
  if (settings.paymentMethods.upi) return "UPI";
  if (settings.paymentMethods.split) return "Split";
  return "";
}

function stockDeductionLabel(status) {
  return ({
    pending: "queued",
    awaiting_payment: "awaiting payment",
    completed: "completed",
  })[status] || status;
}

export default function BillingPage() {
  const currentUser = getStoredAdmin();
  const [settings, setSettings] = useState(getPosSettings);
  const [menuItems, setMenuItems] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [promotionRetry, setPromotionRetry] = useState(0);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);
  const categoryRefs = useRef([]);
  const cartTouchStart = useRef(null);
  const [activeCategory, setActiveCategory] = useState("All items");
  const [orderType, setOrderType] = useState("Dine-in");
  const [packagingCharge, setPackagingCharge] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(() => initialPaymentMethod(getPosSettings()));
  const [cashReceived, setCashReceived] = useState("");
  const [singlePaymentReference, setSinglePaymentReference] = useState("");
  const [splitMode, setSplitMode] = useState("tender");
  const [splitPeopleCount, setSplitPeopleCount] = useState(2);
  const [equalSplitMethods, setEqualSplitMethods] = useState(["Cash", "Cash"]);
  const [equalSplitReferences, setEqualSplitReferences] = useState(["", ""]);
  const [itemAssignments, setItemAssignments] = useState({});
  const [itemSplitMethods, setItemSplitMethods] = useState(["Cash", "Cash"]);
  const [itemSplitReferences, setItemSplitReferences] = useState(["", ""]);
  const [splitPayments, setSplitPayments] = useState(() => {
    const savedSettings = getPosSettings();
    const enabledMethods = ["Cash", "Card", "UPI"].filter((method) => savedSettings.paymentMethods[method.toLowerCase()]);
    return enabledMethods.slice(0, 2).map((method, index) => ({ id: index + 1, method, amount: "" }));
  });
  const [discount, setDiscount] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalPin, setApprovalPin] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [partialNotice, setPartialNotice] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [promotionError, setPromotionError] = useState("");
  const [completedBill, setCompletedBill] = useState(null);
  const [autoPrintRequested, setAutoPrintRequested] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [recentBills, setRecentBills] = useState([]);
  const [noteItemId, setNoteItemId] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [retryingWhatsApp, setRetryingWhatsApp] = useState(false);
  const submitLock = useRef(false);
  const submissionKey = useRef(null);

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

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    const refreshPromotions = () => {
      setPromotionsLoaded(false);
      listActivePromotions(menuItems.map((item) => item.categoryId).filter(Boolean))
        .then((currentPromotions) => {
          if (active) {
            setPromotions(currentPromotions);
            setPromotionError("");
          setError((current) => current.includes("Scheduled discounts changed") ? "" : current);
          setPromotionsLoaded(true);
        }
        })
        .catch((promotionError) => {
          if (active) {
            setPromotionError(promotionError.message || "Unable to verify current promotions. Billing is paused until this is resolved.");
            setPromotionsLoaded(false);
          }
        });
    };
    refreshPromotions();
    const intervalId = window.setInterval(refreshPromotions, 60000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loading, menuItems, promotionRetry]);

  useEffect(() => {
    let active = true;
    let socket;
    try {
      socket = connectKitchenSocket();
      const refreshMenu = () => {
        Promise.all([listMenuCategories(), listMenuItems()])
          .then(([categories, items]) => {
            if (!active) return;
            setMenuItems(items
              .map((item) => normalizeMenuItem(item, categories))
              .filter((item) => item.available && Number.isFinite(item.price) && item.price > 0));
            setError((current) => current.startsWith("Live menu updates") ? "" : current);
          })
          .catch((refreshError) => {
            if (active) setError(`Live menu updates could not refresh: ${refreshError.message}`);
          });
      };
      socket.on("connect", refreshMenu);
      socket.on("disconnect", () => {
        if (active) setError("Live menu updates disconnected. Reconnect or reload to refresh availability.");
      });
      socket.on("menu:item-updated", (updatedItem) => {
        const item = normalizeMenuItem(updatedItem, []);
        if (!active) return;
        setMenuItems((current) => {
          const next = current.filter((entry) => entry.id !== item.id);
          return item.available && Number.isFinite(item.price) && item.price > 0 ? [...next, item] : next;
        });
      });
      socket.on("connect_error", (socketError) => {
        if (active) setError(`Live menu updates are unavailable: ${socketError.message || "Connection error."}`);
      });
    } catch (socketError) {
      if (active) setError(`Live menu updates are unavailable: ${socketError.message || "Connection error."}`);
    }
    return () => {
      active = false;
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!autoPrintRequested || !completedBill) return undefined;
    const timerId = window.setTimeout(() => {
      window.print();
      setAutoPrintRequested(false);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [autoPrintRequested, completedBill]);

  const categories = useMemo(() => ["All items", ...new Set(menuItems.map((item) => item.category))], [menuItems]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleSearchShortcut(event) {
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }
    function handleCategoryShortcut(event) {
      if (!event.altKey || !/^[1-9]$/.test(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )) return;
      const category = categories[Number(event.key)];
      if (!category) return;
      event.preventDefault();
      setActiveCategory(category);
      categoryRefs.current[Number(event.key)]?.focus();
    }
    window.addEventListener("keydown", handleSearchShortcut);
    window.addEventListener("keydown", handleCategoryShortcut);
    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
      window.removeEventListener("keydown", handleCategoryShortcut);
    };
  }, [categories]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    return menuItems.filter((item) => {
      const words = item.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const initials = words.map((word) => word[0]).join("");
      const name = item.name.toLowerCase();
      const searchTermsMatch = !query
        || name.includes(query)
        || item.shortCode.toLowerCase().includes(query)
        || initials.startsWith(query)
        || terms.every((term) => words.some((word) => word.startsWith(term)) || name.includes(term));
      return (
      (activeCategory === "All items" || item.category === activeCategory)
      && searchTermsMatch
      );
    });
  }, [activeCategory, menuItems, search]);
  const subtotal = cart.reduce((total, row) => total + row.price * row.quantity, 0);
  const compAmount = cart.reduce((sum, row) => sum + (row.comp ? row.price * row.quantity : 0), 0);
  const promotionPercentByCategory = promotions.reduce((current, promotion) => {
    const key = String(promotion.categoryId);
    current.set(key, Math.max(current.get(key) || 0, Number(promotion.discountPercent)));
    return current;
  }, new Map());
  const promotionalDiscountAmount = Math.round(cart.reduce((sum, row) => (
    sum + (row.comp ? 0 : row.price * row.quantity * (promotionPercentByCategory.get(String(row.categoryId)) || 0) / 100)
  ), 0) * 100) / 100;
  const manualDiscountAmount = Math.min(
    Math.max(0, subtotal - compAmount - promotionalDiscountAmount),
    Math.max(0, Number(discount) || 0),
  );
  const discountAmount = Math.min(subtotal, manualDiscountAmount + compAmount + promotionalDiscountAmount);
  const requiresDiscountApproval = compAmount > 0 || manualDiscountAmount + compAmount > subtotal * 0.1 + 0.000001;
  const packagingAmount = settings.packagingEnabled && orderType === "Takeaway"
    ? Math.max(0, Number(packagingCharge) || 0)
    : 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount) + packagingAmount;
  const taxAmount = settings.taxEnabled
    ? Math.floor(taxableAmount * Math.max(0, Number(settings.taxRate) || 0) / 100 + 0.5)
    : 0;
  const cgstAmount = Math.round((taxAmount / 2 + Number.EPSILON) * 100) / 100;
  const sgstAmount = Math.round((taxAmount - cgstAmount + Number.EPSILON) * 100) / 100;
  const total = Math.round((Math.max(0, subtotal - discountAmount + packagingAmount + taxAmount) + Number.EPSILON) * 100) / 100;
  const enabledPaymentMethods = ["Cash", "Card", "UPI"].filter((method) => settings.paymentMethods[method.toLowerCase()]);
  const peopleCount = Number(splitPeopleCount);
  const validPeopleCount = Number.isInteger(peopleCount) && peopleCount >= 2 && peopleCount <= 20;
  const equalAmounts = validPeopleCount ? splitEvenly(total, peopleCount) : [];
  const lineAmounts = allocateAmount(total, cart.map((row) => ({ id: row.id, weight: row.price * row.quantity })));
  const itemSplitAmounts = validPeopleCount
    ? Array.from({ length: peopleCount }, (_, index) => cart.reduce(
      (sum, row) => sum + (Number(itemAssignments[row.id]) === index + 1 ? lineAmounts[row.id] || 0 : 0),
      0,
    ))
    : [];
  const splitMethod = (methods, index) => enabledPaymentMethods.includes(methods[index])
    ? methods[index]
    : enabledPaymentMethods[0] || "";
  const equalSplitTenders = equalAmounts.map((amount, index) => ({
    method: splitMethod(equalSplitMethods, index),
    amount,
    transactionRef: equalSplitReferences[index] || "",
  }));
  const itemSplitTenders = itemSplitAmounts
    .map((amount, index) => ({
      method: splitMethod(itemSplitMethods, index),
      amount,
      transactionRef: itemSplitReferences[index] || "",
    }))
    .filter((row) => row.amount > 0);
  const activeSplitTenders = splitMode === "equal"
    ? equalSplitTenders
    : splitMode === "items"
      ? itemSplitTenders
      : splitPayments;
  const amountTendered = Number(cashReceived) || 0;
  const splitTotal = activeSplitTenders.reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const nonCashSplitTotal = activeSplitTenders.filter((row) => row.method !== "Cash").reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const cashSplitTotal = activeSplitTenders.filter((row) => row.method === "Cash").reduce((amount, row) => amount + Math.max(0, Number(row.amount) || 0), 0);
  const paidAmount = paymentMethod === "Split" ? splitTotal : paymentMethod === "Cash" ? amountTendered : total;
  const changeDue = paymentMethod === "Cash"
    ? Math.max(0, amountTendered - total)
    : paymentMethod === "Split"
      ? Math.max(0, cashSplitTotal - Math.max(0, total - nonCashSplitTotal))
      : 0;
  const balanceDue = Math.max(0, total - paidAmount);
  const splitHasValidRows = activeSplitTenders.length >= 2 && activeSplitTenders.every((row) => Number(row.amount) > 0 && Boolean(row.method));
  const splitHasValidTotal = splitMode !== "tender" || settings.allowBalanceDue || splitTotal >= total;
  const splitHasValidChange = splitMode !== "tender" || splitTotal <= total || cashSplitTotal > 0;
  const itemAssignmentsAreValid = cart.length > 0 && cart.every((row) => (
    Number.isInteger(Number(itemAssignments[row.id]))
    && Number(itemAssignments[row.id]) >= 1
    && Number(itemAssignments[row.id]) <= peopleCount
  ));
  const itemSplitHasMultiplePeople = itemSplitAmounts.filter((amount) => amount > 0).length >= 2;
  const equalSplitIsValid = validPeopleCount && equalSplitTenders.length >= 2 && equalSplitTenders.every((row) => Boolean(row.method));
  const itemSplitIsValid = validPeopleCount && itemAssignmentsAreValid && itemSplitHasMultiplePeople;
  const tenderIsValid = paymentMethod === "Split"
    ? splitMode === "equal"
      ? equalSplitIsValid
      : splitMode === "items"
        ? itemSplitIsValid
        : splitHasValidRows && splitHasValidTotal && splitHasValidChange
    : paymentMethod === "Cash"
      ? settings.allowBalanceDue || amountTendered >= total
      : Boolean(paymentMethod);
  const normalizedPhone = indianPhoneDigits(customerPhone);
  const whatsappDetailsValid = !whatsappOptIn || /^[6-9]\d{9}$/.test(normalizedPhone);
  const canComplete = Boolean(cart.length) && Boolean(paymentMethod) && !saving && tenderIsValid && promotionsLoaded && whatsappDetailsValid;

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
        ? current.map((row) => row.id === item.id ? { ...row, quantity: Math.min(99, row.quantity + 1) } : row)
        : [...current, { ...item, quantity: 1 }];
    });
  }

  function adjustQuantity(id, amount) {
    setCart((current) => current
      .map((row) => row.id === id ? { ...row, quantity: Math.min(99, row.quantity + amount) } : row)
      .filter((row) => row.quantity > 0));
  }

  function startCartSwipe(event) {
    if (event.target.closest("button")) {
      cartTouchStart.current = null;
      return;
    }
    cartTouchStart.current = event.touches[0]?.clientX ?? null;
  }

  function finishCartSwipe(event, id) {
    const startX = cartTouchStart.current;
    cartTouchStart.current = null;
    if (startX === null || event.changedTouches[0].clientX - startX > -80) return;
    setCart((current) => current.filter((row) => row.id !== id));
  }

  function openLineNote(row) {
    setNoteItemId(row.id);
    setNoteDraft(row.notes || "");
  }

  function saveLineNote() {
    setCart((current) => current.map((row) => row.id === noteItemId
      ? { ...row, notes: noteDraft.trim() }
      : row));
    setNoteItemId("");
    setNoteDraft("");
  }

  function toggleComp(id) {
    const updated = cart.map((row) => row.id === id ? { ...row, comp: !row.comp } : row);
    const nextCompAmount = updated.reduce((sum, row) => sum + (row.comp ? row.price * row.quantity : 0), 0);
    setCart(updated);
    setDiscount((value) => String(Math.min(Math.max(0, Number(value) || 0), Math.max(0, subtotal - nextCompAmount))));
  }

  function completeBill() {
    if (!cart.length || saving) return;
    if (!promotionsLoaded) {
      setPromotionRetry((value) => value + 1);
      setError("Scheduled discounts are still being verified. Try again when the check completes.");
      return;
    }
    if (!tenderIsValid) {
      setError(settings.allowBalanceDue ? "Enter a valid payment amount for every split line." : "Payment must cover the full bill total.");
      return;
    }
    if (requiresDiscountApproval) {
      setPaymentOpen(false);
      setApprovalPin("");
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    setPaymentOpen(true);
  }

  function confirmTender() {
    if (!cart.length || saving) return;
    if (!promotionsLoaded) {
      setPromotionRetry((value) => value + 1);
      setError("Scheduled discounts are still being verified. Try again when the check completes.");
      return;
    }
    if (!whatsappDetailsValid) {
      setError("Enter a valid customer phone number or turn off WhatsApp bill delivery.");
      return;
    }
    if (!tenderIsValid) {
      setError(settings.allowBalanceDue ? "Enter a valid payment amount for every split line." : "Payment must cover the full bill total.");
      return;
    }
    setPaymentOpen(false);
    if (requiresDiscountApproval) {
      setApprovalPin("");
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    submitBill(null);
  }

  async function submitBill(authorization) {
    if (!cart.length || saving || submitLock.current) return;
    if (!promotionsLoaded) {
      setPromotionRetry((value) => value + 1);
      setError("Scheduled discounts are still being verified. Try again when the check completes.");
      return;
    }
    if (!whatsappDetailsValid) {
      setError("Enter a valid customer phone number or turn off WhatsApp bill delivery.");
      return;
    }
    if (!tenderIsValid) {
      setError(settings.allowBalanceDue ? "Enter a valid payment amount for every split line." : "Payment must cover the full bill total.");
      return;
    }

    setError("");
    setPartialNotice("");
    submitLock.current = true;
    setSaving(true);
    submissionKey.current ||= newIdempotencyKey();
    const idempotencyKey = submissionKey.current;
    const tenderRows = paymentMethod === "Split"
      ? activeSplitTenders.map((row) => ({ method: row.method, amount: Number(row.amount), transactionRef: row.transactionRef }))
      : paymentMethod === "Cash"
        ? amountTendered > 0 ? [{ method: "Cash", amount: amountTendered, transactionRef: singlePaymentReference }] : []
        : [{ method: paymentMethod, amount: total, transactionRef: singlePaymentReference }];
    const tenders = tenderRows.map((row) => ({
      method: row.method,
      amount: row.amount,
      ...(row.transactionRef?.trim() ? { transactionRef: row.transactionRef.trim() } : {}),
    }));
    try {
      const bill = await createPosSale({
        idempotencyKey,
        items: cart.map((row) => ({
          menuItemId: row.id,
          quantity: row.quantity,
          ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
        })),
        compItemIds: cart.filter((row) => row.comp).map((row) => row.id),
        orderType,
        packagingAmount,
        discountAmount: manualDiscountAmount,
        promotionalDiscountAmount,
        customerPhone: whatsappOptIn ? customerPhone : "",
        whatsappOptIn,
        ...(authorization ? { discountAuthorization: authorization } : {}),
        paymentMethod,
        tenders,
      });
      setCompletedBill(bill);
      submissionKey.current = null;
      setPaymentOpen(false);
      setAutoPrintRequested(true);
      setRecentBills((current) => [bill, ...current.filter((entry) => entry.id !== bill.id)].slice(0, 5));
      setPartialNotice(bill.stockWarnings?.join(" ") || "");
      setCart([]);
      setDiscount("");
      setApprovalOpen(false);
      setApprovalPin("");
      setApprovalReason("");
      setPackagingCharge("");
      setCashReceived("");
      setCustomerPhone("");
      setWhatsappOptIn(false);
      setSinglePaymentReference("");
      setEqualSplitReferences(Array(20).fill(""));
      setItemSplitReferences(Array(20).fill(""));
      setItemAssignments({});
      setSplitPayments((current) => current.map((row) => ({ ...row, amount: "", transactionRef: "" })));
    } catch (saveError) {
      const message = saveError.message || "Unable to complete the bill.";
      setError(message);
      if (message.includes("Scheduled discounts changed")) {
        setPaymentOpen(false);
        setPromotionRetry((value) => value + 1);
      }
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  async function saveManagerPin() {
    if (pinSaving) return;
    setError("");
    setPinSaving(true);
    try {
      await setManagerPin({ currentPassword, pin: newPin, confirmPin });
      setPinSetupOpen(false);
      setCurrentPassword("");
      setNewPin("");
      setConfirmPin("");
      setSuccessNotice("Manager approval PIN saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save the manager PIN.");
    } finally {
      setPinSaving(false);
    }
  }

  function printBill() {
    window.print();
  }

  async function retryWhatsAppDelivery() {
    if (!completedBill || retryingWhatsApp) return;
    setRetryingWhatsApp(true);
    try {
      const delivery = await resendWhatsAppBill(completedBill.id);
      setCompletedBill((current) => current ? { ...current, whatsappDelivery: delivery } : current);
    } catch (deliveryError) {
      setError(deliveryError.message || "Unable to retry WhatsApp delivery.");
    } finally {
      setRetryingWhatsApp(false);
    }
  }

  return (
    <Box className="billing-page">
      <Box className="billing-page__header">
        <Box>
          <Typography className="billing-page__eyebrow">FRONT COUNTER</Typography>
          <Typography component="h1">Billing &amp; POS</Typography>
          <Typography>Build an order, collect payment, and close the sale.</Typography>
        </Box>
        <Box className="billing-page__header-stat">
          {["admin", "manager"].includes(currentUser?.role) && <Button size="small" onClick={() => setPinSetupOpen(true)}>Set approval PIN</Button>}
          <ShoppingBagOutlinedIcon /><Box><strong>{cart.reduce((count, row) => count + row.quantity, 0)}</strong><span>items in bill</span></Box>
        </Box>
      </Box>

      {(error || partialNotice || successNotice) && <Alert severity={error ? "error" : partialNotice ? "warning" : "success"} onClose={() => { setError(""); setPartialNotice(""); setSuccessNotice(""); }}>
        {error || successNotice}{partialNotice && <Typography component="span" display="block">{partialNotice}</Typography>}
      </Alert>}
      {promotionError && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => setPromotionRetry((value) => value + 1)}>Retry</Button>}>{promotionError} Payment is disabled until this check succeeds.</Alert>}

      <Box className="billing-layout">
        <Box className="billing-catalog">
          <Card className="billing-catalog__panel" elevation={0}>
            <Box className="billing-catalog__toolbar">
              <Box><Typography component="h2">Menu</Typography><Typography>{menuItems.length} available items</Typography></Box>
              <TextField
                className="billing-search"
                inputRef={searchInputRef}
                placeholder="Search name or code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && visibleItems[0]) {
                    event.preventDefault();
                    addToCart(visibleItems[0]);
                  }
                }}
                slotProps={{
                  htmlInput: { "aria-label": "Search menu", "aria-describedby": "billing-search-results" },
                  input: {
                    startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        {search && <IconButton aria-label="Clear search" onClick={() => { setSearch(""); searchInputRef.current?.focus(); }} edge="end"><CloseRoundedIcon /></IconButton>}
                        <IconButton aria-label="Barcode lookup (focus search)" title="Barcode lookup" onClick={() => searchInputRef.current?.focus()} edge="end"><CameraAltOutlinedIcon /></IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
            <Box className="billing-categories" role="tablist" aria-label="Menu categories">
              {categories.map((category, index) => {
                const count = category === "All items" ? menuItems.length : menuItems.filter((item) => item.category === category).length;
                return (
                  <Button
                    key={category}
                    ref={(element) => { categoryRefs.current[index] = element; }}
                    role="tab"
                    aria-selected={activeCategory === category}
                    tabIndex={activeCategory === category ? 0 : -1}
                    className={activeCategory === category ? "is-active" : ""}
                    onClick={() => setActiveCategory(category)}
                    onKeyDown={(event) => {
                      let nextIndex;
                      if (event.key === "ArrowRight") nextIndex = (index + 1) % categories.length;
                      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + categories.length) % categories.length;
                      else return;
                      event.preventDefault();
                      setActiveCategory(categories[nextIndex]);
                      categoryRefs.current[nextIndex]?.focus();
                    }}
                  >
                    {category} <span aria-label={`${count} items`}>· {count}</span>
                  </Button>
                );
              })}
            </Box>
            <Typography id="billing-search-results" role="status" aria-live="polite" className="billing-search-status">
              {search ? `${visibleItems.length} menu item${visibleItems.length === 1 ? "" : "s"} found` : `${menuItems.length} menu items available`}
            </Typography>
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
          <Box className="billing-ticket__heading"><Box><Typography component="h2">Current bill</Typography><Typography>{formatDate(new Date())}</Typography></Box><Chip label={`${cart.length} lines`} size="small" /></Box>
          {cart.length ? <Box className="billing-ticket__lines">
            {cart.map((row) => (
              <Box
                className="billing-line"
                key={row.id}
                onTouchStart={startCartSwipe}
                onTouchEnd={(event) => finishCartSwipe(event, row.id)}
              >
                <Box className="billing-line__copy">
                  <Typography>{row.name}</Typography>
                  <Typography>{CURRENCY.format(row.price)} each</Typography>
                  {row.notes && <Typography className="billing-line__note">{row.notes}</Typography>}
                </Box>
                <ButtonGroup size="small" className="billing-line__quantity" aria-label={`${row.name} quantity`}>
                  <IconButton aria-label={`Decrease ${row.name}`} onClick={() => adjustQuantity(row.id, -1)}><RemoveRoundedIcon fontSize="small" /></IconButton>
                  <span>{row.quantity}</span>
                  <IconButton aria-label={`Increase ${row.name}`} disabled={row.quantity >= 99} onClick={() => adjustQuantity(row.id, 1)}><AddRoundedIcon fontSize="small" /></IconButton>
                </ButtonGroup>
                <Box className="billing-line__footer">
                  <strong className="billing-line__total">{row.comp ? "NC" : CURRENCY.format(row.price * row.quantity)}</strong>
                  <Button size="small" aria-label={`${row.comp ? "Remove comp from" : "Comp"} ${row.name}`} onClick={() => toggleComp(row.id)}>{row.comp ? "Remove NC" : "Comp / NC"}</Button>
                  <IconButton aria-label={`${row.notes ? "Edit" : "Add"} note for ${row.name}`} title="Add item note" onClick={() => openLineNote(row)}><NoteAltRoundedIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={`Remove ${row.name}`} className="billing-line__remove" onClick={() => setCart((current) => current.filter((entry) => entry.id !== row.id))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Box>
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
            <TextField size="small" type="number" label="Discount (₹)" value={discount} onChange={(event) => setDiscount(event.target.value)} slotProps={{ htmlInput: { min: 0, max: Math.max(0, subtotal - compAmount), step: "any" } }} />
            <Box className="billing-totals">
              <Box><span>Subtotal</span><strong>{CURRENCY.format(subtotal)}</strong></Box>
              {compAmount > 0 && <Box><span>Comp / NC</span><strong>− {CURRENCY.format(compAmount)}</strong></Box>}
              {manualDiscountAmount > 0 && <Box><span>Discount</span><strong>− {CURRENCY.format(manualDiscountAmount)}</strong></Box>}
              {promotionalDiscountAmount > 0 && <Box><span>Happy hour</span><strong>− {CURRENCY.format(promotionalDiscountAmount)}</strong></Box>}
              {settings.packagingEnabled && orderType === "Takeaway" && <Box><span>Packaging</span><strong>{CURRENCY.format(packagingAmount)}</strong></Box>}
              {settings.taxEnabled && <>
                <Box><span>CGST · {(Number(settings.taxRate) || 0) / 2}%</span><strong>{CURRENCY.format(cgstAmount)}</strong></Box>
                <Box><span>SGST · {(Number(settings.taxRate) || 0) / 2}%</span><strong>{CURRENCY.format(sgstAmount)}</strong></Box>
              </>}
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
            {(paymentMethod === "Card" || paymentMethod === "UPI") && <TextField
              size="small"
              label="Transaction reference"
              value={singlePaymentReference}
              onChange={(event) => setSinglePaymentReference(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />}
            {paymentMethod === "Split" && <Box className="billing-split-payments">
              <Typography>Split bill</Typography>
              <FormControl size="small">
                <InputLabel id="billing-split-mode-label">Split by</InputLabel>
                <Select id="billing-split-mode" labelId="billing-split-mode-label" label="Split by" value={splitMode} onChange={(event) => setSplitMode(event.target.value)}>
                  <MenuItem value="tender">Payment methods</MenuItem>
                  <MenuItem value="equal">Equal shares</MenuItem>
                  <MenuItem value="items">Selected items</MenuItem>
                </Select>
              </FormControl>
              {splitMode === "tender" && <>
                {splitPayments.map((row) => (
                  <Box className="billing-split-row" key={row.id}>
                    <FormControl size="small">
                      <InputLabel id={`split-method-${row.id}`}>Method</InputLabel>
                      <Select labelId={`split-method-${row.id}`} label="Method" value={row.method} onChange={(event) => updateSplitPayment(row.id, "method", event.target.value)}>
                        {enabledPaymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" type="number" label="Amount (₹)" value={row.amount} onChange={(event) => updateSplitPayment(row.id, "amount", event.target.value)} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
                    <TextField size="small" label="Reference" value={row.transactionRef || ""} onChange={(event) => updateSplitPayment(row.id, "transactionRef", event.target.value)} slotProps={{ htmlInput: { maxLength: 120 } }} />
                    {splitPayments.length > 2 && <IconButton aria-label={`Remove ${row.method} payment`} onClick={() => setSplitPayments((current) => current.filter((entry) => entry.id !== row.id))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>}
                  </Box>
                ))}
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={addSplitPayment} disabled={splitPayments.length >= enabledPaymentMethods.length}>Add payment method</Button>
              </>}
              {splitMode === "equal" && <>
                <TextField
                  size="small"
                  type="number"
                  label="Number of people"
                  value={splitPeopleCount}
                  onChange={(event) => setSplitPeopleCount(event.target.value)}
                  slotProps={{ htmlInput: { min: 2, max: 20, step: 1 } }}
                />
                {equalAmounts.map((amount, index) => (
                  <Box className="billing-split-person" key={`equal-${index}`}>
                    <Typography>Person {index + 1} · {CURRENCY.format(amount)}</Typography>
                    <FormControl size="small">
                      <InputLabel id={`equal-method-${index}`}>Person {index + 1} payment method</InputLabel>
                      <Select
                        labelId={`equal-method-${index}`}
                        label={`Person ${index + 1} payment method`}
                        value={splitMethod(equalSplitMethods, index)}
                        onChange={(event) => setEqualSplitMethods((current) => current.map((method, methodIndex) => methodIndex === index ? event.target.value : method))}
                      >
                        {enabledPaymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label={`Person ${index + 1} reference`}
                      value={equalSplitReferences[index] || ""}
                      onChange={(event) => setEqualSplitReferences((current) => current.map((reference, refIndex) => refIndex === index ? event.target.value : reference))}
                      slotProps={{ htmlInput: { maxLength: 120 } }}
                    />
                  </Box>
                ))}
              </>}
              {splitMode === "items" && <>
                <TextField
                  size="small"
                  type="number"
                  label="Number of people"
                  value={splitPeopleCount}
                  onChange={(event) => setSplitPeopleCount(event.target.value)}
                  slotProps={{ htmlInput: { min: 2, max: 20, step: 1 } }}
                />
                <Typography className="billing-split-total">Assign each bill line to the person paying for it.</Typography>
                {cart.map((row) => (
                  <Box className="billing-item-split-row" key={`item-${row.id}`}>
                    <Typography>{row.quantity} × {row.name} · {CURRENCY.format(lineAmounts[row.id] || 0)}</Typography>
                    <FormControl size="small">
                      <InputLabel id={`item-payer-${row.id}`}>Paid by</InputLabel>
                      <Select
                        labelId={`item-payer-${row.id}`}
                        label="Paid by"
                        value={itemAssignments[row.id] || ""}
                        onChange={(event) => setItemAssignments((current) => ({ ...current, [row.id]: event.target.value }))}
                      >
                        {validPeopleCount && Array.from({ length: peopleCount }, (_, index) => <MenuItem key={index + 1} value={String(index + 1)}>Person {index + 1}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                ))}
                {itemSplitAmounts.map((amount, index) => amount > 0 && (
                  <Box className="billing-split-person" key={`item-person-${index}`}>
                    <Typography>Person {index + 1} · {CURRENCY.format(amount)}</Typography>
                    <FormControl size="small">
                      <InputLabel id={`item-method-${index}`}>Person {index + 1} payment method</InputLabel>
                      <Select
                        labelId={`item-method-${index}`}
                        label={`Person ${index + 1} payment method`}
                        value={splitMethod(itemSplitMethods, index)}
                        onChange={(event) => setItemSplitMethods((current) => current.map((method, methodIndex) => methodIndex === index ? event.target.value : method))}
                      >
                        {enabledPaymentMethods.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label={`Person ${index + 1} reference`}
                      value={itemSplitReferences[index] || ""}
                      onChange={(event) => setItemSplitReferences((current) => current.map((reference, refIndex) => refIndex === index ? event.target.value : reference))}
                      slotProps={{ htmlInput: { maxLength: 120 } }}
                    />
                  </Box>
                ))}
              </>}
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
        <Box className="billing-recent__list">{recentBills.map((bill) => <Card elevation={0} key={bill.number}><Box><strong>{bill.number}</strong><span>{bill.items.length} lines · {bill.paymentMethod}</span>{bill.stockDeductionStatus && <span>Ingredient stock {stockDeductionLabel(bill.stockDeductionStatus)}</span>}{bill.stockWarnings?.map((warning, index) => <span key={`${bill.number}-stock-warning-${index}`}>{warning}</span>)}</Box><strong>{CURRENCY.format(bill.total)}</strong></Card>)}</Box>
      </Box>}

      <Dialog open={Boolean(noteItemId)} onClose={() => setNoteItemId("")} fullWidth maxWidth="xs">
        <DialogTitle>Item preparation note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Kitchen note"
            placeholder="Less spicy, no ice…"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value.slice(0, 300))}
            helperText={`${noteDraft.length}/300 characters`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteItemId("")}>Cancel</Button>
          <Button variant="contained" onClick={saveLineNote}>Save note</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="payment-tender-title"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.defaultPrevented) {
            event.preventDefault();
            confirmTender();
          }
        }}
        slotProps={{ paper: { sx: { borderRadius: 3, p: { xs: 1, sm: 2 } } } }}
      >
        <DialogTitle id="payment-tender-title" sx={{ textAlign: "center", fontWeight: 800 }}>
          Complete payment
          <Typography component="span" display="block" color="text.secondary" variant="body2">Amount payable</Typography>
          <Typography component="span" display="block" sx={{ fontSize: "2rem", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{CURRENCY.format(total)}</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography fontWeight={700} mb={1}>Choose payment mode</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 1 }}>
            {[...enabledPaymentMethods, ...(settings.paymentMethods.split ? ["Split"] : [])].map((method) => (
              <Button key={method} variant={paymentMethod === method ? "contained" : "outlined"} onClick={() => choosePaymentMethod(method)} sx={{ minHeight: 52, borderWidth: 2, borderRadius: 2, fontWeight: 800 }}>
                {method === "UPI" ? "PhonePe / GPay" : method}
              </Button>
            ))}
          </Box>
          {paymentMethod === "Cash" && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Cash tendered (₹)"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: "any" } }}
                sx={{ mb: 1.5 }}
              />
              <Typography fontWeight={700} mb={1}>Quick cash tender</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {[500, 1000, 2000].map((amount) => <Button key={amount} variant="outlined" sx={{ minHeight: 44 }} onClick={() => setCashReceived(String(amount))}>₹{amount}</Button>)}
                <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => setCashReceived(total.toFixed(2))}>Exact amount</Button>
              </Box>
              <Typography sx={{ mt: 1.5, fontWeight: 800, color: changeDue > 0 ? "#047857" : balanceDue > 0 ? "#b91c1c" : "#166534" }} role="status" aria-live="polite">
                {changeDue > 0 ? `Return ${CURRENCY.format(changeDue)} to customer` : balanceDue > 0 ? `${CURRENCY.format(balanceDue)} still due` : "Exact amount received"}
              </Typography>
            </Box>
          )}
          {paymentMethod === "Split" && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Split amounts are configured in the bill panel. Entered {CURRENCY.format(splitTotal)}; remaining {CURRENCY.format(balanceDue)}.
            </Alert>
          )}
          {paymentMethod !== "Cash" && paymentMethod !== "Split" && (
            <Typography sx={{ mt: 2 }} color="text.secondary">Collect {CURRENCY.format(total)} by {paymentMethod === "UPI" ? "UPI (PhonePe / GPay)" : paymentMethod} before finishing.</Typography>
          )}
          <Box sx={{ mt: 2, borderTop: "1px solid", borderColor: "divider", pt: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />}
              label="Send WhatsApp bill (customer consent required)"
            />
            {whatsappOptIn && <TextField
              fullWidth
              size="small"
              type="tel"
              label="Customer mobile number"
              placeholder="10-digit number or country code"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 12))}
              error={!/^[6-9]\d{9}$/.test(normalizedPhone)}
              helperText={!/^[6-9]\d{9}$/.test(normalizedPhone) ? "Enter a valid 10-digit Indian mobile number (6–9 prefix); +91 is accepted." : "Valid Indian mobile number."}
              sx={{ mt: 1 }}
            />}
          </Box>
          {!promotionsLoaded && <Alert severity="warning" sx={{ mt: 2 }}>Verifying scheduled discounts. Payment is disabled until this check succeeds.</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1 }}>
          <Button onClick={() => setPaymentOpen(false)} sx={{ minHeight: 48 }}>Cancel</Button>
          <Button variant="contained" size="large" disabled={!canComplete} onClick={confirmTender} sx={{ minHeight: 52, px: 3, fontWeight: 800, borderRadius: 2 }}>
            {saving ? "Recording sale…" : "Print & finish"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={approvalOpen} onClose={() => !saving && setApprovalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Manager authorization required</DialogTitle>
        <DialogContent>
          <Typography>Enter an active Admin or Manager's 4-digit PIN and select the reason for this discount or comp.</Typography>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel id="discount-reason-label">Reason code</InputLabel>
            <Select id="discount-reason" labelId="discount-reason-label" label="Reason code" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)}>
              <MenuItem value="service_recovery">Service recovery</MenuItem>
              <MenuItem value="promotion">Promotion</MenuItem>
              <MenuItem value="pricing_error">Pricing correction</MenuItem>
              <MenuItem value="customer_retention">Customer retention</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Manager PIN"
            type="password"
            value={approvalPin}
            onChange={(event) => setApprovalPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4, autoComplete: "one-time-code" } }}
          />
          <FormControlLabel
            control={<Checkbox checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />}
            label="Send WhatsApp bill (customer consent required)"
          />
          {whatsappOptIn && <TextField
            fullWidth
            size="small"
            type="tel"
            label="Customer mobile number"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 12))}
            error={!/^[6-9]\d{9}$/.test(normalizedPhone)}
            helperText={!/^[6-9]\d{9}$/.test(normalizedPhone) ? "Enter a valid 10-digit Indian mobile number (6–9 prefix); +91 is accepted." : "Valid Indian mobile number."}
          />}
          {!promotionsLoaded && <Alert severity="warning">Verifying scheduled discounts. Sale completion is paused.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" disabled={saving || !promotionsLoaded || !whatsappDetailsValid || approvalPin.length !== 4 || !approvalReason} onClick={() => submitBill({ pin: approvalPin, reasonCode: approvalReason })}>
            {saving ? "Recording sale…" : "Approve and complete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pinSetupOpen} onClose={() => !pinSaving && setPinSetupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set manager approval PIN</DialogTitle>
        <DialogContent>
          <Typography>Confirm your account password to save a hashed 4-digit PIN. Never share your PIN with cashiers.</Typography>
          <TextField fullWidth margin="normal" label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <TextField fullWidth margin="normal" label="New 4-digit PIN" type="password" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4 } }} />
          <TextField fullWidth margin="normal" label="Confirm 4-digit PIN" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinSetupOpen(false)} disabled={pinSaving}>Cancel</Button>
          <Button variant="contained" disabled={pinSaving || !currentPassword || newPin.length !== 4 || newPin !== confirmPin} onClick={saveManagerPin}>
            {pinSaving ? "Saving…" : "Save PIN"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(completedBill)} onClose={() => setCompletedBill(null)} fullWidth maxWidth="xs" className="billing-receipt" aria-labelledby="billing-receipt-title">
        {completedBill && <>
          <DialogTitle><Box className="billing-receipt__title"><CheckCircleRoundedIcon /><Box><Typography id="billing-receipt-title" component="h2">Bill complete</Typography><Typography>{completedBill.number}</Typography></Box></Box></DialogTitle>
          <DialogContent className="billing-receipt__content">
            <Box className="billing-receipt__line"><span>Order type</span><strong>{completedBill.orderType}</strong></Box>
            {completedBill.items.map((row) => <Box className="billing-receipt__line" key={row.id}><span>{row.quantity} × {row.name}{row.comp ? " · NC" : ""}{row.notes && <small className="billing-receipt__note">{row.notes}</small>}</span><strong>{row.comp ? "NC" : CURRENCY.format(row.quantity * row.price)}</strong></Box>)}
            <Box className="billing-receipt__line"><span>Subtotal</span><strong>{CURRENCY.format(completedBill.subtotal)}</strong></Box>
            {completedBill.items.some((row) => row.comp) && <Box className="billing-receipt__line"><span>Comp / NC</span><strong>− {CURRENCY.format(completedBill.items.filter((row) => row.comp).reduce((sum, row) => sum + row.quantity * row.price, 0))}</strong></Box>}
            {(completedBill.discount - completedBill.items.filter((row) => row.comp).reduce((sum, row) => sum + row.quantity * row.price, 0) - (completedBill.promotionalDiscount || 0)) > 0 && <Box className="billing-receipt__line"><span>Discount</span><strong>− {CURRENCY.format(completedBill.discount - completedBill.items.filter((row) => row.comp).reduce((sum, row) => sum + row.quantity * row.price, 0) - (completedBill.promotionalDiscount || 0))}</strong></Box>}
            {(completedBill.promotionalDiscount || 0) > 0 && <Box className="billing-receipt__line"><span>Happy hour</span><strong>− {CURRENCY.format(completedBill.promotionalDiscount)}</strong></Box>}
            {completedBill.packaging > 0 && <Box className="billing-receipt__line"><span>Packaging</span><strong>{CURRENCY.format(completedBill.packaging)}</strong></Box>}
            {completedBill.tax > 0 && <Box className="billing-receipt__line"><span>Tax</span><strong>{CURRENCY.format(completedBill.tax)}</strong></Box>}
            <Box className="billing-receipt__line is-total"><span>Total · {completedBill.paymentMethod}</span><strong>{CURRENCY.format(completedBill.total)}</strong></Box>
            {completedBill.tenders.map((tender, index) => <Box className="billing-receipt__line" key={`${tender.method}-${index}`}><span>{tender.method} payment{tender.transactionRef ? ` · ${tender.transactionRef}` : ""}</span><strong>{CURRENCY.format(tender.amount)}</strong></Box>)}
            {completedBill.paymentMethod === "Cash" && <Box className="billing-receipt__line"><span>Change</span><strong>{CURRENCY.format(completedBill.changeDue)}</strong></Box>}
            {completedBill.changeDue > 0 && completedBill.paymentMethod === "Split" && <Box className="billing-receipt__line"><span>Change</span><strong>{CURRENCY.format(completedBill.changeDue)}</strong></Box>}
            {completedBill.balanceDue > 0 && <Box className="billing-receipt__line is-balance"><span>Balance remaining</span><strong>{CURRENCY.format(completedBill.balanceDue)}</strong></Box>}
            {completedBill.stockDeductionStatus && <Alert severity={completedBill.stockWarnings?.length ? "warning" : completedBill.stockDeductionStatus === "completed" ? "success" : "info"}>
              Ingredient stock deduction {stockDeductionLabel(completedBill.stockDeductionStatus)}.
              {completedBill.stockWarnings?.map((warning) => <Typography key={warning} variant="body2">{warning}</Typography>)}
            </Alert>}
          </DialogContent>
          {completedBill.whatsappDelivery?.status === "sent" && <Alert severity="success">WhatsApp bill sent successfully.</Alert>}
          {completedBill.whatsappDelivery?.status === "failed" && <Alert severity="warning">Bill saved, but WhatsApp delivery failed: {completedBill.whatsappDelivery.message || "Check the WhatsApp integration settings."}</Alert>}
          {completedBill.whatsappDelivery?.status === "pending_payment" && <Alert severity="info">WhatsApp bill was not sent because this bill is not fully paid.</Alert>}
          <DialogActions>
            {completedBill.whatsappDelivery?.status === "failed" && <Button onClick={retryWhatsAppDelivery} disabled={retryingWhatsApp}>{retryingWhatsApp ? "Retrying…" : "Retry WhatsApp bill"}</Button>}
            <Button onClick={printBill}>Print</Button><Button variant="contained" onClick={() => setCompletedBill(null)}>New bill</Button>
          </DialogActions>
        </>}
      </Dialog>
    </Box>
  );
}