import { Context, type Next } from "@oak/oak";
import { APIErrorCode, type APIFailure } from "../model/interfaces.ts";
import { APIException } from "../model/exceptions.ts";

export async function errorMiddleware(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof APIException) {
      const responseBody: APIFailure = {
        success: false,
        error: { code: err.code, message: err.message },
      };
      ctx.response.status = err.status;
      ctx.response.type = "application/json";
      ctx.response.body = responseBody;
      console.log(responseBody);
      return;
    }

    console.error(err);

    const responseBody: APIFailure = {
      success: false,
      error: {
        code: APIErrorCode.SERVER_ERROR,
        message: "Unexpected server error",
      },
    };

    ctx.response.status = 500;
    ctx.response.type = "application/json";
    ctx.response.body = responseBody;
  }
}