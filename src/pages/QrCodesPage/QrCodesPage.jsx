import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { createTableQrCode } from "../../services/featureServices";
import { listDiningTables } from "../../services/kotService";

export default function QrCodesPage() {
  const [tables, setTables] = useState([]);
  const [tableName, setTableName] = useState("");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listDiningTables()
      .then((result) => { if (active) setTables(result); })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load dining tables."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function generateCode() {
    if (!tableName || saving) return;
    setSaving(true);
    setError("");
    try {
      const code = await createTableQrCode(tableName);
      const image = await QRCode.toDataURL(code.url, { width: 360, margin: 2, errorCorrectionLevel: "Q" });
      setCodes((current) => [{ ...code, image }, ...current.filter((entry) => entry.tableName !== code.tableName)]);
    } catch (generateError) {
      setError(generateError.message || "Unable to generate a table QR code.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="overline" color="primary">SELF-ORDERING</Typography>
        <Typography component="h1" variant="h4" fontWeight={800}>Table QR codes</Typography>
        <Typography color="text.secondary">Generate signed ordering links for tables. Customers submit orders for counter payment.</Typography>
      </Box>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <Card variant="outlined" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, p: 2 }}>
        <FormControl sx={{ minWidth: 240 }} size="small">
          <InputLabel id="qr-table-label">Dining table</InputLabel>
          <Select labelId="qr-table-label" label="Dining table" value={tableName} onChange={(event) => setTableName(event.target.value)} disabled={loading}>
            {tables.map((table) => <MenuItem key={table.tableName} value={table.tableName}>{table.tableName}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" disabled={!tableName || saving || loading} onClick={generateCode} sx={{ minHeight: 44 }}>
          {saving ? <CircularProgress size={20} color="inherit" /> : "Generate QR code"}
        </Button>
      </Card>
      {codes.map((code) => (
        <Card key={code.tableName} variant="outlined" sx={{ display: "flex", alignItems: "center", gap: 2, p: 2 }}>
          <Box component="img" src={code.image} alt={`Customer ordering QR code for ${code.tableName}`} sx={{ width: { xs: 120, sm: 180 }, height: "auto" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800}>{code.tableName}</Typography>
            <Typography sx={{ overflowWrap: "anywhere" }} color="text.secondary">{code.url}</Typography>
            <Button sx={{ mt: 1 }} onClick={() => window.print()}>Print QR codes</Button>
          </Box>
        </Card>
      ))}
    </Box>
  );
}
