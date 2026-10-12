/**
 * Typed application errors. Services throw these; the UI layer maps them to
 * safe messages. Anything that is not an AppError is treated as unexpected:
 * it is logged server-side and shown to users as a generic message only.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STATE";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INSUFFICIENT_STOCK: 409,
  INVALID_STATE: 409,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Field-level messages for forms, keyed by field name. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export const unauthenticated = (m = "Please sign in to continue.") => new AppError("UNAUTHENTICATED", m);
export const forbidden = (m = "You do not have permission to do that.") => new AppError("FORBIDDEN", m);
export const notFound = (m = "That record could not be found.") => new AppError("NOT_FOUND", m);
export const conflict = (m: string) => new AppError("CONFLICT", m);
export const invalidState = (m: string) => new AppError("INVALID_STATE", m);
export const validation = (m: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION", m, fieldErrors);
export const rateLimited = (m = "Too many requests. Please wait a moment and try again.") =>
  new AppError("RATE_LIMITED", m);

export const GENERIC_ERROR_MESSAGE = "Something went wrong on our side. Please try again; if it keeps happening, contact us.";

/** Message that is safe to show to a user for any thrown value. */
export function safeMessage(error: unknown): string {
  return error instanceof AppError ? error.message : GENERIC_ERROR_MESSAGE;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
