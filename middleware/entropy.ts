import { randomInt } from "node:crypto";
import { Context, type Next } from "@oak/oak";
import { APIErrorCode } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function entropyMiddleware(ctx: Context, next: Next) {
  const d10 = randomInt(0, 10);

  if (d10 === 9) {
    throw new APIException(APIErrorCode.SERVER_ERROR, 500, "Entropy error :-)");
  }

  if (d10 >= 3 && d10 < 9) {
    const timeout = randomInt(0, 5);
    await delay(timeout * 1000);
  }

  await next();
}