export const orderErrorCodes = [
  "required",
  "tooLong",
  "orderAlreadyOpen",
  "orderNotOpen",
  "productUnavailable",
  "tableNotFound",
] as const;

export type OrderErrorCode = (typeof orderErrorCodes)[number];

export type OrderActionResult =
  | { ok: true }
  | { ok: false; error: { code: OrderErrorCode } };
