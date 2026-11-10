import { getLocale, getTranslations } from "next-intl/server";
import { CatalogScreen } from "@/features/catalog/catalog-screen";
import { getCatalog } from "@/features/catalog/queries";
import { formatPrice } from "@/lib/money";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  return pageTitle("products");
}

export default async function ProductsPage() {
  const [catalog, locale, t] = await Promise.all([
    getCatalog(),
    getLocale(),
    getTranslations("products"),
  ]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 ps-4 pe-4 py-6 md:ps-8 md:pe-8">
        <header className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-base text-muted-foreground">{t("guidance")}</p>
        </header>
        <CatalogScreen
          catalog={{
            categories: catalog.categories,
            subcategories: catalog.subcategories,
            products: catalog.products.map((product) => ({
              ...product,
              priceLabel: formatPrice(product.priceCents, locale),
            })),
          }}
        />
      </div>
    </div>
  );
}
