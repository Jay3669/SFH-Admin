import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  ButtonGroup,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableContainer,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import * as inventoryService from "../../services/inventoryService";
import { listMenuItems } from "../../services/menuService";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import LocalFireDepartmentOutlinedIcon from "@mui/icons-material/LocalFireDepartmentOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { recipeUnitsForStockUnit } from "../../utils/recipeUnits";

const EMPTY_RECIPE = {
  menuItemId: "",
  name: "",
  baseProductionQuantity: "0.5",
  productionUnit: "kg",
  instructions: "",
  status: "Active",
  ingredients: [{ itemId: "", quantity: "", unit: "" }],
};

const UNIT_CONVERSIONS = {
  kg: { group: "mass", factor: 1000 },
  kgs: { group: "mass", factor: 1000 },
  kilogram: { group: "mass", factor: 1000 },
  kilograms: { group: "mass", factor: 1000 },
  g: { group: "mass", factor: 1 },
  gm: { group: "mass", factor: 1 },
  gms: { group: "mass", factor: 1 },
  gram: { group: "mass", factor: 1 },
  grams: { group: "mass", factor: 1 },
  mg: { group: "mass", factor: 0.001 },
  lb: { group: "mass", factor: 453.59237 },
  lbs: { group: "mass", factor: 453.59237 },
  oz: { group: "mass", factor: 28.349523125 },
  l: { group: "volume", factor: 1000 },
  liter: { group: "volume", factor: 1000 },
  litre: { group: "volume", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  cc: { group: "volume", factor: 1 },
  pcs: { group: "count", factor: 1 },
  pc: { group: "count", factor: 1 },
  piece: { group: "count", factor: 1 },
  pieces: { group: "count", factor: 1 },
  dozen: { group: "count", factor: 12 },
};

function inventoryId(item) {
  return String(item.inventory_item_id || item.id);
}

function menuId(item) {
  return String(item.menu_item_id || item.id);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function amountInStockUnit(quantity, recipeUnit, stockUnit) {
  const recipe = UNIT_CONVERSIONS[String(recipeUnit || "").trim().toLowerCase()];
  const stock = UNIT_CONVERSIONS[String(stockUnit || "").trim().toLowerCase()];
  if (!recipe || !stock || recipe.group !== stock.group) return null;
  return Number(quantity) * recipe.factor / stock.factor;
}

export default function RecipeProductionPanel() {
  const [inventory, setInventory] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [historyRecipe, setHistoryRecipe] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [recipeVersions, setRecipeVersions] = useState([]);
  const [productions, setProductions] = useState([]);
  const [viewingProduction, setViewingProduction] = useState(null);
  const [productionDetailsLoading, setProductionDetailsLoading] = useState(false);
  const [productionDetailsError, setProductionDetailsError] = useState("");
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [productionForm, setProductionForm] = useState({ recipeId: "", quantity: "", unit: "kg", date: localDateValue() });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workflowTab, setWorkflowTab] = useState("produce");

  const loadData = useCallback(async () => {
    setError("");
    const [stockItems, menu, recipeList, productionList] = await Promise.all([
      inventoryService.getRecipeInventoryItems(),
      listMenuItems(),
      inventoryService.getRecipes(),
      inventoryService.getProductions(),
    ]);
    setInventory(stockItems);
    setMenuItems(menu);
    setRecipes(recipeList);
    setProductions(productionList);
    if (!productionForm.recipeId && recipeList.length) {
      const defaultRecipe = recipeList.find((recipe) => recipe.status === "Active");
      setProductionForm((current) => ({
        ...current,
        recipeId: defaultRecipe?.id || "",
        unit: defaultRecipe?.productionUnit || current.unit,
      }));
    }
  }, [productionForm.recipeId]);

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message || "Unable to load recipe production data."))
      .finally(() => setLoading(false));
  }, [loadData]);

  function startEdit(recipe) {
    setEditingRecipe(recipe);
    setRecipeForm({
      menuItemId: recipe.menuItemId,
      name: recipe.name,
      baseProductionQuantity: String(recipe.baseProductionQuantity),
      productionUnit: recipe.productionUnit,
      instructions: recipe.instructions,
      status: recipe.status,
      ingredients: recipe.ingredients.map((ingredient) => ({
        itemId: ingredient.itemId,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
      })),
    });
    setMessage("");
  }

  async function saveRecipe(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...recipeForm,
        baseProductionQuantity: Number(recipeForm.baseProductionQuantity),
        ingredients: recipeForm.ingredients.map((ingredient) => ({
          itemId: ingredient.itemId,
          quantity: Number(ingredient.quantity),
          unit: ingredient.unit.trim(),
        })),
      };
      if (editingRecipe) await inventoryService.updateRecipeDefinition(editingRecipe.id, payload);
      else await inventoryService.createRecipeDefinition(payload);
      setRecipeForm(EMPTY_RECIPE);
      setEditingRecipe(null);
      setMessage(editingRecipe ? "Recipe version saved." : "Recipe created.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "Unable to save recipe.");
    }
  }

  async function handleDeactivate(recipe) {
    setError("");
    setMessage("");
    try {
      await inventoryService.deactivateRecipe(recipe.id);
      setMessage(`${recipe.name} was deactivated.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "Unable to deactivate recipe.");
    }
  }

  async function loadVersionHistory(recipe) {
    setError("");
    setHistoryRecipe(recipe);
    setRecipeVersions([]);
    try {
      setRecipeVersions(await inventoryService.getRecipeVersions(recipe.id));
    } catch (historyError) {
      setError(historyError.message || "Unable to load recipe versions.");
      setHistoryRecipe(null);
    }
  }

  async function calculatePreview(event) {
    event.preventDefault();
    setError("");
    setPreview(null);
    try {
      const selectedRecipe = recipes.find((recipe) => recipe.id === productionForm.recipeId);
      const result = await inventoryService.previewProduction({
        recipeId: productionForm.recipeId,
        quantity: Number(productionForm.quantity),
        unit: productionForm.unit || selectedRecipe?.productionUnit,
      });
      setPreview(result.data);
    } catch (previewError) {
      setError(previewError.message || "Unable to calculate production.");
    }
  }

  async function saveProductionDraft() {
    setError("");
    setMessage("");
    try {
      const result = await inventoryService.createProductionDraft({
        recipeId: productionForm.recipeId,
        quantity: Number(productionForm.quantity),
        unit: productionForm.unit,
        productionDate: productionForm.date,
      });
      setMessage(`Draft ${result.production.productionNumber} saved. Inventory has not been deducted.`);
      await loadData();
    } catch (draftError) {
      setError(draftError.message || "Unable to save production draft.");
    }
  }

  async function changeProductionStatus(production, action) {
    setError("");
    setMessage("");
    try {
      if (action === "confirm") await inventoryService.confirmProduction(production.id);
      else await inventoryService.cancelProduction(production.id, "Cancelled by manager.");
      setMessage(action === "confirm" ? `${production.productionNumber} confirmed.` : `${production.productionNumber} cancelled.`);
      await loadData();
    } catch (actionError) {
      setError(actionError.message || "Unable to update production.");
    }
  }

  async function viewProduction(production) {
    setViewingProduction(production);
    setProductionDetailsError("");
    const embeddedIngredients = production.ingredients || production.ingredientConsumptions || production.consumptions;
    if (Array.isArray(embeddedIngredients) && embeddedIngredients.length) return;

    setProductionDetailsLoading(true);
    try {
      setViewingProduction(await inventoryService.getProductionById(production.id));
    } catch (detailsError) {
      setProductionDetailsError(detailsError.message || "Unable to load production ingredient details.");
    } finally {
      setProductionDetailsLoading(false);
    }
  }

  const activeRecipes = recipes.filter((recipe) => recipe.status === "Active");
  const selectedProductionRecipe = recipes.find((recipe) => recipe.id === productionForm.recipeId);

  function getRecipeIngredientCost(ingredient) {
    const item = inventory.find((entry) => inventoryId(entry) === String(ingredient.itemId));
    const explicitCost = ingredient.totalCost ?? ingredient.ingredientCost;
    if (explicitCost !== undefined && explicitCost !== null && Number.isFinite(Number(explicitCost))) {
      return Number(explicitCost);
    }
    const unitCost = ingredient.unitCost ?? item?.unitCost ?? item?.cost;
    if (unitCost === undefined || unitCost === null || !Number.isFinite(Number(unitCost))) return null;
    const stockQuantity = amountInStockUnit(ingredient.quantity, ingredient.unit, ingredient.inventoryUnit || item?.unit);
    return stockQuantity === null ? null : stockQuantity * Number(unitCost);
  }

  function getRecipeTotalCost(recipe) {
    if (recipe.totalRecipeCost !== undefined && recipe.totalRecipeCost !== null && Number.isFinite(Number(recipe.totalRecipeCost))) {
      return Number(recipe.totalRecipeCost);
    }
    const costs = (recipe.ingredients || []).map(getRecipeIngredientCost);
    return costs.length && costs.every((cost) => cost !== null) ? costs.reduce((total, cost) => total + cost, 0) : null;
  }

  if (loading) return <Alert severity="info">Loading recipe production workflow…</Alert>;

  return (
    <Box className="inventory-section-stack recipe-workflow">
      <Box className="recipe-workflow__hero">
        <Box className="recipe-workflow__hero-copy">
          <Typography className="recipe-workflow__eyebrow">KITCHEN OPERATIONS</Typography>
          <Typography component="h1">Recipe production</Typography>
          <Typography>Build reliable recipes, plan batches, and keep ingredient usage in sync with stock.</Typography>
        </Box>
        <Box className="recipe-workflow__summary" aria-label="Recipe production summary">
          <Box><strong>{recipes.length}</strong><span>Recipes</span></Box>
          <Box><strong>{activeRecipes.length}</strong><span>Active</span></Box>
          <Box><strong>{productions.filter((production) => production.status === "Draft").length}</strong><span>Drafts</span></Box>
        </Box>
      </Box>

      <Box className="recipe-workflow__navigation">
        <Tabs value={workflowTab} onChange={(_, value) => setWorkflowTab(value)} aria-label="Recipe production views" variant="scrollable" scrollButtons="auto">
          <Tab value="produce" icon={<LocalFireDepartmentOutlinedIcon />} iconPosition="start" label="Produce" />
          <Tab value="recipes" icon={<RestaurantOutlinedIcon />} iconPosition="start" label="Recipes" />
        </Tabs>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

      {workflowTab === "recipes" && <>
      <Card className="inventory-panel recipe-workflow__recipe-panel" elevation={0}>
        <Box className="inventory-panel__heading">
          <Box>
            <Typography component="h2">Recipe definitions</Typography>
            <Typography variant="body2">Versioned recipes linked to menu items and stock ingredients.</Typography>
          </Box>
        </Box>
        <Box className="inventory-recipe-grid">
          {recipes.map((recipe) => (
            <Card className="inventory-recipe-card recipe-workflow__recipe-card" elevation={0} key={recipe.id}>
              <Box className="recipe-workflow__recipe-card-heading">
                <Box>
                  <Typography component="h3">{recipe.name}</Typography>
                  <Typography>{recipe.menuItemName}</Typography>
                </Box>
                <Chip size="small" label={recipe.status} className={`recipe-workflow__status is-${String(recipe.status).toLowerCase()}`} />
              </Box>
              <Box className="recipe-workflow__recipe-card-meta">
                <Box><span>Version</span><strong>{recipe.version}</strong></Box>
                <Box><span>Ingredients</span><strong>{recipe.ingredients.length}</strong></Box>
                <Box><span>Recipe cost</span><strong>{getRecipeTotalCost(recipe) === null ? "—" : currency(getRecipeTotalCost(recipe))}</strong></Box>
              </Box>
              <Typography className="recipe-workflow__recipe-base">Base batch · {formatNumber(recipe.baseProductionQuantity)} {recipe.productionUnit}</Typography>
              <Box className="recipe-workflow__recipe-card-actions">
                <IconButton aria-label={`View ${recipe.name} details`} title="View recipe details" onClick={() => setViewingRecipe(recipe)}><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                <Button size="small" onClick={() => startEdit(recipe)}>New version</Button>
                <Button size="small" onClick={() => loadVersionHistory(recipe)}>Version history</Button>
                {recipe.status === "Active" && <Button size="small" color="error" onClick={() => handleDeactivate(recipe)}>Deactivate</Button>}
              </Box>
            </Card>
          ))}
          {!recipes.length && <Typography>No recipes are configured yet.</Typography>}
        </Box>
        {historyRecipe && <Box className="inventory-section-stack" sx={{ px: 2, pb: 2 }}>
          <Typography variant="subtitle1">{historyRecipe.name} version history</Typography>
          {recipeVersions.map((version) => (
            <Alert severity="info" key={`${version.id}-${version.version}`}>
              Version {version.version} · {formatNumber(version.baseProductionQuantity)} {version.productionUnit} · Cost snapshot {currency(version.totalRecipeCost)} · {version.ingredients.map((ingredient) => `${ingredient.name} ${formatNumber(ingredient.quantity)} ${ingredient.unit}`).join(", ")}
            </Alert>
          ))}
          <Button size="small" onClick={() => { setHistoryRecipe(null); setRecipeVersions([]); }}>Close history</Button>
        </Box>}
      </Card>

      <Card className="inventory-panel recipe-workflow__builder-panel" elevation={0}>
        <Box className="inventory-panel__heading">
          <Box>
            <Typography component="h2">{editingRecipe ? "Create recipe version" : "Add recipe"}</Typography>
            <Typography variant="body2">Editing creates a new immutable version; prior production keeps its original recipe.</Typography>
          </Box>
        </Box>
        <Box component="form" onSubmit={saveRecipe} className="inventory-section-stack">
          <Box className="inventory-form-row">
            <FormControl required>
              <InputLabel id="workflow-menu-item-label">Menu item</InputLabel>
              <Select labelId="workflow-menu-item-label" label="Menu item" value={recipeForm.menuItemId} onChange={(event) => {
                const item = menuItems.find((entry) => menuId(entry) === event.target.value);
                setRecipeForm((current) => ({ ...current, menuItemId: event.target.value, name: current.name || item?.name || "" }));
              }}>
                {menuItems.map((item) => <MenuItem key={menuId(item)} value={menuId(item)}>{item.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField required label="Recipe name" value={recipeForm.name} onChange={(event) => setRecipeForm({ ...recipeForm, name: event.target.value })} />
          </Box>
          <Box className="inventory-form-row">
            <TextField required type="number" label="Base production quantity" value={recipeForm.baseProductionQuantity} onChange={(event) => setRecipeForm({ ...recipeForm, baseProductionQuantity: event.target.value })} slotProps={{ htmlInput: { min: 0.001, step: "any" } }} />
            <TextField required label="Production unit" value={recipeForm.productionUnit} onChange={(event) => setRecipeForm({ ...recipeForm, productionUnit: event.target.value })} placeholder="kg, litre, pieces" />
          </Box>
          <FormControl>
            <InputLabel id="recipe-status-label">Recipe status</InputLabel>
            <Select labelId="recipe-status-label" label="Recipe status" value={recipeForm.status} onChange={(event) => setRecipeForm({ ...recipeForm, status: event.target.value })}>
              <MenuItem value="Active">Active</MenuItem><MenuItem value="Inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Preparation instructions" multiline minRows={2} value={recipeForm.instructions} onChange={(event) => setRecipeForm({ ...recipeForm, instructions: event.target.value })} />
          <Typography variant="subtitle1">Ingredients</Typography>
          {recipeForm.ingredients.map((ingredient, index) => (
            <Box className="inventory-form-row" key={`ingredient-${index}`}>
              <FormControl required>
                <InputLabel id={`workflow-ingredient-${index}`}>Inventory ingredient</InputLabel>
                <Select labelId={`workflow-ingredient-${index}`} label="Inventory ingredient" value={ingredient.itemId} onChange={(event) => {
                  const item = inventory.find((entry) => inventoryId(entry) === event.target.value);
                  setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((row, rowIndex) => rowIndex === index ? { ...row, itemId: event.target.value, unit: item?.unit || row.unit } : row) }));
                }}>
                  {inventory.map((item) => <MenuItem key={inventoryId(item)} value={inventoryId(item)}>{item.name} ({item.unit})</MenuItem>)}
                </Select>
              </FormControl>
              <TextField required type="number" label="Required quantity" value={ingredient.quantity} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} slotProps={{ htmlInput: { min: 0.001, step: "any" } }} />
              <FormControl required disabled={!ingredient.itemId}>
                <InputLabel id={`workflow-unit-${index}`}>Recipe unit</InputLabel>
                <Select labelId={`workflow-unit-${index}`} label="Recipe unit" value={ingredient.unit} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((row, rowIndex) => rowIndex === index ? { ...row, unit: event.target.value } : row) }))}>
                  {recipeUnitsForStockUnit(inventory.find((item) => inventoryId(item) === ingredient.itemId)?.unit).map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                </Select>
              </FormControl>
              <Button disabled={recipeForm.ingredients.length === 1} color="error" onClick={() => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, rowIndex) => rowIndex !== index) }))}>Remove</Button>
            </Box>
          ))}
          <Box className="inventory-table__actions">
            <Button onClick={() => setRecipeForm((current) => ({ ...current, ingredients: [...current.ingredients, { itemId: "", quantity: "", unit: "" }] }))}>Add ingredient</Button>
            <Button type="submit" variant="contained" color="secondary">{editingRecipe ? "Save new version" : "Create recipe"}</Button>
            {editingRecipe && <Button onClick={() => { setEditingRecipe(null); setRecipeForm(EMPTY_RECIPE); }}>Stop editing</Button>}
          </Box>
        </Box>
      </Card>
      </>}

      {workflowTab === "produce" && <>
      <Card className="inventory-panel recipe-workflow__production-panel" elevation={0}>
        <Box className="inventory-panel__heading">
          <Box><Typography component="h2">Build a production batch</Typography><Typography variant="body2">Choose a recipe and quantity. Ingredient requirements are calculated from its base batch.</Typography></Box>
        </Box>
        <Box className="recipe-workflow__production-layout">
          <Box component="form" onSubmit={calculatePreview} className="recipe-workflow__production-form">
            <FormControl required>
              <InputLabel id="production-recipe-label">Recipe</InputLabel>
              <Select labelId="production-recipe-label" label="Recipe" value={productionForm.recipeId} onChange={(event) => {
                const recipe = recipes.find((entry) => entry.id === event.target.value);
                setProductionForm((current) => ({ ...current, recipeId: event.target.value, unit: recipe?.productionUnit || current.unit }));
                setPreview(null);
              }}>
                {activeRecipes.map((recipe) => <MenuItem key={recipe.id} value={recipe.id}>{recipe.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Box className="recipe-workflow__production-fields">
              <TextField required type="number" label="Production quantity" value={productionForm.quantity} onChange={(event) => { setProductionForm({ ...productionForm, quantity: event.target.value }); setPreview(null); }} slotProps={{ htmlInput: { min: 0.001, step: "any" } }} />
              <TextField required label="Unit" value={productionForm.unit} slotProps={{ htmlInput: { readOnly: true } }} />
              <TextField required type="date" label="Production date" value={productionForm.date} onChange={(event) => setProductionForm({ ...productionForm, date: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <Box className="recipe-workflow__quick-quantities">
              <Typography component="span">Quick quantity</Typography>
              <ButtonGroup size="small" aria-label="Quick production quantities">
                {[0.5, 1, 5, 10].map((quantity) => (
                  <Button key={quantity} type="button" variant={productionForm.quantity === String(quantity) ? "contained" : "outlined"} onClick={() => {
                    setProductionForm((current) => ({ ...current, quantity: String(quantity), unit: selectedProductionRecipe?.productionUnit || current.unit }));
                    setPreview(null);
                  }}>{quantity} {selectedProductionRecipe?.productionUnit || "kg"}</Button>
                ))}
              </ButtonGroup>
            </Box>
            <Button className="recipe-workflow__preview-button" type="submit" variant="contained" color="secondary" startIcon={<AssessmentOutlinedIcon />}>Preview ingredients</Button>
          </Box>

          <Box className="recipe-workflow__batch-aside">
            <Typography className="recipe-workflow__aside-label">RECIPE BASIS</Typography>
            {selectedProductionRecipe ? <>
              <Typography className="recipe-workflow__aside-title">{selectedProductionRecipe.name}</Typography>
              <Typography className="recipe-workflow__aside-menu">{selectedProductionRecipe.menuItemName}</Typography>
              <Box className="recipe-workflow__basis-metrics">
                <Box><span>Base batch</span><strong>{formatNumber(selectedProductionRecipe.baseProductionQuantity)} {selectedProductionRecipe.productionUnit}</strong></Box>
                <Box><span>Ingredients</span><strong>{selectedProductionRecipe.ingredients.length}</strong></Box>
              </Box>
              {Number(productionForm.quantity) > 0 && <Typography className="recipe-workflow__multiplier">
                {formatNumber(Number(productionForm.quantity) / Number(selectedProductionRecipe.baseProductionQuantity))}× base batch
              </Typography>}
            </> : <Typography className="recipe-workflow__aside-empty">Select a recipe to see its base quantity and batch multiplier.</Typography>}
          </Box>
        </Box>
        {preview && <Box className="inventory-section-stack recipe-workflow__preview">
          <Alert severity={preview.sufficient ? "success" : "warning"}>Estimated ingredient cost: {currency(preview.totalIngredientCost)}{!preview.sufficient && " · One or more ingredients are short."}</Alert>
          <TableContainer className="recipe-workflow__table-wrap"><Table size="small"><TableHead><TableRow><TableCell>INGREDIENT</TableCell><TableCell>REQUIRED</TableCell><TableCell>AVAILABLE</TableCell><TableCell>REMAINING</TableCell><TableCell>COST</TableCell></TableRow></TableHead>
            <TableBody>{preview.ingredients.map((ingredient) => <TableRow key={ingredient.itemId}><TableCell>{ingredient.ingredientName}</TableCell><TableCell>{formatNumber(ingredient.requiredQuantity)} {ingredient.unit}</TableCell><TableCell>{formatNumber(ingredient.availableStock)} {ingredient.unit}</TableCell><TableCell>{formatNumber(ingredient.remainingStock)} {ingredient.unit}</TableCell><TableCell>{currency(ingredient.totalCost)}</TableCell></TableRow>)}</TableBody>
          </Table></TableContainer>
          <Button variant="contained" color="secondary" onClick={saveProductionDraft}>Save as draft (no stock deducted)</Button>
        </Box>}
      </Card>

      <Card className="inventory-panel recipe-workflow__entries-panel" elevation={0}>
        <Box className="inventory-panel__heading"><Box><Typography component="h2">Production entries</Typography><Typography variant="body2">Confirmed entries retain actual ingredient quantities and costs.</Typography></Box><Button onClick={() => loadData().catch((loadError) => setError(loadError.message))}>Refresh</Button></Box>
        <TableContainer className="recipe-workflow__table-wrap"><Table size="small"><TableHead><TableRow><TableCell>DATE</TableCell><TableCell>PRODUCTION</TableCell><TableCell>STATUS</TableCell><TableCell>COST</TableCell><TableCell>ACTIONS</TableCell></TableRow></TableHead>
          <TableBody>{productions.map((production) => <TableRow key={production.id}><TableCell>{production.productionDate}</TableCell><TableCell>{production.recipeName} · {formatNumber(production.productionQuantity)} {production.productionUnit}<Typography variant="caption" display="block">{production.productionNumber}</Typography></TableCell><TableCell>{production.status}</TableCell><TableCell>{currency(production.totalCost)}</TableCell><TableCell>
            <IconButton aria-label={`View ${production.productionNumber} details`} title="View production details" onClick={() => viewProduction(production)}><VisibilityOutlinedIcon fontSize="small" /></IconButton>
            {production.status === "Draft" && <Button size="small" onClick={() => changeProductionStatus(production, "confirm")}>Confirm</Button>}
            {production.status !== "Cancelled" && <Button size="small" color="error" onClick={() => changeProductionStatus(production, "cancel")}>Cancel</Button>}
          </TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>
      </Card>
      </>}

      <Dialog open={Boolean(viewingRecipe)} onClose={() => setViewingRecipe(null)} fullWidth maxWidth="md">
        {viewingRecipe && <>
          <DialogTitle>{viewingRecipe.name}</DialogTitle>
          <DialogContent className="recipe-workflow__details-content">
            <Box className="recipe-workflow__details-summary">
              <Box><span>Menu item</span><strong>{viewingRecipe.menuItemName}</strong></Box>
              <Box><span>Status</span><strong>{viewingRecipe.status}</strong></Box>
              <Box><span>Version</span><strong>{viewingRecipe.version}</strong></Box>
              <Box><span>Base batch</span><strong>{formatNumber(viewingRecipe.baseProductionQuantity)} {viewingRecipe.productionUnit}</strong></Box>
              <Box><span>Total ingredients</span><strong>{viewingRecipe.ingredients.length}</strong></Box>
              <Box><span>Overall recipe cost</span><strong>{getRecipeTotalCost(viewingRecipe) === null ? "Not available" : currency(getRecipeTotalCost(viewingRecipe))}</strong></Box>
            </Box>
            <TableContainer className="recipe-workflow__table-wrap">
              <Table size="small">
                <TableHead><TableRow><TableCell>INGREDIENT</TableCell><TableCell>AMOUNT USED</TableCell><TableCell>STOCK UNIT</TableCell><TableCell>UNIT COST</TableCell><TableCell>INGREDIENT COST</TableCell></TableRow></TableHead>
                <TableBody>{(viewingRecipe.ingredients || []).map((ingredient) => {
                  const item = inventory.find((entry) => inventoryId(entry) === String(ingredient.itemId));
                  const unitCost = ingredient.unitCost ?? item?.unitCost ?? item?.cost;
                  const ingredientCost = getRecipeIngredientCost(ingredient);
                  return (
                    <TableRow key={ingredient.id || ingredient.itemId}>
                      <TableCell>{ingredient.name || item?.name || "Inventory item"}</TableCell>
                      <TableCell>{formatNumber(ingredient.quantity)} {ingredient.unit}</TableCell>
                      <TableCell>{ingredient.inventoryUnit || item?.unit || "—"}</TableCell>
                      <TableCell>{unitCost === undefined || unitCost === null ? "—" : `${currency(unitCost)}/${ingredient.inventoryUnit || item?.unit || "unit"}`}</TableCell>
                      <TableCell>{ingredientCost === null ? "—" : currency(ingredientCost)}</TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions><Button onClick={() => setViewingRecipe(null)}>Close</Button></DialogActions>
        </>}
      </Dialog>

      <Dialog open={Boolean(viewingProduction)} onClose={() => setViewingProduction(null)} fullWidth maxWidth="md">
        {viewingProduction && <>
          <DialogTitle>Production details · {viewingProduction.productionNumber}</DialogTitle>
          <DialogContent className="recipe-workflow__details-content">
            <Box className="recipe-workflow__details-summary">
              <Box><span>Recipe</span><strong>{viewingProduction.recipeName}</strong></Box>
              <Box><span>Production date</span><strong>{viewingProduction.productionDate}</strong></Box>
              <Box><span>Status</span><strong>{viewingProduction.status}</strong></Box>
              <Box><span>Produced</span><strong>{formatNumber(viewingProduction.productionQuantity)} {viewingProduction.productionUnit}</strong></Box>
              <Box><span>Ingredient lines</span><strong>{(viewingProduction.ingredients || viewingProduction.ingredientConsumptions || viewingProduction.consumptions || []).length}</strong></Box>
              <Box><span>Total ingredient cost</span><strong>{currency(viewingProduction.totalCost ?? viewingProduction.totalIngredientCost ?? 0)}</strong></Box>
            </Box>
            {productionDetailsLoading ? <Alert severity="info">Loading ingredient costs…</Alert> : productionDetailsError ? <Alert severity="error">{productionDetailsError}</Alert> : <TableContainer className="recipe-workflow__table-wrap">
              <Table size="small">
                <TableHead><TableRow><TableCell>INGREDIENT</TableCell><TableCell>CONSUMED</TableCell><TableCell>UNIT COST</TableCell><TableCell>INGREDIENT COST</TableCell></TableRow></TableHead>
                <TableBody>{(viewingProduction.ingredients || viewingProduction.ingredientConsumptions || viewingProduction.consumptions || []).map((ingredient) => {
                  const quantity = ingredient.actualQuantity ?? ingredient.consumedQuantity ?? ingredient.quantity ?? ingredient.requiredQuantity;
                  const unit = ingredient.inventoryUnit || ingredient.stockUnit || ingredient.unit;
                  const lineCost = ingredient.totalCost ?? ingredient.ingredientCost ?? ingredient.cost;
                  const unitCost = ingredient.unitCost ?? ingredient.costPerUnit;
                  return <TableRow key={ingredient.id || ingredient.itemId}>
                    <TableCell>{ingredient.ingredientName || ingredient.name || ingredient.itemName}</TableCell>
                    <TableCell>{formatNumber(quantity)} {unit}</TableCell>
                    <TableCell>{unitCost === undefined || unitCost === null ? "—" : `${currency(unitCost)}/${unit || "unit"}`}</TableCell>
                    <TableCell>{lineCost === undefined || lineCost === null ? "—" : currency(lineCost)}</TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            </TableContainer>}
            {!productionDetailsLoading && !productionDetailsError && !(viewingProduction.ingredients || viewingProduction.ingredientConsumptions || viewingProduction.consumptions || []).length && <Alert severity="info">No ingredient cost details are available for this production entry.</Alert>}
          </DialogContent>
          <DialogActions><Button onClick={() => setViewingProduction(null)}>Close</Button></DialogActions>
        </>}
      </Dialog>

    </Box>
  );
}
