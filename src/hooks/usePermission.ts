import { useAuth } from "@/features/auth/AuthContext";
import { hasPermission, type Permission } from "@/features/auth/permissions";

export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();

  if (!user) {
    return false;
  }

  return hasPermission(user.role, permission);
}
