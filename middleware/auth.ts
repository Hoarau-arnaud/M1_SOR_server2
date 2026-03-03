import type { Next, State, RouterContext } from "@oak/oak";

import { verifyJWT } from "../lib/jwt.ts";
import { APIErrorCode, type AuthPayload } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";

export interface AuthState extends State {
  user?: AuthPayload;
}


export type AuthContext = RouterContext<string, Record<string, string>, AuthState>;

export async function authMiddleware(ctx: AuthContext, next: Next) {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new APIException(
      APIErrorCode.UNAUTHORIZED,
      401,
      "Missing or invalid token",
    );
  }

  const token = authHeader.substring(7);
  const payload = await verifyJWT(token);

  if (!payload) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Invalid token");
  }

  ctx.state.user = payload;
  await next();
}