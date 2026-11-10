import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, LinearProgress, MenuItem, Select, Typography } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { getKitchenAnalytics } from "../../services/featureServices";

export default function KitchenAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAnalytics(await getKitchenAnalytics(days));
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load kitchen analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { refresh(); }, [refresh]);
  const maxMinutes = Math.max(25, ...(analytics?.dishes || []).map((dish) => dish.averageMinutes));

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="overline" color="primary">KITCHEN EFFICIENCY</Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>Prep time analytics</Typography>
          <Typography color="text.secondary">Measured from KOT fire to served; slow items exceed 25 minutes.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Select size="small" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Analytics period">
            {[7, 30, 90].map((period) => <MenuItem key={period} value={period}>Last {period} days</MenuItem>)}
          </Select>
          <Button aria-label="Refresh kitchen analytics" startIcon={<RefreshRoundedIcon />} onClick={refresh}>Refresh</Button>
        </Box>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LinearProgress />}
      {analytics && <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
          <Card variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary">Completed items</Typography><Typography variant="h4" fontWeight={800}>{analytics.completedItems}</Typography></Card>
          <Card variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary">Menu items tracked</Typography><Typography variant="h4" fontWeight={800}>{analytics.dishes.length}</Typography></Card>
          <Card variant="outlined" sx={{ p: 2 }}><Typography color="text.secondary">Slow dishes (&gt;25m avg)</Typography><Typography variant="h4" fontWeight={800}>{analytics.dishes.filter((dish) => dish.averageMinutes > 25).length}</Typography></Card>
        </Box>
        <Card variant="outlined" sx={{ p: 2, display: "grid", gap: 1.5 }}>
          <Typography variant="h6">Average preparation duration</Typography>
          {!analytics.dishes.length && <Typography color="text.secondary">No completed kitchen timings in this period yet.</Typography>}
          {analytics.dishes.map((dish) => (
            <Box key={dish.name} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", sm: "minmax(160px, 1fr) 3fr auto" }, alignItems: "center", gap: 1 }}>
              <Typography fontWeight={700}>{dish.name}</Typography>
              <LinearProgress variant="determinate" value={Math.min(100, dish.averageMinutes / maxMinutes * 100)} color={dish.averageMinutes > 25 ? "error" : "primary"} sx={{ display: { xs: "none", sm: "block" }, height: 10, borderRadius: 5 }} />
              <Typography sx={{ fontVariantNumeric: "tabular-nums", color: dish.averageMinutes > 25 ? "error.main" : "text.primary" }}>{dish.averageMinutes} min · {dish.slowOrders} slow</Typography>
            </Box>
          ))}
        </Card>
      </>}
    </Box>
  );
}
