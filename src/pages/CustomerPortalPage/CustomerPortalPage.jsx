import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Rating,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {
  loadPublicOrder,
  loadPublicReceipt,
  submitPublicFeedback,
  submitPublicOrder,
} from "../../services/featureServices";
import { formatDateTime } from "../../utils/dateTimeFormat";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function useToken() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

function newIdempotencyKey() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function CustomerOrder({ token }) {
  const [menu, setMenu] = useState(null);
  const [cart, setCart] = useState({});
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const orderKey = useRef(newIdempotencyKey());

  useEffect(() => {
    let active = true;
    loadPublicOrder(token)
      .then((response) => { if (active) setMenu(response); })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load this table menu."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const visibleItems = useMemo(
    () => (menu?.items || []).filter((item) => category === "all" || item.categoryId === category),
    [category, menu],
  );
  const selectedItems = useMemo(
    () => Object.entries(cart).filter(([, quantity]) => quantity > 0),
    [cart],
  );
  const total = selectedItems.reduce((sum, [id, quantity]) => {
    const item = menu?.items.find((entry) => entry.id === id);
    return sum + (item ? item.price * quantity : 0);
  }, 0);

  function changeQuantity(id, amount) {
    setCart((current) => {
      const quantity = Math.max(0, Math.min(20, (current[id] || 0) + amount));
      return { ...current, [id]: quantity };
    });
  }

  async function placeOrder() {
    if (!selectedItems.length || sending) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await submitPublicOrder(token, selectedItems.map(([menuItemId, quantity]) => ({ menuItemId, quantity })), orderKey.current);
      setNotice(`${response.message}${response.orderNumber ? ` Reference: ${response.orderNumber}.` : ""}`);
      setCart({});
      orderKey.current = newIdempotencyKey();
    } catch (submitError) {
      setError(submitError.message || "Unable to send your order.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}><CircularProgress /></Box>;
  if (!menu) return <Alert severity="error">{error || "This table QR code could not be loaded."}</Alert>;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, pb: 16 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="primary">SURYA FOOD HUB</Typography>
        <Typography component="h1" variant="h4" fontWeight={800}>Order for {menu.tableName}</Typography>
        <Typography color="text.secondary">Browse the menu and send your order to the kitchen. Pay at the counter.</Typography>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: 2 }}>
        <Chip clickable color={category === "all" ? "primary" : "default"} label="All items" onClick={() => setCategory("all")} />
        {menu.categories.map((entry) => (
          <Chip key={entry.category_id} clickable color={category === String(entry.category_id) ? "primary" : "default"} label={entry.category_name} onClick={() => setCategory(String(entry.category_id))} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
        {visibleItems.map((item) => (
          <Card key={item.id} variant="outlined" sx={{ display: "flex", overflow: "hidden", minHeight: 116 }}>
            {item.imageUrl && <Box component="img" src={item.imageUrl} alt="" sx={{ width: 104, objectFit: "cover" }} />}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.5, flex: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                <Typography fontWeight={800} sx={{ mt: 0.5 }}>{CURRENCY.format(item.price)}</Typography>
                <Chip size="small" variant="outlined" color={item.foodType === "Veg" ? "success" : "error"} label={item.foodType || "Menu item"} sx={{ mt: 0.75 }} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <IconButton aria-label={`Remove one ${item.name}`} disabled={!cart[item.id]} onClick={() => changeQuantity(item.id, -1)}><RemoveRoundedIcon /></IconButton>
                <Typography aria-live="polite" sx={{ minWidth: 20, textAlign: "center" }}>{cart[item.id] || 0}</Typography>
                <IconButton aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, 1)}><AddRoundedIcon /></IconButton>
              </Box>
            </Box>
          </Card>
        ))}
      </Box>
      {!visibleItems.length && <Alert severity="info" sx={{ mt: 2 }}>No available dishes in this category.</Alert>}
      <Card elevation={8} sx={{ position: "fixed", zIndex: 2, bottom: 12, left: 12, right: 12, maxWidth: 920, mx: "auto", p: 1.5, borderRadius: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography fontWeight={800}>{selectedItems.reduce((sum, [, count]) => sum + count, 0)} items · {CURRENCY.format(total)}</Typography>
            <Typography variant="caption" color="text.secondary">Payment is collected at the counter</Typography>
          </Box>
          <Button variant="contained" size="large" disabled={!selectedItems.length || sending} onClick={placeOrder} sx={{ minHeight: 48, px: 3 }}>
            {sending ? "Sending…" : "Place order"}
          </Button>
        </Box>
      </Card>
    </Container>
  );
}

function PublicReceipt({ token, feedback = false }) {
  const [receipt, setReceipt] = useState(null);
  const [rating, setRating] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadPublicReceipt(token)
      .then((value) => { if (active) setReceipt(value); })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load this receipt."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function saveRating() {
    if (!rating) return;
    try {
      await submitPublicFeedback(token, rating);
      setNotice("Thank you for your feedback.");
      setError("");
    } catch (submitError) {
      setError(submitError.message || "Unable to save your feedback.");
    }
  }

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}><CircularProgress /></Box>;
  if (!receipt) return <Container maxWidth="sm" sx={{ py: 4 }}><Alert severity="error">{error || "Receipt not found."}</Alert></Container>;
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Typography variant="overline" color="primary">SURYA FOOD HUB</Typography>
        <Typography component="h1" variant="h4" fontWeight={800}>{feedback ? "How was your visit?" : "Your receipt"}</Typography>
        {!feedback && <Typography color="text.secondary">{receipt.number} · {formatDateTime(receipt.date)}</Typography>}
        {!feedback && <>
          <Divider sx={{ my: 2 }} />
          {receipt.items.map((item, index) => <Box key={`${item.name}-${index}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}><span>{item.quantity} × {item.name}</span><strong>{CURRENCY.format(item.lineTotal)}</strong></Box>)}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "grid", gap: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><strong>{CURRENCY.format(receipt.subtotal)}</strong></Box>
            {receipt.discount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><strong>− {CURRENCY.format(receipt.discount)}</strong></Box>}
            {receipt.tax > 0 && <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>Tax</span><strong>{CURRENCY.format(receipt.tax)}</strong></Box>}
            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem" }}><span>Total · {receipt.paymentMethod}</span><strong>{CURRENCY.format(receipt.total)}</strong></Box>
          </Box>
        </>}
        {feedback && <>
          <Typography sx={{ mt: 2 }}>Please rate your experience.</Typography>
          <Rating value={rating} onChange={(event, value) => setRating(value || 0)} size="large" aria-label="Rate your experience" sx={{ my: 2 }} />
          <Button variant="contained" disabled={!rating} onClick={saveRating}>Send feedback</Button>
        </>}
        {notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Card>
    </Container>
  );
}

export default function CustomerPortalPage() {
  const token = useToken();
  const path = window.location.pathname;
  if (!token) return <Container maxWidth="sm" sx={{ py: 4 }}><Alert severity="error">This link is incomplete. Please scan the QR code or reopen your bill link.</Alert></Container>;
  if (path === "/customer/receipt") return <PublicReceipt token={token} />;
  if (path === "/customer/feedback") return <PublicReceipt token={token} feedback />;
  return <CustomerOrder token={token} />;
}
