import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import type { User } from "@/types";
import { getUsers, updateUser } from "@/db/queries/users";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import UserFormDialog from "./UserFormDialog";

function capitalizeRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreateDialog() {
    setEditingUser(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  async function handleToggleActive(user: User) {
    setTogglingId(user.id);
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      toast.success(
        user.isActive
          ? `${user.fullName} has been deactivated`
          : `${user.fullName} has been activated`
      );
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update user status");
    } finally {
      setTogglingId(null);
    }
  }

  const isCurrentUser = (u: User) => currentUser?.id === u.id;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            User Management
          </h1>
          <p className="text-slate-600 mt-1">
            Manage user accounts and roles
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <PlusIcon className="size-4" />
          Add User
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading users…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-muted-foreground text-sm">No users found.</p>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              Create the first user
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-sm text-slate-700">
                    {u.username}
                    {isCurrentUser(u) && (
                      <span className="ml-2 text-xs text-muted-foreground font-sans">
                        (you)
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="font-medium">{u.fullName}</TableCell>

                  <TableCell>
                    <span className="text-sm text-slate-700">
                      {capitalizeRole(u.role)}
                    </span>
                  </TableCell>

                  <TableCell>
                    {u.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(u)}
                        title="Edit user"
                      >
                        <PencilIcon className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      {!isCurrentUser(u) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggleActive(u)}
                          disabled={togglingId === u.id}
                          title={u.isActive ? "Deactivate user" : "Activate user"}
                          className={
                            u.isActive
                              ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          }
                        >
                          {u.isActive ? (
                            <UserXIcon className="size-4" />
                          ) : (
                            <UserCheckIcon className="size-4" />
                          )}
                          <span className="sr-only">
                            {u.isActive ? "Deactivate" : "Activate"}
                          </span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        onSaved={fetchUsers}
      />
    </div>
  );
}
