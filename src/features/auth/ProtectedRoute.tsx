import { Navigate, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { hasPermission, type Permission } from "@/features/auth/permissions";

interface ProtectedRouteProps {
  permission: Permission;
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(user.role, permission)) {
    toast.error("You don't have access to this section");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
