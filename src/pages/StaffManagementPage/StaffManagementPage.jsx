import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import FormLabel from "@mui/material/FormLabel";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WalletOutlinedIcon from "@mui/icons-material/WalletOutlined";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import { getBillingReport } from "../../services/billingReport";
import { listFinancialExpenses } from "../../services/financialExpenses";
import { summarizeProfitLoss } from "../../services/profitLossSummary";
import { getStaffManagementData, saveStaffManagementData, STAFF_ROLES } from "../../services/staffManagement";
import "./StaffManagementPage.css";

const CURRENCY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_DRAFT = { name: "", email: "", phone: "", roles: [], status: "Active", sharePercent: "0" };

function walletBalance(transactions, staffId) {
  return transactions
    .filter((transaction) => transaction.staffId === staffId)
    .reduce((balance, transaction) => balance + Number(transaction.amount), 0);
}

function StatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <Card className={`staff-stat is-${tone}`} elevation={0}>
      <Box className="staff-stat__icon"><Icon /></Box>
      <Box><Typography>{label}</Typography><strong>{value}</strong><span>{detail}</span></Box>
    </Card>
  );
}

function StaffDialog({ open, draft, setDraft, error, editing, onClose, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit staff profile" : "Onboard a team member"}</DialogTitle>
      <DialogContent className="staff-dialog__content">
        <TextField autoFocus required label="Full name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Box className="staff-dialog__two-col">
          <TextField required label="Phone number" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} slotProps={{ htmlInput: { maxLength: 30 } }} />
          <TextField label="Email address" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} slotProps={{ htmlInput: { maxLength: 150 } }} />
        </Box>
        <FormControl required component="fieldset">
          <FormLabel component="legend">Roles</FormLabel>
          <FormGroup className="staff-dialog__roles">
            {STAFF_ROLES.map((role) => (
              <FormControlLabel
                key={role}
                label={role}
                control={<Checkbox
                  checked={draft.roles.includes(role)}
                  onChange={(event) => setDraft({
                    ...draft,
                    roles: event.target.checked
                      ? [...draft.roles, role]
                      : draft.roles.filter((item) => item !== role),
                  })}
                />}
              />
            ))}
          </FormGroup>
        </FormControl>
        <Box className="staff-dialog__two-col">
          <FormControl>
            <InputLabel id="staff-status-label">Status</InputLabel>
            <Select labelId="staff-status-label" label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              {["Active", "Invited", "Inactive"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField required type="number" label="Daily profit share (%)" value={draft.sharePercent} onChange={(event) => setDraft({ ...draft, sharePercent: event.target.value })} slotProps={{ htmlInput: { min: 0, max: 100, step: "0.1" } }} />
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography className="staff-dialog__note">Roles are labels for this local demo and do not enforce permissions. Profit-share percentages must total 100% or less across active staff.</Typography>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave}>{editing ? "Save changes" : "Add team member"}</Button></DialogActions>
    </Dialog>
  );
}

function WalletDialog({ staff, balance, draft, setDraft, error, onClose, onSave }) {
  return (
    <Dialog open={Boolean(staff)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Wallet adjustment</DialogTitle>
      <DialogContent className="staff-dialog__content">
        <Typography className="staff-dialog__note">{staff?.name} · Current balance {CURRENCY.format(balance)}. This records a demo ledger entry only; it does not transfer money.</Typography>
        <FormControl>
          <InputLabel id="wallet-action-label">Transaction</InputLabel>
          <Select labelId="wallet-action-label" label="Transaction" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
            <MenuItem value="credit">Add wallet credit</MenuItem>
            <MenuItem value="debit">Record withdrawal</MenuItem>
          </Select>
        </FormControl>
        <TextField autoFocus required type="number" label="Amount (₹)" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} slotProps={{ htmlInput: { min: 0.01, step: "0.01" } }} />
        <TextField required label="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave}>Save ledger entry</Button></DialogActions>
    </Dialog>
  );
}

export default function StaffManagementPage() {
  const [data, setData] = useState({ staff: [], transactions: [] });
  const [dailyProfit, setDailyProfit] = useState(0);
  const [profitDate, setProfitDate] = useState(today());
  const [profitReady, setProfitReady] = useState(false);
  const [profitReloadKey, setProfitReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareError, setShareError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("team");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [staffDraft, setStaffDraft] = useState(EMPTY_DRAFT);
  const [staffFormError, setStaffFormError] = useState("");
  const [walletStaff, setWalletStaff] = useState(null);
  const [walletDraft, setWalletDraft] = useState({ type: "credit", amount: "", description: "" });
  const [walletError, setWalletError] = useState("");
  const [staffToRemove, setStaffToRemove] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(getStaffManagementData)
      .then((saved) => { if (active) setData(saved); })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load staff."); })
      .finally(() => { if (active) setLoading(false); });
    setShareError("");
    setProfitReady(false);
    Promise.all([getBillingReport("daily"), Promise.resolve().then(listFinancialExpenses)])
      .then(([report, expenses]) => {
        if (!active) return;
        const summary = summarizeProfitLoss(report, expenses);
        setDailyProfit(summary.netProfit);
        setProfitDate(String(report.to || today()).slice(0, 10));
        setProfitReady(true);
      })
      .catch((loadError) => {
        if (active) setShareError(loadError.message || "Unable to load today's profit for share calculations.");
      });
    return () => { active = false; };
  }, [profitReloadKey]);

  const activeStaff = data.staff.filter((member) => member.status === "Active");
  const totalSharePercent = activeStaff.reduce((total, member) => total + Number(member.sharePercent), 0);
  const projectedShare = Math.max(0, dailyProfit) * totalSharePercent / 100;
  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.staff.filter((member) => (
      (statusFilter === "All" || member.status === statusFilter) &&
      (!query || `${member.name} ${member.email} ${member.phone} ${member.roles.join(" ")}`.toLowerCase().includes(query))
    ));
  }, [data.staff, search, statusFilter]);
  const transactionHistory = useMemo(
    () => [...data.transactions].sort((a, b) => `${b.date}-${b.id}`.localeCompare(`${a.date}-${a.id}`)),
    [data.transactions]
  );
  const todayDistributed = data.transactions.some((transaction) => transaction.type === "profit_share" && transaction.date === profitDate);

  function persist(nextData, successMessage) {
    try {
      saveStaffManagementData(nextData);
      setData(nextData);
      setError("");
      setNotice(successMessage);
      return true;
    } catch (saveError) {
      setError(saveError.message || "Unable to save staff data.");
      return false;
    }
  }

  function openStaffDialog(member = null) {
    setEditingId(member?.id || "");
    setStaffFormError("");
    setStaffDraft(member
      ? { name: member.name, email: member.email, phone: member.phone, roles: member.roles, status: member.status, sharePercent: String(member.sharePercent) }
      : { ...EMPTY_DRAFT });
    setStaffDialogOpen(true);
  }

  function saveStaff() {
    const name = staffDraft.name.trim();
    const phone = staffDraft.phone.trim();
    const email = staffDraft.email.trim();
    const sharePercent = Number(staffDraft.sharePercent);
    if (!name || !phone || !staffDraft.roles.length || !Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      setStaffFormError("Enter a name, phone, at least one role, and a share percentage between 0 and 100.");
      return;
    }
    const member = {
      id: editingId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name, phone, email, roles: staffDraft.roles, status: staffDraft.status, sharePercent,
      joinedAt: editingId ? data.staff.find((entry) => entry.id === editingId)?.joinedAt : today(),
    };
    const nextStaff = editingId
      ? data.staff.map((entry) => entry.id === editingId ? member : entry)
      : [...data.staff, member];
    const shareTotal = nextStaff.filter((entry) => entry.status === "Active").reduce((sum, entry) => sum + Number(entry.sharePercent), 0);
    if (shareTotal > 100.000001) {
      setStaffFormError(`Active staff profit shares total ${shareTotal.toFixed(1)}%. The total must not exceed 100%.`);
      return;
    }
    if (persist({ ...data, staff: nextStaff }, editingId ? "Staff profile updated." : "Team member added.")) setStaffDialogOpen(false);
  }

  function changeStatus(member, status) {
    const nextStaff = data.staff.map((entry) => entry.id === member.id ? { ...entry, status } : entry);
    const shareTotal = nextStaff.filter((entry) => entry.status === "Active").reduce((sum, entry) => sum + Number(entry.sharePercent), 0);
    if (shareTotal > 100.000001) {
      setError(`Cannot activate this staff member: active profit shares would total ${shareTotal.toFixed(1)}%.`);
      return;
    }
    persist({ ...data, staff: nextStaff }, `${member.name} marked ${status.toLowerCase()}.`);
  }

  function distributeShares() {
    if (dailyProfit <= 0) {
      setShareError("Daily profit must be positive before shares can be distributed.");
      return;
    }
    if (!activeStaff.length || totalSharePercent <= 0) {
      setShareError("Add active staff and assign a profit-share percentage before distributing.");
      return;
    }
    if (totalSharePercent > 100.000001) {
      setShareError("Active staff profit shares exceed 100%. Adjust the percentages first.");
      return;
    }
    if (todayDistributed) {
      setShareError(`Profit shares for ${profitDate} have already been recorded.`);
      return;
    }
    const credits = activeStaff
      .filter((member) => Number(member.sharePercent) > 0)
      .map((member) => ({
        id: `share-${profitDate}-${member.id}`,
        staffId: member.id,
        date: profitDate,
        type: "profit_share",
        amount: Math.round(dailyProfit * Number(member.sharePercent)) / 100,
        description: `Daily profit share · ${member.sharePercent}% of ${CURRENCY.format(dailyProfit)}`,
      }));
    if (persist({ ...data, transactions: [...data.transactions, ...credits] }, `Daily profit shares recorded for ${credits.length} team members.`)) setShareError("");
  }

  function openWallet(member) {
    setWalletStaff(member);
    setWalletDraft({ type: "credit", amount: "", description: "" });
    setWalletError("");
  }

  function saveWalletEntry() {
    const value = Number(walletDraft.amount);
    const description = walletDraft.description.trim();
    const balance = walletBalance(data.transactions, walletStaff.id);
    if (!Number.isFinite(value) || value <= 0 || !description) {
      setWalletError("Enter a valid amount greater than zero and a description.");
      return;
    }
    if (walletDraft.type === "debit" && value > balance) {
      setWalletError("A withdrawal cannot exceed the current wallet balance.");
      return;
    }
    const transaction = {
      id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      staffId: walletStaff.id,
      date: today(),
      type: walletDraft.type,
      amount: walletDraft.type === "credit" ? value : -value,
      description,
    };
    if (persist({ ...data, transactions: [...data.transactions, transaction] }, "Wallet ledger entry recorded.")) setWalletStaff(null);
  }

  function removeStaff(member) {
    if (walletBalance(data.transactions, member.id) !== 0) {
      changeStatus(member, "Inactive");
      setNotice(`${member.name} has a wallet balance, so the profile was deactivated instead of removed.`);
      return;
    }
    const nextStaff = data.staff.filter((entry) => entry.id !== member.id);
    if (persist({ ...data, staff: nextStaff }, "Team member removed. Existing wallet transactions remain in the ledger.")) setNotice(`${member.name} removed. Existing wallet transactions remain in the ledger.`);
  }

  const totalWalletLiability = data.staff.reduce((sum, member) => sum + walletBalance(data.transactions, member.id), 0);

  return (
    <Box className="staff-page app-content-width">
      <Box className="staff-page__heading">
        <Box><Typography className="staff-page__eyebrow">PEOPLE / TEAM OPERATIONS</Typography><Typography component="h1">Staff management</Typography><Typography>Onboard your team, manage roles, and track daily profit shares.</Typography></Box>
        <Button variant="contained" startIcon={<PersonAddAlt1RoundedIcon />} onClick={() => openStaffDialog()}>Add team member</Button>
      </Box>
      <Alert severity="info" className="staff-page__demo-note">Local demo: staff records and wallet entries are stored in this browser. Wallet actions record a ledger only—no money is transferred. Roles are labels and do not enforce account access.</Alert>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <Box className="staff-page__stats">
        <StatCard icon={GroupsOutlinedIcon} label="Team members" value={data.staff.length} detail={`${activeStaff.length} active`} tone="people" />
        <StatCard icon={TrendingUpRoundedIcon} label="Today's estimated profit" value={CURRENCY.format(dailyProfit)} detail={profitDate} tone="profit" />
        <StatCard icon={PaymentsOutlinedIcon} label="Today's share allocation" value={CURRENCY.format(projectedShare)} detail={`${totalSharePercent.toFixed(1)}% of positive profit`} tone="share" />
        <StatCard icon={WalletOutlinedIcon} label="Team wallet balance" value={CURRENCY.format(totalWalletLiability)} detail="Ledger balance · local demo" tone="wallet" />
      </Box>

      <Card className="staff-page__workspace" elevation={0}>
        <Box className="staff-page__workspace-header">
          <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Staff management sections">
            <Tab value="team" label="Team roster" />
            <Tab value="shares" label="Daily profit share" />
            <Tab value="wallets" label="Wallets & ledger" />
          </Tabs>
          {tab === "team" && <Box className="staff-page__filters">
            <TextField size="small" label="Search team" value={search} onChange={(event) => setSearch(event.target.value)} />
            <FormControl size="small"><InputLabel id="staff-status-filter-label">Status</InputLabel><Select labelId="staff-status-filter-label" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{["All", "Active", "Invited", "Inactive"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select></FormControl>
          </Box>}
        </Box>

        {loading ? <Box className="staff-page__loading"><CircularProgress size={26} /><Typography>Loading team data…</Typography></Box> : (
          <>
            {tab === "team" && (
              data.staff.length ? (
                filteredStaff.length ? (
                <Box className="staff-table-wrap"><Box className="staff-table">
                  <Box className="staff-table__head"><span>TEAM MEMBER</span><span>ROLES</span><span>STATUS</span><span>PROFIT SHARE</span><span>WALLET</span><span>ACTIONS</span></Box>
                  {filteredStaff.map((member) => (
                    <Box className="staff-table__row" key={member.id}>
                      <Box className="staff-table__person"><Avatar>{member.name.charAt(0).toUpperCase()}</Avatar><Box><strong>{member.name}</strong><span>{member.phone}{member.email ? ` · ${member.email}` : ""}</span></Box></Box>
                      <Box className="staff-table__roles">{member.roles.map((role) => <Chip key={role} size="small" label={role} />)}</Box>
                      <Chip size="small" label={member.status} className={`staff-status is-${member.status.toLowerCase()}`} />
                      <strong>{Number(member.sharePercent).toFixed(1)}%</strong>
                      <strong>{CURRENCY.format(walletBalance(data.transactions, member.id))}</strong>
                      <Box className="staff-table__actions"><Button size="small" onClick={() => openStaffDialog(member)}>Edit</Button><Button size="small" onClick={() => openWallet(member)}>Wallet</Button>{member.status === "Active" ? <Button size="small" color="warning" onClick={() => changeStatus(member, "Inactive")}>Deactivate</Button> : <Button size="small" onClick={() => changeStatus(member, "Active")}>Activate</Button>}<Button size="small" color="error" onClick={() => setStaffToRemove(member)}>Remove</Button></Box>
                    </Box>
                  ))}
                </Box></Box>
                ) : <Box className="staff-page__empty"><Typography>No team members match these filters.</Typography><Button onClick={() => { setSearch(""); setStatusFilter("All"); }}>Clear filters</Button></Box>
              ) : <Box className="staff-page__empty"><Avatar><GroupsOutlinedIcon /></Avatar><Typography component="h2">Build your restaurant team</Typography><Typography>Add staff, assign one or more roles, and set each person&apos;s daily profit-share percentage.</Typography><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openStaffDialog()}>Onboard first team member</Button></Box>
            )}

            {tab === "shares" && (
              <Box className="staff-share">
                {shareError && <Alert severity="error" onClose={() => setShareError("")}>{shareError}</Alert>}
                <Box className="staff-share__summary">
                  <Box><Typography>DAILY NET PROFIT · {profitDate}</Typography><strong>{profitReady ? CURRENCY.format(dailyProfit) : "—"}</strong><span>Uses the Profit &amp; Loss estimate from recorded sales, purchases, and browser expense entries.</span></Box>
                  <Box><Typography>ALLOCATED SHARE</Typography><strong>{CURRENCY.format(projectedShare)}</strong><span>{totalSharePercent.toFixed(1)}% of positive daily profit</span></Box>
                  <Box className="staff-share__date"><Typography>REPORT DATE</Typography><strong>{profitDate}</strong><Button size="small" onClick={() => setProfitReloadKey((key) => key + 1)}>Refresh daily report</Button></Box>
                </Box>
                {shareError && <Alert severity="error">{shareError}</Alert>}
                <Alert severity="warning">Profit share is calculated as daily net profit × each active staff member&apos;s percentage. Total allocation is limited to 100%. Shares are credited to local demo wallets, not paid out.</Alert>
                {activeStaff.length ? <Box className="staff-share__table">
                  <Box className="staff-share__head"><span>TEAM MEMBER</span><span>ROLES</span><span>SHARE</span><span>ESTIMATED CREDIT</span><span>WALLET</span></Box>
                  {activeStaff.map((member) => <Box className="staff-share__row" key={member.id}><Box className="staff-share__person"><Avatar>{member.name.charAt(0).toUpperCase()}</Avatar><strong>{member.name}</strong></Box><span>{member.roles.join(", ")}</span><strong>{Number(member.sharePercent).toFixed(1)}%</strong><strong>{CURRENCY.format(Math.max(0, dailyProfit) * Number(member.sharePercent) / 100)}</strong><span>{CURRENCY.format(walletBalance(data.transactions, member.id))}</span></Box>)}
                  <Box className="staff-share__footer"><strong>Total allocation</strong><strong>{totalSharePercent.toFixed(1)}%</strong><strong>{CURRENCY.format(projectedShare)}</strong><span>{100 - totalSharePercent >= 0 ? `${(100 - totalSharePercent).toFixed(1)}% unallocated` : "Over limit"}</span></Box>
                </Box> : <Box className="staff-page__empty"><Typography>Add active staff and configure profit shares to see a distribution preview.</Typography><Button variant="outlined" onClick={() => { setTab("team"); openStaffDialog(); }}>Add team member</Button></Box>}
                <Box className="staff-share__actions"><Typography>{todayDistributed ? `Shares for ${profitDate} have already been credited.` : "Distribution can be recorded once per day; review staff percentages before confirming."}</Typography><Button variant="contained" disabled={!profitReady || todayDistributed || dailyProfit <= 0 || !activeStaff.length || totalSharePercent <= 0 || totalSharePercent > 100.000001} onClick={distributeShares}>Distribute daily shares</Button></Box>
              </Box>
            )}

            {tab === "wallets" && (
              <Box className="staff-wallets">
                <Alert severity="info">Wallets are an internal demo ledger. Credits, withdrawals, and profit shares do not trigger bank, UPI, or payroll payments.</Alert>
                {data.staff.length ? <Box className="staff-wallets__grid">{data.staff.map((member) => (
                  <Card className="staff-wallet-card" key={member.id} elevation={0}>
                    <Box className="staff-wallet-card__person"><Avatar>{member.name.charAt(0).toUpperCase()}</Avatar><Box><strong>{member.name}</strong><span>{member.roles.join(" · ")}</span></Box></Box>
                    <Typography>Wallet balance</Typography><strong className="staff-wallet-card__balance">{CURRENCY.format(walletBalance(data.transactions, member.id))}</strong>
                    <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => openWallet(member)}>Record wallet entry</Button>
                  </Card>
                ))}</Box> : <Box className="staff-page__empty"><Typography>Onboard a staff member to create a wallet ledger.</Typography><Button onClick={() => openStaffDialog()}>Add team member</Button></Box>}
                <Box className="staff-ledger"><Typography component="h2">Recent wallet activity</Typography>{transactionHistory.length ? transactionHistory.slice(0, 20).map((transaction) => {
                  const member = data.staff.find((entry) => entry.id === transaction.staffId);
                  return <Box className="staff-ledger__row" key={transaction.id}><Box><strong>{member?.name || "Former team member"}</strong><span>{transaction.description} · {transaction.date}</span></Box><strong className={transaction.amount >= 0 ? "is-credit" : "is-debit"}>{transaction.amount >= 0 ? "+" : "−"}{CURRENCY.format(Math.abs(transaction.amount))}</strong></Box>;
                }) : <Typography className="staff-ledger__empty">No wallet transactions yet. Profit-share distribution and manual entries appear here.</Typography>}</Box>
              </Box>
            )}
          </>
        )}
      </Card>

      <StaffDialog open={staffDialogOpen} draft={staffDraft} setDraft={setStaffDraft} error={staffFormError} editing={Boolean(editingId)} onClose={() => setStaffDialogOpen(false)} onSave={saveStaff} />
      <WalletDialog staff={walletStaff} balance={walletStaff ? walletBalance(data.transactions, walletStaff.id) : 0} draft={walletDraft} setDraft={setWalletDraft} error={walletError} onClose={() => setWalletStaff(null)} onSave={saveWalletEntry} />
      <ConfirmationDialog
        open={Boolean(staffToRemove)}
        title={staffToRemove && walletBalance(data.transactions, staffToRemove.id) !== 0 ? "Deactivate team member?" : "Remove team member?"}
        message={<Typography>{staffToRemove && walletBalance(data.transactions, staffToRemove.id) !== 0
          ? `${staffToRemove.name} has a wallet balance, so their profile will be deactivated instead of removed.`
          : `Remove ${staffToRemove?.name} from the team? Existing wallet transactions will remain in the ledger.`}</Typography>}
        confirmLabel={staffToRemove && walletBalance(data.transactions, staffToRemove.id) !== 0 ? "Deactivate member" : "Remove member"}
        destructive
        icon={<PersonRemoveRoundedIcon />}
        onCancel={() => setStaffToRemove(null)}
        onConfirm={() => {
          if (!staffToRemove) return;
          removeStaff(staffToRemove);
          setStaffToRemove(null);
        }}
      />
    </Box>
  );
}
