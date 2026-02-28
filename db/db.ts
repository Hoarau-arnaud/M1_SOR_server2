import { DatabaseSync, SQLOutputValue } from "node:sqlite";
import type {
  Poll,
  PollOption,
  Vote,
  PollRow,
  PollOptionRow,
  VoteRow,
  UserRow,
} from "../model/interfaces.ts";

// ---------- Database -----------------------------------

export const db = new DatabaseSync("polls.db");

// ---------- Type guards (SQLite -> Row types) ----------

export function isPollRow(obj: Record<string, SQLOutputValue>): obj is PollRow {
  return !!obj &&
    typeof obj === "object" &&
    "id" in obj && typeof obj.id === "string" &&
    "title" in obj && typeof obj.title === "string" &&
    "description" in obj &&
    (typeof obj.description === "string" || obj.description === null) &&
    "user_id" in obj &&
    (typeof obj.user_id === "string" || obj.user_id === null) &&
    "created_at" in obj && typeof obj.created_at === "string" &&
    "expires_at" in obj &&
    (typeof obj.expires_at === "string" || obj.expires_at === null) &&
    "is_active" in obj && typeof obj.is_active === "number" &&
    "restricted_to_auth" in obj && typeof obj.restricted_to_auth === "number";
}

export function isPollOptionRow(
  obj: Record<string, SQLOutputValue>,
): obj is PollOptionRow {
  return !!obj &&
    typeof obj === "object" &&
    "id" in obj && typeof obj.id === "string" &&
    "poll_id" in obj && typeof obj.poll_id === "string" &&
    "text" in obj && typeof obj.text === "string" &&
    "vote_count" in obj && typeof obj.vote_count === "number";
}

export function isVoteRow(obj: Record<string, SQLOutputValue>): obj is VoteRow {
  return !!obj &&
    typeof obj === "object" &&
    "id" in obj && typeof obj.id === "string" &&
    "poll_id" in obj && typeof obj.poll_id === "string" &&
    "option_id" in obj && typeof obj.option_id === "string" &&
    "user_id" in obj &&
    (typeof obj.user_id === "string" || obj.user_id === null) &&
    "created_at" in obj && typeof obj.created_at === "string";
}

// ---------- Users (type guard) -------------------------

export function isUserRow(obj: Record<string, SQLOutputValue>): obj is UserRow {
  return !!obj &&
    typeof obj === "object" &&
    "id" in obj && typeof obj.id === "string" &&
    "username" in obj && typeof obj.username === "string" &&
    "password_hash" in obj && typeof obj.password_hash === "string" &&
    "is_admin" in obj && typeof obj.is_admin === "number" &&
    "created_at" in obj && typeof obj.created_at === "string";
}

// ---------- Conversions Row <-> API (helpers) ----------

export function pollOptionRowToApi(row: PollOptionRow): PollOption {
  return { id: row.id, text: row.text, voteCount: row.vote_count };
}

export function pollRowToApi(row: PollRow, optionRows: PollOptionRow[]): Poll {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
    isActive: row.is_active === 1,
    restrictedToAuth: row.restricted_to_auth === 1,
    options: optionRows.map(pollOptionRowToApi),
  };
}

export function voteRowToApi(row: VoteRow): Vote {
  return {
    id: row.id,
    pollId: row.poll_id,
    optionId: row.option_id,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
  };
}