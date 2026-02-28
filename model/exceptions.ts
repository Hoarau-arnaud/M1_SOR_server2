import { APIErrorCode } from "./interfaces.ts";

export class APIException extends Error {
  readonly code: APIErrorCode;
  readonly status: number;

  constructor(code: APIErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}