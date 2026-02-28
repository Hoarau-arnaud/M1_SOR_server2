import type { VoteCastMessage } from "../model/interfaces.ts";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function isVoteCastMessage(x: unknown): x is VoteCastMessage {
  if (!isObject(x)) return false;

  if (x.type !== "vote_cast") return false;
  if (typeof x.voteId !== "string") return false; 
  if (typeof x.pollId !== "string") return false;
  if (typeof x.optionId !== "string") return false;

  if ("userId" in x && x.userId !== undefined && typeof x.userId !== "string") {
    return false;
  }

  return true;
}