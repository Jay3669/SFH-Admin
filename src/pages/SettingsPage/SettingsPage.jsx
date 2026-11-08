import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Chip,
  InputAdornment,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { DEFAULT_POS_SETTINGS, getPosSettings, loadPosSettings, updatePosSettings } from "../../services/posSettings";
import TeamPermissionsPanel from "./TeamPermissionsPanel";
import "./SettingsPage.css";

const PAYMENT_OPTIONS = [
  { key: "cash", label: "Cash", detail: "Cash tender and change calculation" },
  { key: "card", label: "Card", detail: "Card payment at the counter" },
  { key: "upi", label: "UPI", detail: "UPI payment at the counter" },
  { key: "split", label: "Split payments", detail: "Accept a combination of enabled methods" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(getPosSettings);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("charges");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadPosSettings()
      .then((loadedSettings) => {
        if (!active) return;
        setSettings(loadedSettings);
        setDirty(false);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load POS settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setDirty(true);
  }

  function updatePaymentMethod(key, value) {
    setSettings((current) => ({ ...current, paymentMethods: { ...current.paymentMethods, [key]: value } }));
    setSaved(false);
    setDirty(true);
  }

  async function saveSettings(event) {
    event?.preventDefault();
    setError("");
    setSaving(true);
    try {
      const savedSettings = await updatePosSettings(settings);
      setSettings(savedSettings);
      setSaved(true);
      setDirty(false);
    } catch (saveError) {
      setError(saveError.message || "Unable to save POS settings.");
    } finally {
      setSaving(false);
    }
  }

  function resetSettings() {
    setSettings({ ...DEFAULT_POS_SETTINGS, paymentMethods: { ...DEFAULT_POS_SETTINGS.paymentMethods } });
    setSaved(false);
    setDirty(true);
  }

  const enabledPaymentCount = ["cash", "card", "upi"].filter((method) => settings.paymentMethods[method]).length;
  const previewSubtotal = 500;
  const previewDiscount = 25;
  const previewTaxable = previewSubtotal - previewDiscount;
  const previewTax = settings.taxEnabled ? previewTaxable * Math.max(0, Number(settings.taxRate) || 0) / 100 : 0;
  const previewTotal = previewTaxable + previewTax;

  function settingSwitch(label, checked, onChange) {
    return <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} slotProps={{ input: { "aria-label": label } }} />;
  }

  return (
    <Box className="settings-page">
      <Box className="settings-page__hero">
        <Box className="settings-page__hero-copy">
          <Typography className="settings-page__eyebrow">POINT OF SALE / CONFIGURATION</Typography>
          <Typography component="h1">Settings</Typography>
          <Typography>Set the rules that shape every checkout.</Typography>
        </Box>
        <Box className="settings-page__hero-status">
          <Chip icon={<CheckCircleRoundedIcon />} label={dirty ? "Unsaved changes" : "Saved to POS"} className={dirty ? "is-dirty" : "is-saved"} />
          <Box><strong>{enabledPaymentCount}</strong><span>active tender types</span></Box>
        </Box>
      </Box>

      {saved && <Alert severity="success" onClose={() => setSaved(false)}>Settings saved and applied to Billing &amp; POS.</Alert>}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {loading && <Alert severity="info">Loading saved POS settings…</Alert>}

      <Box className={`settings-page__layout${activeSection === "team" ? " is-team-section" : ""}`}>
        <Box component="nav" className="settings-nav" aria-label="Settings sections">
          <Typography className="settings-nav__label">CHECKOUT</Typography>
          <ButtonBase className={`settings-nav__item ${activeSection === "charges" ? "is-active" : ""}`} onClick={() => setActiveSection("charges")}>
            <ReceiptLongOutlinedIcon /><Box><strong>Charges</strong><span>Packaging and tax</span></Box>
          </ButtonBase>
          <ButtonBase className={`settings-nav__item ${activeSection === "payments" ? "is-active" : ""}`} onClick={() => setActiveSection("payments")}>
            <PaymentsOutlinedIcon /><Box><strong>Payments</strong><span>Methods and split tender</span></Box>
          </ButtonBase>
          <ButtonBase className={`settings-nav__item ${activeSection === "balance" ? "is-active" : ""}`} onClick={() => setActiveSection("balance")}>
            <Inventory2OutlinedIcon /><Box><strong>Balance rules</strong><span>Unpaid amounts</span></Box>
          </ButtonBase>
          <ButtonBase className={`settings-nav__item ${activeSection === "team" ? "is-active" : ""}`} onClick={() => setActiveSection("team")}>
            <GroupsOutlinedIcon /><Box><strong>Team &amp; permissions</strong><span>Pages and actions</span></Box>
          </ButtonBase>
          <Box className="settings-nav__footnote"><span>POS PROFILE</span><strong>Counter checkout</strong><Typography>Settings are shared with Billing &amp; POS.</Typography></Box>
        </Box>

        <Box
          component={activeSection === "team" ? "div" : "form"}
          id={activeSection === "team" ? undefined : "pos-settings-form"}
          onSubmit={activeSection === "team" ? undefined : saveSettings}
          className="settings-editor"
        >
          {activeSection === "charges" && <Box className="settings-section">
            <Box className="settings-section__heading"><Box><Typography className="settings-section__kicker">BILLING &amp; NUMBERING</Typography><Typography component="h2">Bill numbering</Typography><Typography>New bills use the prefix followed by the next number.</Typography></Box></Box>
            <Box className="settings-field-row">
              <TextField
                label="Bill number prefix"
                value={settings.billNumberPrefix}
                onChange={(event) => updateSetting("billNumberPrefix", event.target.value)}
                slotProps={{ htmlInput: { maxLength: 32 } }}
              />
              <TextField
                type="number"
                label="Next bill number"
                value={settings.nextBillNumber}
                onChange={(event) => updateSetting("nextBillNumber", event.target.value)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />
            </Box>
            <Typography className="settings-section__description">
              Next bill: {settings.billNumberPrefix}{settings.nextBillNumber}
            </Typography>
            <Box className="settings-section__heading"><Box><Typography className="settings-section__kicker">BILL TOTAL</Typography><Typography component="h2">Charges</Typography><Typography>Optional amounts are calculated automatically at checkout.</Typography></Box></Box>
            <Box className="settings-option">
              <Box className="settings-option__copy"><Typography component="h3">Packaging charge</Typography><Typography>Allow a cashier to enter a packaging amount for each Takeaway bill.</Typography></Box>
              <Box className="settings-option__control"><Typography>{settings.packagingEnabled ? "On" : "Off"}</Typography>{settingSwitch("Packaging charge enabled", settings.packagingEnabled, (value) => updateSetting("packagingEnabled", value))}</Box>
            </Box>
            <Box className="settings-option">
              <Box className="settings-option__copy"><Typography component="h3">Tax</Typography><Typography>Apply a percentage to the discounted subtotal plus packaging.</Typography></Box>
              <Box className="settings-option__control"><Typography>{settings.taxEnabled ? "On" : "Off"}</Typography>{settingSwitch("Tax enabled", settings.taxEnabled, (value) => updateSetting("taxEnabled", value))}</Box>
            </Box>
            {settings.taxEnabled && <Box className="settings-field-row"><TextField type="number" label="Tax rate" value={settings.taxRate} onChange={(event) => updateSetting("taxRate", event.target.value)} slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} /><Typography>Included in the final amount due.</Typography></Box>}
          </Box>}

          {activeSection === "payments" && <Box className="settings-section">
            <Box className="settings-section__heading"><Box><Typography className="settings-section__kicker">TENDER OPTIONS</Typography><Typography component="h2">Payments</Typography><Typography>Choose what the cashier can accept at checkout.</Typography></Box></Box>
            <Box className="settings-payment-list">
              {PAYMENT_OPTIONS.map((option) => (
                <Box className="settings-option" key={option.key}>
                  <Box className="settings-option__copy"><Typography component="h3">{option.label}</Typography><Typography>{option.detail}</Typography></Box>
                  <Box className="settings-option__control"><Typography>{settings.paymentMethods[option.key] ? "On" : "Off"}</Typography>{settingSwitch(`${option.label} enabled`, settings.paymentMethods[option.key], (value) => updatePaymentMethod(option.key, value))}</Box>
                </Box>
              ))}
            </Box>
            {!settings.paymentMethods.cash && !settings.paymentMethods.card && !settings.paymentMethods.upi && <Alert severity="warning">Enable Cash, Card, or UPI to accept payments. Split tender needs at least one enabled method.</Alert>}
          </Box>}

          {activeSection === "balance" && <Box className="settings-section settings-section--balance">
            <Box className="settings-section__heading"><Box><Typography className="settings-section__kicker">SETTLEMENT POLICY</Typography><Typography component="h2">Balance rules</Typography><Typography>Decide whether a bill may close before it is fully paid.</Typography></Box></Box>
            <Box className="settings-balance-intro"><Inventory2OutlinedIcon /><Box><Typography component="h3">Remaining balance</Typography><Typography>When enabled, Billing &amp; POS will print and show the outstanding amount on the receipt.</Typography></Box></Box>
            <Box className="settings-option settings-option--balance">
              <Box className="settings-option__copy"><Typography component="h3">Allow balance due</Typography><Typography>Permit a cashier to close a bill with an unpaid remainder.</Typography></Box>
              <Box className="settings-option__control"><Typography>{settings.allowBalanceDue ? "On" : "Off"}</Typography>{settingSwitch("Allow remaining balance", settings.allowBalanceDue, (value) => updateSetting("allowBalanceDue", value))}</Box>
            </Box>
          </Box>}

          {activeSection === "team" && <TeamPermissionsPanel />}
        </Box>

        <Box className={`settings-preview${activeSection === "team" ? " is-hidden" : ""}`}>
          <Typography className="settings-preview__label">LIVE CHECKOUT</Typography>
          <Typography component="h2">Bill preview</Typography>
          <Typography className="settings-preview__description">Dine-in example subtotal with a ₹25 discount.</Typography>
          <Box className="settings-preview__lines"><Box><span>Items subtotal</span><strong>₹500.00</strong></Box><Box><span>Discount</span><strong>− ₹25.00</strong></Box>
            {settings.packagingEnabled && <Box><span>Takeaway packaging</span><strong>Entered per bill</strong></Box>}
            {settings.taxEnabled && <Box><span>Tax · {Number(settings.taxRate) || 0}%</span><strong>₹{previewTax.toFixed(2)}</strong></Box>}
          </Box>
          <Box className="settings-preview__total"><span>Amount due</span><strong>₹{previewTotal.toFixed(2)}</strong></Box>
          <Box className="settings-preview__methods"><span>Available payment methods</span><Box>
            {[
              settings.paymentMethods.cash && "Cash",
              settings.paymentMethods.card && "Card",
              settings.paymentMethods.upi && "UPI",
              settings.paymentMethods.split && "Split",
            ].filter(Boolean).map((method) => <Chip key={method} label={method} size="small" />)}
            {!enabledPaymentCount && <Typography>No methods enabled</Typography>}
          </Box></Box>
          {settings.allowBalanceDue && <Typography className="settings-preview__balance-note">Unpaid balances can remain open.</Typography>}
        </Box>
      </Box>

      {activeSection !== "team" && <Box className="settings-page__savebar">
        <Tooltip title="Restore default POS settings"><Button aria-label="Restore defaults" startIcon={<RestartAltRoundedIcon />} onClick={resetSettings}>Restore defaults</Button></Tooltip>
        <Box><Chip icon={<CheckCircleRoundedIcon />} label={dirty ? "Unsaved changes" : "Saved to POS"} className={dirty ? "is-dirty" : "is-saved"} /><Button type="submit" form="pos-settings-form" variant="contained" color="secondary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button></Box>
      </Box>}
    </Box>
  );
}