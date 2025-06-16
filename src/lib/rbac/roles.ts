import type { Role, Permission } from "../../types";

// Role display names for UI
export const roleDisplayNames: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  CEO: "Chief Executive Officer",
  CTO: "Chief Technology Officer",
  CBO: "Chief Business Officer",
  CMO: "Chief Marketing Officer",
  CFO: "Chief Financial Officer",
  MANAGER: "Manager",
  NO_ROLE: "REMOVE ROLE",
};

// Role colors for badges
export const roleColors: Record<Role, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800 border-red-200",
  ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  CEO: "bg-blue-100 text-blue-800 border-blue-200",
  CTO: "bg-green-100 text-green-800 border-green-200",
  CBO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  CMO: "bg-pink-100 text-pink-800 border-pink-200",
  CFO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  MANAGER: "bg-gray-100 text-gray-800 border-gray-200",
  NO_ROLE: "bg-gray-100 text-gray-800 border-gray-200",
};

// Permissions for each role
export const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "VIEW_ADMIN_DASHBOARD",
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "VIEW_ANALYTICS",
    "VIEW_FINANCIALS",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "DELETE_STUDY_MATERIALS",
    "APPROVE_STUDY_MATERIALS",
    "MANAGE_CONTENT",
    "SYSTEM_SETTINGS",
  ],
  ADMIN: [
    "VIEW_ADMIN_DASHBOARD",
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "VIEW_ANALYTICS",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "DELETE_STUDY_MATERIALS",
    "APPROVE_STUDY_MATERIALS",
    "MANAGE_CONTENT",
  ],
  CEO: [
    "VIEW_ADMIN_DASHBOARD",
    "VIEW_ANALYTICS",
    "VIEW_FINANCIALS",
    "EDIT_STUDY_MATERIALS",
    "UPLOAD_STUDY_MATERIALS",
    "APPROVE_STUDY_MATERIALS",
    "SYSTEM_SETTINGS",
    "MANAGE_CONTENT",
  ],
  CTO: [
    "VIEW_ADMIN_DASHBOARD",
    "VIEW_ANALYTICS",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "APPROVE_STUDY_MATERIALS",
    "SYSTEM_SETTINGS",
  ],
  CBO: [
    "VIEW_ADMIN_DASHBOARD",
    "VIEW_ANALYTICS",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "MANAGE_CONTENT",
  ],
  CMO: [
    "VIEW_ADMIN_DASHBOARD",
    "VIEW_ANALYTICS",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "MANAGE_CONTENT",
  ],
  CFO: ["VIEW_ADMIN_DASHBOARD", "VIEW_ANALYTICS", "VIEW_FINANCIALS"],
  MANAGER: [
    "VIEW_ADMIN_DASHBOARD",
    "UPLOAD_STUDY_MATERIALS",
    "EDIT_STUDY_MATERIALS",
    "VIEW_ANALYTICS",
  ],
  NO_ROLE: [],
};

// Check if user has specific permission
export function hasPermission(
  userRoles: Role[],
  permission: Permission
): boolean {
  if (!userRoles || userRoles.length === 0) return false;

  return userRoles.some((role) => rolePermissions[role]?.includes(permission));
}

// Get all permissions for user
export function getUserPermissions(userRoles: Role[]): Permission[] {
  if (!userRoles || userRoles.length === 0) return [];

  const permissions = new Set<Permission>();
  userRoles.forEach((role) => {
    rolePermissions[role]?.forEach((permission) => {
      permissions.add(permission);
    });
  });

  return Array.from(permissions);
}

// Check if user can manage another user (based on role hierarchy)
export function canManageUser(
  managerRoles: Role[],
  targetRoles: Role[]
): boolean {
  if (!managerRoles || managerRoles.length === 0) return false;

  // Super admin can manage anyone
  if (managerRoles.includes("SUPER_ADMIN")) return true;

  // Admin can manage non-admin roles
  if (managerRoles.includes("ADMIN")) {
    return (
      !targetRoles?.includes("SUPER_ADMIN") && !targetRoles?.includes("ADMIN")
    );
  }

  return false;
}

// Get role hierarchy level (lower number = higher privilege)
export function getRoleLevel(role: Role): number {
  const hierarchy: Record<Role, number> = {
    SUPER_ADMIN: 0,
    ADMIN: 1,
    CEO: 2,
    CTO: 2,
    CFO: 2,
    CMO: 2,
    CBO: 2,
    MANAGER: 3,
    NO_ROLE: 999, // No role has the lowest privilege
  };

  return hierarchy[role] ?? 999;
}
