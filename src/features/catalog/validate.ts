import { z } from "zod";
import type { ActionError } from "@/features/catalog/action-result";
import type { CatalogField } from "@/features/catalog/action-result";
import { parsePrice } from "@/lib/money";

const nameSchema = z.string().trim().min(1, "required").max(80, "tooLong");

const knownCodes = new Set(["required", "tooLong", "invalidPrice"]);

function codeFromMessage(message: string | undefined): ActionError["code"] {
  if (message && knownCodes.has(message)) {
    return message as ActionError["code"];
  }
  return "required";
}

function fieldFromPath(path: PropertyKey | undefined): CatalogField | undefined {
  switch (path) {
    case "name":
    case "description":
    case "price":
    case "category":
    case "subcategory":
      return path;
    case "categoryId":
    case "newCategoryName":
      return "category";
    case "subcategoryId":
    case "newSubcategoryName":
      return "subcategory";
    default:
      return undefined;
  }
}

function nameError(field: CatalogField, value: unknown): ActionError | null {
  const parsed = nameSchema.safeParse(value);
  if (parsed.success) return null;
  return {
    code: codeFromMessage(parsed.error.issues[0]?.message),
    field,
  };
}

export function parseNameInput(
  input: unknown,
): { ok: true; name: string } | { ok: false; error: ActionError } {
  const object = z.object({ name: z.unknown() }).safeParse(input);
  if (!object.success) {
    return { ok: false, error: { code: "required", field: "name" } };
  }
  const error = nameError("name", object.data.name);
  if (error) return { ok: false, error };
  return { ok: true, name: nameSchema.parse(object.data.name) };
}

export function parseSubcategoryInput(
  input: unknown,
):
  | { ok: true; name: string; categoryId: number }
  | { ok: false; error: ActionError } {
  const named = parseNameInput(input);
  if (!named.ok) return named;
  const category = z
    .object({ categoryId: z.number().int().positive() })
    .safeParse(input);
  if (!category.success) {
    return { ok: false, error: { code: "required", field: "category" } };
  }
  return {
    ok: true,
    name: named.name,
    categoryId: category.data.categoryId,
  };
}

export function parseId(input: unknown): number | null {
  const parsed = z.number().int().positive().safeParse(input);
  return parsed.success ? parsed.data : null;
}

export type ParsedProduct = {
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  categoryId: number | null;
  newCategoryName: string | null;
  subcategoryId: number | null;
  newSubcategoryName: string | null;
};

function productSchema(locale: string) {
  return z
    .object({
      name: nameSchema,
      description: z.string().trim().max(280, "tooLong"),
      price: z.string().trim(),
      isAvailable: z.boolean(),
      categoryId: z.number().int().positive().nullable(),
      newCategoryName: z.string().trim().nullable(),
      subcategoryId: z.number().int().positive().nullable(),
      newSubcategoryName: z.string().trim().nullable(),
    })
    .superRefine((value, ctx) => {
      if (parsePrice(value.price, locale) === null) {
        ctx.addIssue({
          code: "custom",
          message: "invalidPrice",
          path: ["price"],
        });
      }

      if (value.newCategoryName !== null) {
        const error = nameError("category", value.newCategoryName);
        if (error) {
          ctx.addIssue({
            code: "custom",
            message: error.code,
            path: ["category"],
          });
        }
      } else if (value.categoryId === null) {
        ctx.addIssue({
          code: "custom",
          message: "required",
          path: ["category"],
        });
      }

      const creatingSubcategory =
        value.newCategoryName !== null || value.newSubcategoryName !== null;
      if (creatingSubcategory) {
        const error = nameError("subcategory", value.newSubcategoryName ?? "");
        if (error) {
          ctx.addIssue({
            code: "custom",
            message: error.code,
            path: ["subcategory"],
          });
        }
      } else if (value.subcategoryId === null) {
        ctx.addIssue({
          code: "custom",
          message: "required",
          path: ["subcategory"],
        });
      }
    });
}

export function parseProductInput(
  input: unknown,
  locale: string,
): { ok: true; data: ParsedProduct } | { ok: false; error: ActionError } {
  const parsed = productSchema(locale).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: {
        code: codeFromMessage(issue?.message),
        field: fieldFromPath(issue?.path[0]),
      },
    };
  }

  const priceCents = parsePrice(parsed.data.price, locale);
  if (priceCents === null) {
    return { ok: false, error: { code: "invalidPrice", field: "price" } };
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      description: parsed.data.description === "" ? null : parsed.data.description,
      priceCents,
      isAvailable: parsed.data.isAvailable,
      categoryId: parsed.data.categoryId,
      newCategoryName: parsed.data.newCategoryName,
      subcategoryId: parsed.data.subcategoryId,
      newSubcategoryName: parsed.data.newSubcategoryName,
    },
  };
}
