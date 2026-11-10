"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import type { FloorFailure, FloorItemResult } from "@/features/floor/action-result";
import { floorCacheTag } from "@/features/floor/cache";
import {
  floorItemColumns,
  mapFloorItem,
  serializePoints,
  type FloorItemRow,
} from "@/features/floor/rows";
import type { FloorItem, FloorItemWrite } from "@/features/floor/types";
import { parseFloorItem, parseItemId } from "@/features/floor/validate";
import { db, ensureDatabase } from "@/lib/db/client";
import { floorItems, floors, orders } from "@/lib/db/schema";

function fail(code: FloorFailure["error"]["code"]): FloorFailure {
  return { ok: false, error: { code } };
}

function saved(item: FloorItem): FloorItemResult<FloorItem> {
  updateTag(floorCacheTag);
  return { ok: true, item };
}

function isForeignKeyError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; message?: unknown; cause?: unknown };
    const code = typeof record.code === "string" ? record.code : "";
    const message = typeof record.message === "string" ? record.message : "";
    if (
      code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
      code === "23503" ||
      /foreign key/i.test(message)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

async function floorBounds(floorId: number) {
  const [floor] = await db
    .select({
      id: floors.id,
      width: floors.width,
      height: floors.height,
    })
    .from(floors)
    .where(eq(floors.id, floorId))
    .limit(1);
  return floor ?? null;
}

function rowValues(floorId: number, item: FloorItemWrite) {
  return {
    floorId,
    kind: item.kind,
    shape: item.shape,
    label: item.label,
    seats: item.seats,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    points: serializePoints(item.points),
    zIndex: item.zIndex,
    color: item.kind === "block" ? null : item.color,
    fixture: null,
  };
}

export async function createFloorItem(input: {
  floorId: number;
  item: FloorItemWrite;
}): Promise<FloorItemResult<FloorItem>> {
  await ensureDatabase();
  const floorId = parseItemId(input.floorId);
  if (floorId === null) return fail("required");
  const floor = await floorBounds(floorId);
  if (!floor) return fail("required");

  const parsed = parseFloorItem(input.item, floor);
  if (!parsed.ok) return parsed;

  const [created] = await db
    .insert(floorItems)
    .values({
      ...rowValues(floorId, parsed.item),
      createdAt: Date.now(),
    })
    .returning(floorItemColumns);

  if (!created) return fail("required");
  return saved(mapFloorItem(created as FloorItemRow));
}

export async function updateFloorItem(input: {
  floorId: number;
  id: number;
  item: FloorItemWrite;
}): Promise<FloorItemResult<FloorItem>> {
  await ensureDatabase();
  const floorId = parseItemId(input.floorId);
  const id = parseItemId(input.id);
  if (floorId === null || id === null) return fail("required");
  const floor = await floorBounds(floorId);
  if (!floor) return fail("required");

  const parsed = parseFloorItem(input.item, floor);
  if (!parsed.ok) return parsed;

  const [updated] = await db
    .update(floorItems)
    .set(rowValues(floorId, parsed.item))
    .where(and(eq(floorItems.id, id), eq(floorItems.floorId, floorId)))
    .returning(floorItemColumns);

  if (!updated) return fail("required");
  return saved(mapFloorItem(updated as FloorItemRow));
}

export async function deleteFloorItem(
  id: number,
): Promise<{ ok: true } | FloorFailure> {
  await ensureDatabase();
  const parsedId = parseItemId(id);
  if (parsedId === null) return fail("required");

  const [existing] = await db
    .select({ id: floorItems.id, kind: floorItems.kind })
    .from(floorItems)
    .where(eq(floorItems.id, parsedId))
    .limit(1);
  if (!existing) {
    updateTag(floorCacheTag);
    return { ok: true };
  }

  if (existing.kind === "table") {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.floorItemId, parsedId))
      .limit(1);
    if (order) return fail("tableHasOrders");
  }

  try {
    await db.delete(floorItems).where(eq(floorItems.id, parsedId));
  } catch (error) {
    if (isForeignKeyError(error)) return fail("tableHasOrders");
    throw error;
  }

  updateTag(floorCacheTag);
  return { ok: true };
}
