import { createTheme } from "@mui/material/styles";

export const BRAND_COLORS = {
  navy: "#131627",
  navySecondary: "#23283B",
  gold: "#FCA930",
  lightGold: "#FDE081",
  orange: "#F47B20",
  green: "#5BAE3B",
  ivory: "#F5F3ED",
};

export const COMPONENT_SIZES = {
  small: { height: 32, fontSize: 13, iconSize: 16, horizontalPadding: 10 },
  medium: { height: 40, fontSize: 14, iconSize: 18, horizontalPadding: 14 },
  large: { height: 48, fontSize: 16, iconSize: 20, horizontalPadding: 18 },
};

export function createAppTheme(mode = "light") {
  const dark = mode === "dark";
  return createTheme({
  breakpoints: {
    values: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1440, xxl: 1920 },
  },
  palette: {
    mode,
    primary: { main: dark ? "#FCA930" : "#E99522", contrastText: "#131627" },
    secondary: { main: "#F47B20", contrastText: "#FFFFFF" },
    success: { main: "#5BAE3B" },
    warning: { main: "#F47B20" },
    error: { main: "#DC4545" },
    background: { default: dark ? "#131627" : "#F5F3ED", paper: dark ? "#23283B" : "#FFFFFF" },
    text: { primary: dark ? "#FFFFFF" : "#202437", secondary: dark ? "#C5C7D0" : "#646875" },
    divider: dark ? "#404858" : "#E5E1D8",
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
    h1: { fontWeight: 800, letterSpacing: "-0.04em" },
    h2: { fontWeight: 750, letterSpacing: "-0.035em" },
    h3: { fontWeight: 700, letterSpacing: "-0.025em" },
    button: { fontWeight: 700, textTransform: "none" },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: dark ? "#131627" : "#F5F3ED" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minWidth: 40,
          height: COMPONENT_SIZES.medium.height,
          minHeight: COMPONENT_SIZES.medium.height,
          paddingInline: COMPONENT_SIZES.medium.horizontalPadding,
          borderRadius: 10,
          fontSize: COMPONENT_SIZES.medium.fontSize,
          fontWeight: 700,
          boxShadow: "none",
          "&.MuiButton-sizeSmall": { height: COMPONENT_SIZES.small.height, minHeight: COMPONENT_SIZES.small.height, fontSize: COMPONENT_SIZES.small.fontSize, paddingInline: COMPONENT_SIZES.small.horizontalPadding },
          "&.MuiButton-sizeLarge": { height: COMPONENT_SIZES.large.height, minHeight: COMPONENT_SIZES.large.height, fontSize: COMPONENT_SIZES.large.fontSize, paddingInline: COMPONENT_SIZES.large.horizontalPadding },
          "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize },
          "& .MuiButton-startIcon": { display: "inline-flex", marginInline: "0 0", "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize } },
          "& .MuiButton-endIcon": { display: "inline-flex", marginInline: "0 0", "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize } },
          "&.MuiButton-sizeSmall .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.small.iconSize },
          "&.MuiButton-sizeLarge .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.large.iconSize },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #FDE081 0%, #FCA930 55%, #F47B20 100%)",
          color: "#131627",
          "&:hover": { background: "linear-gradient(135deg, #FCA930 0%, #F47B20 100%)", boxShadow: "0 8px 18px rgba(244,123,32,.22)" },
        },
        containedSecondary: {
          background: "#F47B20",
          color: "#FFFFFF",
        },
        outlined: { borderColor: "#FCA930", color: dark ? "#FDE081" : "#B86A08" },
        text: { color: dark ? "#FDE081" : "#C06C0A" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          width: COMPONENT_SIZES.medium.height,
          height: COMPONENT_SIZES.medium.height,
          padding: 10,
          borderRadius: 10,
          color: dark ? "#FDE081" : "#404858",
          "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize },
          "&.MuiIconButton-sizeSmall": { width: COMPONENT_SIZES.small.height, height: COMPONENT_SIZES.small.height, padding: 8, "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.small.iconSize } },
          "&.MuiIconButton-sizeLarge": { width: COMPONENT_SIZES.large.height, height: COMPONENT_SIZES.large.height, padding: 14, "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.large.iconSize } },
          "&:hover": { backgroundColor: dark ? "rgba(252,169,48,.12)" : "#FFF4D7" },
        },
      },
    },
    MuiAppBar: { styleOverrides: { root: { background: "linear-gradient(135deg, #404858 0%, #131627 100%)" } } },
    MuiToolbar: { styleOverrides: { root: { minHeight: 64, paddingInline: 24 } } },
    MuiDrawer: { styleOverrides: { paper: { background: "#191C2C", color: "#F5F3ED" } } },
    MuiDialog: { styleOverrides: { paper: { margin: 16, maxHeight: "calc(100% - 32px)", borderRadius: 16, backgroundImage: "none" } } },
    MuiDialogTitle: { styleOverrides: { root: { minHeight: 64, padding: "16px 24px 12px", color: dark ? "#FFFFFF" : "#202437", fontSize: 18, fontWeight: 800 } } },
    MuiDialogContent: { styleOverrides: { root: { padding: "12px 24px", fontSize: COMPONENT_SIZES.medium.fontSize } } },
    MuiDialogActions: { styleOverrides: { root: { minHeight: 64, gap: 8, padding: "12px 24px 16px" } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 40 }, indicator: { height: 3, borderRadius: 3, background: "linear-gradient(90deg, #FDE081, #FCA930)" }, flexContainer: { minHeight: 40 } } },
    MuiTab: {
      styleOverrides: {
        root: {
          minWidth: 40,
          height: 46,
          minHeight: 46,
          padding: "8px 14px",
          flexDirection: "row",
          fontSize: COMPONENT_SIZES.medium.fontSize,
          fontWeight: 700,
          textTransform: "none",
          "& .MuiTab-iconWrapper": { display: "inline-flex", alignItems: "center", marginBottom: "0 !important", marginRight: 7, "& svg": { width: 18, height: 18, fontSize: 18 } },
          "& .MuiSvgIcon-root": { width: 18, height: 18, fontSize: 18 },
          "&.Mui-selected": { color: dark ? "#FDE081 !important" : "#B86A08 !important" },
        },
      },
    },
    MuiTableHead: { styleOverrides: { root: { backgroundColor: dark ? "#303646" : "#131627" } } },
    MuiTableRow: { styleOverrides: { root: { minHeight: 48 } } },
    MuiTableCell: { styleOverrides: { root: { height: 48, padding: "10px 16px", fontSize: 13, verticalAlign: "middle" }, head: { height: 44, color: "#FDE081", fontSize: 12, fontWeight: 800, lineHeight: 1.3 }, footer: { fontWeight: 700 } } },
    MuiChip: { styleOverrides: { root: { height: 28, maxWidth: "100%", borderRadius: 14, fontSize: 12, fontWeight: 700 }, small: { height: 24, fontSize: 11 }, label: { paddingInline: 8 }, colorPrimary: { background: "linear-gradient(135deg, #FDE081, #FCA930)", color: "#131627" } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCardHeader: { styleOverrides: { root: { minHeight: 64, padding: 16 }, title: { fontSize: 16, fontWeight: 800 }, subheader: { marginTop: 2, fontSize: 13 } } },
    MuiCardContent: { styleOverrides: { root: { padding: 16, "&:last-child": { paddingBottom: 16 } } } },
    MuiCardActions: { styleOverrides: { root: { minHeight: 56, gap: 8, padding: 16 } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 40, borderRadius: 10 } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 40, fontSize: 14 } } },
    MuiAccordion: { styleOverrides: { root: { borderRadius: 12, backgroundImage: "none", "&:before": { display: "none" } } } },
    MuiAccordionSummary: { styleOverrides: { root: { minHeight: 48, paddingInline: 16, "&.Mui-expanded": { minHeight: 48 } }, content: { marginBlock: 12, "&.Mui-expanded": { marginBlock: 12 } } } },
    MuiAvatar: { styleOverrides: { root: { width: 40, height: 40, fontSize: 14, fontWeight: 800 }, small: { width: 32, height: 32, fontSize: 13 }, large: { width: 48, height: 48, fontSize: 16 } } },
    MuiBadge: { styleOverrides: { badge: { minWidth: 18, height: 18, padding: "0 5px", fontSize: 11 } } },
    MuiAlert: { styleOverrides: { root: { minHeight: 40, borderRadius: 10, alignItems: "center", fontSize: 14 }, icon: { padding: 0 }, message: { paddingBlock: 4 } } },
    MuiSnackbarContent: { styleOverrides: { root: { minHeight: 48, borderRadius: 10, fontSize: 14 } } },
    MuiFab: { styleOverrides: { root: { width: 48, height: 48, boxShadow: "0 8px 24px rgba(19,22,39,.18)" }, sizeSmall: { width: 40, height: 40 }, sizeMedium: { width: 48, height: 48 } } },
    MuiPaginationItem: { styleOverrides: { root: { minWidth: 40, height: 40, marginInline: 2, fontSize: 14 }, rounded: { borderRadius: 10 } } },
    MuiBottomNavigationAction: { styleOverrides: { root: { minWidth: 64, paddingInline: 12, fontSize: 12 } } },
    MuiFormControl: { styleOverrides: { root: { minWidth: 0 } } },
    MuiFormLabel: { styleOverrides: { root: { marginBottom: 6, fontSize: 13, fontWeight: 700, lineHeight: 1.4 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14, "&.MuiInputLabel-sizeSmall": { fontSize: 13 } } } },
    MuiFormHelperText: { styleOverrides: { root: { marginTop: 5, fontSize: 12, lineHeight: 1.35 } } },
    MuiInputAdornment: { styleOverrides: { root: { maxHeight: 40, fontSize: 14 } } },
    MuiInputBase: {
      styleOverrides: {
        root: { minHeight: COMPONENT_SIZES.medium.height, borderRadius: 10, fontSize: COMPONENT_SIZES.medium.fontSize },
        input: { height: "auto", padding: "10px 14px", fontSize: COMPONENT_SIZES.medium.fontSize, lineHeight: 1.4, "&::placeholder": { opacity: 0.68 } },
        inputSizeSmall: { padding: "6px 10px", fontSize: COMPONENT_SIZES.small.fontSize },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: COMPONENT_SIZES.medium.height,
          backgroundColor: dark ? "#303646" : "#FFFFFF",
          borderRadius: 12,
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#FCA930" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#FCA930", borderWidth: 2 },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: "#D93636" },
        },
        input: { height: "auto", padding: "10px 14px", fontSize: COMPONENT_SIZES.medium.fontSize, lineHeight: 1.4 },
        sizeSmall: { minHeight: COMPONENT_SIZES.small.height, "& .MuiOutlinedInput-input": { padding: "6px 10px", fontSize: COMPONENT_SIZES.small.fontSize } },
      },
    },
    MuiSelect: { styleOverrides: { select: { minHeight: "auto", display: "flex", alignItems: "center", padding: "10px 14px", fontSize: COMPONENT_SIZES.medium.fontSize }, outlined: { "&.MuiInputBase-inputSizeSmall": { padding: "6px 10px" } } } },
    MuiFilledInput: { styleOverrides: { root: { minHeight: COMPONENT_SIZES.medium.height, borderRadius: 10 }, input: { padding: "10px 14px" }, sizeSmall: { minHeight: COMPONENT_SIZES.small.height } } },
    MuiCheckbox: { styleOverrides: { root: { width: COMPONENT_SIZES.medium.height, height: COMPONENT_SIZES.medium.height, padding: 10, "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize } } } },
    MuiRadio: { styleOverrides: { root: { width: COMPONENT_SIZES.medium.height, height: COMPONENT_SIZES.medium.height, padding: 10, "& .MuiSvgIcon-root": { fontSize: COMPONENT_SIZES.medium.iconSize } } } },
    MuiSwitch: {
      styleOverrides: {
        root: { width: 48, height: 32, padding: 7, verticalAlign: "middle" },
        switchBase: {
          padding: 8,
          color: dark ? "#CDD2DF" : "#FFFFFF",
          "&.Mui-checked": {
            color: "#FFFFFF",
            transform: "translateX(16px)",
            "& + .MuiSwitch-track": {
              background: "linear-gradient(135deg, #FDE081 0%, #FCA930 55%, #F47B20 100%)",
              opacity: 1,
              borderColor: "transparent",
            },
          },
          "&.Mui-focusVisible": {
            boxShadow: "0 0 0 3px rgba(252,169,48,.28)",
          },
        },
        thumb: {
          width: 16,
          height: 16,
          boxShadow: "0 1px 4px rgba(19,22,39,.28)",
        },
        track: {
          borderRadius: 8,
          backgroundColor: dark ? "#596174" : "#B9BECA",
          opacity: 1,
        },
      },
    },
    MuiList: { styleOverrides: { root: { paddingBlock: 8 } } },
    MuiListItem: { styleOverrides: { root: { minHeight: 40 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: dark ? "#404858" : "#E5E1D8" } } },
    MuiTooltip: { styleOverrides: { tooltip: { maxWidth: 320, borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.4 }, arrow: { color: dark ? "#303646" : "#202437" } } },
    MuiCard: {
      styleOverrides: {
        root: { border: `1px solid ${dark ? "#404858" : "#E5E1D8"}`, borderRadius: 14, boxShadow: dark ? "0 12px 30px rgba(0,0,0,.18)" : "0 10px 28px rgba(19,22,39,.06)" },
      },
    },
  },
  });
}

export default createAppTheme("light");
