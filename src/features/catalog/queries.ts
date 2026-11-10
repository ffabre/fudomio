import "server-only";

import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { catalogCacheTag } from "@/features/catalog/cache";
import type { CatalogData } from "@/features/catalog/types";
import { db, ensureDatabase } from "@/lib/db/client";
import { categories, products, subcategories } from "@/lib/db/schema";

async function loadCatalog(): Promise<CatalogData> {
  await ensureDatabase();

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
    })
    .from(categories)
    .orderBy(asc(categories.id));

  const subcategoryRows = await db
    .select({
      id: subcategories.id,
      categoryId: subcategories.categoryId,
      name: subcategories.name,
    })
    .from(subcategories)
    .orderBy(asc(subcategories.categoryId), asc(subcategories.id));

  const productRows = await db
    .select({
      id: products.id,
      subcategoryId: products.subcategoryId,
      categoryId: subcategories.categoryId,
      name: products.name,
      description: products.description,
      priceCents: products.priceCents,
      isAvailable: products.isAvailable,
      position: products.position,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
    })
    .from(products)
    .innerJoin(subcategories, eq(products.subcategoryId, subcategories.id))
    .innerJoin(categories, eq(subcategories.categoryId, categories.id))
    .orderBy(
      asc(categories.id),
      asc(subcategories.id),
      asc(products.position),
      asc(products.id),
    );

  return {
    categories: categoryRows,
    subcategories: subcategoryRows,
    products: productRows.map((product) => ({
      ...product,
      isAvailable: Number(product.isAvailable) === 1,
    })),
  };
}

export const getCatalog = unstable_cache(loadCatalog, ["catalog"], {
  tags: [catalogCacheTag],
  revalidate: false,
});
