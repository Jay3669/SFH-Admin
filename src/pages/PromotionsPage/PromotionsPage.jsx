import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { deletePromotion, listPromotions, savePromotion } from "../../services/featureServices";
import { listMenuCategories } from "../../services/menuService";

const WEEKDAYS = [
  ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0],
];
const EMPTY_FORM = { name: "", categoryId: "", discountPercent: 20, daysOfWeek: [1, 2, 3, 4], startTime: "16:00", endTime: "19:00", effectiveFrom: "", effectiveUntil: "", isActive: true };

function mapPromotion(rule) {
  return {
    name: rule.name,
    categoryId: String(rule.category_id),
    discountPercent: Number(rule.discount_percent),
    daysOfWeek: rule.days_of_week.map(Number),
    startTime: String(rule.start_time).slice(0, 5),
    endTime: String(rule.end_time).slice(0, 5),
    effectiveFrom: rule.effective_from || "",
    effectiveUntil: rule.effective_until || "",
    isActive: rule.is_active,
  };
}

export default function PromotionsPage() {
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const [menuCategories, currentPromotions] = await Promise.all([listMenuCategories(), listPromotions()]);
    setCategories(menuCategories.filter((category) => category.is_active));
    setPromotions(currentPromotions);
    setForm((current) => current.categoryId || !menuCategories.length
      ? current
      : { ...current, categoryId: String(menuCategories.find((category) => category.is_active)?.category_id || "") });
  }

  useEffect(() => {
    let active = true;
    Promise.all([listMenuCategories(), listPromotions()])
      .then(([menuCategories, currentPromotions]) => {
        if (!active) return;
        const activeCategories = menuCategories.filter((category) => category.is_active);
        setCategories(activeCategories);
        setPromotions(currentPromotions);
        setForm((current) => ({ ...current, categoryId: String(activeCategories[0]?.category_id || "") }));
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load promotion rules."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day) {
    update("daysOfWeek", form.daysOfWeek.includes(day)
      ? form.daysOfWeek.filter((value) => value !== day)
      : [...form.daysOfWeek, day]);
  }

  function edit(rule) {
    setEditingId(String(rule.happy_hour_rule_id));
    setForm(mapPromotion(rule));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await savePromotion(form, editingId);
      await refresh();
      setEditingId("");
      setNotice(editingId ? "Promotion updated." : "Promotion created.");
      setForm({ ...EMPTY_FORM, categoryId: String(categories[0]?.category_id || "") });
    } catch (saveError) {
      setError(saveError.message || "Unable to save the promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule) {
    if (!window.confirm(`Delete "${rule.name}"?`)) return;
    try {
      await deletePromotion(rule.happy_hour_rule_id);
      await refresh();
      setNotice("Promotion deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete the promotion.");
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="overline" color="primary">REVENUE MANAGEMENT</Typography>
        <Typography component="h1" variant="h4" fontWeight={800}>Happy hour promotions</Typography>
        <Typography color="text.secondary">Schedules use Asia/Kolkata time. The server applies the discount at checkout; menu base prices stay unchanged.</Typography>
      </Box>
      {(error || notice) && <Alert severity={error ? "error" : "success"} onClose={() => { setError(""); setNotice(""); }}>{error || notice}</Alert>}
      <Card component="form" onSubmit={save} variant="outlined" sx={{ p: 2, display: "grid", gap: 2 }}>
        <Typography variant="h6">{editingId ? "Edit promotion" : "Create promotion"}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
          <TextField required label="Rule name" value={form.name} onChange={(event) => update("name", event.target.value)} inputProps={{ maxLength: 120 }} />
          <FormControl required>
            <InputLabel id="promo-category-label">Menu category</InputLabel>
            <Select labelId="promo-category-label" label="Menu category" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
              {categories.map((category) => <MenuItem key={category.category_id} value={String(category.category_id)}>{category.category_name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField required type="number" label="Discount percent" value={form.discountPercent} onChange={(event) => update("discountPercent", Number(event.target.value))} inputProps={{ min: 0.01, max: 100, step: 0.01 }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          {WEEKDAYS.map(([name, day]) => <FormControlLabel key={name} control={<Checkbox checked={form.daysOfWeek.includes(day)} onChange={() => toggleDay(day)} />} label={name} />)}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          <TextField required type="time" label="Start time" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField required type="time" label="End time" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Effective from" value={form.effectiveFrom} onChange={(event) => update("effectiveFrom", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Effective until" value={form.effectiveUntil} onChange={(event) => update("effectiveUntil", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <FormControlLabel control={<Switch checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />} label="Rule active" />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button type="submit" variant="contained" disabled={saving || loading || !categories.length}>{saving ? "Saving…" : editingId ? "Save changes" : "Create rule"}</Button>
          {editingId && <Button onClick={() => { setEditingId(""); setForm({ ...EMPTY_FORM, categoryId: String(categories[0]?.category_id || "") }); }}>Cancel</Button>}
        </Box>
      </Card>
      {loading ? <Typography>Loading promotions…</Typography> : promotions.map((rule) => (
        <Card key={rule.happy_hour_rule_id} variant="outlined" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 2 }}>
          <Box>
            <Typography fontWeight={800}>{rule.name} · {Number(rule.discount_percent)}% off {rule.category?.category_name || "category"}</Typography>
            <Typography color="text.secondary">{rule.days_of_week.map((day) => WEEKDAYS.find((entry) => entry[1] === Number(day))?.[0]).filter(Boolean).join(", ")} · {String(rule.start_time).slice(0, 5)}–{String(rule.end_time).slice(0, 5)} · {rule.is_active ? "Active" : "Paused"}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Button onClick={() => edit(rule)}>Edit</Button>
            <Button color="error" aria-label={`Delete ${rule.name}`} onClick={() => remove(rule)}><DeleteOutlineRoundedIcon /></Button>
          </Box>
        </Card>
      ))}
    </Box>
  );
}
