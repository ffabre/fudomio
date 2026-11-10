export const floorErrorCodes = ["required", "tooLong", "tableHasOrders"] as const;

export type FloorErrorCode = (typeof floorErrorCodes)[number];

export type FloorFailure = { ok: false; error: { code: FloorErrorCode } };

export type FloorActionResult = { ok: true } | FloorFailure;

export type FloorItemResult<T> = { ok: true; item: T } | FloorFailure;
