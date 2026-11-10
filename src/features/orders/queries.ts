import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { getCatalog } from "@/features/catalog/queries";
import type { Menu, OpenOrder } from "@/features/orders/types";
import { db, ensureDatabase } from "@/lib/db/client";
import { floorItems, orderItems, orders } from "@/lib/db/schema";

// Not cached: occupancy changes with every order write.
export async function getOpenOrders(floorId: number): Promise<OpenOrder[]> {
  await ensureDatabase();

  const open = await db
    .select({ id: orders.id, floorItemId: orders.floorItemId })
    .from(orders)
    .innerJoin(floorItems, eq(floorItems.id, orders.floorItemId))
    .where(and(eq(orders.status, "open"), eq(floorItems.floorId, floorId)))
    .orderBy(asc(orders.id));

  if (open.length === 0) return [];

  const lines = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      name: orderItems.productName,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
      note: orderItems.note,
    })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        open.map((order) => order.id),
      ),
    )
    .orderBy(asc(orderItems.id));

  return open.map((order) => ({
    id: order.id,
    floorItemId: order.floorItemId,
    lines: lines
      .filter((line) => line.orderId === order.id)
      .map((line) => ({
        key: `line-${line.id}`,
        productId: line.productId,
        name: line.name,
        unitPriceCents: Number(line.unitPriceCents),
        quantity: Number(line.quantity),
        note: line.note,
      })),
  }));
}

export async function getMenu(): Promise<Menu> {
  const catalog = await getCatalog();
  const available = catalog.products
    .filter((product) => product.isAvailable)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.name.localeCompare(b.name) ||
        a.id - b.id,
    );
  const subcategoryIds = new Set(available.map((product) => product.subcategoryId));
  const subcategories = catalog.subcategories.filter((sub) => subcategoryIds.has(sub.id));
  const categoryIds = new Set(subcategories.map((sub) => sub.categoryId));

  return {
    categories: catalog.categories.filter((category) => categoryIds.has(category.id)),
    subcategories,
    products: available.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      name: product.name,
      priceCents: product.priceCents,
    })),
  };
}
