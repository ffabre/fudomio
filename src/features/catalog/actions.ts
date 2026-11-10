"use server";

import { eq, max } from "drizzle-orm";
import { updateTag } from "next/cache";
import type {
  ActionResult,
  CatalogErrorCode,
  CatalogField,
} from "@/features/catalog/action-result";
import { catalogCacheTag } from "@/features/catalog/cache";
import {
  parseId,
  parseNameInput,
  parseProductInput,
  parseSubcategoryInput,
  type ParsedProduct,
} from "@/features/catalog/validate";
import { resolveLocale } from "@/i18n/locale";
import { db, ensureDatabase, type Database } from "@/lib/db/client";
import { categories, products, subcategories } from "@/lib/db/schema";

function fail(code: CatalogErrorCode, field?: CatalogField): ActionResult {
  return field
    ? { ok: false, error: { code, field } }
    : { ok: false, error: { code } };
}

function success(): ActionResult {
  updateTag(catalogCacheTag);
  return { ok: true };
}

function isForeignKeyError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
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

async function categoryExists(tx: Database, id: number): Promise<boolean> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return row !== undefined;
}

async function subcategoryForCategory(
  tx: Database,
  subcategoryId: number,
  categoryId: number,
): Promise<boolean> {
  const [row] = await tx
    .select({ categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(eq(subcategories.id, subcategoryId))
    .limit(1);
  return row?.categoryId === categoryId;
}

async function nextPosition(tx: Database, subcategoryId: number): Promise<number> {
  const [row] = await tx
    .select({ value: max(products.position) })
    .from(products)
    .where(eq(products.subcategoryId, subcategoryId));
  return (row?.value ?? 0) + 1;
}

export async function createCategory(input: {
  name: string;
}): Promise<ActionResult> {
  await ensureDatabase();
  const parsed = parseNameInput(input);
  if (!parsed.ok) return parsed;

  await db.insert(categories).values({
    name: parsed.name,
    createdAt: Date.now(),
  });
  return success();
}

export async function renameCategory(input: {
  id: number;
  name: string;
}): Promise<ActionResult> {
  await ensureDatabase();
  const id = parseId(input.id);
  const parsed = parseNameInput(input);
  if (!parsed.ok) return parsed;
  if (id === null) return fail("required", "name");

  const updated = await db
    .update(categories)
    .set({ name: parsed.name })
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  if (updated.length === 0) return fail("required", "name");
  return success();
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  await ensureDatabase();
  const parsedId = parseId(id);
  if (parsedId === null) return fail("required");

  try {
    await db.delete(categories).where(eq(categories.id, parsedId));
  } catch (error) {
    if (isForeignKeyError(error)) return fail("categoryHasChildren");
    throw error;
  }
  return success();
}

export async function createSubcategory(input: {
  name: string;
  categoryId: number;
}): Promise<ActionResult> {
  await ensureDatabase();
  const parsed = parseSubcategoryInput(input);
  if (!parsed.ok) return parsed;
  if (!(await categoryExists(db, parsed.categoryId))) {
    return fail("required", "category");
  }

  try {
    await db.insert(subcategories).values({
      categoryId: parsed.categoryId,
      name: parsed.name,
      createdAt: Date.now(),
    });
  } catch (error) {
    if (isForeignKeyError(error)) return fail("required", "category");
    throw error;
  }
  return success();
}

export async function renameSubcategory(input: {
  id: number;
  name: string;
}): Promise<ActionResult> {
  await ensureDatabase();
  const id = parseId(input.id);
  const parsed = parseNameInput(input);
  if (!parsed.ok) return parsed;
  if (id === null) return fail("required", "name");

  const updated = await db
    .update(subcategories)
    .set({ name: parsed.name })
    .where(eq(subcategories.id, id))
    .returning({ id: subcategories.id });
  if (updated.length === 0) return fail("required", "name");
  return success();
}

export async function deleteSubcategory(id: number): Promise<ActionResult> {
  await ensureDatabase();
  const parsedId = parseId(id);
  if (parsedId === null) return fail("required");

  try {
    await db.delete(subcategories).where(eq(subcategories.id, parsedId));
  } catch (error) {
    if (isForeignKeyError(error)) return fail("subcategoryHasProducts");
    throw error;
  }
  return success();
}

async function placeProduct(
  tx: Database,
  data: ParsedProduct,
): Promise<{ subcategoryId: number }> {
  let categoryId = data.categoryId;
  if (data.newCategoryName !== null) {
    const [created] = await tx
      .insert(categories)
      .values({
        name: data.newCategoryName,
        createdAt: Date.now(),
      })
      .returning({ id: categories.id });
    if (!created) throw new Error("Category was not created");
    categoryId = created.id;
  }

  if (categoryId === null) throw new Error("Product is missing a category");

  if (data.newSubcategoryName !== null || data.newCategoryName !== null) {
    if (data.newSubcategoryName === null) {
      throw new Error("Product is missing a subcategory");
    }
    const [created] = await tx
      .insert(subcategories)
      .values({
        categoryId,
        name: data.newSubcategoryName,
        createdAt: Date.now(),
      })
      .returning({ id: subcategories.id });
    if (!created) throw new Error("Subcategory was not created");
    return { subcategoryId: created.id };
  }

  if (data.subcategoryId === null) {
    throw new Error("Product is missing a subcategory");
  }
  return { subcategoryId: data.subcategoryId };
}

async function writeProduct(
  data: ParsedProduct,
  productId?: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const { subcategoryId } = await placeProduct(tx, data);
    const description = data.description;
    const isAvailable = data.isAvailable ? 1 : 0;

    if (productId === undefined) {
      await tx.insert(products).values({
        subcategoryId,
        name: data.name,
        description,
        priceCents: data.priceCents,
        isAvailable,
        position: await nextPosition(tx, subcategoryId),
        createdAt: Date.now(),
      });
      return;
    }

    const [existing] = await tx
      .select({
        subcategoryId: products.subcategoryId,
        position: products.position,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!existing) throw new Error("Product was not found");

    const position =
      existing.subcategoryId === subcategoryId
        ? existing.position
        : await nextPosition(tx, subcategoryId);

    const updated = await tx
      .update(products)
      .set({
        subcategoryId,
        name: data.name,
        description,
        priceCents: data.priceCents,
        isAvailable,
        position,
      })
      .where(eq(products.id, productId))
      .returning({ id: products.id });
    if (updated.length === 0) throw new Error("Product was not updated");
  });
}

async function saveProduct(
  input: unknown,
  productId?: number,
): Promise<ActionResult> {
  await ensureDatabase();
  const locale = await resolveLocale();
  const parsed = parseProductInput(input, locale);
  if (!parsed.ok) return parsed;

  if (parsed.data.newCategoryName === null && parsed.data.categoryId !== null) {
    if (!(await categoryExists(db, parsed.data.categoryId))) {
      return fail("required", "category");
    }
  }

  if (
    parsed.data.newCategoryName === null &&
    parsed.data.newSubcategoryName === null &&
    parsed.data.categoryId !== null &&
    parsed.data.subcategoryId !== null
  ) {
    const matches = await subcategoryForCategory(
      db,
      parsed.data.subcategoryId,
      parsed.data.categoryId,
    );
    if (!matches) return fail("required", "subcategory");
  }

  if (productId !== undefined) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!existing) return fail("required");
  }

  try {
    await writeProduct(parsed.data, productId);
  } catch (error) {
    if (isForeignKeyError(error)) return fail("required", "subcategory");
    throw error;
  }
  return success();
}

export async function createProduct(input: {
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  categoryId: number | null;
  newCategoryName: string | null;
  subcategoryId: number | null;
  newSubcategoryName: string | null;
}): Promise<ActionResult> {
  return saveProduct(input);
}

export async function updateProduct(input: {
  id: number;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  categoryId: number | null;
  newCategoryName: string | null;
  subcategoryId: number | null;
  newSubcategoryName: string | null;
}): Promise<ActionResult> {
  const id = parseId(input.id);
  if (id === null) return fail("required");
  return saveProduct(input, id);
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  await ensureDatabase();
  const parsedId = parseId(id);
  if (parsedId === null) return fail("required");

  try {
    await db.delete(products).where(eq(products.id, parsedId));
  } catch (error) {
    if (isForeignKeyError(error)) return fail("productOnOrders");
    throw error;
  }
  return success();
}
