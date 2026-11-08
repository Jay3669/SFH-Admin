import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import * as inventoryService from "../../services/inventoryService";
import { listMenuItems } from "../../services/menuService";
import { recipeUnitsForStockUnit } from "../../utils/recipeUnits";

const EMPTY_RECIPE = {
  menuItemId: "",
  baseProductionQuantity: "0.5",
  productionUnit: "kg",
  ingredients: [{ itemId: "", quantity: "", unit: "" }],
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

export default function RecipeDefinitionPanel() {
  const [inventory, setInventory] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setError("");
    const [stockItems, menu, recipeList] = await Promise.all([
      inventoryService.getRecipeInventoryItems(),
      listMenuItems(),
      inventoryService.getRecipes(),
    ]);
    setInventory(stockItems);
    setMenuItems(menu);
    setRecipes(recipeList);
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message || "Unable to load recipes."))
      .finally(() => setLoading(false));
  }, []);

  function openDialog() {
    setRecipeForm(EMPTY_RECIPE);
    setError("");
    setDialogOpen(true);
  }

  async function saveRecipe(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const menuItem = menuItems.find((item) => menuId(item) === recipeForm.menuItemId);
    const baseProductionQuantity = Number(recipeForm.baseProductionQuantity);
    if (!menuItem || !Number.isFinite(baseProductionQuantity) || baseProductionQuantity <= 0) {
      setError("Choose a menu item and enter a base quantity greater than zero.");
      return;
    }
    if (!recipeForm.ingredients.length || recipeForm.ingredients.some((ingredient) => {
      const quantity = Number(ingredient.quantity);
      return !ingredient.itemId || !Number.isFinite(quantity) || quantity <= 0;
    })) {
      setError("Choose an inventory item and enter a quantity for every ingredient.");
      return;
    }

    const payload = {
      menuItemId: recipeForm.menuItemId,
      name: menuItem.name,
      baseProductionQuantity,
      productionUnit: recipeForm.productionUnit,
      status: "Active",
      instructions: "",
      ingredients: recipeForm.ingredients.map((ingredient) => ({
        itemId: ingredient.itemId,
        quantity: Number(ingredient.quantity),
        unit: ingredient.unit,
      })),
    };

    setSaving(true);
    try {
      await inventoryService.createRecipeDefinition(payload);
      await loadData();
      setDialogOpen(false);
      setRecipeForm(EMPTY_RECIPE);
      setMessage(`${menuItem.name} recipe created.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save the recipe.");
    } finally {
      setSaving(false);
    }
  }

  function updateIngredient(index, updates) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, rowIndex) => rowIndex === index
        ? { ...ingredient, ...updates }
        : ingredient),
    }));
  }

  return (
    <>
      <Card className="inventory-panel" elevation={0}>
        <Box className="inventory-panel__heading">
          <Box>
            <Typography component="h2">Recipes</Typography>
            <Typography variant="body2">Set ingredient amounts for a 0.5 kg base batch. Production quantities are scaled by the backend.</Typography>
          </Box>
          <Button variant="contained" color="secondary" startIcon={<AddRoundedIcon />} onClick={openDialog}>Add recipe</Button>
        </Box>
        {error && !dialogOpen && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" onClose={() => setMessage("")} sx={{ mx: 2, mb: 2 }}>{message}</Alert>}
        {loading ? <Alert severity="info" sx={{ mx: 2, mb: 2 }}>Loading recipes…</Alert> : recipes.length ? (
          <Box className="inventory-recipe-grid">
            {recipes.map((recipe) => (
              <Card className="inventory-recipe-card" elevation={0} key={recipe.id}>
                <Typography variant="h6">{recipe.name}</Typography>
                <Typography>{recipe.menuItemName} · Version {recipe.version} · {recipe.status}</Typography>
                <Typography>Base: {formatNumber(recipe.baseProductionQuantity)} {recipe.productionUnit}</Typography>
                {(recipe.ingredients || []).map((ingredient) => (
                  <Typography key={ingredient.id}>{ingredient.name}: {formatNumber(ingredient.quantity)} {ingredient.unit}</Typography>
                ))}
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <Box sx={{ display: "grid", justifyItems: "center", gap: 1, border: "1px dashed #d9dee7", borderRadius: 1, p: 3, textAlign: "center" }}>
              <RestaurantOutlinedIcon color="action" />
              <Typography variant="subtitle1">No recipes yet</Typography>
              <Typography variant="body2" color="text.secondary">Add a menu item and its ingredient quantities to get started.</Typography>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openDialog}>Add recipe</Button>
            </Box>
          </Box>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={saveRecipe}>
          <DialogTitle>Add recipe</DialogTitle>
          <DialogContent className="inventory-dialog__content">
            {error && <Alert severity="error">{error}</Alert>}
            <FormControl required>
              <InputLabel id="recipe-menu-item-label">Menu item</InputLabel>
              <Select labelId="recipe-menu-item-label" label="Menu item" value={recipeForm.menuItemId} onChange={(event) => setRecipeForm((current) => ({ ...current, menuItemId: event.target.value }))}>
                {menuItems.map((item) => <MenuItem key={menuId(item)} value={menuId(item)}>{item.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Box className="inventory-form-row">
              <TextField required type="number" label="Base batch quantity (kg)" value={recipeForm.baseProductionQuantity} onChange={(event) => setRecipeForm((current) => ({ ...current, baseProductionQuantity: event.target.value }))} slotProps={{ htmlInput: { min: 0.001, step: "any" } }} />
              <TextField label="Production unit" value={recipeForm.productionUnit} slotProps={{ htmlInput: { readOnly: true } }} />
            </Box>
            <Alert severity="info">Enter the amount of each ingredient used for this base batch. When you enter a production quantity later, the backend calculates the required ingredient amounts.</Alert>
            <Typography variant="subtitle1">Ingredients</Typography>
            {recipeForm.ingredients.map((ingredient, index) => (
              <Box className="inventory-form-row" key={`recipe-ingredient-${index}`}>
                <FormControl required>
                  <InputLabel id={`recipe-inventory-item-${index}`}>Inventory item</InputLabel>
                  <Select labelId={`recipe-inventory-item-${index}`} label="Inventory item" value={ingredient.itemId} onChange={(event) => {
                    const item = inventory.find((entry) => inventoryId(entry) === event.target.value);
                    updateIngredient(index, { itemId: event.target.value, unit: item?.unit || "" });
                  }}>
                    {inventory.map((item) => <MenuItem key={inventoryId(item)} value={inventoryId(item)}>{item.name} ({item.unit})</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField required type="number" label={`Amount used${ingredient.unit ? ` (${ingredient.unit})` : ""}`} value={ingredient.quantity} onChange={(event) => updateIngredient(index, { quantity: event.target.value })} slotProps={{ htmlInput: { min: 0.001, step: "any" } }} />
                <FormControl required disabled={!ingredient.itemId}>
                  <InputLabel id={`recipe-unit-label-${index}`}>Recipe unit</InputLabel>
                  <Select labelId={`recipe-unit-label-${index}`} label="Recipe unit" value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value })}>
                    {recipeUnitsForStockUnit(inventory.find((item) => inventoryId(item) === ingredient.itemId)?.unit).map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                  </Select>
                </FormControl>
                <Tooltip title="Remove ingredient">
                  <span><IconButton aria-label={`Remove ingredient ${index + 1}`} color="error" onClick={() => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, rowIndex) => rowIndex !== index) }))}><DeleteOutlineRoundedIcon /></IconButton></span>
                </Tooltip>
              </Box>
            ))}
            <Button startIcon={<AddRoundedIcon />} onClick={() => setRecipeForm((current) => ({ ...current, ingredients: [...current.ingredients, { itemId: "", quantity: "", unit: "" }] }))}>Add ingredient</Button>
          </DialogContent>
          <DialogActions>
            <Button disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={saving} type="submit" variant="contained" color="secondary">{saving ? "Saving…" : "Save recipe"}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}