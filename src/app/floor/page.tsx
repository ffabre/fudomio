import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrCreateFloor } from "@/features/floor/queries";
import { ServiceFloor } from "@/features/floor/service-floor";
import { getMenu, getOpenOrders } from "@/features/orders/queries";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  return pageTitle("floor");
}

export default async function FloorPage({ searchParams }: PageProps<"/floor">) {
  const [params, layout] = await Promise.all([searchParams, getTranslations("layout")]);
  const floor = await getOrCreateFloor(layout("defaultFloorName"));
  const [openOrders, menu] = await Promise.all([getOpenOrders(floor.id), getMenu()]);

  const table = params.table;
  if (table !== undefined) {
    const valid =
      typeof table === "string" &&
      floor.items.some((item) => item.kind === "table" && String(item.id) === table);
    if (!valid) redirect("/floor");
  }

  return <ServiceFloor floor={floor} openOrders={openOrders} menu={menu} />;
}
