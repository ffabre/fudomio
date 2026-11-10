import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { floorCacheTag } from "@/features/floor/cache";
import {
  DEFAULT_FLOOR_HEIGHT,
  DEFAULT_FLOOR_WIDTH,
} from "@/features/floor/geometry";
import { floorItemColumns, mapFloorItem } from "@/features/floor/rows";
import type { FloorData } from "@/features/floor/types";
import { db, ensureDatabase, type Database } from "@/lib/db/client";
import { floorItems, floors } from "@/lib/db/schema";

async function insertFloor(tx: Database, name: string) {
  const [created] = await tx
    .insert(floors)
    .values({
      name,
      width: DEFAULT_FLOOR_WIDTH,
      height: DEFAULT_FLOOR_HEIGHT,
      createdAt: Date.now(),
    })
    .returning({
      id: floors.id,
      name: floors.name,
      width: floors.width,
      height: floors.height,
    });
  if (!created) throw new Error("Floor was not created");
  return created;
}

async function loadFloor(defaultName: string): Promise<FloorData> {
  await ensureDatabase();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: floors.id,
        name: floors.name,
        width: floors.width,
        height: floors.height,
      })
      .from(floors)
      .orderBy(asc(floors.id))
      .limit(1);

    const floor = existing ?? (await insertFloor(tx, defaultName));
    const rows = await tx
      .select(floorItemColumns)
      .from(floorItems)
      .where(eq(floorItems.floorId, floor.id))
      .orderBy(asc(floorItems.zIndex), asc(floorItems.id));

    return {
      id: floor.id,
      name: floor.name,
      width: floor.width,
      height: floor.height,
      items: rows.map(mapFloorItem),
    };
  });
}

export const getOrCreateFloor = unstable_cache(loadFloor, ["floor"], {
  tags: [floorCacheTag],
  revalidate: false,
});
