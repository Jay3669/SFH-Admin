import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import "./ProfilePage.css";

export default function ProfilePage({ user, themeMode, onThemeChange }) {
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || "Administrator",
    email: user?.email || "admin@suryafoodhub.com",
    phone: user?.phone || "",
    role: user?.role || "Admin",
  });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");

  function saveProfile() {
    if (!profile.name.trim()) return;
    window.localStorage.setItem("sfhAdminProfile", JSON.stringify(profile));
    setEditing(false);
    setSaved(true);
  }

  function changePassword() {
    if (!passwords.current || passwords.next.length < 8 || passwords.next !== passwords.confirm) {
      setPasswordError("Use an 8-character new password and make sure both passwords match.");
      return;
    }
    setPasswordOpen(false);
    setPasswordError("");
    setPasswords({ current: "", next: "", confirm: "" });
    setSaved(true);
  }

  const initials = profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Box className="profile-page app-content-width">
      <Box className="profile-page__heading">
        <Box><Typography className="profile-page__eyebrow">ACCOUNT</Typography><Typography component="h1">My profile</Typography><Typography>Manage your personal details and portal preferences.</Typography></Box>
      </Box>
      {saved && <Alert severity="success" onClose={() => setSaved(false)}>Profile preferences updated.</Alert>}
      <Box className="profile-page__layout">
        <Card className="profile-summary" elevation={0}>
          <Avatar>{initials}</Avatar>
          <Typography component="h2">{profile.name}</Typography>
          <Typography>{profile.role}</Typography>
          <Divider />
          <Button startIcon={<LockRoundedIcon />} variant="outlined" onClick={() => setPasswordOpen(true)}>Change password</Button>
        </Card>
        <Box className="profile-content">
          <Card className="profile-card" elevation={0}>
            <Box className="profile-card__heading"><Box><PersonRoundedIcon fontSize="medium" /><Box><Typography component="h2">Personal information</Typography><Typography>Your details used across the admin portal.</Typography></Box></Box><IconButton aria-label={editing ? "Cancel profile editing" : "Edit profile"} title={editing ? "Cancel profile editing" : "Edit profile"} onClick={() => setEditing((value) => !value)}>{editing ? null : <EditRoundedIcon />}</IconButton></Box>
            <Box className="profile-fields">
              <TextField label="Full name" value={profile.name} disabled={!editing} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
              <TextField label="Email address" type="email" value={profile.email} disabled={!editing} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
              <TextField label="Phone number" value={profile.phone} disabled={!editing} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
              <TextField label="Role" value={profile.role} disabled />
            </Box>
            {editing && <Box className="profile-card__actions"><Button onClick={() => setEditing(false)}>Cancel</Button><Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={saveProfile}>Save changes</Button></Box>}
          </Card>
          <Card className="profile-card" elevation={0}>
            <Box className="profile-card__heading"><Box><DarkModeRoundedIcon fontSize="medium" /><Box><Typography component="h2">Appearance</Typography><Typography>Choose the display theme for this portal.</Typography></Box></Box></Box>
            <Box className="profile-theme-row"><Box><Typography>Dark theme</Typography><Typography>Use the premium navy and gold night palette.</Typography></Box><Switch checked={themeMode === "dark"} slotProps={{ input: { "aria-label": "Dark theme" } }} onChange={(event) => onThemeChange(event.target.checked ? "dark" : "light")} /></Box>
          </Card>
        </Box>
      </Box>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Change password</DialogTitle>
        <DialogContent className="profile-password-dialog">
          <TextField type="password" label="Current password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
          <TextField type="password" label="New password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
          <TextField type="password" label="Confirm new password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
          {passwordError && <Alert severity="error">{passwordError}</Alert>}
        </DialogContent>
        <DialogActions><Button onClick={() => setPasswordOpen(false)}>Cancel</Button><Button variant="contained" onClick={changePassword}>Update password</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
