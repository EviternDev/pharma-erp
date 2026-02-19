import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { getDb } from './index';

interface DbContextValue {
  db: Database;
}

const DbContext = createContext<DbContextValue | null>(null);

interface DbProviderProps {
  children: ReactNode;
}

/**
 * Provides a database connection to the React component tree.
 * Shows a loading screen until the DB is ready.
 */
export function DbProvider({ children }: DbProviderProps) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((database) => {
        if (!cancelled) setDb(database);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Database Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading PharmaCare...</p>
        </div>
      </div>
    );
  }

  return (
    <DbContext.Provider value={{ db }}>
      {children}
    </DbContext.Provider>
  );
}

/**
 * Hook to access the database connection from any component.
 * Must be used within a DbProvider.
 */
export function useDb(): Database {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return ctx.db;
}
