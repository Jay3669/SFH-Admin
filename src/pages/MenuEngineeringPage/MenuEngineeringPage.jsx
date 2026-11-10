import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { getMenuEngineering } from "../../services/menuEngineering";

const CATEGORIES = ["Star", "Plowhorse", "Puzzle", "Dog", "Needs costing"];
const COLORS = {
  Star: "#16834b",
  Plowhorse: "#2467c9",
  Puzzle: "#b35b00",
  Dog: "#bd3434",
  "Needs costing": "#667085",
};
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function ScatterPlot({ dishes, thresholds }) {
  const costedDishes = dishes.filter((dish) => Number.isFinite(dish.grossProfitPerServing));
  if (!costedDishes.length) {
    return <Typography color="text.secondary">Add complete recipe ingredient costs to plot gross profit.</Typography>;
  }

  const left = 76;
  const right = 724;
  const top = 26;
  const bottom = 274;
  const xMax = Math.max(20, ...costedDishes.map((dish) => dish.popularityPercent), thresholds.popularityThresholdPercent || 0) * 1.12;
  const values = costedDishes.map((dish) => dish.grossProfitPerServing);
  const yMin = Math.min(0, ...values, thresholds.profitThresholdPerServing ?? 0);
  const yMax = Math.max(1, ...values, thresholds.profitThresholdPerServing ?? 0);
  const yRange = Math.max(1, yMax - yMin);
  const x = (value) => left + (value / xMax) * (right - left);
  const y = (value) => bottom - ((value - yMin) / yRange) * (bottom - top);
  const horizontalThreshold = thresholds.profitThresholdPerServing === null
    ? null
    : y(thresholds.profitThresholdPerServing);

  return (
    <Box sx={{ overflowX: "auto" }}>
      <svg
        viewBox="0 0 760 330"
        role="img"
        aria-labelledby="menu-matrix-title menu-matrix-description"
        style={{ display: "block", width: "100%", minWidth: 540, height: "auto" }}
      >
        <title id="menu-matrix-title">Menu engineering popularity and gross profit scatter plot</title>
        <desc id="menu-matrix-description">
          Each point is a dish. Popularity is the horizontal axis and gross profit per serving is the vertical axis.
          Dashed lines show the popularity and average gross profit thresholds.
        </desc>
        <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="#98a2b3" />
        <line x1={left} y1={top} x2={left} y2={bottom} stroke="#98a2b3" />
        <line x1={left} y1={y(0)} x2={right} y2={y(0)} stroke="#e4e7ec" />
        {thresholds.popularityThresholdPercent > 0 && (
          <line
            x1={x(thresholds.popularityThresholdPercent)}
            y1={top}
            x2={x(thresholds.popularityThresholdPercent)}
            y2={bottom}
            stroke="#667085"
            strokeDasharray="5 5"
          />
        )}
        {horizontalThreshold !== null && (
          <line x1={left} y1={horizontalThreshold} x2={right} y2={horizontalThreshold} stroke="#667085" strokeDasharray="5 5" />
        )}
        {costedDishes.map((dish) => (
          <circle
            key={dish.menuItemId || dish.dishName}
            cx={x(dish.popularityPercent)}
            cy={y(dish.grossProfitPerServing)}
            r="7"
            fill={COLORS[dish.category]}
            stroke="#fff"
            strokeWidth="2"
          >
            <title>{`${dish.dishName}: ${dish.popularityPercent}% popularity, ${currency.format(dish.grossProfitPerServing)} gross profit per serving (${dish.category})`}</title>
          </circle>
        ))}
        <text x={(left + right) / 2} y="316" textAnchor="middle" fill="#475467" fontSize="12">
          Popularity (% of units sold)
        </text>
        <text
          x="17"
          y={(top + bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 17 ${(top + bottom) / 2})`}
          fill="#475467"
          fontSize="12"
        >
          Gross profit per serving (₹)
        </text>
        <text x={left} y="294" fill="#667085" fontSize="11">0%</text>
        <text x={right} y="294" textAnchor="end" fill="#667085" fontSize="11">{xMax.toFixed(0)}%</text>
      </svg>
    </Box>
  );
}

export default function MenuEngineeringPage() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState("All");
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAnalytics(await getMenuEngineering(days));
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load menu engineering.");
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => { refresh(); }, [refresh]);

  const visibleDishes = useMemo(() => (
    (analytics?.dishes || []).filter((dish) => category === "All" || dish.category === category)
  ), [analytics, category]);
  const summary = analytics?.summary;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="overline" color="primary">MENU PERFORMANCE</Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>Menu engineering matrix</Typography>
          <Typography color="text.secondary">
            Compare popularity with gross profit per serving using fully paid sales and configured recipe costs.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 145 }}>
            <InputLabel id="menu-period-label">Sales period</InputLabel>
            <Select labelId="menu-period-label" label="Sales period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[30, 90, 365].map((period) => <MenuItem key={period} value={period}>Last {period} days</MenuItem>)}
            </Select>
          </FormControl>
          <Button aria-label="Refresh menu engineering" startIcon={<RefreshRoundedIcon />} onClick={refresh}>Refresh</Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && <LinearProgress />}
      {analytics && <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
          {[
            ["Paid units sold", summary.totalSoldQuantity],
            ["Dishes analyzed", summary.dishCount],
            ["Costed dishes", summary.costedDishCount],
            ["Needs costing", summary.missingCostDishCount],
          ].map(([label, value]) => (
            <Card key={label} variant="outlined" sx={{ p: 2 }}>
              <Typography color="text.secondary">{label}</Typography>
              <Typography variant="h4" fontWeight={800}>{value}</Typography>
            </Card>
          ))}
        </Box>

        <Card variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography variant="h6" fontWeight={750}>Popularity vs. gross profit</Typography>
          <Typography variant="body2" color="text.secondary">
            High popularity is at least {analytics.thresholds.popularityThresholdPercent}% of units sold.
            High profitability is at or above the costed dishes’ average gross profit per serving
            {analytics.thresholds.profitThresholdPerServing === null
              ? " (not available until a recipe is costed)."
              : ` (${currency.format(analytics.thresholds.profitThresholdPerServing)}).`}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {CATEGORIES.map((item) => (
              <Typography key={item} variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                <Box component="span" sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: COLORS[item] }} />
                {item}: {summary.categories[item] || 0}
              </Typography>
            ))}
          </Box>
          <ScatterPlot dishes={visibleDishes} thresholds={analytics.thresholds} />
          <Typography variant="caption" color="text.secondary">
            Gross profit uses the sale line’s average realized price minus current recipe ingredient cost. Missing or zero ingredient costs are not estimated; those dishes are marked “Needs costing.”
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2, display: "grid", gap: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" fontWeight={750}>Dish performance</Typography>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="menu-category-label">Category</InputLabel>
              <Select labelId="menu-category-label" label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <MenuItem value="All">All categories</MenuItem>
                {CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <TableContainer>
            <Table size="small" aria-label="Menu engineering dish performance">
              <TableHead>
                <TableRow>
                  <TableCell>Dish</TableCell>
                  <TableCell align="right">Units sold</TableCell>
                  <TableCell align="right">Popularity</TableCell>
                  <TableCell align="right">Avg. sale price</TableCell>
                  <TableCell align="right">Ingredient cost / serving</TableCell>
                  <TableCell align="right">Gross profit / serving</TableCell>
                  <TableCell>Category</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleDishes.map((dish) => (
                  <TableRow key={dish.menuItemId || dish.dishName}>
                    <TableCell sx={{ fontWeight: 700 }}>{dish.dishName}</TableCell>
                    <TableCell align="right">{dish.soldQuantity}</TableCell>
                    <TableCell align="right">{dish.popularityPercent}%</TableCell>
                    <TableCell align="right">{currency.format(dish.unitSellingPrice)}</TableCell>
                    <TableCell align="right">
                      {dish.ingredientCostPerServing === null
                        ? `Missing${dish.missingIngredients?.length ? `: ${dish.missingIngredients.join(", ")}` : ""}`
                        : currency.format(dish.ingredientCostPerServing)}
                    </TableCell>
                    <TableCell align="right">
                      {dish.grossProfitPerServing === null ? "—" : currency.format(dish.grossProfitPerServing)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ color: COLORS[dish.category] }}>
                        {dish.category}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {!visibleDishes.length && (
                  <TableRow><TableCell colSpan={7} align="center">No dishes match this category in the selected period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {analytics.truncated && <Alert severity="warning">The analysis reached its record limit; results may not include every sale in this period.</Alert>}
        </Card>
      </>}
    </Box>
  );
}
