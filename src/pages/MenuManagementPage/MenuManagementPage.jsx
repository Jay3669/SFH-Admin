import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import FastfoodRoundedIcon from "@mui/icons-material/FastfoodRounded";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ConfirmationDialog from "../../components/ConfirmationDialog/ConfirmationDialog";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import nonVegetarianIcon from "../../assets/images/nonveg.png";
import vegetarianIcon from "../../assets/images/veg.png";
import { EditActionButton, DeleteActionButton } from "../../components/ActionButtons/ActionButtons";
import {
    createMenuCategory,
    createMenuItem,
    deleteMenuCategory,
    deleteMenuItem,
    getMenuCategory,
    getMenuItem,
    listMenuCategories,
    listMenuItems,
    updateMenuCategory,
    updateMenuItem,
} from "../../services/menuService";
import "./MenuManagementPage.css";

const EMPTY_ITEM = {
    name: "",
    categoryId: "",
    description: "",
    price: "",
    imageUrl: "",
    isVegetarian: true,
    isAvailable: true,
};

const EMPTY_CATEGORY = {
    name: "",
    description: "",
    displayOrder: "",
    isActive: true,
};

const EMPTY_MENU_FILTERS = {
    search: "",
    foodType: "",
    isAvailable: "",
    sort: "",
};

function capitalizeInitialCharacter(value) {
    const firstCharacterIndex = value.search(/\S/);
    if (firstCharacterIndex === -1) return value;
    return value.slice(0, firstCharacterIndex) +
        value.charAt(firstCharacterIndex).toUpperCase() +
        value.slice(firstCharacterIndex + 1);
}

function normalizeCategory(category) {
    const id = category?.category_id ?? category?.id;
    const name = category?.category_name ?? category?.name;
    if (id == null || !name) {
        throw new Error("The server returned a category with missing details.");
    }
    return {
        id: String(id),
        name: String(name),
        description: category.description || "",
        displayOrder: Number(category.display_order) || 0,
        isActive: category.is_active !== false,
    };
}

function normalizeItem(item) {
    const id = item?.menu_item_id ?? item?.id;
    const name = item?.name;
    if (id == null || !name) {
        throw new Error("The server returned a menu item with missing details.");
    }
    return {
        id: String(id),
        name: String(name),
        categoryId: String(item.category_id ?? item.category?.category_id ?? ""),
        description: item.description || "",
        price: String(item.price ?? ""),
        imageUrl: item.image_url || "",
        isVegetarian: String(item.food_type || "").toLowerCase() === "veg",
        isAvailable: item.is_available !== false,
    };
}

function getErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}

function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount)
        : value;
}

export default function MenuManagementPage() {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeTab, setActiveTab] = useState("items");
    const [menuFilters, setMenuFilters] = useState(EMPTY_MENU_FILTERS);
    const [itemDialogOpen, setItemDialogOpen] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [categoryToEdit, setCategoryToEdit] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [itemForm, setItemForm] = useState(EMPTY_ITEM);
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
    const [formError, setFormError] = useState("");
    const [notice, setNotice] = useState("");
    const [noticeSeverity, setNoticeSeverity] = useState("success");
    const [savingItem, setSavingItem] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [updatingItemId, setUpdatingItemId] = useState(null);
    const menuLoadRequestId = useRef(0);
    const itemFilterRequestId = useRef(0);

    const loadMenu = useCallback(async (filters = EMPTY_MENU_FILTERS) => {
        const requestId = ++menuLoadRequestId.current;
        const filterRequestAtStart = itemFilterRequestId.current;
        setLoading(true);
        setLoadError("");
        try {
            const [categoryData, itemData] = await Promise.all([
                listMenuCategories(),
                listMenuItems(filters),
            ]);
            if (requestId === menuLoadRequestId.current) {
                setCategories(categoryData.map(normalizeCategory));
                if (filterRequestAtStart === itemFilterRequestId.current) {
                    setItems(itemData.map(normalizeItem));
                }
            }
        } catch (error) {
            if (requestId === menuLoadRequestId.current) {
                setLoadError(getErrorMessage(error, "Unable to load menu data."));
            }
        } finally {
            if (requestId === menuLoadRequestId.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMenu(EMPTY_MENU_FILTERS);
    }, [loadMenu]);

    const initialMenuFilters = useRef(menuFilters);
    useEffect(() => {
        if (menuFilters === initialMenuFilters.current) return undefined;

        const requestId = ++itemFilterRequestId.current;
        const timeoutId = setTimeout(async () => {
            try {
                const itemData = await listMenuItems(menuFilters);
                if (requestId === itemFilterRequestId.current) {
                    setItems(itemData.map(normalizeItem));
                    setLoadError("");
                }
            } catch (error) {
                if (requestId === itemFilterRequestId.current) {
                    showNotice(getErrorMessage(error, "Unable to filter menu items."), "error");
                }
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [menuFilters]);

    function showNotice(message, severity = "success") {
        setNoticeSeverity(severity);
        setNotice(message);
    }

    const visibleItems = useMemo(() => {
        const query = menuFilters.search.trim().toLowerCase();
        return items.filter((item) => {
            const matchesCategory =
                activeCategory === "all" || item.categoryId === activeCategory;
            const matchesSearch =
                !query ||
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query);
            const matchesFoodType =
                !menuFilters.foodType ||
                (menuFilters.foodType === "veg" ? item.isVegetarian : !item.isVegetarian);
            const matchesAvailability =
                menuFilters.isAvailable === "" ||
                String(item.isAvailable) === menuFilters.isAvailable;
            return matchesCategory && matchesSearch && matchesFoodType && matchesAvailability;
        }).sort((first, second) => {
            if (menuFilters.sort === "price_asc") {
                return Number(first.price) - Number(second.price);
            }
            if (menuFilters.sort === "price_desc") {
                return Number(second.price) - Number(first.price);
            }
            return 0;
        });
    }, [activeCategory, items, menuFilters]);

    const hasAppliedFilters = Boolean(
        menuFilters.search || menuFilters.foodType || menuFilters.isAvailable ||
        menuFilters.sort
    );
    const hasMenuFilters = hasAppliedFilters || activeCategory !== "all";

    function resetMenuFilters() {
        setMenuFilters({ ...EMPTY_MENU_FILTERS });
        setActiveCategory("all");
    }

    const availableCount = items.filter((item) => item.isAvailable).length;

    function openNewItem() {
        setItemToEdit(null);
        setItemForm({ ...EMPTY_ITEM, categoryId: categories[0]?.id || "" });
        setFormError("");
        setItemDialogOpen(true);
    }

    async function openEditItem(item) {
        setFormError("");
        try {
            const latestItem = normalizeItem(await getMenuItem(item.id));
            setItemToEdit(latestItem);
            setItemForm({ ...latestItem });
            setItemDialogOpen(true);
        } catch (error) {
            showNotice(getErrorMessage(error, "Unable to load this menu item."), "error");
        }
    }

    async function saveItem(event) {
        event.preventDefault();
        const price = Number(itemForm.price);
        if (!itemForm.name.trim() || !itemForm.categoryId || !itemForm.price) {
            setFormError("Add an item name, category, and price to continue.");
            return;
        }
        if (!Number.isFinite(price) || price <= 0) {
            setFormError("Enter a valid price greater than zero.");
            return;
        }

        const payload = {
            category_id: itemForm.categoryId,
            name: itemForm.name.trim(),
            description: itemForm.description.trim(),
            price: String(price),
            food_type: itemForm.isVegetarian ? "Veg" : "Non-Veg",
            image_url: itemForm.imageUrl.trim(),
        };
        setSavingItem(true);
        setFormError("");
        try {
            const savedItem = normalizeItem(
                itemToEdit
                    ? await updateMenuItem(itemToEdit.id, {
                        ...payload,
                        is_available: itemForm.isAvailable,
                    })
                    : await createMenuItem(payload)
            );
            setItems((current) =>
                itemToEdit
                    ? current.map((item) => item.id === itemToEdit.id ? savedItem : item)
                    : [savedItem, ...current]
            );
            setItemDialogOpen(false);
            showNotice(itemToEdit ? "Menu item updated." : "Menu item added.");
        } catch (error) {
            setFormError(getErrorMessage(error, "Unable to save the menu item."));
        } finally {
            setSavingItem(false);
        }
    }

    function openNewCategory() {
        setCategoryToEdit(null);
        setCategoryForm({
            ...EMPTY_CATEGORY,
            displayOrder: String(
                Math.max(0, ...categories.map((category) => category.displayOrder)) + 1
            ),
        });
        setFormError("");
        setCategoryDialogOpen(true);
    }

    async function openEditCategory(category) {
        setFormError("");
        try {
            const latestCategory = normalizeCategory(await getMenuCategory(category.id));
            setCategoryToEdit(latestCategory);
            setCategoryForm({
                name: latestCategory.name,
                description: latestCategory.description,
                displayOrder: String(latestCategory.displayOrder),
                isActive: latestCategory.isActive,
            });
            setCategoryDialogOpen(true);
        } catch (error) {
            showNotice(getErrorMessage(error, "Unable to load this category."), "error");
        }
    }

    async function saveCategory(event) {
        event.preventDefault();
        const name = categoryForm.name.trim();
        if (!name) {
            setFormError("Enter a category name.");
            return;
        }
        if (
            categories.some(
                (category) =>
                    category.name.toLowerCase() === name.toLowerCase() &&
                    category.id !== categoryToEdit?.id
            )
        ) {
            setFormError("A category with this name already exists.");
            return;
        }

        const payload = {
            category_name: name,
            description: categoryForm.description.trim(),
            display_order: Number(categoryForm.displayOrder) ||
                Math.max(0, ...categories.map((category) => category.displayOrder)) + 1,
            is_active: categoryForm.isActive,
        };
        setSavingCategory(true);
        setFormError("");
        try {
            const savedCategory = normalizeCategory(
                categoryToEdit
                    ? await updateMenuCategory(categoryToEdit.id, payload)
                    : await createMenuCategory(payload)
            );
            setCategories((current) =>
                categoryToEdit
                    ? current.map((category) => category.id === categoryToEdit.id ? savedCategory : category)
                    : [...current, savedCategory].sort(
                        (first, second) => first.displayOrder - second.displayOrder
                    )
            );
            setCategoryDialogOpen(false);
            showNotice(categoryToEdit ? "Category updated." : "Category created.");
        } catch (error) {
            setFormError(getErrorMessage(error, "Unable to save the category."));
        } finally {
            setSavingCategory(false);
        }
    }

    async function deleteItem() {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            await deleteMenuItem(itemToDelete.id);
            setItems((current) => current.filter((item) => item.id !== itemToDelete.id));
            setItemToDelete(null);
            showNotice("Menu item deleted.");
        } catch (error) {
            showNotice(getErrorMessage(error, "Unable to delete the menu item."), "error");
        } finally {
            setDeleting(false);
        }
    }

    async function deleteCategory() {
        if (!categoryToDelete) return;
        setDeleting(true);
        try {
            await deleteMenuCategory(categoryToDelete.id);
            setItems((current) =>
                current.filter((item) => item.categoryId !== categoryToDelete.id)
            );
            setCategories((current) =>
                current.filter((category) => category.id !== categoryToDelete.id)
            );
            if (activeCategory === categoryToDelete.id) setActiveCategory("all");
            setCategoryToDelete(null);
            showNotice("Category deleted.");
        } catch (error) {
            showNotice(getErrorMessage(error, "Unable to delete the category."), "error");
        } finally {
            setDeleting(false);
        }
    }

    async function toggleAvailability(item) {
        setUpdatingItemId(item.id);
        try {
            const updatedItem = normalizeItem(await updateMenuItem(item.id, {
                category_id: item.categoryId,
                name: item.name,
                description: item.description,
                price: item.price,
                food_type: item.isVegetarian ? "Veg" : "Non-Veg",
                image_url: item.imageUrl,
                is_available: !item.isAvailable,
            }));
            setItems((current) =>
                current.map((currentItem) =>
                    currentItem.id === item.id ? updatedItem : currentItem
                )
            );
        } catch (error) {
            showNotice(getErrorMessage(error, "Unable to update item availability."), "error");
        } finally {
            setUpdatingItemId(null);
        }
    }

    return (
        <Box className="menu-management app-content-width">
            <Box className="menu-management__intro">
                <Box>
                    <Typography className="menu-management__eyebrow">
                        MENU MANAGEMENT
                    </Typography>
                    <Typography component="h1" className="menu-management__title">
                        Menu management
                    </Typography>
                    <Typography className="menu-management__description">
                        Organize categories and keep your menu fresh and up to date.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AddRoundedIcon />}
                    onClick={openNewItem}
                    disabled={!categories.length}
                >
                    Add menu item
                </Button>
            </Box>

            <Box className="menu-management__summary">
                <Card className="menu-summary-card" elevation={0}>
                    <Box className="menu-summary-card__icon is-orange">
                        <FastfoodRoundedIcon />
                    </Box>
                    <Box>
                        <Typography className="menu-summary-card__value">{items.length}</Typography>
                        <Typography className="menu-summary-card__label">Menu items</Typography>
                    </Box>
                </Card>
                <Card className="menu-summary-card" elevation={0}>
                    <Box className="menu-summary-card__icon is-green">
                        <Inventory2OutlinedIcon />
                    </Box>
                    <Box>
                        <Typography className="menu-summary-card__value">{availableCount}</Typography>
                        <Typography className="menu-summary-card__label">Available today</Typography>
                    </Box>
                </Card>
                <Card className="menu-summary-card" elevation={0}>
                    <Box className="menu-summary-card__icon is-gold">
                        <CategoryRoundedIcon />
                    </Box>
                    <Box>
                        <Typography className="menu-summary-card__value">{categories.length}</Typography>
                        <Typography className="menu-summary-card__label">Categories</Typography>
                    </Box>
                </Card>
            </Box>

            {loading ? null : loadError ? (
                <Alert
                    severity="error"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={<RefreshRoundedIcon />}
                            onClick={() => loadMenu(menuFilters)}
                        >
                            Retry
                        </Button>
                    }
                >
                    Menu data could not be loaded.
                </Alert>
            ) : (
                <>
                    <Tabs
                        className="menu-management__tabs"
                        value={activeTab}
                        onChange={(_, value) => setActiveTab(value)}
                        aria-label="Menu management sections"
                    >
                        <Tab value="items" label="Menu items" />
                        <Tab value="categories" label={`Categories (${categories.length})`} />
                    </Tabs>

            {activeTab === "items" ? (
                <>
                    <Box className="menu-management__toolbar">
                        <Box className="menu-management__menu-heading">
                            <Typography component="h2">Your menu</Typography>
                            <Typography variant="body2">
                                {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
                                {activeCategory !== "all"
                                    ? ` in ${categories.find((category) => category.id === activeCategory)?.name || "category"}`
                                    : ""}
                            </Typography>
                        </Box>
                        <TextField
                            className="menu-management__search"
                            size="small"
                            placeholder="Search menu..."
                            value={menuFilters.search}
                            onChange={(event) => setMenuFilters((current) => ({
                                ...current,
                                search: event.target.value,
                            }))}
                            slotProps={{
                                htmlInput: { "aria-label": "Search menu items" },
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRoundedIcon />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                        <FormControl className="menu-management__filter" size="small">
                            <InputLabel id="menu-category-filter-label">Category</InputLabel>
                            <Select
                                labelId="menu-category-filter-label"
                                label="Category"
                                value={activeCategory}
                                onChange={(event) => setActiveCategory(event.target.value)}
                            >
                                <MenuItem value="all">All categories</MenuItem>
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl className="menu-management__filter" size="small">
                            <InputLabel id="menu-food-type-filter-label">Food type</InputLabel>
                            <Select
                                labelId="menu-food-type-filter-label"
                                label="Food type"
                                value={menuFilters.foodType}
                                onChange={(event) => setMenuFilters((current) => ({
                                    ...current,
                                    foodType: event.target.value,
                                }))}
                            >
                                <MenuItem value="">All types</MenuItem>
                                <MenuItem value="veg">Vegetarian</MenuItem>
                                <MenuItem value="nonveg">Non-vegetarian</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl className="menu-management__filter" size="small">
                            <InputLabel id="menu-availability-filter-label">Availability</InputLabel>
                            <Select
                                labelId="menu-availability-filter-label"
                                label="Availability"
                                value={menuFilters.isAvailable}
                                onChange={(event) => setMenuFilters((current) => ({
                                    ...current,
                                    isAvailable: event.target.value,
                                }))}
                            >
                                <MenuItem value="">Any status</MenuItem>
                                <MenuItem value="true">Available</MenuItem>
                                <MenuItem value="false">Unavailable</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl className="menu-management__filter menu-management__sort" size="small">
                            <InputLabel id="menu-sort-filter-label">Sort by</InputLabel>
                            <Select
                                labelId="menu-sort-filter-label"
                                label="Sort by"
                                value={menuFilters.sort}
                                onChange={(event) => setMenuFilters((current) => ({
                                    ...current,
                                    sort: event.target.value,
                                }))}
                            >
                                <MenuItem value="">Default</MenuItem>
                                <MenuItem value="price_asc">Price: low to high</MenuItem>
                                <MenuItem value="price_desc">Price: high to low</MenuItem>
                            </Select>
                        </FormControl>
                        <Tooltip title="Reset menu filters">
                            <span>
                                <IconButton
                                    className="menu-management__reset"
                                    aria-label="Reset menu filters"
                                    onClick={resetMenuFilters}
                                    disabled={!hasMenuFilters}
                                >
                                    <RestartAltRoundedIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>

                    {visibleItems.length ? (
                        <Box className="menu-item-grid">
                            {visibleItems.map((item) => {
                                const category = categories.find(
                                    (entry) => entry.id === item.categoryId
                                );
                                return (
                                    <Card className="menu-item-card" key={item.id} elevation={0}>
                                        <Box className="menu-item-card__image">
                                            {item.imageUrl ? (
                                                <img
                                                    className="menu-item-card__photo"
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                />
                                            ) : (
                                                <Avatar className="menu-item-card__placeholder">
                                                    <FastfoodRoundedIcon />
                                                </Avatar>
                                            )}
                                            <Chip
                                                className={`menu-item-card__availability ${item.isAvailable ? "is-available" : "is-unavailable"
                                                    }`}
                                                label={item.isAvailable ? "Available" : "Unavailable"}
                                                size="small"
                                            />
                                            <Box className="menu-item-card__image-details">
                                                <Box className="menu-item-card__image-heading">
                                                    <Box className="menu-item-card__name-wrap">
                                                        <span
                                                            className={`menu-item-card__diet ${item.isVegetarian ? "is-veg" : "is-nonveg"
                                                                }`}
                                                            aria-label={item.isVegetarian ? "Vegetarian" : "Non-vegetarian"}
                                                            role="img"
                                                        >
                                                            <img
                                                                src={item.isVegetarian ? vegetarianIcon : nonVegetarianIcon}
                                                                alt=""
                                                            />
                                                        </span>
                                                        <Typography
                                                            component="h3"
                                                            className="menu-item-card__name"
                                                        >
                                                            {item.name}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        className="menu-item-card__category"
                                                        label={category?.name || "Uncategorized"}
                                                        size="small"
                                                    />
                                                </Box>
                                                <Box className="menu-item-card__image-meta">
                                                    <Typography className="menu-item-card__image-description">
                                                        {item.description || "No description added yet."}
                                                    </Typography>
                                                    <Typography className="menu-item-card__image-price">
                                                        {formatPrice(item.price)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <CardContent className="menu-item-card__content">
                                            <Box className="menu-item-card__footer">
                                                <Box className="menu-item-card__availability-control">
                                                    <Switch
                                                        checked={item.isAvailable}
                                                        onChange={() => toggleAvailability(item)}
                                                        size="small"
                                                        disabled={updatingItemId === item.id}
                                                        slotProps={{
                                                            input: { "aria-label": `Availability for ${item.name}` },
                                                        }}
                                                    />
                                                    <Typography>Available</Typography>
                                                </Box>
                                                <Box className="menu-item-card__actions">
                                                    <EditActionButton tooltip={`Edit ${item.name}`} aria-label={`Edit ${item.name}`} onClick={() => openEditItem(item)} />
                                                    <DeleteActionButton tooltip={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={() => setItemToDelete(item)} />
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Box>
                    ) : (
                        <Card className="menu-empty-state" elevation={0}>
                            <Box className="menu-empty-state__icon">
                                {categories.length ? <ImageOutlinedIcon /> : <CategoryRoundedIcon />}
                            </Box>
                            <Typography component="h2">
                                {hasAppliedFilters
                                    ? "No matching menu items"
                                    : categories.length
                                        ? "No menu items in this category"
                                        : "Start with a menu category"}
                            </Typography>
                            <Typography>
                                {hasAppliedFilters
                                    ? "Try another search term or choose a different category."
                                    : categories.length
                                        ? "Add a menu item to get this category started."
                                        : "Create a category first, then add dishes to build your menu."}
                            </Typography>
                            {!hasAppliedFilters && categories.length > 0 && (
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<AddRoundedIcon />}
                                    onClick={openNewItem}
                                >
                                    Add menu item
                                </Button>
                            )}
                            {!hasAppliedFilters && categories.length === 0 && (
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<AddRoundedIcon />}
                                    onClick={openNewCategory}
                                >
                                    Create category
                                </Button>
                            )}
                        </Card>
                    )}
                </>
            ) : (
                <Box className="category-management">
                    <Box className="menu-management__section-heading">
                        <Box>
                            <Typography component="h2">Menu categories</Typography>
                            <Typography variant="body2">
                                Organize dishes into clear sections and keep your menu easy to browse.
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AddRoundedIcon />}
                            onClick={openNewCategory}
                        >
                            Add category
                        </Button>
                    </Box>
                    {categories.length ? (
                        <Box className="category-management__grid">
                            {categories.map((category) => {
                                const count = items.filter(
                                    (item) => item.categoryId === category.id
                                ).length;
                                return (
                                    <Card
                                        className="category-management__card"
                                        key={category.id}
                                        elevation={0}
                                    >
                                        <CardContent>
                                            <Box className="category-management__card-heading">
                                                <Box className="category-management__icon">
                                                    <CategoryRoundedIcon />
                                                </Box>
                                                <Box className="category-management__badges">
                                                    <Chip
                                                        label={`${count} ${count === 1 ? "item" : "items"}`}
                                                        size="small"
                                                    />
                                                    <Chip
                                                        className={category.isActive ? "is-active" : "is-inactive"}
                                                        label={category.isActive ? "Active" : "Inactive"}
                                                        size="small"
                                                    />
                                                </Box>
                                            </Box>
                                            <Typography
                                                component="h3"
                                                className="category-management__name"
                                            >
                                                {category.name}
                                            </Typography>
                                            <Typography className="category-management__description">
                                                {category.description || (count
                                                    ? `${count} menu ${count === 1 ? "item" : "items"} in this category`
                                                    : "No menu items in this category yet")}
                                            </Typography>
                                            <Box className="category-management__actions">
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    aria-label={`View items in ${category.name}`}
                                                    startIcon={<VisibilityOutlinedIcon />}
                                                    onClick={() => {
                                                        setActiveCategory(category.id);
                                                        setMenuFilters((current) => ({
                                                            ...current,
                                                            search: "",
                                                        }));
                                                        setActiveTab("items");
                                                    }}
                                                >
                                                    View items
                                                </Button>
                                                <EditActionButton tooltip={`Edit ${category.name}`} aria-label={`Edit ${category.name}`} onClick={() => openEditCategory(category)} />
                                                <DeleteActionButton tooltip={`Delete ${category.name}`} aria-label={`Delete ${category.name}`} onClick={() => setCategoryToDelete(category)} />
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Box>
                    ) : (
                        <Card className="category-management__empty" elevation={0}>
                            <Box className="menu-empty-state__icon">
                                <CategoryRoundedIcon />
                            </Box>
                            <Typography component="h3">No categories yet</Typography>
                            <Typography>
                                Create a category to start organizing your menu.
                            </Typography>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<AddRoundedIcon />}
                                onClick={openNewCategory}
                            >
                                Add category
                            </Button>
                        </Card>
                    )}
                </Box>
            )}
                </>
            )}

            <Dialog
                open={itemDialogOpen}
                onClose={() => setItemDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <Box component="form" onSubmit={saveItem}>
                    <DialogTitle>
                        {itemToEdit ? "Edit menu item" : "Add a menu item"}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Typography color="text.secondary" variant="body2">
                                Add the details customers need to discover your dish.
                            </Typography>
                            {formError && <Alert severity="error">{formError}</Alert>}
                            <TextField
                                autoFocus
                                label="Item name"
                                placeholder="e.g. Paneer Tikka"
                                value={itemForm.name}
                                onChange={(event) =>
                                    setItemForm((current) => ({
                                        ...current,
                                        name: capitalizeInitialCharacter(event.target.value),
                                    }))
                                }
                                required
                                fullWidth
                            />
                            <Box className="menu-item-form__row">
                                <FormControl fullWidth required>
                                    <InputLabel id="menu-item-category-label">Category</InputLabel>
                                    <Select
                                        labelId="menu-item-category-label"
                                        label="Category"
                                        value={itemForm.categoryId}
                                        onChange={(event) =>
                                            setItemForm((current) => ({
                                                ...current,
                                                categoryId: event.target.value,
                                            }))
                                        }
                                    >
                                        {categories.map((category) => (
                                            <MenuItem value={category.id} key={category.id}>
                                                {category.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Price (₹)"
                                    type="number"
                                    value={itemForm.price}
                                    onChange={(event) =>
                                        setItemForm((current) => ({ ...current, price: event.target.value }))
                                    }
                                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                                    required
                                    fullWidth
                                />
                            </Box>
                            <TextField
                                label="Description"
                                placeholder="Describe the dish, ingredients, or flavor."
                                value={itemForm.description}
                                onChange={(event) =>
                                    setItemForm((current) => ({
                                        ...current,
                                        description: capitalizeInitialCharacter(event.target.value),
                                    }))
                                }
                                multiline
                                minRows={3}
                                fullWidth
                            />
                            <TextField
                                label="Image URL"
                                placeholder="https://example.com/dish.jpg"
                                value={itemForm.imageUrl}
                                onChange={(event) =>
                                    setItemForm((current) => ({ ...current, imageUrl: event.target.value }))
                                }
                                fullWidth
                            />
                            <Box className="menu-item-form__options">
                                <Box>
                                    <Typography fontWeight={700}>Vegetarian</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Mark this item as vegetarian.
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={itemForm.isVegetarian}
                                    onChange={(event) =>
                                        setItemForm((current) => ({
                                            ...current,
                                            isVegetarian: event.target.checked,
                                        }))
                                    }
                                    slotProps={{ input: { "aria-label": "Vegetarian item" } }}
                                />
                            </Box>
                            {itemToEdit && (
                                <Box className="menu-item-form__options">
                                    <Box>
                                        <Typography fontWeight={700}>Available</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Show this item as available on the menu.
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={itemForm.isAvailable}
                                        onChange={(event) =>
                                            setItemForm((current) => ({
                                                ...current,
                                                isAvailable: event.target.checked,
                                            }))
                                        }
                                        slotProps={{ input: { "aria-label": "Item available" } }}
                                    />
                                </Box>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={() => setItemDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="secondary" disabled={savingItem}>
                            {savingItem ? "Saving..." : itemToEdit ? "Save changes" : "Add item"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog
                open={categoryDialogOpen}
                onClose={() => setCategoryDialogOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <Box component="form" onSubmit={saveCategory}>
                    <DialogTitle>
                        {categoryToEdit ? "Edit category" : "Create a category"}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Typography color="text.secondary" variant="body2">
                                Use a clear name to help organize your menu.
                            </Typography>
                            {formError && <Alert severity="error">{formError}</Alert>}
                            <TextField
                                autoFocus
                                label="Category name"
                                placeholder="e.g. Soups"
                                value={categoryForm.name}
                                onChange={(event) => setCategoryForm((current) => ({
                                    ...current,
                                    name: capitalizeInitialCharacter(event.target.value),
                                }))}
                                required
                                fullWidth
                            />
                            <TextField
                                label="Description"
                                value={categoryForm.description}
                                onChange={(event) => setCategoryForm((current) => ({
                                    ...current,
                                    description: capitalizeInitialCharacter(event.target.value),
                                }))}
                                multiline
                                minRows={2}
                                fullWidth
                            />
                            <TextField
                                label="Display order"
                                type="number"
                                value={categoryForm.displayOrder}
                                onChange={(event) => setCategoryForm((current) => ({
                                    ...current,
                                    displayOrder: event.target.value,
                                }))}
                                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                                required
                                fullWidth
                            />
                            <Box className="menu-item-form__options">
                                <Box>
                                    <Typography fontWeight={700}>Active category</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Keep this category available on the menu.
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={categoryForm.isActive}
                                    onChange={(event) => setCategoryForm((current) => ({
                                        ...current,
                                        isActive: event.target.checked,
                                    }))}
                                    slotProps={{ input: { "aria-label": "Category active" } }}
                                />
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="secondary" disabled={savingCategory}>
                            {savingCategory ? "Saving..." : categoryToEdit ? "Save changes" : "Create category"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            <ConfirmationDialog
                open={Boolean(itemToDelete)}
                title="Delete this menu item?"
                message={<Typography color="text.secondary">
                        “{itemToDelete?.name}” will be removed from this menu.
                    </Typography>}
                confirmLabel={deleting ? "Deleting..." : "Delete item"}
                destructive
                icon={<DeleteOutlineRoundedIcon />}
                onCancel={() => setItemToDelete(null)}
                onConfirm={deleteItem}
            />

            <ConfirmationDialog
                open={Boolean(categoryToDelete)}
                title="Delete this category?"
                message={<Typography color="text.secondary">
                        “{categoryToDelete?.name}” will be removed from your categories.
                    </Typography>}
                confirmLabel={deleting ? "Deleting..." : "Delete category"}
                destructive
                icon={<DeleteOutlineRoundedIcon />}
                onCancel={() => setCategoryToDelete(null)}
                onConfirm={deleteCategory}
            />

            <Alert
                className="menu-management__notice"
                severity={noticeSeverity}
                onClose={() => setNotice("")}
                sx={{ display: notice ? "flex" : "none" }}
            >
                {notice}
            </Alert>
        </Box>
    );
}
