const STORAGE_KEY = "sfhTeamPermissions";

export const TEAM_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "menu", label: "Menu management" },
  { key: "inventory", label: "Inventory & stock" },
  { key: "billing", label: "Billing & POS" },
  { key: "reports", label: "Purchases & sales" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "Settings" },
];

export const TEAM_ACTIONS = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "export", label: "Export" },
  { key: "manage", label: "Manage access" },
];

function permissionsFor(grants) {
  return Object.fromEntries(TEAM_PAGES.map(({ key }) => [
    key,
    TEAM_ACTIONS.reduce((actions, { key: action }) => ({
      ...actions,
      [action]: Boolean(grants[key]?.includes(action)),
    }), {}),
  ]));
}

export const DEFAULT_TEAM_MEMBERS = [
  {
    id: "team-maya",
    name: "Maya Shah",
    email: "maya.shah@example.com",
    role: "Manager",
    permissions: permissionsFor({
      dashboard: ["view"],
      menu: ["view", "create", "edit"],
      inventory: ["view", "create", "edit"],
      billing: ["view", "create"],
      reports: ["view", "export"],
      notifications: ["view"],
      settings: ["view"],
    }),
  },
  {
    id: "team-arjun",
    name: "Arjun Patel",
    email: "arjun.patel@example.com",
    role: "Cashier",
    permissions: permissionsFor({
      dashboard: ["view"],
      billing: ["view", "create"],
      notifications: ["view"],
    }),
  },
  {
    id: "team-priya",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    role: "Inventory staff",
    permissions: permissionsFor({
      dashboard: ["view"],
      inventory: ["view", "create", "edit"],
      notifications: ["view"],
    }),
  },
];

export function permissionsForRole(role) {
  const member = DEFAULT_TEAM_MEMBERS.find((candidate) => candidate.role === role);
  return member
    ? JSON.parse(JSON.stringify(member.permissions))
    : permissionsFor({});
}

export function loadTeamMembers() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_TEAM_MEMBERS));

  const members = JSON.parse(saved);
  if (!Array.isArray(members) || members.some((member) => (
    !member
    || typeof member.id !== "string"
    || typeof member.name !== "string"
    || typeof member.email !== "string"
    || typeof member.role !== "string"
    || !member.permissions
    || typeof member.permissions !== "object"
  ))) {
    throw new Error("Saved team permissions have an invalid format.");
  }
  return members;
}

export function saveTeamMembers(members) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}
