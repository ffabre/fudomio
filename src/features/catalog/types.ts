export type CatalogCategory = {
  id: number;
  name: string;
};

export type CatalogSubcategory = {
  id: number;
  categoryId: number;
  name: string;
};

export type CatalogProduct = {
  id: number;
  subcategoryId: number;
  categoryId: number;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  position: number;
  categoryName: string;
  subcategoryName: string;
};

export type CatalogData = {
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  products: CatalogProduct[];
};

export type CatalogProductView = CatalogProduct & {
  priceLabel: string;
};

export type CatalogView = {
  categories: CatalogCategory[];
  subcategories: CatalogSubcategory[];
  products: CatalogProductView[];
};
