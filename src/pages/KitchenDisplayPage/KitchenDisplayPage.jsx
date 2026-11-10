import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  connectKitchenSocket,
  listKitchenKots,
  updateKotItemStatus,
} from "../../services/kotService";

const STATIONS = ["All", "Tandoor", "Curry", "Starters", "Beverages"];
const NEXT_STATUS = {
  pending: { status: "cooking", label: "Start cooking" },
  cooking: { status: "ready", label: "Mark ready" },
  ready: { status: "served", label: "Mark served" },
};

function statusColor(status) {
  if (status === "pending") return "warning";
  if (status === "cooking") return "info";
  if (status === "ready") return "success";
  return "default";
}

export default function KitchenDisplayPage() {
  const [kots, setKots] = useState([]);
  const [clock, setClock] = useState(Date.now());
  const [station, setStation] = useState("All");
  const [connection, setConnection] = useState("Connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bumping, setBumping] = useState([]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const currentKots = await listKitchenKots(station);
      setKots(currentKots);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load kitchen tickets.");
    } finally {
      setLoading(false);
    }
  }, [station]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let socket;
    try {
      socket = connectKitchenSocket();
      socket.on("connect", () => {
        setConnection("Live");
        refresh();
      });
      socket.on("disconnect", () => setConnection("Disconnected"));
      socket.on("connect_error", (socketError) => {
        setConnection("Disconnected");
        setError(socketError.message || "Kitchen live connection failed.");
      });
      const upsertKot = (updatedKot) => {
        if (station !== "All" && updatedKot.station !== station) return;
        setKots((current) => {
          if (updatedKot.status === "served") return current.filter((kot) => kot.id !== updatedKot.id);
          const exists = current.some((kot) => kot.id === updatedKot.id);
          return exists
            ? current.map((kot) => kot.id === updatedKot.id ? updatedKot : kot)
            : [updatedKot, ...current];
        });
      };
      socket.on("kot:created", upsertKot);
      socket.on("kot:updated", upsertKot);
    } catch (socketError) {
      setConnection("Disconnected");
      setError(socketError.message || "Kitchen live connection failed.");
    }
    return () => socket?.disconnect();
  }, [refresh, station]);

  async function advanceItem(kot, item, status) {
    try {
      const updatedKot = await updateKotItemStatus(kot.id, item.id, status);
      setKots((current) => updatedKot.status === "served"
        ? current.filter((entry) => entry.id !== updatedKot.id)
        : current.map((entry) => entry.id === updatedKot.id ? updatedKot : entry));
      setError("");
    } catch (updateError) {
      setError(updateError.message || "Unable to update this kitchen item.");
    }
  }

  async function bumpCard(kot) {
    if (bumping.includes(kot.id) || !kot.items.every((item) => item.status === "ready")) return;
    setBumping((current) => [...current, kot.id]);
    try {
      for (const item of kot.items) {
        const updatedKot = await updateKotItemStatus(kot.id, item.id, "served");
        setKots((current) => updatedKot.status === "served"
          ? current.filter((entry) => entry.id !== updatedKot.id)
          : current.map((entry) => entry.id === updatedKot.id ? updatedKot : entry));
      }
      setError("");
    } catch (updateError) {
      setError(updateError.message || "Unable to complete this kitchen ticket.");
    } finally {
      setBumping((current) => current.filter((id) => id !== kot.id));
    }
  }

  function elapsedTime(createdAt) {
    const elapsedSeconds = Math.max(0, Math.floor((clock - new Date(createdAt).getTime()) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return (
    <Box sx={{ display: "grid", gap: 2, pb: 3, minHeight: "calc(100vh - 120px)", bgcolor: "#090e18", color: "#f8fafc", p: { xs: 1.5, md: 2.5 }, borderRadius: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "#a5b4fc" }}>LIVE KITCHEN</Typography>
          <Typography component="h1" variant="h4" fontWeight={800} sx={{ color: "#fff" }}>Kitchen Display</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>Track incoming orders and update each item as it is prepared.</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip color={connection === "Live" ? "success" : "default"} label={connection} sx={{ color: "#fff" }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="kitchen-station-label">Station</InputLabel>
            <Select labelId="kitchen-station-label" label="Station" value={station} onChange={(event) => setStation(event.target.value)}>
              {STATIONS.map((option) => <MenuItem value={option} key={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <Button aria-label="Refresh kitchen tickets" startIcon={<RefreshRoundedIcon />} onClick={refresh} sx={{ minHeight: 44, color: "#fff" }}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {loading ? <Typography color="text.secondary">Loading kitchen tickets…</Typography> : kots.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", alignItems: "start", gap: 2 }}>
          {kots.map((kot) => (
            (() => {
              const ageMinutes = Math.floor((clock - new Date(kot.createdAt).getTime()) / 60000);
              const alertColor = ageMinutes < 10 ? "#1e293b" : ageMinutes < 20 ? "#f59e0b" : "#e11d48";
              return <Card key={kot.id} variant="outlined" sx={{ overflow: "hidden", bgcolor: "#111827", color: "#f8fafc", border: "1px solid #334155", borderRadius: 2, boxShadow: "0 8px 26px rgb(0 0 0 / 28%)" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                <Box sx={{ flex: 1, p: 1.5, bgcolor: alertColor, color: ageMinutes >= 10 && ageMinutes < 20 ? "#111827" : "#fff" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                    <Typography variant="h5" fontWeight={900}>Table {kot.tableName}</Typography>
                    <Typography aria-label={`Elapsed time ${elapsedTime(kot.createdAt)}`} sx={{ fontSize: "1.5rem", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{elapsedTime(kot.createdAt)}</Typography>
                  </Box>
                  <Typography fontWeight={700}>{kot.number} · {kot.orderType || "Dine-in"}</Typography>
                </Box>
              </Box>
              <Box sx={{ px: 2, pb: 2 }}>
              <Chip size="small" variant="outlined" label={kot.station} sx={{ mb: 1.5, color: "#e2e8f0", borderColor: "#64748b" }} />
              <Box sx={{ display: "grid", gap: 1 }}>
                {kot.items.map((item) => {
                  const next = NEXT_STATUS[item.status];
                  return (
                    <Box key={item.id} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, alignItems: "center", borderTop: "1px solid #334155", pt: 1.25 }}>
                      <Box>
                        <Typography sx={{ fontSize: "1.15rem", fontWeight: 800, textDecoration: item.status === "ready" || item.status === "served" ? "line-through" : "none" }}>{item.quantity} × {item.name}</Typography>
                        {item.notes && <Typography variant="body1" sx={{ color: "#cbd5e1" }}>{item.notes}</Typography>}
                        <Chip size="small" color={statusColor(item.status)} label={item.status} sx={{ mt: 0.5 }} />
                      </Box>
                      {next && <Button size="small" variant="contained" sx={{ minHeight: 44, fontWeight: 800 }} onClick={() => advanceItem(kot, item, next.status)}>{next.label}</Button>}
                    </Box>
                  );
                })}
              </Box>
              <Button fullWidth variant="contained" color="success" sx={{ mt: 2, minHeight: 48, fontSize: "1rem", fontWeight: 900 }} disabled={bumping.includes(kot.id) || !kot.items.every((item) => item.status === "ready")} onClick={() => bumpCard(kot)}>
                {bumping.includes(kot.id) ? "Completing ticket…" : "Bump Card"}
              </Button>
              </Box>
            </Card>;
            })()
          ))}
        </Box>
      ) : <Card variant="outlined" sx={{ p: 5, textAlign: "center" }}>
        <Typography variant="h6" fontWeight={750}>No active kitchen tickets</Typography>
        <Typography color="text.secondary" mt={0.5}>New orders will appear here as soon as the cashier fires a KOT.</Typography>
      </Card>}
    </Box>
  );
}
