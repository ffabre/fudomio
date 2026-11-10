import type { FloorColor, FloorKind } from "@/features/floor/types";

export function itemFill(item: {
  kind: FloorKind;
  color: FloorColor | null;
}): string {
  if (item.kind === "block") return "var(--floor-structure)";
  if (item.color) return `var(--swatch-${item.color})`;
  if (item.kind === "outline") return "var(--floor-surface)";
  return "var(--status-free)";
}

export function labelFill(item: {
  kind: FloorKind;
  color: FloorColor | null;
}): string {
  if (item.kind === "block") return "var(--muted-foreground)";
  if (item.color === "stone" || item.color === "wood" || item.color === "ink") {
    return "var(--primary-foreground)";
  }
  return "var(--foreground)";
}
