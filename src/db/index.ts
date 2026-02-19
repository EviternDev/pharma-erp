import Database from '@tauri-apps/plugin-sql';

const DB_PATH = 'sqlite:pharmacare.db';

let db: Database | null = null;

/**
 * Get a singleton Database connection.
 * First call triggers async connection; subsequent calls return cached instance.
 */
export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load(DB_PATH);
  }
  return db;
}

/**
 * Close the database connection.
 * Useful for cleanup or before backup operations.
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
