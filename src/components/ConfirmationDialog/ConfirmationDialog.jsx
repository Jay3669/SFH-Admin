import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

export default function ConfirmationDialog({
  open,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs" aria-labelledby="confirmation-dialog-title">
      <DialogTitle id="confirmation-dialog-title">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, pt: 1, textAlign: "center" }}>
          {icon && (
            <Avatar sx={{ width: 56, height: 56, bgcolor: destructive ? "error.light" : "primary.light", color: destructive ? "error.dark" : "primary.dark" }}>
              {icon}
            </Avatar>
          )}
          <Typography component="span" variant="h6" fontWeight={700}>{title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: "center" }}>{message}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button color={destructive ? "error" : "primary"} variant="contained" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
