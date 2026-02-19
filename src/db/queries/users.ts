import { getDb } from '../index';
import { toCamelCase, toBool } from '../utils';
import type { User, UserRole } from '@/types';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow): User {
  return {
    ...toCamelCase<User>(row),
    isActive: toBool(row.is_active),
    role: row.role as UserRole,
  };
}

export async function getUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(mapUserRow);
}

export async function getActiveUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>('SELECT * FROM users WHERE is_active = 1 ORDER BY full_name');
  return rows.map(mapUserRow);
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>('SELECT * FROM users WHERE id = $1', [id]);
  return rows.length > 0 ? mapUserRow(rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>('SELECT * FROM users WHERE username = $1', [username]);
  return rows.length > 0 ? mapUserRow(rows[0]) : null;
}

export async function createUser(
  username: string,
  passwordHash: string,
  fullName: string,
  role: UserRole
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
    [username, passwordHash, fullName, role]
  );
  return result.lastInsertId ?? 0;
}

export async function updateUser(
  id: number,
  data: { fullName?: string; role?: UserRole; isActive?: boolean; passwordHash?: string }
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.fullName !== undefined) {
    setClauses.push(`full_name = $${paramIdx++}`);
    values.push(data.fullName);
  }
  if (data.role !== undefined) {
    setClauses.push(`role = $${paramIdx++}`);
    values.push(data.role);
  }
  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIdx++}`);
    values.push(data.isActive ? 1 : 0);
  }
  if (data.passwordHash !== undefined) {
    setClauses.push(`password_hash = $${paramIdx++}`);
    values.push(data.passwordHash);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.execute(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM users');
  return rows[0]?.count ?? 0;
}
