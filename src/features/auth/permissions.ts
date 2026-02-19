import type { UserRole } from "@/types";

// ─── Permission union type ────────────────────────────────────────────────────

export type Permission =
  | "dashboard:view"
  | "inventory:view"
  | "inventory:edit"
  | "sales:view"
  | "sales:create"
  | "customers:view"
  | "customers:edit"
  | "suppliers:view"
  | "reports:view"
  | "users:manage"
  | "settings:manage";

// ─── Role → Permission mapping ────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "dashboard:view",
    "inventory:view",
    "inventory:edit",
    "sales:view",
    "sales:create",
    "customers:view",
    "customers:edit",
    "suppliers:view",
    "reports:view",
    "users:manage",
    "settings:manage",
  ],
  pharmacist: [
    "dashboard:view",
    "inventory:view",
    "inventory:edit",
    "sales:view",
    "sales:create",
    "customers:view",
    "customers:edit",
    "suppliers:view",
    "reports:view",
  ],
  cashier: [
    "dashboard:view",
    "sales:view",
    "sales:create",
    "customers:view",
  ],
};

// ─── Helper functions ─────────────────────────────────────────────────────────

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

// ─── Route → Permission mapping ───────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/": "dashboard:view",
  "/inventory/*": "inventory:view",
  "/sales/*": "sales:view",
  "/customers": "customers:view",
  "/suppliers": "suppliers:view",
  "/reports/*": "reports:view",
  "/users": "users:manage",
  "/settings": "settings:manage",
};

// ─── Sidebar label → Permission mapping ──────────────────────────────────────

export const SIDEBAR_PERMISSIONS: Record<string, Permission> = {
  Dashboard: "dashboard:view",
  Inventory: "inventory:view",
  Sales: "sales:view",
  Customers: "customers:view",
  Suppliers: "suppliers:view",
  Reports: "reports:view",
  Users: "users:manage",
  Settings: "settings:manage",
};
