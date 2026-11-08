import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { loadTeamMembers, permissionsForRole, saveTeamMembers, TEAM_ACTIONS, TEAM_PAGES } from "../../services/teamPermissions";

const TEAM_ROLES = ["Manager", "Cashier", "Inventory staff", "Custom"];

function getInitialTeamState() {
  try {
    return { members: loadTeamMembers(), error: "" };
  } catch {
    return { members: [], error: "Saved team data could not be read. Add a teammate to create a fresh team list." };
  }
}

function memberAccessCount(member) {
  return Object.values(member.permissions || {}).reduce(
    (total, actions) => total + Object.values(actions || {}).filter(Boolean).length,
    0
  );
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

export default function TeamPermissionsPanel() {
  const [teamState, setTeamState] = useState(getInitialTeamState);
  const [selectedId, setSelectedId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", role: "Cashier" });
  const [inviteError, setInviteError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedMember = teamState.members.find((member) => member.id === selectedId) || teamState.members[0];

  function persistMembers(members, successMessage) {
    try {
      saveTeamMembers(members);
      setTeamState({ members, error: "" });
      setNotice(successMessage);
    } catch (saveError) {
      setTeamState((current) => ({ ...current, error: saveError.message || "Unable to save team permissions." }));
    }
  }

  function updatePermission(pageKey, actionKey, allowed) {
    if (!selectedMember) return;
    const updatedMembers = teamState.members.map((member) => (
      member.id === selectedMember.id
        ? {
          ...member,
          permissions: {
            ...member.permissions,
            [pageKey]: { ...member.permissions[pageKey], [actionKey]: allowed },
          },
        }
        : member
    ));
    persistMembers(updatedMembers, "Permissions saved in this browser.");
  }

  function inviteMember(event) {
    event.preventDefault();
    setInviteError("");
    const name = invite.name.trim();
    const email = invite.email.trim().toLowerCase();
    if (!name || !email) {
      setInviteError("Enter a teammate name and email address.");
      return;
    }
    if (teamState.members.some((member) => member.email.toLowerCase() === email)) {
      setInviteError("A teammate with this email is already in the list.");
      return;
    }
    const member = {
      id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      role: invite.role,
      permissions: permissionsForRole(invite.role),
    };
    const updatedMembers = [...teamState.members, member];
    try {
      saveTeamMembers(updatedMembers);
      setTeamState({ members: updatedMembers, error: "" });
      setSelectedId(member.id);
      setNotice(`${name} added to your team. Review their access before sharing the workspace.`);
      setInvite({ name: "", email: "", role: "Cashier" });
      setInviteOpen(false);
    } catch (saveError) {
      setInviteError(saveError.message || "Unable to save the new teammate.");
    }
  }

  return (
    <Box className="settings-section team-permissions">
      <Box className="settings-section__heading team-permissions__heading">
        <Box>
          <Typography className="settings-section__kicker">WORKSPACE ACCESS</Typography>
          <Typography component="h2">Team &amp; permissions</Typography>
          <Typography>Review which pages and actions each teammate can access.</Typography>
        </Box>
        <Button type="button" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setInviteError(""); setInviteOpen(true); }}>
          Add teammate
        </Button>
      </Box>

      <Alert severity="info" icon={<AdminPanelSettingsOutlinedIcon />}>
        Demo team data is stored in this browser only. It does not create accounts or enforce access on the server.
      </Alert>
      {teamState.error && <Alert severity="error">{teamState.error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Box className="team-permissions__workspace">
        <Box className="team-permissions__roster">
          <Box className="team-permissions__roster-heading">
            <Box><Typography component="h3">My team</Typography><Typography>{teamState.members.length} teammates</Typography></Box>
            <GroupsOutlinedIcon />
          </Box>
          {teamState.members.length ? teamState.members.map((member) => (
            <Button
              key={member.id}
              className={`team-member${selectedId === member.id ? " is-active" : ""}`}
              onClick={() => { setSelectedId(member.id); setNotice(""); }}
            >
              <Avatar className="team-member__avatar">{initials(member.name)}</Avatar>
              <Box className="team-member__copy">
                <Typography component="strong">{member.name}</Typography>
                <Typography>{member.role}</Typography>
              </Box>
              <Chip label={memberAccessCount(member)} size="small" title="Granted page actions" />
            </Button>
          )) : (
            <Box className="team-permissions__roster-empty">
              <Typography>No teammates have been added.</Typography>
              <Button size="small" onClick={() => setInviteOpen(true)}>Add your first teammate</Button>
            </Box>
          )}
        </Box>

        <Box className="team-permissions__details">
          {selectedMember ? <>
            <Box className="team-member-detail">
              <Avatar className="team-member-detail__avatar">{initials(selectedMember.name)}</Avatar>
              <Box>
                <Typography component="h3">{selectedMember.name}</Typography>
                <Typography>{selectedMember.email}</Typography>
              </Box>
              <Chip label={selectedMember.role} size="small" />
            </Box>
            <Box className="team-permissions__matrix-heading">
              <Box><Typography component="h3">Page access</Typography><Typography>Turn on only the actions this teammate needs.</Typography></Box>
              <Chip label={`${memberAccessCount(selectedMember)} permissions`} size="small" />
            </Box>
            <Box className="team-permissions__table-scroll">
              <table className="team-permissions__table">
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    {TEAM_ACTIONS.map((action) => <th scope="col" key={action.key}>{action.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {TEAM_PAGES.map((page) => (
                    <tr key={page.key}>
                      <th scope="row">{page.label}</th>
                      {TEAM_ACTIONS.map((action) => {
                        const checked = Boolean(selectedMember.permissions?.[page.key]?.[action.key]);
                        return (
                          <td key={action.key}>
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={(event) => updatePermission(page.key, action.key, event.target.checked)}
                              slotProps={{ input: { "aria-label": `Grant ${action.label} access to ${page.label}` } }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </> : (
            <Box className="team-permissions__select-empty">
              <GroupsOutlinedIcon />
              <Typography component="h3">Select a teammate</Typography>
              <Typography>Add a teammate or select someone from the list to review their access.</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="xs" aria-labelledby="invite-teammate-title">
        <Box component="form" onSubmit={inviteMember}>
          <DialogTitle id="invite-teammate-title">Add a teammate</DialogTitle>
          <DialogContent className="team-invite__content">
            <Typography>Set up a sample team profile and choose a starting access level.</Typography>
            {inviteError && <Alert severity="error">{inviteError}</Alert>}
            <TextField autoFocus required label="Full name" value={invite.name} onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))} />
            <TextField required type="email" label="Email address" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} />
            <FormControl>
              <InputLabel id="team-role-label">Starting role</InputLabel>
              <Select labelId="team-role-label" label="Starting role" value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}>
                {TEAM_ROLES.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography className="team-invite__note">You can customize individual page actions after adding the teammate.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Add teammate</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
