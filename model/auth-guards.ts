import type { AuthPayload, LoginRequest, RegisterRequest } from "./interfaces.ts";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function isLoginRequest(x: unknown): x is LoginRequest {
  if (!isObject(x)) return false;
  return typeof x.username === "string" && typeof x.password === "string";
}

export function isRegisterRequest(x: unknown): x is RegisterRequest {
  if (!isObject(x)) return false;
  if (typeof x.username !== "string") return false;
  if (typeof x.password !== "string") return false;
  if ("isAdmin" in x && x.isAdmin !== undefined && typeof x.isAdmin !== "boolean") return false;
  return true;
}

export function isAuthPayload(x: unknown): x is AuthPayload {
  if (!isObject(x)) return false;
  return typeof x.userId === "string" &&
    typeof x.username === "string" &&
    typeof x.isAdmin === "boolean" &&
    typeof x.exp === "number";
}