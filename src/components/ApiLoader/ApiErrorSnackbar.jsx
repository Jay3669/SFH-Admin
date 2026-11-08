import { Alert, Snackbar } from "@mui/material";
import { useSyncExternalStore } from "react";
import {
  dismissApiError,
  getApiErrorsSnapshot,
  subscribeToApiErrors,
} from "../../utils/apiErrorStore";

export default function ApiErrorSnackbar() {
  const errors = useSyncExternalStore(
    subscribeToApiErrors,
    getApiErrorsSnapshot,
    getApiErrorsSnapshot
  );
  const currentError = errors[0];

  return (
    <Snackbar
      key={currentError?.id || "api-error"}
      open={Boolean(currentError)}
      autoHideDuration={6000}
      onClose={dismissApiError}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{ zIndex: 1700 }}
    >
      <Alert onClose={dismissApiError} severity="error" variant="filled">
        {currentError?.message}
      </Alert>
    </Snackbar>
  );
}
