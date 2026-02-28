import { db } from "../db/db.ts";
import {
  APIErrorCode,
  type VoteCastMessage,
  type VotesUpdateMessage,
} from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";

const subscriptions = new Map<string, Set<WebSocket>>();

function isLikelyUniqueConstraintError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("UNIQUE") || msg.includes("constraint") || msg.includes("PRIMARY");
}

function castVote(
  voteId: string,
  pollId: string,
  optionId: string,
  authedUserId?: string, // ✅ identité issue du token WS
): { voteCount: number; didIncrement: boolean } {
  // ✅ Lire aussi restricted_to_auth (+ is_active si tu veux bloquer les polls inactifs)
  const poll = db.prepare(
    `SELECT id, is_active, restricted_to_auth
     FROM polls
     WHERE id = ?;`,
  ).get(pollId) as { id: string; is_active: number; restricted_to_auth: number } | undefined;

  if (!poll) throw new APIException(APIErrorCode.NOT_FOUND, 404, "Poll not found");

  // Optionnel (mais logique) : pas de vote si poll inactif
  if (poll.is_active !== 1) {
    throw new APIException(APIErrorCode.VALIDATION_ERROR, 400, "Poll is inactive");
  }

  // ✅ Règle: si poll restreint => JWT obligatoire
  if (poll.restricted_to_auth === 1 && !authedUserId) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Login required to vote");
  }

  // Vérifier que l’option appartient au poll
  const opt = db.prepare(
    `SELECT id FROM poll_options WHERE id = ? AND poll_id = ?;`,
  ).get(optionId, pollId);

  if (!opt) throw new APIException(APIErrorCode.NOT_FOUND, 404, "Option not found");

  const createdAt = new Date().toISOString();

  db.exec("BEGIN;");
  try {
    db.prepare(
      `INSERT INTO votes (id, poll_id, option_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?);`,
    ).run(voteId, pollId, optionId, authedUserId ?? null, createdAt);

    db.prepare(
      `UPDATE poll_options
       SET vote_count = vote_count + 1
       WHERE id = ? AND poll_id = ?;`,
    ).run(optionId, pollId);

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");

    // voteId déjà vu => idempotent
    if (!isLikelyUniqueConstraintError(e)) throw e;

    const rowDup = db.prepare(
      `SELECT vote_count FROM poll_options WHERE id = ? AND poll_id = ?;`,
    ).get(optionId, pollId) as { vote_count: number } | undefined;

    if (!rowDup) {
      throw new APIException(APIErrorCode.SERVER_ERROR, 500, "Failed to read vote_count after duplicate vote");
    }

    return { voteCount: rowDup.vote_count, didIncrement: false };
  }

  const row = db.prepare(
    `SELECT vote_count FROM poll_options WHERE id = ? AND poll_id = ?;`,
  ).get(optionId, pollId) as { vote_count: number } | undefined;

  if (!row) {
    throw new APIException(APIErrorCode.SERVER_ERROR, 500, "Failed to read updated vote_count");
  }

  return { voteCount: row.vote_count, didIncrement: true };
}

export function subscribe(ws: WebSocket, pollId: string): void {
  const set = subscriptions.get(pollId) ?? new Set<WebSocket>();
  set.add(ws);
  subscriptions.set(pollId, set);
}

export function unsubscribe(ws: WebSocket, pollId: string): void {
  const set = subscriptions.get(pollId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subscriptions.delete(pollId);
}

export function broadcast(pollId: string, message: VotesUpdateMessage): void {
  const set = subscriptions.get(pollId);
  if (!set) return;

  const payload = JSON.stringify(message);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch { /* ignore */ }
    }
  }
}

export function sendError(
  ws: WebSocket,
  pollId: string,
  optionId: string,
  exception: APIException,
): void {
  try {
    ws.send(JSON.stringify({
      type: "vote_ack",
      pollId,
      optionId,
      success: false,
      error: { code: exception.code, message: exception.message },
    }));
  } catch {
    // ignore
  }
}

// ✅ userId passé séparément, et on ignore tout userId éventuel dans msg
export function handleVoteMessage(ws: WebSocket, msg: VoteCastMessage, authedUserId?: string): void {
  try {
    const { voteCount, didIncrement } = castVote(
      msg.voteId,
      msg.pollId,
      msg.optionId,
      authedUserId,
    );

    ws.send(JSON.stringify({
      type: "vote_ack",
      pollId: msg.pollId,
      optionId: msg.optionId,
      success: true,
    }));

    if (didIncrement) {
      broadcast(msg.pollId, {
        type: "votes_update",
        pollId: msg.pollId,
        optionId: msg.optionId,
        voteCount,
      });
    }
  } catch (e) {
    if (e instanceof APIException) {
      sendError(ws, msg.pollId, msg.optionId, e);
      return;
    }

    console.error(e);
    sendError(ws, msg.pollId, msg.optionId, new APIException(APIErrorCode.SERVER_ERROR, 500, "Unexpected server error"));
  }
}