import { db } from "../db/db.ts";
import { APIErrorCode, type AuthResponse, type User, type UserRow } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";
import { createJWT, hashPassword, verifyPassword } from "../lib/jwt.ts";

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  };
}

export function findUserByUsername(username: string): UserRow | null {
  const row = db.prepare(
    `SELECT id, username, password_hash, is_admin, created_at
     FROM users WHERE username = ?;`,
  ).get(username) as UserRow | undefined;

  return row ?? null;
}

export function findUserById(id: string): UserRow | null {
  const row = db.prepare(
    `SELECT id, username, password_hash, is_admin, created_at
     FROM users WHERE id = ?;`,
  ).get(id) as UserRow | undefined;

  return row ?? null;
}

export async function registerUser(username: string, password: string, isAdmin = false): Promise<User> {
  const existing = findUserByUsername(username);
  if (existing) {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Username already exists");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, username, password_hash, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?);`,
  ).run(id, username, passwordHash, isAdmin ? 1 : 0, createdAt);

  return { id, username, isAdmin, createdAt };
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  const row = findUserByUsername(username);
  if (!row) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Invalid credentials");
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Invalid credentials");
  }

  const user = rowToUser(row);

  const token = await createJWT({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  });

  return { token, user };
}

// Exemple de "me": infos user + stats simples
export function getMe(userId: string) {
  const userRow = findUserById(userId);
  if (!userRow) {
    throw new APIException(APIErrorCode.NOT_FOUND, 404, "User not found");
  }

  const polls = db.prepare(
    `SELECT id, title, description, user_id, created_at, expires_at, is_active
     FROM polls WHERE user_id = ?
     ORDER BY created_at DESC;`,
  ).all(userId) as Array<Record<string, unknown>>;

  const votesCountRow = db.prepare(
    `SELECT COUNT(*) AS c FROM votes WHERE user_id = ?;`,
  ).get(userId) as { c: number } | undefined;

  return {
    user: rowToUser(userRow),
    polls,
    votesCount: votesCountRow?.c ?? 0,
  };
}