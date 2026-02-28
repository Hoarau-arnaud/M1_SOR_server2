import { Router } from "@oak/oak";

import { APIErrorCode, type APIResponse } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";
import { isLoginRequest, isRegisterRequest } from "../model/auth-guards.ts";
import { authMiddleware, type AuthContext } from "../middleware/auth.ts";
import { getMe, loginUser, registerUser } from "../services/users.ts";

const router = new Router({ prefix: "/users" });

// POST /users/register
router.post("/register", async (ctx) => {
  const body: unknown = await ctx.request.body.json();

  if (!isRegisterRequest(body)) {
    throw new APIException(APIErrorCode.BAD_REQUEST, 400, "Invalid register payload");
  }

  const user = await registerUser(body.username, body.password, body.isAdmin ?? false);

  const resp: APIResponse<typeof user> = { success: true, data: user };
  ctx.response.body = resp;
});

// POST /users/login
router.post("/login", async (ctx) => {
  const body: unknown = await ctx.request.body.json();

  if (!isLoginRequest(body)) {
    throw new APIException(APIErrorCode.BAD_REQUEST, 400, "Invalid login payload");
  }

  const auth = await loginUser(body.username, body.password);

  const resp: APIResponse<typeof auth> = { success: true, data: auth };
  ctx.response.body = resp;
});

// GET /users/me (protégé)
router.get("/me", authMiddleware, (ctx: AuthContext) => {
  const userId = ctx.state.user?.userId;
  if (!userId) {
    throw new APIException(APIErrorCode.UNAUTHORIZED, 401, "Not authenticated");
  }

  const data = getMe(userId);
  const resp: APIResponse<typeof data> = { success: true, data };
  ctx.response.body = resp;
});

export default router;