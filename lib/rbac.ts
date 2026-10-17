export const STAFF_ROLES = ["support", "operations", "administrator", "security_admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "customers.read",
  "customers.note",
  "customers.status",
  "customers.update",
  "accounts.read",
  "accounts.status",
  "cards.read",
  "cards.status",
  "transactions.read",
  "transactions.operate",
  "transactions.reverse.request",
  "transactions.reverse.approve",
  "billers.manage",
  "requests.manage",
  "users.manage",
  "users.role.approve",
  "reports.read",
  "reports.export",
  "audit.read",
  "audit.own",
  "settings.manage",
  "settings.security",
  "announcements.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const matrix: Record<StaffRole, Permission[]> = {
  support: [
    "customers.read",
    "customers.note",
    "accounts.read",
    "cards.read",
    "transactions.read",
    "requests.manage",
    "audit.own",
  ],
  operations: [
    "customers.read",
    "customers.note",
    "accounts.read",
    "accounts.status",
    "cards.read",
    "cards.status",
    "transactions.read",
    "transactions.operate",
    "transactions.reverse.request",
    "requests.manage",
    "reports.read",
    "reports.export",
    "audit.own",
  ],
  administrator: [
    "customers.read",
    "customers.note",
    "customers.status",
    "customers.update",
    "accounts.read",
    "accounts.status",
    "cards.read",
    "cards.status",
    "transactions.read",
    "transactions.reverse.approve",
    "billers.manage",
    "requests.manage",
    "users.manage",
    "users.role.approve",
    "reports.read",
    "reports.export",
    "audit.read",
    "settings.manage",
    "announcements.manage",
  ],
  security_admin: [
    "customers.read",
    "transactions.read",
    "users.role.approve",
    "reports.read",
    "reports.export",
    "audit.read",
    "settings.security",
  ],
};

export function permissionsFor(role: StaffRole) {
  return matrix[role];
}

export function can(role: string, permission: Permission) {
  if (!STAFF_ROLES.includes(role as StaffRole)) return false;
  return matrix[role as StaffRole].includes(permission);
}

export function seesBalances(role: string) {
  return role === "operations" || role === "administrator";
}
