export const catalogErrorCodes = [
  "required",
  "tooLong",
  "invalidPrice",
  "categoryHasChildren",
  "subcategoryHasProducts",
  "productOnOrders",
] as const;

export type CatalogErrorCode = (typeof catalogErrorCodes)[number];

export type CatalogField =
  | "name"
  | "description"
  | "price"
  | "category"
  | "subcategory";

export type ActionError = {
  code: CatalogErrorCode;
  field?: CatalogField;
};

export type ActionResult = { ok: true } | { ok: false; error: ActionError };
