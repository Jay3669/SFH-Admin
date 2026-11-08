import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { ViewActionButton, EditActionButton, DeleteActionButton } from "../../components/ActionButtons/ActionButtons";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import * as inventoryService from "../../services/inventoryService";
import { recipeUnitsForStockUnit } from "../../utils/recipeUnits";
import RecipeProductionPanel from "./RecipeProductionPanel";
import "./InventoryPage.css";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: <TrendingUpRoundedIcon /> },
  { id: "stock", label: "Stock items", icon: <Inventory2OutlinedIcon /> },
  { id: "batches", label: "Batches & expiry", icon: <CalendarMonthRoundedIcon /> },
  { id: "purchases", label: "Purchases", icon: <ReceiptLongOutlinedIcon /> },
  { id: "suppliers", label: "Suppliers", icon: <LocalShippingOutlinedIcon /> },
  { id: "recipes", label: "Recipes & production", icon: <RestaurantOutlinedIcon /> },
  { id: "movements", label: "Movements", icon: <HistoryRoundedIcon /> },
  { id: "alerts", label: "Alerts", icon: <NotificationsActiveOutlinedIcon /> },
  { id: "reports", label: "Reports", icon: <AssessmentOutlinedIcon /> },
  { id: "categories", label: "Categories", icon: <CategoryOutlinedIcon /> },
];

const EMPTY_ITEM = { name: "", category: "Vegetables", quantity: "", unit: "kg", reorderLevel: "", cost: "", expiry: "" };
const EMPTY_SUPPLIER = { name: "", contact: "", phone: "", email: "", terms: "Due on receipt" };
const EMPTY_PURCHASE = { supplierId: "", itemId: "", quantity: "", unitPrice: "", invoice: "", expiry: "" };
const EMPTY_MOVEMENT = { type: "Kitchen consumption", quantity: "", reason: "", expiry: "", batch: "" };
const EMPTY_RECIPE = { dish: "", itemId: "", quantity: "", unit: "" };
const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function formatQuantity(value) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function stockStatus(item) {
  if (item.quantity <= 0) return "Out of stock";
  if (item.quantity <= item.reorderLevel) return "Low stock";
  return "In stock";
}

function todayLabel() {
  return formatISODate(new Date());
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MetricCard({ icon, label, value, detail, tone = "orange" }) {
  return (
    <Card className="inventory-metric" elevation={0}>
      <Box className={`inventory-metric__icon is-${tone}`}>{icon}</Box>
      <Box className="inventory-metric__copy">
        <Typography className="inventory-metric__label">{label}</Typography>
        <Typography className="inventory-metric__value">{value}</Typography>
        {detail && <Typography className="inventory-metric__detail">{detail}</Typography>}
      </Box>
    </Card>
  );
}

function PanelHeading({ title, subtitle, action }) {
  return (
    <Box className="inventory-panel__heading">
      <Box>
        <Typography component="h2">{title}</Typography>
        {subtitle && <Typography variant="body2">{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

function StatusChip({ status }) {
  const tone = status === "In stock" || status === "Received" || status === "Paid" || status === "Fresh" ? "good"
    : status === "Low stock" || status === "Ordered" || status === "Partially paid" || status === "Expiring soon" ? "low"
      : status === "Out of stock" || status === "Expired" || status === "Overdue" ? "out" : "neutral";
  return <Chip className={`inventory-status is-${tone}`} label={status === "Low stock" ? "Running low" : status} size="small" />;
}

export default function InventoryPage({ initialTab = "stock" }) {
  const [items, setItems] = useState([
    { id: "rice", name: "Basmati rice", category: "Grains", quantity: 24, unit: "kg", cost: 118, reorderLevel: 30, batches: [{ id: "RICE-001", quantity: 24, cost: 118 }], movements: [] },
  ]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryDetails, setCategoryDetails] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryLoadError, setInventoryLoadError] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [supplierToView, setSupplierToView] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
  const [paymentPurchase, setPaymentPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [movementItem, setMovementItem] = useState(null);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [replacementCategory, setReplacementCategory] = useState("");
  const [historyItem, setHistoryItem] = useState(null);
  const [batchToEdit, setBatchToEdit] = useState(null);
  const [batchExpiry, setBatchExpiry] = useState("");
  const [reportPeriod, setReportPeriod] = useState("30");
  const [notice, setNotice] = useState("");
  const [noticeSeverity, setNoticeSeverity] = useState("success");
  const [formError, setFormError] = useState("");
  const [posDialog, setPosDialog] = useState(null);
  const [recipeToEdit, setRecipeToEdit] = useState(null);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [receivingPurchase, setReceivingPurchase] = useState(null);
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportError, setReportError] = useState("");

  function applyInventory(snapshot) {
    setItems(snapshot.items);
    setSuppliers(snapshot.suppliers);
    setPurchases(snapshot.purchases);
    setRecipes(snapshot.recipes);
    setCategories(snapshot.categories);
    setCategoryDetails(snapshot.categoryDetails || snapshot.categories.map((name) => ({ name, description: "" })));
    setInventoryLoadError("");
    setInventoryLoading(false);
  }

  async function refreshInventory() {
    const snapshot = await inventoryService.getInventory();
    applyInventory(snapshot);
    return snapshot;
  }

  useEffect(() => {
    let active = true;
    inventoryService.getInventory().then((snapshot) => {
      if (!active) return;
      setItems(snapshot.items);
      setSuppliers(snapshot.suppliers);
      setPurchases(snapshot.purchases);
      setRecipes(snapshot.recipes);
      setCategories(snapshot.categories);
      setCategoryDetails(snapshot.categoryDetails || snapshot.categories.map((name) => ({ name, description: "" })));
      setInventoryLoadError("");
      setInventoryLoading(false);
    }).catch((error) => {
      if (!active) return;
      setInventoryLoadError(error.message || "Unable to load inventory.");
      setInventoryLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTab !== "reports" || inventoryLoading) return undefined;
    let active = true;
    setReportError("");
    inventoryService.getInventoryReport(Number(reportPeriod)).then((report) => {
      if (active) setReportData(report);
    }).catch((error) => {
      if (active) setReportError(error.message || "Unable to load the inventory report.");
    });
    return () => { active = false; };
  }, [activeTab, reportPeriod, inventoryLoading, items]);

  async function runInventoryAction(action, successMessage) {
    try {
      await action();
      await refreshInventory();
      showNotice(successMessage);
      return true;
    } catch (error) {
      showNotice(error.message || "The inventory action failed.", "error");
      return false;
    }
  }

  const lowStockItems = items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel);
  const outOfStockItems = items.filter((item) => item.quantity <= 0);
  const today = todayLabel();
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + 30);
  const expiryDeadline = formatISODate(expiryThreshold);
  const expiredBatches = items.flatMap((item) => (item.batches || [])
    .filter((batch) => batch.quantity > 0 && batch.expiry && batch.expiry < today)
    .map((batch) => ({ item, batch })));
  const expiringBatches = items.flatMap((item) => (item.batches || [])
    .filter((batch) => batch.quantity > 0 && batch.expiry && batch.expiry >= today && batch.expiry <= expiryDeadline)
    .map((batch) => ({ item, batch })));
  const stockValue = items.reduce((total, item) => total + (item.batches || []).reduce((value, batch) => value + batch.quantity * batch.cost, 0), 0);
  const visibleItems = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = `${item.name} ${item.category} ${item.batch || ""}`.toLowerCase().includes(query);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const status = stockStatus(item);
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "low" && status === "Low stock") ||
      (statusFilter === "out" && status === "Out of stock") ||
      (statusFilter === "good" && status === "In stock");
    return matchesSearch && matchesCategory && matchesStatus;
  }), [items, search, categoryFilter, statusFilter]);
  const allMovements = useMemo(() => items.flatMap((item) => item.movements.map((movement, index) => ({
    ...movement,
    itemName: item.name,
    itemId: item.id,
    key: `${item.id}-${index}-${movement.date}`,
  }))).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), [items]);
  const alerts = [
    ...outOfStockItems.map((item) => ({ id: `out-${item.id}`, item, type: "Out of stock", message: `${item.name} is out of stock. Reorder before the next service.`, tone: "out" })),
    ...lowStockItems.map((item) => ({ id: `low-${item.id}`, item, type: "Low stock", message: `${item.name} is below its reorder point (${formatQuantity(item.reorderLevel)} ${item.unit}).`, tone: "low" })),
    ...expiredBatches.map(({ item, batch }) => ({ id: `expired-${item.id}-${batch.id}`, item, batch, type: "Expired", message: `${item.name} · batch ${batch.id} (${formatQuantity(batch.quantity)} ${item.unit}) expired ${batch.expiry}. Remove it from available stock.`, tone: "out" })),
    ...expiringBatches.map(({ item, batch }) => ({ id: `expiry-${item.id}-${batch.id}`, item, batch, type: "Expiring soon", message: `${item.name} · batch ${batch.id} (${formatQuantity(batch.quantity)} ${item.unit}) expires ${batch.expiry}.`, tone: "expiry" })),
  ];
  function showNotice(message, severity = "success") {
    setNoticeSeverity(severity);
    setNotice(message);
  }

  function openItemDialog(item = null) {
    setItemToEdit(item);
    setItemForm(item
      ? { name: item.name, category: item.category, quantity: String(item.quantity), unit: item.unit, reorderLevel: String(item.reorderLevel), cost: String(item.cost), expiry: item.expiry || "" }
      : EMPTY_ITEM);
    setFormError("");
    setItemDialogOpen(true);
  }

  async function saveItem(event) {
    event.preventDefault();
    const quantity = Number(itemForm.quantity);
    const reorderLevel = Number(itemForm.reorderLevel);
    const cost = Number(itemForm.cost);
    if (!itemForm.name.trim() || !itemForm.category || !itemForm.unit || itemForm.quantity === "" || itemForm.reorderLevel === "" || itemForm.cost === "" || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0 || !Number.isFinite(cost) || cost < 0) {
      setFormError("Complete all required fields with valid, non-negative values.");
      return;
    }
    if (itemToEdit) {
      const saved = await runInventoryAction(() => inventoryService.updateItem(itemToEdit.id, {
        name: itemForm.name.trim(),
        category: itemForm.category,
        reorderLevel,
      }), "Inventory item updated. Stock quantity and cost history remain unchanged.");
      if (!saved) return;
    } else {
      const saved = await runInventoryAction(() => inventoryService.createItem({
        name: itemForm.name.trim(),
        category: itemForm.category,
        quantity,
        unit: itemForm.unit,
        reorderLevel,
        ...(quantity > 0 ? { openingTotalCost: cost } : { cost }),
        expiry: itemForm.expiry,
      }), "Inventory item added.");
      if (!saved) return;
    }
    setItemDialogOpen(false);
  }

  function openMovement(item, type) {
    setMovementItem(item);
    setMovementForm({ ...EMPTY_MOVEMENT, type });
    setFormError("");
  }

  async function recordMovement(event) {
    event.preventDefault();
    const amount = Number(movementForm.quantity);
    if (!Number.isFinite(amount) || amount <= 0 || !movementForm.reason.trim()) {
      setFormError("Enter a quantity and a reason for this stock movement.");
      return;
    }
    if (movementForm.type !== "Stock correction" && movementForm.type !== "Purchase received" && amount > movementItem.quantity) {
      setFormError(`Only ${formatQuantity(movementItem.quantity)} ${movementItem.unit} is available. Stock cannot go negative.`);
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.recordMovement(movementItem.id, {
      type: movementForm.type,
      quantity: amount,
      reason: movementForm.reason.trim(),
      expiry: movementForm.expiry,
      batch: movementForm.batch.trim(),
    }), `${movementForm.type} recorded.`);
    if (saved) setMovementItem(null);
  }

  function openSupplierDialog(supplier = null) {
    setSupplierToEdit(supplier);
    setSupplierForm(supplier ? {
      name: supplier.name,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email || "",
      terms: supplier.terms,
    } : EMPTY_SUPPLIER);
    setFormError("");
    setSupplierDialogOpen(true);
  }

  async function reactivateSupplier(supplier) {
    const saved = await runInventoryAction(() => inventoryService.setSupplierActive(supplier.id, true), `${supplier.name} is active and available for new purchase orders.`);
    if (saved) setSupplierToView((current) => current?.id === supplier.id ? { ...current, active: true } : current);
  }

  async function saveSupplier(event) {
    event.preventDefault();
    const name = supplierForm.name.trim();
    const contact = supplierForm.contact.trim();
    const phone = supplierForm.phone.trim();
    if (!name || !contact || !phone) {
      setFormError("Supplier name, contact person, and phone are required.");
      return;
    }
    const payload = {
      name,
      contact,
      phone,
      email: supplierForm.email.trim(),
      terms: supplierForm.terms,
    };
    if (supplierToEdit) {
      const saved = await runInventoryAction(() => inventoryService.updateSupplier(supplierToEdit.id, payload), "Supplier details updated.");
      if (!saved) return;
      setSupplierToView((current) => current?.id === supplierToEdit.id ? { ...current, ...payload } : current);
    } else {
      const saved = await runInventoryAction(() => inventoryService.createSupplier(payload), "Supplier added.");
      if (!saved) return;
    }
    setSupplierDialogOpen(false);
    setSupplierToEdit(null);
  }

  async function deleteSupplier() {
    if (!supplierToDelete) return;
    const hasPurchaseHistory = purchases.some((purchase) => purchase.supplierId === supplierToDelete.id);
    const saved = await runInventoryAction(() => inventoryService.deleteSupplier(supplierToDelete.id), hasPurchaseHistory
      ? "Supplier archived. Historical purchase records were preserved."
      : "Supplier deleted.");
    if (saved) setSupplierToDelete(null);
  }

  async function createPurchase(event) {
    event.preventDefault();
    const quantity = Number(purchaseForm.quantity);
    const unitPrice = Number(purchaseForm.unitPrice);
    const supplier = suppliers.find((entry) => entry.id === purchaseForm.supplierId);
    const item = items.find((entry) => entry.id === purchaseForm.itemId);
    if (!supplier || !supplier.active || !item || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !purchaseForm.invoice.trim()) {
      setFormError("Choose a supplier and item, enter a valid quantity and price, and add an invoice reference.");
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.createPurchase({
      supplierId: supplier.id,
      itemId: item.id,
      quantity,
      unitPrice,
      invoice: purchaseForm.invoice.trim(),
      expiry: purchaseForm.expiry,
    }), "Purchase order created. Receive it when the delivery arrives.");
    if (!saved) return;
    setPurchaseDialogOpen(false);
    setPurchaseForm(EMPTY_PURCHASE);
    setActiveTab("purchases");
  }

  function openReceivePurchase(purchase) {
    const remaining = purchase.quantity - (purchase.receivedQuantity || 0);
    setReceivingPurchase(purchase);
    setReceiveQuantity(String(remaining));
  }

  async function confirmReceivePurchase(event) {
    event.preventDefault();
    if (!receivingPurchase) return;
    const quantity = Number(receiveQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.receivePurchase(receivingPurchase.purchaseId, quantity), `${formatQuantity(quantity)} ${receivingPurchase.unit} of ${receivingPurchase.item} received into stock.`);
    if (saved) {
      setReceivingPurchase(null);
      setReceiveQuantity("");
      setFormError("");
    }
  }

  async function cancelPurchase(purchase) {
    const saved = await runInventoryAction(() => inventoryService.cancelPurchase(purchase.purchaseId), `Purchase order ${purchase.id} cancelled.`);
    if (saved) setPaymentPurchase((current) => current?.purchaseId === purchase.purchaseId ? null : current);
  }

  async function saveRecipe(event) {
    event.preventDefault();
    const quantity = Number(recipeForm.quantity);
    if (!recipeForm.dish.trim() || !recipeForm.itemId || !Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Enter a dish name, ingredient, and a quantity per serving greater than zero.");
      return;
    }
    const item = items.find((entry) => entry.id === recipeForm.itemId);
    if (!item) {
      setFormError("Choose a valid inventory ingredient.");
      return;
    }
    const duplicate = recipes.some((recipe) => recipe.id !== recipeToEdit?.id && recipe.dish.toLowerCase() === recipeForm.dish.trim().toLowerCase() && recipe.itemId === item.id);
    if (duplicate) {
      setFormError("This ingredient is already part of that recipe.");
      return;
    }
    const payload = { dish: recipeForm.dish.trim(), itemId: item.id, quantity, unit: recipeForm.unit || item.unit };
    const saved = recipeToEdit
      ? await runInventoryAction(() => inventoryService.updateRecipe(recipeToEdit.id, payload), "Recipe ingredient updated.")
      : await runInventoryAction(() => inventoryService.createRecipe(payload), `Ingredient added to ${payload.dish}.`);
    if (!saved) return;
    setRecipeDialogOpen(false);
    setRecipeForm(EMPTY_RECIPE);
    setRecipeToEdit(null);
  }

  async function simulatePosSale(dish, portions) {
    if (!Number.isInteger(portions) || portions < 1) {
      showNotice("Enter a whole number of servings greater than zero.", "error");
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.completePosSale(dish, portions), `POS sale recorded. Recipe stock deducted for ${portions} × ${dish}.`);
    if (saved) setPosDialog(null);
  }

  function openCategoryDialog(category = null) {
    setCategoryToEdit(category);
    setNewCategory(category || "");
    setCategoryDescription(categoryDetails.find((detail) => detail.name === category)?.description || "");
    setFormError("");
    setCategoryDialogOpen(true);
  }

  async function saveCategory(event) {
    event.preventDefault();
    const name = newCategory.trim();
    const description = categoryDescription.trim();
    if (!name || description.length > 2000) {
      setFormError(!name ? "Enter a category name." : "Category description must be 2000 characters or fewer.");
      return;
    }
    if (categoryToEdit) {
      const saved = await runInventoryAction(() => inventoryService.updateCategory(categoryToEdit, name, description), `Category updated. Stock items moved to “${name}”.`);
      if (!saved) return;
      if (categoryFilter === categoryToEdit) setCategoryFilter(name);
      setItemForm((current) => current.category === categoryToEdit ? { ...current, category: name } : current);
    } else {
      const saved = await runInventoryAction(() => inventoryService.createCategory(name, description), "Category created.");
      if (!saved) return;
    }
    setNewCategory("");
    setCategoryDescription("");
    setCategoryDialogOpen(false);
    setCategoryToEdit(null);
  }

  async function confirmDeleteCategory(event) {
    event.preventDefault();
    if (!categoryToDelete) return;
    const linkedItems = items.filter((item) => item.category === categoryToDelete);
    if (linkedItems.length && !replacementCategory) {
      setFormError("Choose a destination category for the linked stock items.");
      return;
    }
    if (linkedItems.length && !categories.includes(replacementCategory)) {
      setFormError("Choose a valid destination category.");
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.deleteCategory(categoryToDelete, replacementCategory), linkedItems.length
      ? `Category deleted. ${linkedItems.length} stock item${linkedItems.length === 1 ? "" : "s"} moved to “${replacementCategory}”.`
      : `Category “${categoryToDelete}” deleted.`);
    if (!saved) return;
    if (linkedItems.length) {
      setItemForm((current) => current.category === categoryToDelete ? { ...current, category: replacementCategory } : current);
    }
    if (categoryFilter === categoryToDelete) setCategoryFilter("all");
    setCategoryToDelete(null);
    setReplacementCategory("");
    setFormError("");
  }

  function actOnAlert(alert) {
    if (alert.type === "Expired" || alert.type === "Expiring soon") {
      const type = alert.type === "Expired" ? "Expired" : "Kitchen consumption";
      setMovementItem(alert.item);
      setMovementForm({
        ...EMPTY_MOVEMENT,
        type,
        quantity: alert.type === "Expired" ? String(alert.batch.quantity) : "",
        reason: alert.type === "Expired" ? `Write off expired batch ${alert.batch.id}` : `Use expiring batch ${alert.batch.id}`,
        batch: alert.batch.id,
      });
      setFormError("");
      return;
    }
    const activeSuppliers = suppliers.filter((supplier) => supplier.active);
    if (!activeSuppliers.length) {
      showNotice("Add a supplier before creating a purchase order.", "error");
      setActiveTab("suppliers");
      return;
    }
    setPurchaseForm({
      supplierId: activeSuppliers[0].id,
      itemId: alert.item.id,
      quantity: String(Math.max(alert.item.reorderLevel - alert.item.quantity, 1)),
      unitPrice: String(alert.item.cost),
      invoice: "",
      expiry: "",
    });
    setFormError("");
    setPurchaseDialogOpen(true);
    setActiveTab("purchases");
  }

  async function saveBatchExpiry(event) {
    event.preventDefault();
    if (!batchToEdit) return;
    const saved = await runInventoryAction(() => inventoryService.updateBatchExpiry(batchToEdit.itemId, batchToEdit.batchId, batchExpiry), `Expiry date updated for batch ${batchToEdit.batchId}.`);
    if (saved) setBatchToEdit(null);
  }

  function exportReport() {
    const rows = [
      ["Item", "Category", "Batch", "On hand", "Unit", "Unit cost (INR)", "Stock value (INR)", "Item status", "Expiry"],
      ...items.flatMap((item) => (item.batches || []).length
        ? item.batches.map((batch) => [item.name, item.category, batch.id, batch.quantity, item.unit, batch.cost, (batch.quantity * batch.cost).toFixed(2), stockStatus(item), batch.expiry || ""])
        : [[item.name, item.category, "", item.quantity, item.unit, item.cost, "0.00", stockStatus(item), ""]]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `sfh-inventory-${todayLabel()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showNotice("Inventory report exported as CSV.");
  }

  async function recordSupplierPayment(event) {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!paymentPurchase || !Number.isFinite(amount) || amount <= 0 || amount > paymentPurchase.due) {
      showNotice("Enter a payment greater than zero and no more than the outstanding amount.", "error");
      return;
    }
    const saved = await runInventoryAction(() => inventoryService.recordPurchasePayment(paymentPurchase.purchaseId, amount), `${CURRENCY.format(amount)} payment recorded for ${paymentPurchase.supplier}.`);
    if (!saved) return;
    setPaymentPurchase(null);
    setPaymentAmount("");
  }

  function renderItemsTable(itemsToRender = visibleItems) {
    return itemsToRender.length ? (
      <TableContainer className="inventory-table-wrap">
        <Table className="inventory-table" aria-label="Inventory stock items">
          <TableHead><TableRow>
            <TableCell>ITEM</TableCell><TableCell>CATEGORY</TableCell><TableCell>ON HAND</TableCell>
            <TableCell>REORDER AT</TableCell><TableCell>UNIT COST</TableCell><TableCell>STATUS</TableCell><TableCell align="right">ACTIONS</TableCell>
          </TableRow></TableHead>
          <TableBody>{itemsToRender.map((item) => {
            const activeBatches = (item.batches || []).filter((batch) => batch.quantity > 0);
            const nextExpiry = activeBatches.map((batch) => batch.expiry).filter(Boolean).sort()[0];
            return <TableRow key={item.id}>
              <TableCell><Typography className="inventory-table__name">{item.name}</Typography><Typography className="inventory-table__meta">{activeBatches.length} active batch{activeBatches.length === 1 ? "" : "es"}{nextExpiry ? ` · Next exp ${nextExpiry}` : ""}</Typography></TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell><strong>{formatQuantity(item.quantity)} {item.unit}</strong></TableCell>
              <TableCell>{formatQuantity(item.reorderLevel)} {item.unit}</TableCell>
              <TableCell>{CURRENCY.format(item.cost)}/{item.unit}</TableCell>
              <TableCell><StatusChip status={stockStatus(item)} /></TableCell>
              <TableCell align="right"><Box className="inventory-table__actions">
                <IconButton aria-label={`Receive ${item.name}`} title="Receive stock" onClick={() => openMovement(item, "Purchase received")}><AddRoundedIcon fontSize="small" /></IconButton>
                <IconButton aria-label={`Record usage for ${item.name}`} title="Record usage" onClick={() => openMovement(item, "Kitchen consumption")}><RemoveRoundedIcon fontSize="small" /></IconButton>
                <IconButton aria-label={`Record wastage for ${item.name}`} title="Record food wastage" disabled={item.quantity <= 0} onClick={() => openMovement(item, "Wastage")}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                <IconButton aria-label={`View history for ${item.name}`} title="Stock history" onClick={() => setHistoryItem(item)}><HistoryRoundedIcon fontSize="small" /></IconButton>
                <IconButton aria-label={`Edit ${item.name}`} title="Edit item" onClick={() => openItemDialog(item)}><EditOutlinedIcon fontSize="small" /></IconButton>
              </Box></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </TableContainer>
    ) : <Box className="inventory-empty"><Inventory2OutlinedIcon /><Typography component="h3">No inventory items found</Typography><Typography>Try another search or add your first stock item.</Typography></Box>;
  }

  function renderOverview() {
    const attentionItems = [...outOfStockItems, ...lowStockItems].slice(0, 4);
    return (
      <Box className="inventory-overview">
        <Box className="inventory-metrics">
          <MetricCard icon={<Inventory2OutlinedIcon />} tone="orange" label="Tracked items" value={items.length} detail={`${categories.length} stock categories`} />
          <MetricCard icon={<TrendingUpRoundedIcon />} tone="green" label="Stock value" value={CURRENCY.format(stockValue)} detail="At current purchase cost" />
          <MetricCard icon={<WarningAmberRoundedIcon />} tone="amber" label="Need reordering" value={lowStockItems.length + outOfStockItems.length} detail={`${outOfStockItems.length} out of stock`} />
          <MetricCard icon={<NotificationsActiveOutlinedIcon />} tone="red" label="Expiry attention" value={expiredBatches.length + expiringBatches.length} detail={`${expiredBatches.length} expired · ${expiringBatches.length} due within 30 days`} />
        </Box>
        <Box className="inventory-overview__grid">
          <Card className="inventory-panel" elevation={0}>
            <PanelHeading title="Stock to watch" subtitle="Items at or below their reorder point" action={<Button size="small" onClick={() => setActiveTab("alerts")}>View alerts</Button>} />
            {attentionItems.length ? <Box className="inventory-watch-list">{attentionItems.map((item) => (
              <Box className="inventory-watch-row" key={item.id}>
                <Box className="inventory-watch-row__icon"><Inventory2OutlinedIcon /></Box>
                <Box className="inventory-watch-row__copy"><Typography>{item.name}</Typography><Typography>{item.category} · reorder at {formatQuantity(item.reorderLevel)} {item.unit}</Typography></Box>
                <Box className="inventory-watch-row__stock"><Typography>{formatQuantity(item.quantity)} {item.unit}</Typography><StatusChip status={stockStatus(item)} /></Box>
              </Box>
            ))}</Box> : <Box className="inventory-empty"><CheckCircleOutlineRoundedIcon /><Typography component="h3">All stock levels look good</Typography></Box>}
          </Card>
          <Card className="inventory-panel inventory-quick-panel" elevation={0}>
            <PanelHeading title="Quick actions" subtitle="Keep your stock flow moving" />
            <Box className="inventory-quick-actions">
              <Button startIcon={<ShoppingCartOutlinedIcon />} onClick={() => { setPurchaseForm(EMPTY_PURCHASE); setFormError(""); setPurchaseDialogOpen(true); }}>Create purchase order</Button>
              <Button startIcon={<AddRoundedIcon />} onClick={() => openItemDialog()}>Add inventory item</Button>
              <Button startIcon={<RestaurantOutlinedIcon />} onClick={() => setActiveTab("recipes")}>Manage recipes</Button>
              <Button startIcon={<AssessmentOutlinedIcon />} onClick={() => setActiveTab("reports")}>View stock reports</Button>
            </Box>
          </Card>
        </Box>
        <Card className="inventory-panel" elevation={0}>
          <PanelHeading title="Recent stock activity" subtitle="Purchases, kitchen usage, and adjustments" action={<Button size="small" onClick={() => setActiveTab("movements")}>All movements</Button>} />
          {renderRecentMovements(allMovements.slice(0, 5))}
        </Card>
      </Box>
    );
  }

  function renderRecentMovements(movements) {
    return movements.length ? (
      <TableContainer className="inventory-table-wrap">
        <Table className="inventory-table inventory-table--compact">
          <TableHead><TableRow><TableCell>ITEM</TableCell><TableCell>MOVEMENT</TableCell><TableCell>QUANTITY</TableCell><TableCell>REASON / REFERENCE</TableCell><TableCell>WHEN</TableCell></TableRow></TableHead>
          <TableBody>{movements.map((movement) => <TableRow key={movement.key || `${movement.itemId}-${movement.date}`}>
            <TableCell><Typography className="inventory-table__name">{movement.itemName}</Typography></TableCell><TableCell>{movement.type}</TableCell>
            <TableCell>{formatQuantity(movement.quantity)} {movement.unit}</TableCell><TableCell>{movement.reason}</TableCell><TableCell>{movement.date}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
    ) : <Box className="inventory-empty"><HistoryRoundedIcon /><Typography component="h3">No stock movements yet</Typography><Typography>Receipts and usage will appear here.</Typography></Box>;
  }

  function renderStock() {
    return (
      <Card className="inventory-panel" elevation={0}>
        <PanelHeading title="Stock items" subtitle="Maintain ingredients, supplies, reorder points, and batch details." action={<Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => openItemDialog()}>Add item</Button>} />
        <Box className="inventory-toolbar">
          <TextField className="inventory-toolbar__search" size="small" placeholder="Search name, category, batch..." value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { "aria-label": "Search inventory" }, input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }} />
          <FormControl size="small"><InputLabel id="inventory-category-filter">Category</InputLabel><Select labelId="inventory-category-filter" label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><MenuItem value="all">All categories</MenuItem>{categories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}</Select></FormControl>
          <FormControl size="small"><InputLabel id="inventory-status-filter">Stock status</InputLabel><Select labelId="inventory-status-filter" label="Stock status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="all">All stock</MenuItem><MenuItem value="good">In stock</MenuItem><MenuItem value="low">Low stock</MenuItem><MenuItem value="out">Out of stock</MenuItem></Select></FormControl>
        </Box>
        {renderItemsTable()}
      </Card>
    );
  }

  function renderBatches() {
    const batches = items.flatMap((item) => (item.batches || []).map((batch) => {
      const state = batch.quantity <= 0 ? "Depleted"
        : !batch.expiry ? "No expiry"
          : batch.expiry < today ? "Expired"
            : batch.expiry <= expiryDeadline ? "Expiring soon" : "Fresh";
      return { item, batch, state };
    })).sort((a, b) => {
      const expiryOrder = (a.batch.expiry || "9999-12-31").localeCompare(b.batch.expiry || "9999-12-31");
      return expiryOrder || (a.batch.receivedAt || 0) - (b.batch.receivedAt || 0);
    });
    return <Card className="inventory-panel" elevation={0}>
      <PanelHeading title="Batches & expiry" subtitle="Review remaining batch quantities and expiration dates. Stock issues are allocated FIFO by receipt date." />
      {batches.length ? <TableContainer className="inventory-table-wrap"><Table className="inventory-table">
        <TableHead><TableRow><TableCell>ITEM / CATEGORY</TableCell><TableCell>BATCH</TableCell><TableCell>REMAINING</TableCell><TableCell>UNIT COST</TableCell><TableCell>EXPIRY DATE</TableCell><TableCell>STATUS</TableCell><TableCell align="right">ACTIONS</TableCell></TableRow></TableHead>
        <TableBody>{batches.map(({ item, batch, state }) => <TableRow key={`${item.id}-${batch.id}`}>
          <TableCell><Typography className="inventory-table__name">{item.name}</Typography><Typography className="inventory-table__meta">{item.category}</Typography></TableCell><TableCell>{batch.id}</TableCell><TableCell>{formatQuantity(batch.quantity)} {item.unit}</TableCell><TableCell>{CURRENCY.format(batch.cost)}/{item.unit}</TableCell><TableCell>{batch.expiry || "Not set"}</TableCell><TableCell><StatusChip status={state} /></TableCell>
          <TableCell align="right"><Box className="inventory-table__actions"><IconButton aria-label={`Edit expiry for batch ${batch.id}`} title="Edit expiry" onClick={() => { setBatchToEdit({ itemId: item.id, batchId: batch.id }); setBatchExpiry(batch.expiry || ""); }}><EditOutlinedIcon fontSize="small" /></IconButton>{batch.quantity > 0 && <IconButton aria-label={`Record use for batch ${batch.id}`} title="Record stock usage (FIFO)" onClick={() => openMovement(item, "Kitchen consumption")}><RemoveRoundedIcon fontSize="small" /></IconButton>}</Box></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer> : <Box className="inventory-empty"><CalendarMonthRoundedIcon /><Typography component="h3">No stock batches yet</Typography><Typography>Received purchases and opening balances will show here.</Typography></Box>}
    </Card>;
  }

  function renderPurchases() {
    const orderedCount = purchases.filter((purchase) => purchase.status === "Ordered").length;
    const payable = purchases.reduce((total, purchase) => total + purchase.due, 0);
    return <Box className="inventory-section-stack">
      <Box className="inventory-metrics inventory-metrics--three">
        <MetricCard icon={<ReceiptLongOutlinedIcon />} tone="orange" label="Purchase orders" value={purchases.length} detail="Across all suppliers" />
        <MetricCard icon={<LocalShippingOutlinedIcon />} tone="amber" label="Awaiting delivery" value={orderedCount} detail="Confirm receipt to update stock" />
        <MetricCard icon={<TrendingUpRoundedIcon />} tone="green" label="Outstanding" value={CURRENCY.format(payable)} detail="Pending supplier invoices" />
      </Box>
      <Card className="inventory-panel" elevation={0}>
        <PanelHeading title="Purchase orders" subtitle="Create an order, then confirm the delivery to add stock." action={<Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => { setPurchaseForm(EMPTY_PURCHASE); setFormError(""); setPurchaseDialogOpen(true); }}>New purchase</Button>} />
        <TableContainer className="inventory-table-wrap"><Table className="inventory-table">
          <TableHead><TableRow><TableCell>ORDER / INVOICE</TableCell><TableCell>SUPPLIER</TableCell><TableCell>ITEM</TableCell><TableCell>ORDERED</TableCell><TableCell>AMOUNT / DUE</TableCell><TableCell>DELIVERY</TableCell><TableCell>PAYMENT</TableCell><TableCell align="right">ACTION</TableCell></TableRow></TableHead>
          <TableBody>{purchases.map((purchase) => <TableRow key={purchase.id}>
            <TableCell><Typography className="inventory-table__name">{purchase.id}</Typography><Typography className="inventory-table__meta">{purchase.invoice} · {purchase.date}</Typography></TableCell>
            <TableCell>{purchase.supplier}</TableCell><TableCell>{purchase.item}</TableCell><TableCell>{formatQuantity(purchase.quantity)} {purchase.unit}</TableCell>
            <TableCell><Typography className="inventory-table__name">{CURRENCY.format(purchase.quantity * purchase.unitPrice)}</Typography><Typography className="inventory-table__meta">Due {CURRENCY.format(purchase.due)}</Typography></TableCell>
            <TableCell><StatusChip status={purchase.status} /></TableCell>
            <TableCell><StatusChip status={purchase.due <= 0 ? "Paid" : purchase.paidAmount > 0 ? "Partially paid" : "Pending"} /></TableCell>
            <TableCell align="right"><Box className="inventory-purchase-actions">
              {(purchase.status === "Ordered" || purchase.status === "Partially received") && <Button size="small" variant="outlined" onClick={() => openReceivePurchase(purchase)}>Receive</Button>}
              {purchase.status === "Ordered" && <Button size="small" color="error" onClick={() => cancelPurchase(purchase)}>Cancel order</Button>}
              {purchase.due > 0 && <Button size="small" onClick={() => { setPaymentPurchase(purchase); setPaymentAmount(String(purchase.due)); }}>Record payment</Button>}
            </Box></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
      </Card>
      <Alert severity="info" className="inventory-info-alert">Receive orders in full or in multiple deliveries. Payments and receipt history remain linked to the supplier invoice.</Alert>
    </Box>;
  }

  function renderSuppliers() {
    return <Card className="inventory-panel" elevation={0}>
      <PanelHeading title="Suppliers" subtitle="Add, update, review, and safely remove supplier records." action={<Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => openSupplierDialog()}>Add supplier</Button>} />
      <TableContainer className="inventory-table-wrap"><Table className="inventory-table">
        <TableHead><TableRow><TableCell>SUPPLIER</TableCell><TableCell>CONTACT</TableCell><TableCell>PHONE / EMAIL</TableCell><TableCell>PAYMENT TERMS</TableCell><TableCell>ORDERS</TableCell><TableCell>STATUS</TableCell><TableCell align="right">ACTIONS</TableCell></TableRow></TableHead>
        <TableBody>{suppliers.map((supplier) => {
          const orderCount = purchases.filter((purchase) => purchase.supplierId === supplier.id).length;
          return <TableRow key={supplier.id}>
            <TableCell><Typography className="inventory-table__name">{supplier.name}</Typography></TableCell>
            <TableCell>{supplier.contact}</TableCell>
            <TableCell>{supplier.phone}<Typography className="inventory-table__meta">{supplier.email || "No email provided"}</Typography></TableCell>
            <TableCell>{supplier.terms}</TableCell>
            <TableCell>{orderCount} purchase{orderCount === 1 ? "" : "s"}</TableCell>
            <TableCell><StatusChip status={supplier.active ? "Active" : "Archived"} /></TableCell>
            <TableCell align="right"><Box className="inventory-table__actions">
              <ViewActionButton tooltip={`View ${supplier.name}`} aria-label={`View ${supplier.name}`} onClick={() => setSupplierToView(supplier)} />
              <EditActionButton tooltip={`Edit ${supplier.name}`} aria-label={`Edit ${supplier.name}`} onClick={() => openSupplierDialog(supplier)} />
              {supplier.active && <DeleteActionButton tooltip={orderCount ? "Archive supplier and preserve purchase history" : `Delete ${supplier.name}`} aria-label={`Delete ${supplier.name}`} onClick={() => setSupplierToDelete(supplier)} />}
              {!supplier.active && <Button size="small" onClick={() => reactivateSupplier(supplier)}>Reactivate</Button>}
            </Box></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table></TableContainer>
    </Card>;
  }

  function renderRecipes() {
    const dishes = [...new Set(recipes.map((recipe) => recipe.dish))];
    return <Box className="inventory-section-stack">
      <RecipeProductionPanel />
      {dishes.length > 0 && <>
        <Alert severity="info" className="inventory-info-alert">Link ingredients to menu dishes. A completed POS bill checks all recipe stock atomically and deducts ingredients from the oldest batches first.</Alert>
        <Card className="inventory-panel" elevation={0}>
        <PanelHeading title="Menu recipes" subtitle={`${dishes.length} recipes · ${recipes.length} ingredient links`} action={<Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => { setRecipeToEdit(null); setRecipeForm(EMPTY_RECIPE); setFormError(""); setRecipeDialogOpen(true); }}>Add ingredient</Button>} />
        <Box className="inventory-recipe-grid">{dishes.map((dish) => {
          const dishRecipes = recipes.filter((recipe) => recipe.dish === dish);
          return <Card className="inventory-recipe-card" elevation={0} key={dish}>
            <Box className="inventory-recipe-card__heading"><Box className="inventory-recipe-card__icon"><RestaurantOutlinedIcon /></Box><Box><Typography>{dish}</Typography><Typography>{dishRecipes.length} ingredients · per serving</Typography></Box></Box>
            <Box className="inventory-recipe-card__ingredients">{dishRecipes.map((recipe) => {
              const item = items.find((entry) => entry.id === recipe.itemId);
              return <Box className="inventory-recipe-card__ingredient" key={recipe.id}><span>{item?.name || "Missing inventory item"}</span><strong>{formatQuantity(recipe.quantity)} {recipe.unit}</strong><IconButton aria-label={`Edit ${dish} ${item?.name || "ingredient"}`} size="small" onClick={() => { setRecipeToEdit(recipe); setRecipeForm({ dish: recipe.dish, itemId: recipe.itemId, quantity: String(recipe.quantity), unit: recipe.unit }); setFormError(""); setRecipeDialogOpen(true); }}><EditOutlinedIcon fontSize="small" /></IconButton><IconButton aria-label={`Remove ${dish} ${item?.name || "ingredient"}`} size="small" onClick={() => setRecipeToDelete(recipe)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Box>;
            })}</Box>
            <Box className="inventory-recipe-card__footer"><Button size="small" startIcon={<ShoppingCartOutlinedIcon />} onClick={() => setPosDialog({ dish, portions: "1" })}>Record POS sale</Button><Typography>Checks stock before deduction</Typography></Box>
          </Card>;
        })}</Box>
        </Card>
      </>}
    </Box>;
  }

  function renderMovements() {
    return <Card className="inventory-panel" elevation={0}>
      <PanelHeading title="Stock movements" subtitle="Auditable record of receipts, consumption, wastage, and corrections." action={<Button startIcon={<DownloadRoundedIcon />} onClick={exportReport}>Export stock</Button>} />
      {renderRecentMovements(allMovements)}
    </Card>;
  }

  function renderAlerts() {
    return <Box className="inventory-section-stack">
      <Box className="inventory-metrics inventory-metrics--three">
        <MetricCard icon={<WarningAmberRoundedIcon />} tone="red" label="Out of stock" value={outOfStockItems.length} detail="Immediate attention" />
        <MetricCard icon={<RemoveRoundedIcon />} tone="amber" label="Below reorder point" value={lowStockItems.length} detail="Plan a purchase" />
        <MetricCard icon={<NotificationsActiveOutlinedIcon />} tone="orange" label="Expired / expiring" value={expiredBatches.length + expiringBatches.length} detail={`${expiredBatches.length} expired · ${expiringBatches.length} due within 30 days`} />
      </Box>
      <Card className="inventory-panel" elevation={0}>
        <PanelHeading title="Inventory alerts" subtitle="Resolve after taking action; active alerts are derived from stock and expiry data." />
        {alerts.length ? <Box className="inventory-alert-list">{alerts.map((alert) => <Box className={`inventory-alert-row is-${alert.tone}`} key={alert.id}>
          <Box className="inventory-alert-row__icon"><WarningAmberRoundedIcon /></Box><Box className="inventory-alert-row__copy"><Box><Typography>{alert.item.name}</Typography><StatusChip status={alert.type} /></Box><Typography>{alert.message}</Typography></Box>
          <Button size="small" onClick={() => actOnAlert(alert)}>{alert.type === "Expired" ? "Write off" : alert.type === "Expiring soon" ? "Record use" : "Create order"}</Button>
        </Box>)}</Box> : <Box className="inventory-empty"><CheckCircleOutlineRoundedIcon /><Typography component="h3">You’re all caught up</Typography><Typography>No active stock or expiry alerts.</Typography></Box>}
      </Card>
    </Box>;
  }

  function renderReports() {
    const days = Number(reportPeriod);
    return <Box className="inventory-section-stack">
      {reportError && <Alert severity="error">{reportError}</Alert>}
      <Card className="inventory-panel" elevation={0}>
        <PanelHeading title="Inventory reports" subtitle="Review stock valuation, movement, and supplier spend." action={<Box className="inventory-report-actions"><FormControl size="small"><InputLabel id="report-period-label">Period</InputLabel><Select labelId="report-period-label" label="Period" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)}><MenuItem value="7">Last 7 days</MenuItem><MenuItem value="30">Last 30 days</MenuItem><MenuItem value="90">Last 90 days</MenuItem></Select></FormControl><Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={exportReport}>Export CSV</Button></Box>} />
        <Box className="inventory-metrics inventory-metrics--three inventory-report-metrics">
          <MetricCard icon={<TrendingUpRoundedIcon />} tone="green" label="Current stock value" value={CURRENCY.format(reportData?.currentStockValue ?? stockValue)} detail="On-hand quantity × batch cost" />
          <MetricCard icon={<AddRoundedIcon />} tone="orange" label="Purchase spend" value={CURRENCY.format(reportData?.purchaseSpend ?? 0)} detail={`Selected ${days}-day period`} />
          <MetricCard icon={<RemoveRoundedIcon />} tone="amber" label="Consumption value" value={CURRENCY.format(reportData?.consumptionValue ?? 0)} detail={`${reportData?.receiptCount ?? 0} stock receipt${reportData?.receiptCount === 1 ? "" : "s"} in period`} />
        </Box>
      </Card>
      <Card className="inventory-panel" elevation={0}><PanelHeading title="Current stock valuation" subtitle="Valued at the latest recorded purchase cost." action={<Chip size="small" label={`${items.length} items`} />} />
        <TableContainer className="inventory-table-wrap"><Table className="inventory-table"><TableHead><TableRow><TableCell>ITEM</TableCell><TableCell>CATEGORY</TableCell><TableCell>ON HAND</TableCell><TableCell>UNIT COST</TableCell><TableCell>STOCK VALUE</TableCell><TableCell>STATUS</TableCell></TableRow></TableHead>
          <TableBody>{items.map((item) => <TableRow key={item.id}><TableCell><Typography className="inventory-table__name">{item.name}</Typography></TableCell><TableCell>{item.category}</TableCell><TableCell>{formatQuantity(item.quantity)} {item.unit}</TableCell><TableCell>{CURRENCY.format(item.cost)}/{item.unit}</TableCell><TableCell><strong>{CURRENCY.format((item.batches || []).reduce((sum, batch) => sum + batch.quantity * batch.cost, 0))}</strong></TableCell><TableCell><StatusChip status={stockStatus(item)} /></TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>
      </Card>
      <Box className="inventory-report-shortcuts">{["Daily stock inward", "Kitchen consumption", "Wastage & damage", "Supplier purchases", "Expiry & batches", "Stock adjustments"].map((report) => <Card elevation={0} key={report}><AssessmentOutlinedIcon /><Box><Typography>{report}</Typography><Typography>Included in inventory activity export</Typography></Box><DownloadRoundedIcon /></Card>)}</Box>
    </Box>;
  }

  function renderCategories() {
    return <Card className="inventory-panel" elevation={0}>
      <PanelHeading title="Stock categories" subtitle="Create, rename, and remove categories. Linked stock is reassigned before deletion." action={<Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={() => openCategoryDialog()}>Add category</Button>} />
      <Box className="inventory-category-grid">{categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        const description = categoryDetails.find((detail) => detail.name === category)?.description;
        const value = categoryItems.reduce((sum, item) => sum + (item.batches || []).reduce((batchSum, batch) => batchSum + batch.quantity * batch.cost, 0), 0);
        return <Card className="inventory-category-card" elevation={0} key={category}>
          <Box className="inventory-category-card__heading"><Box className="inventory-category-card__icon"><CategoryOutlinedIcon /></Box><Box className="inventory-category-card__actions">
            <IconButton aria-label={`Edit ${category}`} title="Edit category" onClick={() => openCategoryDialog(category)}><EditOutlinedIcon fontSize="small" /></IconButton>
            <IconButton aria-label={`Delete ${category}`} title="Delete category" onClick={() => { setCategoryToDelete(category); setReplacementCategory(""); setFormError(""); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
          </Box></Box>
          <Typography>{category}</Typography>{description && <Typography>{description}</Typography>}<Typography>{categoryItems.length} stock items</Typography>
          <Box><span>Stock value</span><strong>{CURRENCY.format(value)}</strong></Box>
        </Card>;
      })}</Box>
    </Card>;
  }

  const tabTitle = NAV_ITEMS.find((tab) => tab.id === activeTab)?.label || "Overview";

  return (
    <Box className="inventory-page app-content-width">
      <Box className="inventory-page__hero">
        <Box><Typography className="inventory-page__eyebrow">STOCK OPERATIONS / {tabTitle.toUpperCase()}</Typography><Typography component="h1" className="inventory-page__title">Inventory &amp; stock</Typography><Typography className="inventory-page__subtitle">From supplier delivery to kitchen consumption, keep every ingredient accounted for.</Typography></Box>
        <Box className="inventory-page__hero-actions"><Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => openItemDialog()}>Add item</Button><Button variant="contained" color="secondary" startIcon={<ShoppingCartOutlinedIcon />} onClick={() => { setPurchaseForm(EMPTY_PURCHASE); setFormError(""); setPurchaseDialogOpen(true); }}>New purchase</Button></Box>
      </Box>
      {inventoryLoading ? <Alert severity="info">Loading inventory data…</Alert> : inventoryLoadError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => {
          setInventoryLoading(true);
          refreshInventory().catch((error) => {
            setInventoryLoadError(error.message || "Unable to load inventory.");
            setInventoryLoading(false);
          });
        }}>Retry</Button>}>{inventoryLoadError}</Alert>
      ) : <>
        <Card className="inventory-navigation" elevation={0}><Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Inventory sections">{NAV_ITEMS.map((tab) => <Tab key={tab.id} value={tab.id} icon={tab.icon} iconPosition="start" label={tab.label} />)}</Tabs></Card>
        {activeTab === "overview" && renderOverview()}
        {activeTab === "stock" && renderStock()}
        {activeTab === "batches" && renderBatches()}
        {activeTab === "purchases" && renderPurchases()}
        {activeTab === "suppliers" && renderSuppliers()}
        {activeTab === "recipes" && renderRecipes()}
        {activeTab === "movements" && renderMovements()}
        {activeTab === "alerts" && renderAlerts()}
        {activeTab === "reports" && renderReports()}
        {activeTab === "categories" && renderCategories()}
      </>}

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} fullWidth maxWidth="sm">        <Box component="form" onSubmit={saveItem}><DialogTitle>{itemToEdit ? "Edit inventory item" : "Add inventory item"}</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField required autoFocus label="Item name" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
          <FormControl required><InputLabel id="item-category-label">Category</InputLabel><Select labelId="item-category-label" label="Category" value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })}>{categories.map((category) => <MenuItem value={category} key={category}>{category}</MenuItem>)}</Select></FormControl>
          <Box className="inventory-form-row"><TextField required label="Unit" placeholder="kg, L, pcs" value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} slotProps={{ htmlInput: { readOnly: Boolean(itemToEdit) } }} /><TextField required type="number" label={itemToEdit ? "Current stock" : "Opening stock"} value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any", readOnly: Boolean(itemToEdit) } }} /></Box>
          <Box className="inventory-form-row"><TextField required type="number" label="Reorder point" value={itemForm.reorderLevel} onChange={(event) => setItemForm({ ...itemForm, reorderLevel: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any" } }} /><TextField required type="number" label={itemToEdit ? "Unit cost (₹ per unit)" : Number(itemForm.quantity) > 0 ? "Opening stock total cost (₹)" : "Unit cost for future stock (₹ per unit)"} value={itemForm.cost} onChange={(event) => setItemForm({ ...itemForm, cost: event.target.value })} helperText={itemToEdit ? "Current stock unit price" : Number(itemForm.quantity) > 0 && Number.isFinite(Number(itemForm.cost)) ? `Unit cost: ${CURRENCY.format(Number(itemForm.cost) / Number(itemForm.quantity))} per ${itemForm.unit}` : "No opening stock: this sets the unit price for future receipts."} slotProps={{ htmlInput: { min: 0, step: "any", readOnly: Boolean(itemToEdit) } }} /></Box>
          {itemToEdit ? <Alert severity="info">Stock quantities, units, and purchase costs are audit-tracked. Use stock movements to change quantities, and Batches &amp; expiry to update batch dates.</Alert> : <TextField type="date" label="Opening batch expiry" value={itemForm.expiry} onChange={(event) => setItemForm({ ...itemForm, expiry: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />}
        </DialogContent><DialogActions><Button onClick={() => setItemDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">{itemToEdit ? "Save changes" : "Add item"}</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(movementItem)} onClose={() => setMovementItem(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={recordMovement}><DialogTitle>Record stock movement{movementItem ? ` · ${movementItem.name}` : ""}</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          {movementItem && <Typography className="inventory-dialog__current">Available now: <strong>{formatQuantity(movementItem.quantity)} {movementItem.unit}</strong></Typography>}
          <FormControl><InputLabel id="movement-type-label">Movement type</InputLabel><Select labelId="movement-type-label" label="Movement type" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}><MenuItem value="Purchase received">Purchase received / stock inward</MenuItem><MenuItem value="Kitchen consumption">Kitchen consumption / stock outward</MenuItem><MenuItem value="Wastage">Wastage</MenuItem><MenuItem value="Damage">Damaged stock</MenuItem><MenuItem value="Expired">Expired stock</MenuItem><MenuItem value="Supplier return">Supplier return</MenuItem><MenuItem value="Stock correction">Physical count correction</MenuItem></Select></FormControl>
          <TextField required type="number" label={`Quantity (${movementItem?.unit || ""})`} value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
          <TextField required label="Reason / reference" placeholder={movementForm.type === "Wastage" ? "e.g. spoiled batch, prep loss, expired food" : "e.g. end-of-day spoilage, physical count"} value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
          {(movementForm.type === "Purchase received" || movementForm.type === "Stock correction") && <Box className="inventory-form-row"><TextField label="Batch number" value={movementForm.batch} onChange={(event) => setMovementForm({ ...movementForm, batch: event.target.value })} /><TextField type="date" label="Expiry date" value={movementForm.expiry} onChange={(event) => setMovementForm({ ...movementForm, expiry: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Box>}
          {movementForm.type === "Stock correction" && <Alert severity="warning">Enter the verified physical quantity. This replaces the system balance and records the variance.</Alert>}
          {movementForm.type === "Wastage" ? <Alert severity="warning">This records discarded food and deducts the quantity from available stock with an auditable reason.</Alert> : movementForm.type !== "Purchase received" && movementForm.type !== "Stock correction" && <Alert severity="info">Stock is issued from the earliest-expiring available batch first (FIFO).</Alert>}
        </DialogContent><DialogActions><Button onClick={() => setMovementItem(null)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Save movement</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={purchaseDialogOpen} onClose={() => setPurchaseDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={createPurchase}><DialogTitle>Create purchase order</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          <Alert severity="info">This creates an order only. Stock changes after you confirm receipt.</Alert>
          <FormControl required><InputLabel id="purchase-supplier-label">Supplier</InputLabel><Select labelId="purchase-supplier-label" label="Supplier" value={purchaseForm.supplierId} onChange={(event) => setPurchaseForm({ ...purchaseForm, supplierId: event.target.value })}><MenuItem value="">Choose supplier</MenuItem>{suppliers.filter((supplier) => supplier.active).map((supplier) => <MenuItem value={supplier.id} key={supplier.id}>{supplier.name}</MenuItem>)}</Select></FormControl>
          <FormControl required><InputLabel id="purchase-item-label">Inventory item</InputLabel><Select labelId="purchase-item-label" label="Inventory item" value={purchaseForm.itemId} onChange={(event) => { const selected = items.find((item) => item.id === event.target.value); setPurchaseForm({ ...purchaseForm, itemId: event.target.value, unitPrice: selected ? String(selected.cost) : "" }); }}><MenuItem value="">Choose item</MenuItem>{items.map((item) => <MenuItem value={item.id} key={item.id}>{item.name} ({item.unit})</MenuItem>)}</Select></FormControl>
          <Box className="inventory-form-row"><TextField required type="number" label="Quantity" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any" } }} /><TextField required type="number" label="Unit price (₹)" value={purchaseForm.unitPrice} onChange={(event) => setPurchaseForm({ ...purchaseForm, unitPrice: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any" } }} /></Box>
          <Box className="inventory-form-row"><TextField required label="Invoice / reference" value={purchaseForm.invoice} onChange={(event) => setPurchaseForm({ ...purchaseForm, invoice: event.target.value })} /><TextField type="date" label="Expected expiry" value={purchaseForm.expiry} onChange={(event) => setPurchaseForm({ ...purchaseForm, expiry: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Box>
          {purchaseForm.quantity && purchaseForm.unitPrice && <Typography className="inventory-dialog__current">Order total <strong>{CURRENCY.format(Number(purchaseForm.quantity) * Number(purchaseForm.unitPrice))}</strong></Typography>}
        </DialogContent><DialogActions><Button onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Create order</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(receivingPurchase)} onClose={() => setReceivingPurchase(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={confirmReceivePurchase}>
          <DialogTitle>Receive purchase delivery</DialogTitle>
          <DialogContent className="inventory-dialog__content">
            {formError && <Alert severity="error">{formError}</Alert>}
            {receivingPurchase && <>
              <Typography className="inventory-dialog__current">{receivingPurchase.id} · {receivingPurchase.item}<strong>{formatQuantity(receivingPurchase.quantity - (receivingPurchase.receivedQuantity || 0))} {receivingPurchase.unit} remaining</strong></Typography>
              <TextField autoFocus required type="number" label={`Quantity received (${receivingPurchase.unit})`} value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} slotProps={{ htmlInput: { min: 0.001, max: receivingPurchase.quantity - (receivingPurchase.receivedQuantity || 0), step: "any" } }} />
              <Alert severity="info">You can receive the order in multiple deliveries. Only the quantity entered here will be added to stock.</Alert>
            </>}
          </DialogContent>
          <DialogActions><Button onClick={() => setReceivingPurchase(null)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Confirm receipt</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(paymentPurchase)} onClose={() => setPaymentPurchase(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={recordSupplierPayment}><DialogTitle>Record supplier payment</DialogTitle><DialogContent className="inventory-dialog__content">
          {paymentPurchase && <><Typography className="inventory-dialog__current">{paymentPurchase.supplier} · {paymentPurchase.id}<strong>Due {CURRENCY.format(paymentPurchase.due)}</strong></Typography><TextField autoFocus required type="number" label="Payment amount (₹)" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} slotProps={{ htmlInput: { min: 0.01, max: paymentPurchase.due, step: "any" } }} /><Alert severity="info">Payments are recorded against this invoice. The outstanding balance will update immediately.</Alert></>}
        </DialogContent><DialogActions><Button onClick={() => setPaymentPurchase(null)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Save payment</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveSupplier}><DialogTitle>{supplierToEdit ? "Edit supplier details" : "Add supplier"}</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField required label="Supplier / business name" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} />
          <Box className="inventory-form-row"><TextField required label="Contact person" value={supplierForm.contact} onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })} /><TextField required label="Phone number" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></Box>
          <TextField type="email" label="Email address" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} />
          <FormControl><InputLabel id="supplier-terms-label">Payment terms</InputLabel><Select labelId="supplier-terms-label" label="Payment terms" value={supplierForm.terms} onChange={(event) => setSupplierForm({ ...supplierForm, terms: event.target.value })}><MenuItem value="Due on receipt">Due on receipt</MenuItem><MenuItem value="Net 7 days">Net 7 days</MenuItem><MenuItem value="Net 15 days">Net 15 days</MenuItem><MenuItem value="Net 30 days">Net 30 days</MenuItem></Select></FormControl>
          {supplierToEdit && <Alert severity="info">Saving updates the supplier’s contact details. Existing purchase orders retain their recorded supplier name and history.</Alert>}
        </DialogContent><DialogActions><Button onClick={() => setSupplierDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">{supplierToEdit ? "Save supplier" : "Add supplier"}</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(supplierToView)} onClose={() => setSupplierToView(null)} fullWidth maxWidth="sm">
        <DialogTitle>Supplier details</DialogTitle>
        <DialogContent className="inventory-dialog__content">
          {supplierToView && <>
            <Box className="inventory-supplier-detail__heading"><Box><Typography>{supplierToView.name}</Typography><Typography>{supplierToView.contact}</Typography></Box><StatusChip status={supplierToView.active ? "Active" : "Archived"} /></Box>
            <Box className="inventory-supplier-detail__grid">
              <Box><Typography>Phone</Typography><Typography>{supplierToView.phone}</Typography></Box>
              <Box><Typography>Email</Typography><Typography>{supplierToView.email || "Not provided"}</Typography></Box>
              <Box><Typography>Payment terms</Typography><Typography>{supplierToView.terms}</Typography></Box>
              <Box><Typography>Purchase orders</Typography><Typography>{purchases.filter((purchase) => purchase.supplierId === supplierToView.id).length}</Typography></Box>
            </Box>
            <Typography className="inventory-supplier-detail__section">Purchase history</Typography>
            {purchases.filter((purchase) => purchase.supplierId === supplierToView.id).length ? (
              <TableContainer className="inventory-supplier-detail__history"><Table size="small">
                <TableHead><TableRow><TableCell>ORDER</TableCell><TableCell>ITEM</TableCell><TableCell>DATE</TableCell><TableCell>AMOUNT</TableCell><TableCell>STATUS</TableCell></TableRow></TableHead>
                <TableBody>{purchases.filter((purchase) => purchase.supplierId === supplierToView.id).map((purchase) => <TableRow key={purchase.id}><TableCell>{purchase.id}</TableCell><TableCell>{purchase.item}</TableCell><TableCell>{purchase.date}</TableCell><TableCell>{CURRENCY.format(purchase.quantity * purchase.unitPrice)}</TableCell><TableCell>{purchase.status}</TableCell></TableRow>)}</TableBody>
              </Table></TableContainer>
            ) : <Typography className="inventory-supplier-detail__empty">No purchases recorded for this supplier.</Typography>}
          </>}
        </DialogContent>
        <DialogActions>{supplierToView?.active && <Button onClick={() => { const supplier = supplierToView; setSupplierToView(null); openSupplierDialog(supplier); }}>Edit supplier</Button>}<Button onClick={() => setSupplierToView(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(supplierToDelete)}
        title={supplierToDelete && purchases.some((purchase) => purchase.supplierId === supplierToDelete.id) ? "Archive supplier?" : "Delete supplier?"}
        message={
          supplierToDelete && (() => {
            const linkedPurchases = purchases.filter((purchase) => purchase.supplierId === supplierToDelete.id);
            return <>
              <Typography>Are you sure you want to remove <strong>{supplierToDelete.name}</strong>?</Typography>
              {linkedPurchases.length > 0
                ? <Alert severity="warning">This supplier has {linkedPurchases.length} purchase record{linkedPurchases.length === 1 ? "" : "s"}. It will be archived and excluded from new orders; existing purchases and payment history will be preserved.</Alert>
                : <Alert severity="warning">This supplier has no purchase history and will be permanently removed.</Alert>}
            </>;
          })()
        }
        confirmLabel={supplierToDelete && purchases.some((purchase) => purchase.supplierId === supplierToDelete.id) ? "Archive supplier" : "Delete supplier"}
        destructive
        icon={<DeleteOutlineRoundedIcon />}
        onCancel={() => setSupplierToDelete(null)}
        onConfirm={deleteSupplier}
      />

      <Dialog open={recipeDialogOpen} onClose={() => setRecipeDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveRecipe}><DialogTitle>{recipeToEdit ? "Edit recipe ingredient" : "Add recipe ingredient"}</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField required label="Menu item / dish" placeholder="e.g. Chicken Biryani" value={recipeForm.dish} onChange={(event) => setRecipeForm({ ...recipeForm, dish: event.target.value })} />
          <FormControl required><InputLabel id="recipe-item-label">Inventory ingredient</InputLabel><Select labelId="recipe-item-label" label="Inventory ingredient" value={recipeForm.itemId} onChange={(event) => { const item = items.find((entry) => entry.id === event.target.value); setRecipeForm({ ...recipeForm, itemId: event.target.value, unit: item?.unit || "" }); }}><MenuItem value="">Choose ingredient</MenuItem>{items.map((item) => <MenuItem value={item.id} key={item.id}>{item.name} ({item.unit})</MenuItem>)}</Select></FormControl>
          <TextField required type="number" label={`Quantity per serving${recipeForm.unit ? ` (${recipeForm.unit})` : ""}`} value={recipeForm.quantity} onChange={(event) => setRecipeForm({ ...recipeForm, quantity: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "any" } }} />
          <FormControl required disabled={!recipeForm.itemId}><InputLabel id="legacy-recipe-unit-label">Recipe unit</InputLabel><Select labelId="legacy-recipe-unit-label" label="Recipe unit" value={recipeForm.unit} onChange={(event) => setRecipeForm({ ...recipeForm, unit: event.target.value })}>{recipeUnitsForStockUnit(items.find((item) => item.id === recipeForm.itemId)?.unit).map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}</Select></FormControl>
          <Alert severity="info">Recipe quantities are converted to the inventory stock unit before stock is deducted.</Alert>
        </DialogContent><DialogActions><Button onClick={() => { setRecipeDialogOpen(false); setRecipeToEdit(null); }}>Cancel</Button><Button type="submit" variant="contained" color="secondary">{recipeToEdit ? "Save ingredient" : "Add ingredient"}</Button></DialogActions></Box>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(recipeToDelete)}
        title="Remove recipe ingredient?"
        message={<Typography>Remove {recipeToDelete?.dish} from this ingredient link? This does not change stock or existing movement history.</Typography>}
        confirmLabel="Remove ingredient"
        destructive
        icon={<DeleteOutlineRoundedIcon />}
        onCancel={() => setRecipeToDelete(null)}
        onConfirm={async () => {
            if (!recipeToDelete) return;
            const deleted = await runInventoryAction(() => inventoryService.deleteRecipe(recipeToDelete.id), "Recipe ingredient removed.");
            if (deleted) setRecipeToDelete(null);
        }}
      />

      <Dialog open={Boolean(posDialog)} onClose={() => setPosDialog(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); simulatePosSale(posDialog.dish, Number(posDialog.portions)); }}><DialogTitle>Record completed POS bill</DialogTitle><DialogContent className="inventory-dialog__content">
          {posDialog && <><Typography className="inventory-dialog__current">Recipe: <strong>{posDialog.dish}</strong></Typography><TextField autoFocus required type="number" label="Number of servings" value={posDialog.portions} onChange={(event) => setPosDialog({ ...posDialog, portions: event.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} /><Alert severity="info">Available ingredients are checked first. If any ingredient is short, no stock will be deducted.</Alert></>}
        </DialogContent><DialogActions><Button onClick={() => setPosDialog(null)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Complete bill &amp; deduct</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={saveCategory}><DialogTitle>{categoryToEdit ? "Edit stock category" : "Add stock category"}</DialogTitle><DialogContent className="inventory-dialog__content">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField autoFocus required label="Category name" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          <TextField label="Description" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} helperText={`${categoryDescription.length}/2000`} />
          {categoryToEdit && <Alert severity="info">Renaming this category also updates every linked stock item. Purchase and movement history remains unchanged.</Alert>}
        </DialogContent><DialogActions><Button onClick={() => { setCategoryDialogOpen(false); setCategoryToEdit(null); }}>Cancel</Button><Button type="submit" variant="contained" color="secondary">{categoryToEdit ? "Save changes" : "Create category"}</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(categoryToDelete)} onClose={() => { setCategoryToDelete(null); setFormError(""); }} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={confirmDeleteCategory}>
          <DialogTitle sx={{ textAlign: "center" }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: "error.light", color: "error.dark" }}><DeleteOutlineRoundedIcon /></Avatar>
              <Typography component="span" variant="h6" fontWeight={700}>Delete stock category?</Typography>
            </Box>
          </DialogTitle>
          <DialogContent className="inventory-dialog__content">
            {formError && <Alert severity="error">{formError}</Alert>}
            {categoryToDelete && (() => {
              const linkedItems = items.filter((item) => item.category === categoryToDelete);
              return <>
                <Typography>Delete <strong>{categoryToDelete}</strong>?</Typography>
                {linkedItems.length > 0 ? <>
                  <Alert severity="warning">This category contains {linkedItems.length} stock item{linkedItems.length === 1 ? "" : "s"}. Choose where to move them before deleting; stock and transaction history will be preserved.</Alert>
                  <FormControl required><InputLabel id="replacement-category-label">Move stock items to</InputLabel><Select labelId="replacement-category-label" label="Move stock items to" value={replacementCategory} onChange={(event) => { setReplacementCategory(event.target.value); setFormError(""); }}>
                    {categories.filter((category) => category !== categoryToDelete).map((category) => <MenuItem value={category} key={category}>{category}</MenuItem>)}
                  </Select></FormControl>
                </> : <Alert severity="info">No stock items use this category. It can be safely deleted.</Alert>}
              </>;
            })()}
          </DialogContent>
          <DialogActions><Button onClick={() => { setCategoryToDelete(null); setFormError(""); }}>Cancel</Button><Button type="submit" color="error" variant="contained">Delete category</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(batchToEdit)} onClose={() => setBatchToEdit(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={saveBatchExpiry}><DialogTitle>Update batch expiry</DialogTitle><DialogContent className="inventory-dialog__content"><Typography className="inventory-dialog__current">Batch <strong>{batchToEdit?.batchId}</strong></Typography><TextField type="date" label="Expiry date" value={batchExpiry} onChange={(event) => setBatchExpiry(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Alert severity="info">Correcting a batch expiry date does not alter its received quantity or purchase cost.</Alert></DialogContent><DialogActions><Button onClick={() => setBatchToEdit(null)}>Cancel</Button><Button type="submit" variant="contained" color="secondary">Save expiry</Button></DialogActions></Box>
      </Dialog>

      <Dialog open={Boolean(historyItem)} onClose={() => setHistoryItem(null)} fullWidth maxWidth="sm">
        <DialogTitle>{historyItem ? `${historyItem.name} · Stock history` : "Stock history"}</DialogTitle><DialogContent className="inventory-history">{historyItem?.movements.length ? historyItem.movements.map((movement, index) => <Box className="inventory-history__row" key={`${movement.date}-${index}`}><Box className={`inventory-history__icon ${movement.type.toLowerCase().includes("received") ? "is-received" : "is-used"}`}>{movement.type.toLowerCase().includes("received") ? <AddRoundedIcon /> : <RemoveRoundedIcon />}</Box><Box className="inventory-history__details"><Typography>{movement.type} <strong>{formatQuantity(movement.quantity)} {movement.unit}</strong></Typography><Typography>{movement.reason}</Typography>{movement.batch && <Typography>Batch {movement.batch}{movement.expiry ? ` · expires ${movement.expiry}` : ""}</Typography>}</Box><Typography className="inventory-history__date">{movement.date}</Typography></Box>) : <Typography className="inventory-history__empty">No stock movements recorded for this item yet.</Typography>}</DialogContent><DialogActions><Button onClick={() => setHistoryItem(null)}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={3200} onClose={() => setNotice("")} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><Alert severity={noticeSeverity} variant="filled" onClose={() => setNotice("")}>{notice}</Alert></Snackbar>
    </Box>
  );
}
