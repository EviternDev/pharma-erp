import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import type { User } from "@/types";
import {
  getUserByUsername,
  getUserById,
  getUserCount,
} from "@/db/queries/users";

const STORAGE_KEY = "pharmacare_user_id";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isFirstLaunch: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Called by FirstLaunchWizard after it creates + auto-logs-in the admin */
  setUser: (user: User) => void;
  /** Re-check first-launch state after wizard creates the first user */
  refreshFirstLaunch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const navigate = useNavigate();

  const refreshFirstLaunch = useCallback(async () => {
    const count = await getUserCount();
    setIsFirstLaunch(count === 0);
  }, []);

  // On mount: restore session from localStorage + check first-launch
  useEffect(() => {
    async function init() {
      try {
        // First-launch check
        const count = await getUserCount();
        if (count === 0) {
          setIsFirstLaunch(true);
          setIsLoading(false);
          return;
        }

        // Session restore
        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId) {
          const id = parseInt(storedId, 10);
          if (!isNaN(id)) {
            const found = await getUserById(id);
            if (found && found.isActive) {
              setUserState(found);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      } catch {
        void 0; // DB might not be ready yet in tests; silently ignore
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const found = await getUserByUsername(username);

      if (!found) {
        throw new Error("Invalid username or password");
      }

      if (!found.isActive) {
        throw new Error("Account is disabled");
      }

      const valid = await bcrypt.compare(password, found.passwordHash);
      if (!valid) {
        throw new Error("Invalid username or password");
      }

      localStorage.setItem(STORAGE_KEY, String(found.id));
      setUserState(found);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
    navigate("/login");
  }, [navigate]);

  const setUser = useCallback((u: User) => {
    localStorage.setItem(STORAGE_KEY, String(u.id));
    setUserState(u);
    setIsFirstLaunch(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isFirstLaunch,
        login,
        logout,
        setUser,
        refreshFirstLaunch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
