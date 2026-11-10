import type { FloorKind } from "./types";

export function nextTableLabel(items: { label: string | null }[]): string {
  const used = new Set<number>();
  for (const item of items) {
    if (!item.label || !/^[1-9]\d{0,8}$/.test(item.label)) continue;
    used.add(Number(item.label));
  }
  let next = 1;
  while (used.has(next)) next += 1;
  return String(next);
}

export function nextZIndex(
  items: { kind: FloorKind; zIndex: number }[],
  kind: FloorKind,
): number {
  const base = kind === "outline" ? 0 : kind === "block" ? 1 : 2;
  let highest = base - 1;
  for (const item of items) {
    if (item.kind === kind) highest = Math.max(highest, item.zIndex);
  }
  return highest + 1;
}
