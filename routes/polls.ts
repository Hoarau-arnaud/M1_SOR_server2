import { Router } from "@oak/oak";
import { db, isPollRow, isPollOptionRow, pollRowToApi } from "../db/db.ts";
import type { APIResponse, Poll } from "../model/interfaces.ts";
import { APIErrorCode } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";
import { authMiddleware, type AuthContext } from "../middleware/auth.ts";

const router = new Router({ prefix: "/polls" });

type CreatePollRequest = {
  title: string;
  description?: string;
  expiresAt?: string;
  options: { text: string }[];
  restrictedToAuth?: boolean;
};

type UpdatePollRequest = Partial<{
  title: string;
  description: string | null;
  expiresAt: string | null;
  isActive: boolean;
  restrictedToAuth: boolean;
  options: { text: string }[];
}>;

function ok<T>(data: T): APIResponse<T> {
  return { success: true, data };
}

function assertCanEdit(ctx: AuthContext, pollId: string) {
  const row = db.prepare(
    `SELECT id, user_id
     FROM polls
     WHERE id = ?;`,
  ).get(pollId) as { id: string; user_id: string | null } | undefined;

  if (!row) {
    throw new APIException(APIErrorCode.NOT_FOUND, 404, `Poll "${pollId}" not found`);
  }

  const user = ctx.state.user;
  if (!user) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Missing auth");
  }

  if (user.isAdmin) return;

  if (row.user_id && row.user_id === user.userId) return;

  throw new APIException(APIErrorCode.UNAUTHORIZED, 403, "Forbidden");
}

function validateCreateBody(body: unknown): CreatePollRequest {
  if (!body || typeof body !== "object") {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Invalid JSON body");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.title !== "string" || b.title.trim() === "") {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'title' is required");
  }
  if (!Array.isArray(b.options) || b.options.length === 0) {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'options' must be a non-empty array");
  }

  const options = b.options.map((o) => {
    if (!o || typeof o !== "object") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Invalid option");
    }
    const oo = o as Record<string, unknown>;
    if (typeof oo.text !== "string" || oo.text.trim() === "") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Each option must have a non-empty 'text'");
    }
    return { text: oo.text };
  });

  const description = typeof b.description === "string" ? b.description : undefined;
  const expiresAt = typeof b.expiresAt === "string" ? b.expiresAt : undefined;
  const restrictedToAuth = typeof b.restrictedToAuth === "boolean" ? b.restrictedToAuth : undefined;

  return { title: b.title, description, expiresAt, options, restrictedToAuth };
}

function validateUpdateBody(body: unknown): UpdatePollRequest {
  if (!body || typeof body !== "object") {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Invalid JSON body");
  }
  const b = body as Record<string, unknown>;
  const out: UpdatePollRequest = {};

  if ("title" in b) {
    if (typeof b.title !== "string" || b.title.trim() === "") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'title' must be a non-empty string");
    }
    out.title = b.title;
  }

  if ("description" in b) {
    if (b.description !== null && typeof b.description !== "string") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'description' must be string or null");
    }
    out.description = b.description as string | null;
  }

  if ("expiresAt" in b) {
    if (b.expiresAt !== null && typeof b.expiresAt !== "string") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'expiresAt' must be string or null");
    }
    out.expiresAt = b.expiresAt as string | null;
  }

  if ("isActive" in b) {
    if (typeof b.isActive !== "boolean") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'isActive' must be boolean");
    }
    out.isActive = b.isActive;
  }

  if ("restrictedToAuth" in b) {
    if (typeof b.restrictedToAuth !== "boolean") {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'restrictedToAuth' must be boolean");
    }
    out.restrictedToAuth = b.restrictedToAuth;
  }

  if ("options" in b) {
    if (!Array.isArray(b.options) || b.options.length === 0) {
      throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Field 'options' must be a non-empty array");
    }
    out.options = b.options.map((o) => {
      if (!o || typeof o !== "object") {
        throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Invalid option");
      }
      const oo = o as Record<string, unknown>;
      if (typeof oo.text !== "string" || oo.text.trim() === "") {
        throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Each option must have a non-empty 'text'");
      }
      return { text: oo.text };
    });
  }

  return out;
}

// ---------- GET /polls (list) ----------
router.get("/", (ctx) => {
  const pollRowsRaw = db.prepare(
    `SELECT id, title, description, user_id, created_at, expires_at, is_active, restricted_to_auth
     FROM polls
     ORDER BY created_at DESC;`,
  ).all();

  const pollRows = pollRowsRaw.filter(isPollRow);

  const polls: Poll[] = pollRows.map((p) => {
    const optionRowsRaw = db.prepare(
      `SELECT id, poll_id, text, vote_count
       FROM poll_options
       WHERE poll_id = ?
       ORDER BY id ASC;`,
    ).all(p.id);

    const optionRows = optionRowsRaw.filter(isPollOptionRow);
    return pollRowToApi(p, optionRows);
  });

  ctx.response.status = 200;
  ctx.response.type = "application/json";
  ctx.response.body = ok(polls);
});

// ---------- GET /polls/:pollId ----------
router.get("/:pollId", (ctx) => {
  const pollId = ctx.params.pollId;

  const pollRowRaw = db.prepare(
    `SELECT id, title, description, user_id, created_at, expires_at, is_active, restricted_to_auth
     FROM polls
     WHERE id = ?;`,
  ).get(pollId);

  if (!pollRowRaw || !isPollRow(pollRowRaw)) {
    throw new APIException(APIErrorCode.NOT_FOUND, 404, `Poll "${pollId}" not found`);
  }

  const optionRowsRaw = db.prepare(
    `SELECT id, poll_id, text, vote_count
     FROM poll_options
     WHERE poll_id = ?
     ORDER BY id ASC;`,
  ).all(pollId);

  const optionRows = optionRowsRaw.filter(isPollOptionRow);
  const poll = pollRowToApi(pollRowRaw, optionRows);

  ctx.response.status = 200;
  ctx.response.type = "application/json";
  ctx.response.body = ok(poll);
});

// ---------- POST /polls (create) ----------
router.post("/", authMiddleware, async (ctx: AuthContext) => {
  const body = await ctx.request.body.json();
  const createReq = validateCreateBody(body);

  const pollId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const userId = ctx.state.user!.userId;
  const restricted = createReq.restrictedToAuth ? 1 : 0;

  db.exec("BEGIN;");
  try {
    db.prepare(
      `INSERT INTO polls (id, title, description, user_id, created_at, expires_at, is_active, restricted_to_auth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      pollId,
      createReq.title,
      createReq.description ?? null,
      userId,
      createdAt,
      createReq.expiresAt ?? null,
      1,
      restricted,
    );

    const insertOpt = db.prepare(
      `INSERT INTO poll_options (id, poll_id, text, vote_count)
       VALUES (?, ?, ?, ?);`,
    );

    for (const opt of createReq.options) {
      insertOpt.run(crypto.randomUUID(), pollId, opt.text, 0);
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  const pollRowRaw = db.prepare(
    `SELECT id, title, description, user_id, created_at, expires_at, is_active, restricted_to_auth
     FROM polls WHERE id = ?;`,
  ).get(pollId);

  if (!pollRowRaw || !isPollRow(pollRowRaw)) {
    throw new APIException(APIErrorCode.SERVER_ERROR, 500, "Failed to read created poll");
  }

  const optionRowsRaw = db.prepare(
    `SELECT id, poll_id, text, vote_count
     FROM poll_options WHERE poll_id = ? ORDER BY id ASC;`,
  ).all(pollId);

  const optionRows = optionRowsRaw.filter(isPollOptionRow);
  const poll = pollRowToApi(pollRowRaw, optionRows);

  ctx.response.status = 201;
  ctx.response.type = "application/json";
  ctx.response.body = ok(poll);
});

// ---------- PUT /polls/:pollId (update) ----------
// -> owner ou admin
router.put("/:pollId", authMiddleware, async (ctx: AuthContext) => {
  const pollId = ctx.params.pollId;
  assertCanEdit(ctx, pollId);

  const body = await ctx.request.body.json();
  const updateReq = validateUpdateBody(body);

  db.exec("BEGIN;");
  try {
    if (
      updateReq.title !== undefined ||
      updateReq.description !== undefined ||
      updateReq.expiresAt !== undefined ||
      updateReq.isActive !== undefined ||
      updateReq.restrictedToAuth !== undefined
    ) {
      db.prepare(
        `UPDATE polls SET
           title = COALESCE(?, title),
           description = COALESCE(?, description),
           expires_at = COALESCE(?, expires_at),
           is_active = COALESCE(?, is_active),
           restricted_to_auth = COALESCE(?, restricted_to_auth)
         WHERE id = ?;`,
      ).run(
        updateReq.title ?? null,
        updateReq.description ?? null,
        updateReq.expiresAt ?? null,
        updateReq.isActive === undefined ? null : Number(updateReq.isActive),
        updateReq.restrictedToAuth === undefined ? null : Number(updateReq.restrictedToAuth),
        pollId,
      );
    }

    if (updateReq.options) {
      db.prepare(`DELETE FROM poll_options WHERE poll_id = ?;`).run(pollId);

      const insertOpt = db.prepare(
        `INSERT INTO poll_options (id, poll_id, text, vote_count)
         VALUES (?, ?, ?, ?);`,
      );
      for (const opt of updateReq.options) {
        insertOpt.run(crypto.randomUUID(), pollId, opt.text, 0);
      }
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  const pollRowRaw = db.prepare(
    `SELECT id, title, description, user_id, created_at, expires_at, is_active, restricted_to_auth
     FROM polls WHERE id = ?;`,
  ).get(pollId);

  if (!pollRowRaw || !isPollRow(pollRowRaw)) {
    throw new APIException(APIErrorCode.SERVER_ERROR, 500, "Failed to read updated poll");
  }

  const optionRowsRaw = db.prepare(
    `SELECT id, poll_id, text, vote_count
     FROM poll_options WHERE poll_id = ? ORDER BY id ASC;`,
  ).all(pollId);

  const optionRows = optionRowsRaw.filter(isPollOptionRow);
  const poll = pollRowToApi(pollRowRaw, optionRows);

  ctx.response.status = 200;
  ctx.response.type = "application/json";
  ctx.response.body = ok(poll);
});

// ---------- DELETE /polls/:pollId ----------
router.delete("/:pollId", authMiddleware, (ctx: AuthContext) => {
  const pollId = ctx.params.pollId;
  assertCanEdit(ctx, pollId);

  db.exec("BEGIN;");
  try {
    db.prepare(`DELETE FROM poll_options WHERE poll_id = ?;`).run(pollId);
    db.prepare(`DELETE FROM polls WHERE id = ?;`).run(pollId);
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  ctx.response.status = 200;
  ctx.response.type = "application/json";
  ctx.response.body = ok({ deleted: true, pollId });
});

export default router;