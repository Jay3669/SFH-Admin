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
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LocalDiningRoundedIcon from "@mui/icons-material/LocalDiningRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { listMenuCategories, listMenuItems } from "../../services/menuService";
import {
  fireKot,
  createDiningTable,
  listDiningTables,
  transferDiningTable,
  updateDiningTableStatus,
  connectKitchenSocket,
} from "../../services/kotService";
import "./TableOrderPage.css";
import { formatDateTime } from "../../utils/dateTimeFormat";

const STATIONS = ["Tandoor", "Curry", "Starters", "Beverages"];
const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function itemId(item) {
  return String(item.menu_item_id ?? item.id);
}

function getTableId(tables, name) {
  const normalizedName = name.trim().toLowerCase();
  const table = tables.find((entry) => entry.tableName.trim().toLowerCase() === normalizedName);
  return table ? String(table.id) : null;
}

function saveTableDraft(tableId, cart) {
  if (!tableId) return;
  const key = `sfh:table-order-draft:${tableId}`;
  if (cart.length) window.localStorage.setItem(key, JSON.stringify(cart));
  else window.localStorage.removeItem(key);
}

function readTableDraft(tableId) {
  const serializedDraft = window.localStorage.getItem(`sfh:table-order-draft:${tableId}`);
  if (!serializedDraft) return null;
  const draft = JSON.parse(serializedDraft);
  if (!Array.isArray(draft) || draft.some((item) => (
    !item || typeof item.id !== "string" || typeof item.name !== "string"
    || !Number.isFinite(Number(item.price)) || !Number.isSafeInteger(item.quantity)
    || item.quantity < 1 || item.quantity > 99
  ))) {
    throw new Error("The saved table order draft is invalid.");
  }
  return draft;
}

function makeIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TableOrderPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [tableName, setTableName] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All items");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [firedKots, setFiredKots] = useState([]);
  const [tables, setTables] = useState([]);
  const [newTableName, setNewTableName] = useState("");
  const [selectedTableName, setSelectedTableName] = useState("");
  const [tableAction, setTableAction] = useState("");
  const [destinationTable, setDestinationTable] = useState("");
  const [transferMode, setTransferMode] = useState("all");
  const [selectedTransferItemIds, setSelectedTransferItemIds] = useState([]);
  const [tableSaving, setTableSaving] = useState(false);
  const fireKey = useRef(null);
  const pressTimer = useRef(null);
  const shortcutRef = useRef("");
  const shortcutTimer = useRef(null);
  const [contextPosition, setContextPosition] = useState(null);
  const [contextTableName, setContextTableName] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [printRequested, setPrintRequested] = useState(false);
  const firingRef = useRef(false);
  const draftSaveTimer = useRef(null);
  const cartRef = useRef(cart);
  const tableNameRef = useRef(tableName);
  const tablesRef = useRef(tables);
  const lastDraftTableId = useRef(null);
  const needsDraftRestore = useRef(true);
  const draftTableId = getTableId(tables, tableName);
  cartRef.current = cart;
  tableNameRef.current = tableName;
  tablesRef.current = tables;

  useEffect(() => {
    let active = true;
    Promise.all([listMenuCategories(), listMenuItems({ isAvailable: "true" }), listDiningTables()])
      .then(([loadedCategories, loadedItems, loadedTables]) => {
        if (!active) return;
        const categoryById = new Map(loadedCategories.map((category) => [
          String(category.category_id ?? category.id),
          category.category_name ?? category.name,
        ]));
        setCategories([...new Set(loadedItems.map((item) => (
          item.category_name || item.category?.category_name || categoryById.get(String(item.category_id)) || "Menu"
        )))]);
        setMenuItems(loadedItems.map((item) => ({
          id: itemId(item),
          name: String(item.name || "Menu item"),
          price: Number(item.price),
          category: item.category_name || item.category?.category_name || categoryById.get(String(item.category_id)) || "Menu",
          available: item.is_available !== false && item.is_available !== 0 && item.is_available !== "false",
        })).filter((item) => item.available && Number.isFinite(item.price)));
        setTables(loadedTables);
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
    let active = true;
    let socket;
    try {
      socket = connectKitchenSocket();
      const refreshMenu = () => {
        Promise.all([listMenuCategories(), listMenuItems({ isAvailable: "true" })])
          .then(([loadedCategories, loadedItems]) => {
            if (!active) return;
            const categoryById = new Map(loadedCategories.map((category) => [
              String(category.category_id ?? category.id),
              category.category_name ?? category.name,
            ]));
            const normalizedItems = loadedItems.map((item) => ({
              id: itemId(item),
              name: String(item.name || "Menu item"),
              price: Number(item.price),
              category: item.category_name || item.category?.category_name || categoryById.get(String(item.category_id)) || "Menu",
              available: item.is_available !== false && item.is_available !== 0 && item.is_available !== "false",
            })).filter((item) => item.available && Number.isFinite(item.price));
            setMenuItems(normalizedItems);
            setCategories([...new Set(normalizedItems.map((item) => item.category))]);
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
        if (!active) return;
        const id = itemId(updatedItem);
        const isAvailable = updatedItem.is_available !== false
          && updatedItem.is_available !== 0
          && updatedItem.is_available !== "false";
        const price = Number(updatedItem.price);
        setMenuItems((current) => {
          const existing = current.find((item) => item.id === id);
          const next = current.filter((item) => item.id !== id);
          if (!isAvailable || !Number.isFinite(price)) return next;
          return [...next, {
            id,
            name: String(updatedItem.name || existing?.name || "Menu item"),
            price,
            category: updatedItem.category_name || updatedItem.category?.category_name || existing?.category || "Menu",
            available: true,
          }];
        });
        const category = updatedItem.category_name || updatedItem.category?.category_name;
        if (category) setCategories((current) => current.includes(category) ? current : [...current, category]);
      });
      const updateTableStatus = (event) => {
        const incomingTable = event?.table || event;
        const incomingName = incomingTable?.tableName || incomingTable?.table_name;
        const incomingId = incomingTable?.id ?? incomingTable?.table_id;
        const incomingStatus = incomingTable?.status;
        if (!incomingStatus) return;
        setTables((current) => current.map((table) => (
          (incomingId != null && String(table.id) === String(incomingId))
          || (incomingName && table.tableName === incomingName)
            ? { ...table, status: incomingStatus }
            : table
        )));
      };
      socket.on("table:settled", updateTableStatus);
      socket.on("table:status", updateTableStatus);
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
    if (!draftTableId) {
      needsDraftRestore.current = true;
      return;
    }
    if (!needsDraftRestore.current && lastDraftTableId.current === draftTableId) return;
    try {
      const draft = readTableDraft(draftTableId);
      if (draft) setCart(draft);
      else if (lastDraftTableId.current) setCart([]);
      lastDraftTableId.current = draftTableId;
      needsDraftRestore.current = false;
    } catch (draftError) {
      setError(`Unable to restore the saved table order: ${draftError.message}`);
    }
  }, [draftTableId]);

  useEffect(() => {
    if (!draftTableId) return undefined;
    window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => {
      try {
        saveTableDraft(draftTableId, cart);
      } catch (draftError) {
        setError(`Unable to save the table order draft: ${draftError.message}`);
      }
    }, 1500);
    return () => window.clearTimeout(draftSaveTimer.current);
  }, [cart, draftTableId]);

  useEffect(() => {
    const flushDraft = () => {
      try {
        saveTableDraft(getTableId(tablesRef.current, tableNameRef.current), cartRef.current);
      } catch (draftError) {
        setError(`Unable to save the table order draft: ${draftError.message}`);
      }
    };
    window.addEventListener("pagehide", flushDraft);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, []);

  useEffect(() => {
    if (!printRequested || !firedKots.length) return;
    window.print();
    setPrintRequested(false);
  }, [firedKots, printRequested]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleTableShortcut(event) {
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )) return;

      if (event.key.toLowerCase() === "t" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        shortcutRef.current = "t";
        window.clearTimeout(shortcutTimer.current);
        shortcutTimer.current = window.setTimeout(() => { shortcutRef.current = ""; }, 1200);
        return;
      }
      if (shortcutRef.current === "t" && /^\d$/.test(event.key)) {
        shortcutRef.current += event.key;
        const tableNumber = shortcutRef.current.slice(1);
        const table = tables.find((entry) => new RegExp(`(?:^|\\D)0*${tableNumber}$`).test(entry.tableName));
        if (table) document.getElementById(`table-card-${table.id}`)?.focus();
        return;
      }
      if (event.key === "Enter" && shortcutRef.current.length > 1) {
        const tableNumber = shortcutRef.current.slice(1);
        const table = tables.find((entry) => new RegExp(`(?:^|\\D)0*${tableNumber}$`).test(entry.tableName));
        if (table) {
          event.preventDefault();
          setSelectedTableName(table.tableName);
        }
        shortcutRef.current = "";
      }
    }
    window.addEventListener("keydown", handleTableShortcut);
    return () => {
      window.removeEventListener("keydown", handleTableShortcut);
      window.clearTimeout(shortcutTimer.current);
    };
  }, [tables]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuItems.filter((item) => (
      (activeCategory === "All items" || item.category === activeCategory)
      && (!query || item.name.toLowerCase().includes(query))
    ));
  }, [activeCategory, menuItems, search]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const selectedTable = tables.find((table) => table.tableName === selectedTableName);
  const priceByItemId = new Map(menuItems.map((item) => [item.id, item.price]));

  function openTableContextMenu(event, table) {
    event.preventDefault();
    setContextTableName(table.tableName);
    setContextPosition({ mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
  }

  function stopLongPress() {
    window.clearTimeout(pressTimer.current);
  }

  function startLongPress(event, table) {
    if (event.pointerType === "mouse") return;
    stopLongPress();
    pressTimer.current = window.setTimeout(() => {
      setContextTableName(table.tableName);
      setContextPosition({ mouseX: event.clientX, mouseY: event.clientY });
    }, 550);
  }

  function chooseTableAction(action) {
    const table = tables.find((entry) => entry.tableName === contextTableName);
    setContextPosition(null);
    if (!table) return;
    setSelectedTableName(table.tableName);
    setTableAction("");
    setDestinationTable("");
    setTransferMode("all");
    setSelectedTransferItemIds([]);
    if (action === "manage") return;
    if (action === "print") {
      setFiredKots(table.kots || []);
      setPrintRequested(true);
      return;
    }
    setTableAction(action);
  }

  async function refreshTables() {
    setTables(await listDiningTables());
  }

  async function handleCreateTable() {
    if (!newTableName.trim()) return;
    setTableSaving(true);
    setError("");
    try {
      await createDiningTable(newTableName.trim());
      setNewTableName("");
    } catch (createError) {
      setError(createError.message || "Unable to add the table.");
      setTableSaving(false);
      return;
    }
    try {
      await refreshTables();
    } catch (refreshError) {
      setError(`Table was added, but the live table list could not refresh: ${refreshError.message}`);
    } finally {
      setTableSaving(false);
    }
  }

  function addToCart(item) {
    fireKey.current = null;
    setCart((current) => {
      const existing = current.find((row) => row.id === item.id);
      return existing
        ? current.map((row) => row.id === item.id ? { ...row, quantity: Math.min(99, row.quantity + 1) } : row)
        : [...current, { ...item, quantity: 1 }];
    });
  }

  function changeQuantity(id, amount) {
    fireKey.current = null;
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: Math.min(99, item.quantity + amount) } : item)
      .filter((item) => item.quantity > 0));
  }

  async function handleFireKot() {
    if (firingRef.current) return;
    if (!tableName.trim()) {
      setError("Enter a table name or number before firing the KOT.");
      return;
    }
    if (!cart.length) {
      setError("Add at least one menu item before firing the KOT.");
      return;
    }
    firingRef.current = true;
    setSaving(true);
    setError("");
    setFiredKots([]);
    fireKey.current ||= makeIdempotencyKey();
    let kots;
    try {
      kots = await fireKot({
        idempotencyKey: fireKey.current,
        tableName: tableName.trim(),
        items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
      });
    } catch (fireError) {
      setError(fireError.message || "Unable to send the order to the kitchen.");
      firingRef.current = false;
      setSaving(false);
      return;
    }
    setFiredKots(kots);
    setCart([]);
    try {
      saveTableDraft(getTableId(tables, tableName), []);
    } catch (draftError) {
      setError(`KOTs were sent, but the saved draft could not be cleared: ${draftError.message}`);
    }
    fireKey.current = null;
    try {
      await refreshTables();
    } catch (refreshError) {
      setError(`KOTs were sent, but the live table list could not refresh: ${refreshError.message}`);
    } finally {
      firingRef.current = false;
      setSaving(false);
    }
  }

  async function handleTableTransfer() {
    if (!selectedTable || !destinationTable || (transferMode === "selected" && !selectedTransferItemIds.length)) return;
    setTableSaving(true);
    setError("");
    try {
      if (transferMode === "selected") {
        await transferDiningTable(selectedTable.tableName, destinationTable, tableAction, {
          itemIds: selectedTransferItemIds,
        });
      } else {
        await transferDiningTable(selectedTable.tableName, destinationTable, tableAction);
      }
    } catch (actionError) {
      setError(actionError.message || "Unable to update the table order.");
      setTableSaving(false);
      return;
    }
    setSelectedTableName("");
    setTableAction("");
    setDestinationTable("");
    setTransferMode("all");
    setSelectedTransferItemIds([]);
    try {
      await refreshTables();
    } catch (refreshError) {
      setError(`Table orders were updated, but the live table list could not refresh: ${refreshError.message}`);
    } finally {
      setTableSaving(false);
    }
  }

  async function handleTableStatus(status) {
    if (!selectedTable) return;
    setTableSaving(true);
    setError("");
    try {
      await updateDiningTableStatus(selectedTable.tableName, status);
    } catch (actionError) {
      setError(actionError.message || "Unable to update the table status.");
      setTableSaving(false);
      return;
    }
    try {
      await refreshTables();
    } catch (refreshError) {
      setError(`Table status was updated, but the live table list could not refresh: ${refreshError.message}`);
    } finally {
      setTableSaving(false);
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2, pb: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">FRONT COUNTER</Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>Table Orders</Typography>
          <Typography color="text.secondary">Fire items to their configured kitchen stations.</Typography>
        </Box>
        <Chip icon={<LocalDiningRoundedIcon />} label={`${itemCount} items in order`} />
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
          <Typography component="h2" variant="h6" fontWeight={750}>Live tables</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              label="New table name"
              value={newTableName}
              onChange={(event) => setNewTableName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 64 } }}
            />
            <Button variant="outlined" onClick={handleCreateTable} disabled={tableSaving || !newTableName.trim()}>
              Add Table
            </Button>
          </Box>
        </Box>
        {tables.length ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 1.5 }}>
            {tables.map((table) => (
              <Card
                id={`table-card-${table.id}`}
                key={table.id}
                variant="outlined"
                role="button"
                tabIndex={0}
                aria-label={`${table.tableName}, ${table.status}. Open table order and billing.`}
                onClick={() => setSelectedTableName(table.tableName)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTableName(table.tableName);
                  }
                }}
                onContextMenu={(event) => openTableContextMenu(event, table)}
                onPointerDown={(event) => startLongPress(event, table)}
                onPointerUp={stopLongPress}
                onPointerLeave={stopLongPress}
                sx={{
                  position: "relative",
                  display: "flex",
                  minHeight: 140,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  overflow: "hidden",
                  p: 1.5,
                  pt: 2.5,
                  cursor: "pointer",
                  touchAction: "pan-y",
                  borderWidth: 2,
                  borderColor: table.status === "vacant" ? "success.main" : table.status === "occupied" ? "warning.main" : table.status === "billed" ? "primary.main" : "error.main",
                  backgroundColor: table.status === "vacant" ? "#ecfdf5" : table.status === "occupied" ? "#fffbeb" : table.status === "billed" ? "#eef2ff" : "#fff1f2",
                  color: table.status === "vacant" ? "#065f46" : table.status === "occupied" ? "#78350f" : table.status === "billed" ? "#3730a3" : "#9f1239",
                  "&:focus-visible": { outline: "3px solid #2563eb", outlineOffset: 2 },
                  "&::before": { content: '""', position: "absolute", inset: "0 0 auto", height: 7, backgroundColor: "currentColor" },
                }}
              >
                <Box>
                  <Typography variant="h6" component="h3" fontWeight={850} lineHeight={1.15}>{table.tableName}</Typography>
                  <Chip size="small" sx={{ mt: 1, textTransform: "capitalize", fontWeight: 700 }} label={table.status.replace("/", " · ")} />
                </Box>
                <Box>
                  {(() => {
                    const firstKot = table.kots.reduce((earliest, kot) => (
                      !earliest || new Date(kot.createdAt) < new Date(earliest.createdAt) ? kot : earliest
                    ), null);
                    const elapsed = firstKot ? Math.max(0, Math.floor((clock - new Date(firstKot.createdAt).getTime()) / 60000)) : null;
                    const estimatedTotal = table.kots.reduce((sum, kot) => sum + kot.items.reduce(
                      (itemTotal, item) => itemTotal + (priceByItemId.get(item.menuItemId) || 0) * item.quantity,
                      0,
                    ), 0);
                    return (
                      <>
                        <Typography variant="body2" fontWeight={800}>{elapsed === null ? "Ready" : `${elapsed}m active`}</Typography>
                        {table.kots.length > 0 && <Typography variant="caption" display="block" fontWeight={700}>~{CURRENCY.format(estimatedTotal)} menu estimate</Typography>}
                      </>
                    );
                  })()}
                  <Typography variant="caption">{table.kots.length} active KOT{table.kots.length === 1 ? "" : "s"}</Typography>
                </Box>
              </Card>
            ))}
          </Box>
        ) : <Typography color="text.secondary">Tables will appear here when an order is fired.</Typography>}
      </Card>

      <Menu
        open={Boolean(contextPosition)}
        onClose={() => setContextPosition(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextPosition ? { top: contextPosition.mouseY, left: contextPosition.mouseX } : undefined}
      >
        <MenuItem onClick={() => chooseTableAction("manage")}>Open table order / billing</MenuItem>
        <MenuItem disabled={tables.find((entry) => entry.tableName === contextTableName)?.status !== "occupied"} onClick={() => chooseTableAction("move")}>Transfer table</MenuItem>
        <MenuItem disabled={tables.find((entry) => entry.tableName === contextTableName)?.status !== "occupied"} onClick={() => chooseTableAction("merge")}>Merge table</MenuItem>
        <MenuItem disabled={!tables.find((entry) => entry.tableName === contextTableName)?.kots.length} onClick={() => chooseTableAction("print")}>Print KOT</MenuItem>
      </Menu>

      <Dialog open={Boolean(selectedTable)} onClose={() => !tableSaving && setSelectedTableName("")} fullWidth maxWidth="md">
        <DialogTitle>{selectedTable?.tableName} · {selectedTable?.status}</DialogTitle>
        <DialogContent dividers>
          <Typography fontWeight={700} mb={1}>Active kitchen tickets</Typography>
          {selectedTable?.kots.length ? selectedTable.kots.map((kot) => (
            <Box key={kot.id} sx={{ mb: 1.5 }}>
              <Typography>{kot.number} · {kot.station} · {kot.status}</Typography>
              <Typography variant="body2" color="text.secondary">
                {kot.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}
              </Typography>
            </Box>
          )) : <Typography color="text.secondary" mb={2}>No active kitchen tickets.</Typography>}
          {selectedTable?.status === "occupied" && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
              <Button variant="outlined" onClick={() => { setTableAction("move"); setDestinationTable(""); setTransferMode("all"); setSelectedTransferItemIds([]); }}>Move Table</Button>
              <Button variant="outlined" onClick={() => { setTableAction("merge"); setDestinationTable(""); setTransferMode("all"); setSelectedTransferItemIds([]); }}>Merge Tables</Button>
              <Button variant="outlined" onClick={() => handleTableStatus("billed")}>Mark Billed</Button>
            </Box>
          )}
          {selectedTable?.status === "billed" && (
            <Button sx={{ mt: 2 }} variant="outlined" onClick={() => handleTableStatus("dirty/cleaning")}>
              Start Cleaning
            </Button>
          )}
          {selectedTable?.status === "dirty/cleaning" && (
            <Button sx={{ mt: 2 }} variant="outlined" onClick={() => handleTableStatus("vacant")}>
              Mark Vacant
            </Button>
          )}
          {tableAction && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
              <Card variant="outlined" sx={{ p: 2, bgcolor: "#eff6ff", borderColor: "#bfdbfe", borderRadius: 2 }}>
                <Typography fontWeight={800}>Source · {selectedTable?.tableName}</Typography>
                <Typography variant="body2">{selectedTable?.kots.length || 0} active kitchen tickets</Typography>
                <Typography variant="body2">Current menu estimate {CURRENCY.format((selectedTable?.kots || []).reduce((sum, kot) => sum + kot.items.reduce((lineSum, item) => lineSum + (priceByItemId.get(item.menuItemId) || 0) * item.quantity, 0), 0))}</Typography>
                <RadioGroup value={transferMode} aria-label="Orders to transfer" onChange={(event) => {
                  setTransferMode(event.target.value);
                  setSelectedTransferItemIds([]);
                }}>
                  <FormControlLabel value="all" control={<Radio />} label="Transfer all active tickets" />
                  <FormControlLabel value="selected" control={<Radio />} label="Select specific items to move" />
                </RadioGroup>
                {transferMode === "selected" && (selectedTable?.kots || []).map((kot) => (
                  <Box key={kot.id} sx={{ display: "grid" }}>
                    <Typography variant="caption" fontWeight={700}>{kot.number} · {kot.station}</Typography>
                    {kot.items.map((item) => (
                      <FormControlLabel
                        key={item.id}
                        control={
                          <Checkbox
                            checked={selectedTransferItemIds.includes(String(item.id))}
                            onChange={(event) => setSelectedTransferItemIds((current) => (
                              event.target.checked
                                ? [...current, String(item.id)]
                                : current.filter((id) => id !== String(item.id))
                            ))}
                          />
                        }
                        label={`${item.name} × ${item.quantity}`}
                      />
                    ))}
                  </Box>
                ))}
              </Card>
              <Card variant="outlined" sx={{ p: 2, bgcolor: "#f8fafc", borderColor: "#cbd5e1", borderRadius: 2 }}>
                <Typography fontWeight={800}>Destination table</Typography>
                <Select
                  fullWidth
                  size="small"
                  displayEmpty
                  value={destinationTable}
                  onChange={(event) => setDestinationTable(event.target.value)}
                  inputProps={{ "aria-label": "Destination table" }}
                  sx={{ mt: 1 }}
                >
                  <MenuItem value="" disabled>Select destination table</MenuItem>
                  {tables.filter((table) => (
                    table.tableName !== selectedTable?.tableName
                    && table.status === (tableAction === "move" ? "vacant" : "occupied")
                  )).map((table) => (
                    <MenuItem key={table.id} value={table.tableName}>{table.tableName}</MenuItem>
                  ))}
                </Select>
                <Typography variant="body2" mt={1}>
                  {transferMode === "selected"
                    ? `${selectedTransferItemIds.length} selected item${selectedTransferItemIds.length === 1 ? "" : "s"} · approx. ${CURRENCY.format((selectedTable?.kots || []).reduce((total, kot) => total + kot.items.filter((item) => selectedTransferItemIds.includes(String(item.id))).reduce((sum, item) => sum + (priceByItemId.get(item.menuItemId) || 0) * item.quantity, 0), 0))}`
                    : tableAction === "move" ? "The source becomes vacant after all active tickets move." : "Tickets are added to the occupied destination table."}
                </Typography>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {tableAction && (
            <Button onClick={handleTableTransfer} disabled={tableSaving || !destinationTable || (transferMode === "selected" && !selectedTransferItemIds.length)}>
              {tableSaving ? "Updating…" : tableAction === "move" ? `Confirm Transfer of ${selectedTable?.tableName} to ${destinationTable}` : `Confirm Merge into ${destinationTable}`}
            </Button>
          )}
          <Button onClick={() => { setSelectedTableName(""); setTableAction(""); }} disabled={tableSaving}>Close</Button>
        </DialogActions>
      </Dialog>

      {firedKots.length > 0 && (
        <Box>
          <Alert severity="success" action={
            <ButtonGroup size="small">
              <Button startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>Print KOTs</Button>
              <Button onClick={() => setFiredKots([])}>Dismiss</Button>
            </ButtonGroup>
          }>
            Sent {firedKots.map((kot) => `${kot.number} · ${kot.station}`).join(", ")} to the kitchen display.
          </Alert>
          <Box className="table-order-print-only">
            {firedKots.map((kot) => (
              <Box key={kot.id} sx={{ mb: 3, pb: 2, borderBottom: "1px dashed #555" }}>
                <Typography variant="h5" fontWeight={800}>{kot.number}</Typography>
                <Typography variant="h6">{kot.station} · Table {kot.tableName}</Typography>
                <Typography variant="caption">{formatDateTime(kot.createdAt)}</Typography>
                {kot.items.map((item) => (
                  <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: 1 }}>
                    <Typography>{item.name}{item.notes ? ` (${item.notes})` : ""}</Typography>
                    <Typography fontWeight={800}>× {item.quantity}</Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 360px" }, gap: 2, alignItems: "start" }}>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "space-between", mb: 2 }}>
            <Typography component="h2" variant="h6" fontWeight={750}>Menu</Typography>
            <TextField size="small" label="Search menu" value={search} onChange={(event) => setSearch(event.target.value)} />
          </Box>
          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", mb: 2 }}>
            {["All items", ...categories].map((category) => (
              <Button key={category} size="small" variant={activeCategory === category ? "contained" : "outlined"} onClick={() => setActiveCategory(category)}>{category}</Button>
            ))}
          </Box>
          {loading ? <Typography color="text.secondary">Loading menu…</Typography> : visibleItems.length ? (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 1.5 }}>
              {visibleItems.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, p: 1.5 }}>
                  <Box>
                    <Typography fontWeight={700}>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.category}</Typography>
                    <Typography variant="body2" fontWeight={700}>{CURRENCY.format(item.price)}</Typography>
                  </Box>
                  <IconButton aria-label={`Add ${item.name} to table order`} onClick={() => addToCart(item)}><AddRoundedIcon /></IconButton>
                </Card>
              ))}
            </Box>
          ) : <Typography color="text.secondary">No menu items found.</Typography>}
        </Card>

        <Card variant="outlined" sx={{ p: 2, position: { lg: "sticky" }, top: 16 }}>
          <Typography component="h2" variant="h6" fontWeight={750} mb={2}>Current table order</Typography>
          <TextField
            label="Table name or number"
            value={tableName}
            onChange={(event) => {
              if (draftTableId) {
                try {
                  saveTableDraft(draftTableId, cartRef.current);
                } catch (draftError) {
                  setError(`Unable to save the table order draft: ${draftError.message}`);
                }
              }
              fireKey.current = null;
              setTableName(event.target.value);
            }}
            slotProps={{ htmlInput: { maxLength: 64 } }}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          {cart.length ? (
            <Box sx={{ display: "grid", gap: 1.5, mb: 2 }}>
              {cart.map((item) => (
                <Box key={item.id} sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 1 }}>
                  <Box>
                    <Typography fontWeight={650}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{CURRENCY.format(item.price * item.quantity)}</Typography>
                  </Box>
                  <ButtonGroup size="small" aria-label={`${item.name} quantity`}>
                    <IconButton aria-label={`Decrease ${item.name}`} onClick={() => changeQuantity(item.id, -1)}><RemoveRoundedIcon fontSize="small" /></IconButton>
                    <Button disabled>{item.quantity}</Button>
                    <IconButton aria-label={`Increase ${item.name}`} disabled={item.quantity >= 99} onClick={() => changeQuantity(item.id, 1)}><AddRoundedIcon fontSize="small" /></IconButton>
                  </ButtonGroup>
                  <IconButton aria-label={`Remove ${item.name}`} onClick={() => changeQuantity(item.id, -item.quantity)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Box>
              ))}
            </Box>
          ) : <Typography color="text.secondary" mb={2}>Choose menu items to add them to the table.</Typography>}
          <Button variant="contained" fullWidth disabled={saving || !cart.length || loading} onClick={handleFireKot}>
            {saving ? "Sending to kitchen…" : "Fire / KOT"}
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
            {STATIONS.join(" · ")} tickets are created separately and sent live to the kitchen display.
          </Typography>
        </Card>
      </Box>
    </Box>
  );
}
