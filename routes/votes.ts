import { Router } from "@oak/oak";
import { APIErrorCode } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";
import { subscribe, unsubscribe, handleVoteMessage } from "../services/vote-service.ts";
import { isVoteCastMessage } from "../services/vote-guards.ts";
import { verifyJWT } from "../lib/jwt.ts";

const router = new Router({ prefix: "/votes" });

router.get("/:pollId", async (ctx) => {
  const pollId = ctx.params.pollId;

  if (!pollId) {
    throw new APIException(APIErrorCode.NOT_FOUND, 404, "Poll not found");
  }

  if (!ctx.isUpgradable) {
    throw new APIException(APIErrorCode.BAD_REQUEST, 400, "WebSocket required");
  }

  // ✅ token passé en query param: ws://.../votes/:pollId?token=...
  const token = ctx.request.url.searchParams.get("token");
  const payload = token ? await verifyJWT(token) : null;
  const userId = payload?.userId; // undefined si non connecté / token invalide

  const ws: WebSocket = ctx.upgrade();

  subscribe(ws, pollId);

  ws.onmessage = (e) => {
    let msg: unknown;

    try {
      msg = JSON.parse(String(e.data));
    } catch {
      ws.send(JSON.stringify({
        type: "vote_ack",
        pollId,
        optionId: "",
        success: false,
        error: { code: APIErrorCode.BAD_REQUEST, message: "Invalid JSON" },
      }));
      return;
    }

    if (!isVoteCastMessage(msg)) {
      ws.send(JSON.stringify({
        type: "vote_ack",
        pollId,
        optionId: "",
        success: false,
        error: { code: APIErrorCode.BAD_REQUEST, message: "Invalid message" },
      }));
      return;
    }

    // ✅ IMPORTANT: on force pollId du canal, et on passe l'identité depuis le token
    handleVoteMessage(ws, { ...msg, pollId }, userId);
  };

  ws.onclose = () => unsubscribe(ws, pollId);
  ws.onerror = () => unsubscribe(ws, pollId);
});

export default router;