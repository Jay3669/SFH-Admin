import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { loginAdmin, requestPasswordReset, resetPassword } from "../../services/authService";
import logo from "../../assets/branding/shf-logo.png";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await loginAdmin({ identifier, password });
      onLogin(user);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Unable to sign in. Check your details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setForgotBusy(true);

    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotMessage("If an account exists for this email, reset instructions will be sent.");
    } catch (requestError) {
      setForgotError(requestError.message || "Unable to request a password reset.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleSetPassword(event) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetBusy(true);
    try {
      await resetPassword(resetToken, newPassword);
      setResetMessage("Password reset successfully. You can now sign in.");
      window.history.replaceState({}, "", "/sfh/login");
    } catch (requestError) {
      setResetError(requestError.message || "Unable to reset the password.");
    } finally {
      setResetBusy(false);
      }
  }

  return (
    <Box className="login-page">
      <Box className="login-page__image" aria-hidden="true" />
      <Box className="login-page__shade" aria-hidden="true" />
      <Box className="login-page__content">
        <Box className="login-brand">
          <img className="login-brand__logo" src={logo} alt="Surya Food Hub logo" />
          <Typography className="login-brand__caption">A TASTE OF SUNSHINE</Typography>
          <Typography className="login-brand__name">Surya Food Hub</Typography>
          <Box className="login-brand__divider" />
          <Typography component="h1" className="login-brand__welcome">
            Welcome back
          </Typography>
          <Typography className="login-brand__message">
            Sign in to manage your restaurant.
          </Typography>
          <Typography className="login-brand__description">
            Fresh ingredients, heartfelt hospitality, and flavors worth coming
            back for — all in one place.
          </Typography>
          <Box className="login-brand__signature">
            <span />
            Made with warmth. Served with joy.
          </Box>
        </Box>

        <Box className="login-card">
          <Box className="login-card__heading">
            <Typography className="login-card__eyebrow">ADMIN PORTAL</Typography>
            <Typography component="h2" className="login-card__title">
              Sign in to your account
            </Typography>
            <Typography className="login-card__description">
              Enter your details to continue.
            </Typography>
          </Box>
          <Box className="login-card__feedback" aria-live="polite">
            {error && (
              <Alert severity="error" className="login-card__alert">
                {error}
              </Alert>
            )}
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box className="login-card__fields">
              <Box className="login-card__field-group">
                <Typography className="login-card__field-label">
                  Email or mobile number
                </Typography>
                <TextField
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Email address or mobile number"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  fullWidth
                  slotProps={{
                    htmlInput: { "aria-label": "Email or mobile number" },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
              <Box className="login-card__field-group">
                <Typography className="login-card__field-label">
                  Password
                </Typography>
                <TextField
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  slotProps={{
                    htmlInput: { "aria-label": "Password" },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((visible) => !visible)}
                            edge="end"
                          >
                            {showPassword ? (
                              <VisibilityOffRoundedIcon fontSize="small" />
                            ) : (
                              <VisibilityRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
              <Box className="login-card__options">
                <Button
                  type="button"
                  className="login-card__text-button"
                  onClick={() => {
                    setForgotEmail(identifier);
                    setForgotError("");
                    setForgotMessage("");
                    setForgotOpen(true);
                  }}
                >
                  Forgot password?
                </Button>
              </Box>
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                disabled={isSubmitting || !identifier.trim() || !password}
                endIcon={
                  isSubmitting ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <ArrowForwardRoundedIcon />
                  )
                }
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </Box>
          </Box>
          <Typography className="login-card__security">
            Secure access to your restaurant workspace
          </Typography>
        </Box>
        <Typography className="login-page__footer">
          © {new Date().getFullYear()} Surya Food Hub
        </Typography>
      </Box>

      <Dialog
        open={Boolean(resetToken)}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleSetPassword}>
          <DialogTitle>Choose a new password</DialogTitle>
          <DialogContent>
            <Box className="login-card__reset-fields">
              {resetMessage && <Alert severity="success">{resetMessage}</Alert>}
              {resetError && <Alert severity="error">{resetError}</Alert>}
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                inputProps={{ minLength: 8 }}
                required
                fullWidth
              />
              <TextField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                inputProps={{ minLength: 8 }}
                required
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button type="submit" variant="contained" color="secondary" disabled={resetBusy || newPassword.length < 8}>
              {resetBusy ? <CircularProgress size={16} color="inherit" /> : "Reset password"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={forgotOpen}
        onClose={() => !forgotBusy && setForgotOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handlePasswordReset}>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogContent>
            <Box className="login-card__reset-fields">
              <Typography color="text.secondary" variant="body2">
                Enter your account email and we’ll send password reset instructions.
              </Typography>
              {forgotMessage && <Alert severity="success">{forgotMessage}</Alert>}
              {forgotError && <Alert severity="error">{forgotError}</Alert>}
              <TextField
                label="Email address"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                required
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setForgotOpen(false)} disabled={forgotBusy}>
              Close
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={forgotBusy || !forgotEmail.trim()}
              endIcon={
                forgotBusy ? <CircularProgress size={16} color="inherit" /> : null
              }
            >
              Send instructions
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}