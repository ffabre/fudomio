"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { floorCacheTag } from "@/features/floor/cache";
import type { OrderActionResult, OrderErrorCode } from "@/features/orders/action-result";
import { NOTE_MAX_LENGTH } from "@/features/orders/types";
import { db, ensureDatabase, type Database } from "@/lib/db/client";
import { floorItems, orderItems, orders, products } from "@/lib/db/schema";

class OrderFailure extends Error {
  constructor(readonly code: OrderErrorCode) {
    super(code);
  }
}

// The floor tag covers every locale's cached floor and makes the page re-render with fresh orders.
function refreshFloor() {
  updateTag(floorCacheTag);
}

function fail(code: OrderErrorCode): OrderActionResult {
  return { ok: false, error: { code } };
}

function parseId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 999
    ? value
    : null;
}

function parseNote(value: unknown): { ok: true; note: string | null } | { ok: false; code: OrderErrorCode } {
  if (value === null || value === undefined) return { ok: true, note: null };
  if (typeof value !== "string") return { ok: false, code: "required" };
  const note = value.trim();
  if (note.length > NOTE_MAX_LENGTH) return { ok: false, code: "tooLong" };
  return { ok: true, note: note === "" ? null : note };
}

function isUniqueError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    const code = typeof record.code === "string" ? record.code : "";
    const message = typeof record.message === "string" ? record.message : "";
    if (
      code === "SQLITE_CONSTRAINT_UNIQUE" ||
      code === "23505" ||
      /unique constraint/i.test(message)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

async function run(
  work: (tx: Database) => Promise<void>,
  refreshOnFailure = false,
): Promise<OrderActionResult> {
  await ensureDatabase();
  try {
    await db.transaction(work);
  } catch (error) {
    if (error instanceof OrderFailure) {
      if (refreshOnFailure || error.code === "orderNotOpen") refreshFloor();
      return fail(error.code);
    }
    if (isUniqueError(error)) {
      refreshFloor();
      return fail("orderAlreadyOpen");
    }
    throw error;
  }
  refreshFloor();
  return { ok: true };
}

async function openOrderFor(tx: Database, tableId: number): Promise<number | null> {
  const [order] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.floorItemId, tableId), eq(orders.status, "open")))
    .limit(1);
  return order?.id ?? null;
}

async function requireOpenOrder(tx: Database, tableId: number): Promise<number> {
  const id = await openOrderFor(tx, tableId);
  if (id === null) throw new OrderFailure("orderNotOpen");
  return id;
}

// One line per product: the earliest one is the line taps and edits act on.
async function lineFor(tx: Database, orderId: number, productId: number) {
  const [line] = await tx
    .select({ id: orderItems.id, quantity: orderItems.quantity })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
    .orderBy(asc(orderItems.id))
    .limit(1);
  return line ?? null;
}

async function snapshot(tx: Database, productId: number) {
  const [product] = await tx
    .select({ name: products.name, priceCents: products.priceCents })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new OrderFailure("productUnavailable");
  return { productName: product.name, unitPriceCents: Number(product.priceCents) };
}

export async function sendOrder(input: {
  tableId: number;
  lines: { productId: number; quantity: number; note: string | null }[];
}): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  if (tableId === null || !Array.isArray(input.lines) || input.lines.length === 0) {
    return fail("required");
  }

  // Merge repeated products so the order keeps one line per product.
  const merged = new Map<number, { quantity: number; note: string | null }>();
  for (const raw of input.lines) {
    const productId = parseId(raw?.productId);
    const quantity = parseQuantity(raw?.quantity);
    const note = parseNote(raw?.note);
    if (productId === null || quantity === null) return fail("required");
    if (!note.ok) return fail(note.code);
    const existing = merged.get(productId);
    merged.set(productId, {
      quantity: (existing?.quantity ?? 0) + quantity,
      note: existing?.note ?? note.note,
    });
  }

  return run(async (tx) => {
    const [table] = await tx
      .select({ id: floorItems.id })
      .from(floorItems)
      .where(and(eq(floorItems.id, tableId), eq(floorItems.kind, "table")))
      .limit(1);
    if (!table) throw new OrderFailure("tableNotFound");
    if ((await openOrderFor(tx, tableId)) !== null) throw new OrderFailure("orderAlreadyOpen");

    const productIds = [...merged.keys()];
    const found = await tx
      .select({ id: products.id, name: products.name, priceCents: products.priceCents })
      .from(products)
      .where(inArray(products.id, productIds));
    const byId = new Map(found.map((product) => [product.id, product]));
    if (byId.size !== productIds.length) throw new OrderFailure("productUnavailable");

    const now = Date.now();
    const [order] = await tx
      .insert(orders)
      .values({ floorItemId: tableId, status: "open", openedAt: now, createdAt: now })
      .returning({ id: orders.id });
    if (!order) throw new OrderFailure("required");

    await tx.insert(orderItems).values(
      productIds.map((productId) => {
        const product = byId.get(productId)!;
        const line = merged.get(productId)!;
        return {
          orderId: order.id,
          productId,
          productName: product.name,
          unitPriceCents: Number(product.priceCents),
          quantity: line.quantity,
          note: line.note,
          createdAt: now,
        };
      }),
    );
  }, true);
}

export async function addProduct(input: {
  tableId: number;
  productId: number;
}): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  const productId = parseId(input?.productId);
  if (tableId === null || productId === null) return fail("required");

  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    const line = await lineFor(tx, orderId, productId);
    if (line) {
      await tx
        .update(orderItems)
        .set({ quantity: Number(line.quantity) + 1 })
        .where(eq(orderItems.id, line.id));
      return;
    }
    const values = await snapshot(tx, productId);
    await tx.insert(orderItems).values({
      orderId,
      productId,
      ...values,
      quantity: 1,
      note: null,
      createdAt: Date.now(),
    });
  });
}

export async function setLineQuantity(input: {
  tableId: number;
  productId: number;
  quantity: number;
}): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  const productId = parseId(input?.productId);
  const quantity = parseQuantity(input?.quantity);
  if (tableId === null || productId === null || quantity === null) return fail("required");

  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    const line = await lineFor(tx, orderId, productId);
    if (!line) return;
    await tx.update(orderItems).set({ quantity }).where(eq(orderItems.id, line.id));
  });
}

export async function setLineNote(input: {
  tableId: number;
  productId: number;
  note: string | null;
}): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  const productId = parseId(input?.productId);
  const note = parseNote(input?.note);
  if (tableId === null || productId === null) return fail("required");
  if (!note.ok) return fail(note.code);

  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    const line = await lineFor(tx, orderId, productId);
    if (!line) return;
    await tx.update(orderItems).set({ note: note.note }).where(eq(orderItems.id, line.id));
  });
}

export async function removeLine(input: {
  tableId: number;
  productId: number;
}): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  const productId = parseId(input?.productId);
  if (tableId === null || productId === null) return fail("required");

  // Removing the last line leaves an empty open order: the table stays occupied.
  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    const line = await lineFor(tx, orderId, productId);
    if (!line) return;
    await tx.delete(orderItems).where(eq(orderItems.id, line.id));
  });
}

export async function closeOrder(input: { tableId: number }): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  if (tableId === null) return fail("required");

  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    await tx
      .update(orders)
      .set({ status: "closed", closedAt: Date.now() })
      .where(eq(orders.id, orderId));
  });
}

export async function cancelOrder(input: { tableId: number }): Promise<OrderActionResult> {
  const tableId = parseId(input?.tableId);
  if (tableId === null) return fail("required");

  return run(async (tx) => {
    const orderId = await requireOpenOrder(tx, tableId);
    // Lines go with the order (on delete cascade).
    await tx.delete(orders).where(and(eq(orders.id, orderId), eq(orders.status, "open")));
  });
}
