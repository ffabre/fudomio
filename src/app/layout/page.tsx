import { getTranslations } from "next-intl/server";
import { FloorEditor } from "@/features/floor/editor";
import { getOrCreateFloor } from "@/features/floor/queries";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  return pageTitle("layout");
}

export default async function LayoutPage() {
  const t = await getTranslations("layout");
  const floor = await getOrCreateFloor(t("defaultFloorName"));
  return <FloorEditor floor={floor} />;
}
