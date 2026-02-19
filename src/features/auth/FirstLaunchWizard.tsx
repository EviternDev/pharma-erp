import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Pill, ShieldCheck } from "lucide-react";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createUser, getUserById } from "@/db/queries/users";
import { useAuth } from "./AuthContext";

export default function FirstLaunchWizard() {
  const { setUser, refreshFirstLaunch } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const username = (data.get("username") as string).trim();
    const fullName = (data.get("fullName") as string).trim();
    const password = data.get("password") as string;
    const confirmPassword = data.get("confirmPassword") as string;

    // Validation
    if (!username || !fullName || !password || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const newId = await createUser(username, passwordHash, fullName, "admin");
      const newUser = await getUserById(newId);
      if (!newUser) {
        throw new Error("Failed to retrieve created user");
      }
      await refreshFirstLaunch();
      setUser(newUser);
      toast.success(`Welcome, ${newUser.fullName}! Your admin account is ready.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create account";
      toast.error(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-100 flex items-center justify-center p-4">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#1e3a5f 1px, transparent 1px), linear-gradient(90deg, #1e3a5f 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo mark */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Pill className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">
                PharmaCare
              </h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
                ERP
              </p>
            </div>
          </div>
        </div>

        {/* Welcome badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full">
            <ShieldCheck size={15} />
            First-time setup
          </div>
        </div>

        <Card className="shadow-xl shadow-slate-200/60 border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">
              Create your admin account
            </CardTitle>
            <CardDescription>
              No users exist yet. Set up your administrator account to get
              started with PharmaCare ERP.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  placeholder="e.g. Dr. Ramesh Kumar"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. admin"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Admin Account & Continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          This setup only runs once. Additional users can be managed later.
        </p>
      </div>
    </div>
  );
}
