import { useMemo, useState } from "react";
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
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import { getCustomers, saveCustomers } from "../../services/customerManagement";
import "./CustomerManagementPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_DRAFT = { name: "", phone: "", email: "", birthday: "", notes: "" };

function displayDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return <Card className={`customer-stat is-${tone}`} elevation={0}><Box className="customer-stat__icon"><Icon /></Box><Box><Typography>{label}</Typography><strong>{value}</strong><span>{detail}</span></Box></Card>;
}

function CustomerDialog({ open, draft, setDraft, error, editing, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit customer profile" : "Add customer"}</DialogTitle>
      <DialogContent className="customer-dialog__content">
        <TextField autoFocus required label="Full name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Box className="customer-dialog__two-col">
          <TextField required label="Phone number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} slotProps={{ htmlInput: { maxLength: 30 } }} />
          <TextField label="Email address" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} slotProps={{ htmlInput: { maxLength: 150 } }} />
        </Box>
        <TextField label="Birthday (optional)" type="date" value={draft.birthday} onChange={(event) => setDraft({ ...draft, birthday: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Preferences and notes" multiline minRows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
        {error && <Alert severity="error">{error}</Alert>}
        <Typography className="customer-dialog__note">Customer records are stored in this browser only. Ask permission before recording personal details.</Typography>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave}>{editing ? "Save changes" : "Add customer"}</Button></DialogActions>
    </Dialog>
  );
}

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState(() => {
    try { return getCustomers(); } catch { return []; }
  });
  const [loadError, setLoadError] = useState(() => {
    try { getCustomers(); return ""; } catch (error) { return error.message || "Unable to load customer records."; }
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("All customers");
  const [selectedId, setSelectedId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [visitCustomer, setVisitCustomer] = useState(null);
  const [visitDraft, setVisitDraft] = useState({ amount: "", note: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const selectedCustomer = customers.find((customer) => customer.id === selectedId) || null;
  const totalVisits = customers.reduce((sum, customer) => sum + Number(customer.visits), 0);
  const totalSpend = customers.reduce((sum, customer) => sum + Number(customer.spend), 0);
  const activeWithinThirtyDays = customers.filter((customer) => {
    if (!customer.lastVisit) return false;
    const ageDays = (Date.now() - new Date(`${customer.lastVisit}T12:00:00.000Z`).getTime()) / 86400000;
    return ageDays >= 0 && ageDays <= 30;
  }).length;
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (segment === "Returning" && Number(customer.visits) < 2) return false;
      if (segment === "New" && Number(customer.visits) > 1) return false;
      return !query || `${customer.name} ${customer.email} ${customer.phone} ${customer.notes}`.toLowerCase().includes(query);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search, segment]);

  function persist(nextCustomers, message) {
    try {
      saveCustomers(nextCustomers);
      setCustomers(nextCustomers);
      setError("");
      setLoadError("");
      setNotice(message);
      return true;
    } catch (saveError) {
      setError(saveError.message || "Unable to save customer records.");
      return false;
    }
  }

  function openDialog(customer = null) {
    setEditingId(customer?.id || "");
    setFormError("");
    setDraft(customer
      ? { name: customer.name, phone: customer.phone, email: customer.email, birthday: customer.birthday || "", notes: customer.notes || "" }
      : { ...EMPTY_DRAFT });
    setDialogOpen(true);
  }

  function saveCustomer() {
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const email = draft.email.trim();
    if (!name || !phone || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setFormError("Enter a customer name and phone number. Check the email address format.");
      return;
    }
    const existing = customers.find((customer) => customer.id === editingId);
    const customer = {
      id: editingId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name, phone, email, birthday: draft.birthday, notes: draft.notes.trim(),
      visits: existing?.visits || 0,
      spend: existing?.spend || 0,
      joinedAt: existing?.joinedAt || today(),
      lastVisit: existing?.lastVisit || "",
      visitHistory: existing?.visitHistory || [],
    };
    const duplicatePhone = customers.some((entry) => entry.phone === phone && entry.id !== editingId);
    if (duplicatePhone) {
      setFormError("A customer with this phone number already exists.");
      return;
    }
    const nextCustomers = editingId
      ? customers.map((entry) => entry.id === editingId ? customer : entry)
      : [...customers, customer];
    if (persist(nextCustomers, editingId ? "Customer profile updated." : "Customer added.")) {
      setSelectedId(customer.id);
      setDialogOpen(false);
    }
  }

  function recordVisit() {
    const visitAmount = Number(visitDraft.amount);
    if (!Number.isFinite(visitAmount) || visitAmount < 0) {
      setError("Enter a valid visit amount of zero or more.");
      return;
    }
    const visit = { date: today(), amount: visitAmount, note: visitDraft.note.trim() };
    const nextCustomers = customers.map((customer) => customer.id === visitCustomer.id ? {
      ...customer,
      visits: Number(customer.visits) + 1,
      spend: Number(customer.spend) + visitAmount,
      lastVisit: visit.date,
      visitHistory: [...(customer.visitHistory || []), visit],
    } : customer);
    if (persist(nextCustomers, "Customer visit recorded.")) setVisitCustomer(null);
  }

  function deleteCustomer() {
    const nextCustomers = customers.filter((customer) => customer.id !== confirmDelete.id);
    if (persist(nextCustomers, "Customer record deleted.")) {
      if (selectedId === confirmDelete.id) setSelectedId("");
      setConfirmDelete(null);
    }
  }

  function retryLoad() {
    try {
      setCustomers(getCustomers());
      setLoadError("");
    } catch (loadFailure) {
      setLoadError(loadFailure.message || "Unable to load customer records.");
    }
  }

  return (
    <Box className="customer-page app-content-width">
      <Box className="customer-page__heading">
        <Box><Typography className="customer-page__eyebrow">PEOPLE / GUEST EXPERIENCE</Typography><Typography component="h1">Customer management</Typography><Typography>Keep guest details, preferences, visits, and lifetime spend in one place.</Typography></Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openDialog()}>Add customer</Button>
      </Box>
      <Alert severity="info" className="customer-page__demo-note">Local demo: customer records stay in this browser and are not synced to your POS or other devices. Store personal information only with the customer&apos;s permission.</Alert>
      {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={retryLoad}>Retry</Button>}>{loadError}</Alert>}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Box className="customer-page__stats">
        <StatCard icon={GroupsOutlinedIcon} label="Customers" value={customers.length} detail="Customer profiles" tone="people" />
        <StatCard icon={ReceiptLongOutlinedIcon} label="Visits recorded" value={totalVisits} detail="Across all profiles" tone="visits" />
        <StatCard icon={StarOutlineRoundedIcon} label="Lifetime spend" value={CURRENCY.format(totalSpend)} detail="Recorded visits only" tone="spend" />
        <StatCard icon={PersonSearchOutlinedIcon} label="Recent guests" value={activeWithinThirtyDays} detail="Visited in the last 30 days" tone="recent" />
      </Box>

      <Box className={`customer-workspace${selectedCustomer ? " has-profile" : ""}`}>
        <Card className="customer-directory" elevation={0}>
          <Box className="customer-directory__heading"><Box><Typography component="h2">Guest directory</Typography><Typography>{filteredCustomers.length} of {customers.length} customers</Typography></Box></Box>
          <TextField fullWidth size="small" placeholder="Search name, phone, email…" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ input: { startAdornment: <SearchRoundedIcon fontSize="small" /> } }} />
          <FormControl size="small" fullWidth><InputLabel id="customer-segment-label">Customer segment</InputLabel><Select labelId="customer-segment-label" label="Customer segment" value={segment} onChange={(event) => setSegment(event.target.value)}>{["All customers", "New", "Returning"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <Box className="customer-directory__list">
            {filteredCustomers.length ? filteredCustomers.map((customer) => (
              <Button key={customer.id} className={`customer-directory__item${selectedId === customer.id ? " is-selected" : ""}`} onClick={() => setSelectedId(customer.id)}>
                <Avatar>{customer.name.charAt(0).toUpperCase()}</Avatar>
                <Box><strong>{customer.name}</strong><span>{customer.phone}</span></Box>
                <Chip size="small" label={customer.visits > 1 ? "Returning" : "New"} />
              </Button>
            )) : <Box className="customer-directory__empty"><PersonSearchOutlinedIcon /><Typography>{customers.length ? "No customers match your search." : "Your guest list starts here."}</Typography>{!customers.length && <Button onClick={() => openDialog()}>Add first customer</Button>}</Box>}
          </Box>
        </Card>

        <Card className="customer-profile" elevation={0}>
          {selectedCustomer ? (
            <>
              <Box className="customer-profile__header">
                <Avatar>{selectedCustomer.name.charAt(0).toUpperCase()}</Avatar>
                <Box><Typography component="h2">{selectedCustomer.name}</Typography><Typography>Customer since {displayDate(selectedCustomer.joinedAt)}</Typography></Box>
                <Box className="customer-profile__actions"><Button startIcon={<EditOutlinedIcon />} onClick={() => openDialog(selectedCustomer)}>Edit</Button><Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setConfirmDelete(selectedCustomer)}>Delete</Button></Box>
              </Box>
              <Box className="customer-profile__contact">
                <Box><span>PHONE</span><a href={`tel:${selectedCustomer.phone}`}>{selectedCustomer.phone}</a></Box>
                <Box><span>EMAIL</span>{selectedCustomer.email ? <a href={`mailto:${selectedCustomer.email}`}>{selectedCustomer.email}</a> : <strong>Not provided</strong>}</Box>
                <Box><span>BIRTHDAY</span><strong>{selectedCustomer.birthday ? displayDate(selectedCustomer.birthday) : "Not provided"}</strong></Box>
              </Box>
              <Box className="customer-profile__stats">
                <Box><Typography>Visits</Typography><strong>{selectedCustomer.visits}</strong></Box>
                <Box><Typography>Lifetime spend</Typography><strong>{CURRENCY.format(selectedCustomer.spend)}</strong></Box>
                <Box><Typography>Average visit</Typography><strong>{selectedCustomer.visits ? CURRENCY.format(selectedCustomer.spend / selectedCustomer.visits) : CURRENCY.format(0)}</strong></Box>
              </Box>
              <Box className="customer-profile__section">
                <Box className="customer-profile__section-heading"><Typography component="h3">Preferences &amp; notes</Typography><CakeOutlinedIcon /></Box>
                <Typography>{selectedCustomer.notes || "No preferences or notes recorded."}</Typography>
              </Box>
              <Box className="customer-profile__section customer-profile__visits">
                <Box className="customer-profile__section-heading"><Typography component="h3">Visit history</Typography><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setVisitCustomer(selectedCustomer); setVisitDraft({ amount: "", note: "" }); }}>Record visit</Button></Box>
                {(selectedCustomer.visitHistory || []).length ? [...selectedCustomer.visitHistory].reverse().map((visit, index) => <Box className="customer-visit" key={`${visit.date}-${index}`}><Box><strong>{displayDate(visit.date)}</strong><span>{visit.note || "Visit recorded"}</span></Box><strong>{CURRENCY.format(visit.amount)}</strong></Box>) : <Typography className="customer-profile__empty-history">No visits recorded yet. Use Record visit to update this customer&apos;s activity and lifetime spend.</Typography>}
              </Box>
            </>
          ) : (
            <Box className="customer-profile__empty"><Avatar><PersonSearchOutlinedIcon /></Avatar><Typography component="h2">Customer profile</Typography><Typography>Select a guest from the directory, or add a new customer to capture their contact details and preferences.</Typography>{!customers.length && <Button variant="outlined" onClick={() => openDialog()}>Add customer</Button>}</Box>
          )}
        </Card>
      </Box>

      <CustomerDialog open={dialogOpen} draft={draft} setDraft={setDraft} error={formError} editing={Boolean(editingId)} onClose={() => setDialogOpen(false)} onSave={saveCustomer} />
      <Dialog open={Boolean(visitCustomer)} onClose={() => setVisitCustomer(null)} fullWidth maxWidth="xs">
        <DialogTitle>Record customer visit</DialogTitle>
        <DialogContent className="customer-dialog__content">
          <Typography className="customer-dialog__note">Add a visit for {visitCustomer?.name}. This updates their visit count and lifetime spend.</Typography>
          <TextField autoFocus required type="number" label="Visit spend (₹)" value={visitDraft.amount} onChange={(event) => setVisitDraft({ ...visitDraft, amount: event.target.value })} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          <TextField label="Visit note (optional)" value={visitDraft.note} onChange={(event) => setVisitDraft({ ...visitDraft, note: event.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} />
        </DialogContent>
        <DialogActions><Button onClick={() => setVisitCustomer(null)}>Cancel</Button><Button variant="contained" onClick={recordVisit}>Save visit</Button></DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(confirmDelete)}
        title="Delete customer record?"
        message={<Typography>Delete {confirmDelete?.name} and their local visit history?</Typography>}
        confirmLabel="Delete customer"
        destructive
        icon={<DeleteOutlineRoundedIcon />}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={deleteCustomer}
      />
    </Box>
  );
}
