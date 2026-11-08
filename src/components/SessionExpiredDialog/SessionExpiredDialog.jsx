import { useSyncExternalStore } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { logoutAdmin } from "../../services/authService";
import {
  getSessionExpirySnapshot,
  dismissSessionExpiry,
  subscribeToSessionExpiry,
} from "../../utils/sessionExpiryStore";
import "./SessionExpiredDialog.css";

const LOGIN_PATH = "/sfh/login";

export default function SessionExpiredDialog() {
  const open = useSyncExternalStore(
    subscribeToSessionExpiry,
    getSessionExpirySnapshot,
    getSessionExpirySnapshot
  );

  function handleLogin() {
    logoutAdmin();
    window.history.replaceState({}, "", LOGIN_PATH);
    dismissSessionExpiry();
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <Dialog
      className="session-expired-dialog"
      open={open}
      onClose={() => {}}
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-message"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="session-expired-title">Session Expired</DialogTitle>
      <DialogContent>
        <Typography id="session-expired-message">
          Your session has expired. Please log in again to continue.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={handleLogin} autoFocus>
          Login
        </Button>
      </DialogActions>
    </Dialog>
  );
}
