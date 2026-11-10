export type TicketLine = {
  // Stable React key. Saved lines use their row id; draft and optimistic lines use the product.
  key: string;
  productId: number;
  name: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
};

export type OpenOrder = {
  id: number;
  floorItemId: number;
  lines: TicketLine[];
};

export type DraftLine = Omit<TicketLine, "key">;

export type MenuCategory = { id: number; name: string };
export type MenuSubcategory = { id: number; categoryId: number; name: string };
export type MenuProduct = {
  id: number;
  categoryId: number;
  subcategoryId: number;
  name: string;
  priceCents: number;
};

export type Menu = {
  categories: MenuCategory[];
  subcategories: MenuSubcategory[];
  products: MenuProduct[];
};

export const NOTE_MAX_LENGTH = 140;

export function ticketSummary(lines: { quantity: number; unitPriceCents: number }[]) {
  let itemCount = 0;
  let totalCents = 0;
  for (const line of lines) {
    itemCount += line.quantity;
    totalCents += line.quantity * line.unitPriceCents;
  }
  return { itemCount, totalCents };
}
