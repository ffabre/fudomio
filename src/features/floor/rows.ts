import { floorItems } from "@/lib/db/schema";
import {
  floorColors,
  type FloorItem,
  type FloorKind,
  type FloorShape,
  type Point,
} from "@/features/floor/types";

export const floorItemColumns = {
  id: floorItems.id,
  kind: floorItems.kind,
  shape: floorItems.shape,
  label: floorItems.label,
  seats: floorItems.seats,
  x: floorItems.x,
  y: floorItems.y,
  width: floorItems.width,
  height: floorItems.height,
  rotation: floorItems.rotation,
  points: floorItems.points,
  zIndex: floorItems.zIndex,
  color: floorItems.color,
};

export type FloorItemRow = {
  id: number;
  kind: string;
  shape: string;
  label: string | null;
  seats: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points: string | null;
  zIndex: number;
  color: string | null;
};

export function serializePoints(points: Point[] | null): string | null {
  if (!points) return null;
  return JSON.stringify(points.map((point) => ({ x: point.x, y: point.y })));
}

export function mapFloorItem(row: FloorItemRow): FloorItem {
  return {
    id: row.id,
    kind: row.kind as FloorKind,
    shape: row.shape as FloorShape,
    label: row.label,
    seats: row.seats,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    rotation: Number(row.rotation),
    points: parsePoints(row.points),
    zIndex: row.zIndex,
    color: asToken(row.color, floorColors),
  };
}

function asToken<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (value === null) return null;
  return allowed.some((entry) => entry === value) ? (value as T) : null;
}

function parsePoints(value: string | null): Point[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const points: Point[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") return null;
      const x = Number((entry as { x?: unknown }).x);
      const y = Number((entry as { y?: unknown }).y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      points.push({ x, y });
    }
    return points;
  } catch {
    return null;
  }
}
