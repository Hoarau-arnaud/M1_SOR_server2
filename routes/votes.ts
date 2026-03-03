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

  const token = ctx.request.url.searchParams.get("token");

  let userId: string | undefined;
  if (token) {
    try {
      const payload = await verifyJWT(token);
      userId = payload?.userId;
    } catch {
      userId = undefined;
    }
  }

  const ws: WebSocket = ctx.upgrade();

  subscribe(ws, pollId);

  ws.onmessage = (e) => {
    let msg: unknown;

    try {
      msg = JSON.parse(String(e.data));
    } catch {
      ws.send(
        JSON.stringify({
          type: "vote_ack",
          pollId,
          optionId: "",
          success: false,
          error: { code: APIErrorCode.BAD_REQUEST, message: "Invalid JSON" },
        }),
      );
      return;
    }

    if (!isVoteCastMessage(msg)) {
      ws.send(
        JSON.stringify({
          type: "vote_ack",
          pollId,
          optionId: "",
          success: false,
          error: { code: APIErrorCode.BAD_REQUEST, message: "Invalid message" },
        }),
      );
      return;
    }

    handleVoteMessage(ws, { ...msg, pollId }, userId);
  };

  ws.onclose = () => unsubscribe(ws, pollId);
  ws.onerror = () => unsubscribe(ws, pollId);
});

export default router;