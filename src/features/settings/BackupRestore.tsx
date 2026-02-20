import { useState } from "react";
import { toast } from "sonner";
import {
  DownloadIcon,
  UploadIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const LAST_BACKUP_KEY = "lastBackupTime";
const DB_FILENAME = "pharmacy.db";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function generateBackupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `pharmacy_backup_${date}_${time}.db`;
}

export default function BackupRestore() {
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(
    () => localStorage.getItem(LAST_BACKUP_KEY),
  );

  const handleBackup = async () => {
    try {
      setBackingUp(true);

      const dataDir = await appDataDir();
      const dbPath = await join(dataDir, DB_FILENAME);

      const destPath = await save({
        title: "Save Backup",
        defaultPath: generateBackupFilename(),
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
      });

      if (!destPath) return; // user cancelled

      await copyFile(dbPath, destPath);

      const now = new Date().toISOString();
      localStorage.setItem(LAST_BACKUP_KEY, now);
      setLastBackup(now);

      toast.success(`Backup saved to ${destPath}`);
    } catch (err) {
      console.error("Backup failed:", err);
      toast.error("Failed to create backup. Please try again.");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoreDialogOpen(false);

    try {
      setRestoring(true);

      const selectedPath = await open({
        title: "Select Backup File",
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
        multiple: false,
      });

      if (!selectedPath) return; // user cancelled

      const dataDir = await appDataDir();
      const dbPath = await join(dataDir, DB_FILENAME);

      await copyFile(selectedPath, dbPath);

      toast.success(
        "Backup restored successfully. Please restart the application to complete the restore.",
        { duration: 10000 },
      );
    } catch (err) {
      console.error("Restore failed:", err);
      toast.error("Failed to restore backup. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup &amp; Restore</CardTitle>
        <p className="text-sm text-slate-600">
          Create a backup of your database or restore from a previous backup
          file.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Backup Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Create Backup
          </h3>
          <p className="text-sm text-slate-500">
            Save a copy of the current database to your chosen location.
          </p>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              onClick={handleBackup}
              disabled={backingUp || restoring}
            >
              <DownloadIcon className="mr-2 size-4" />
              {backingUp ? "Creating Backup..." : "Create Backup"}
            </Button>
            {lastBackup && (
              <span className="text-sm text-slate-500">
                Last backup: {formatTimestamp(lastBackup)}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* Restore Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Restore from Backup
          </h3>
          <p className="text-sm text-slate-500">
            Replace the current database with a previously saved backup file.
          </p>

          <Dialog
            open={restoreDialogOpen}
            onOpenChange={setRestoreDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={backingUp || restoring}
              >
                <UploadIcon className="mr-2 size-4" />
                {restoring ? "Restoring..." : "Restore Backup"}
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-5 text-amber-500" />
                  Confirm Restore
                </DialogTitle>
                <DialogDescription>
                  This will replace ALL current data with the backup. This
                  cannot be undone. Are you sure?
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRestore}
                >
                  Yes, Restore
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
