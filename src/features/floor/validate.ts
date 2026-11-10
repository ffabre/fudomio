import { z } from "zod";
import type { FloorFailure } from "@/features/floor/action-result";
import { normalizeGeometry, type FloorBounds } from "@/features/floor/geometry";
import {
  floorColors,
  type FloorItemWrite,
  type FloorKind,
  type FloorShape,
  type Point,
} from "@/features/floor/types";

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const rawSchema = z.object({
  kind: z.enum(["table", "block", "outline"]),
  shape: z.enum(["circle", "square", "rectangle", "polygon"]),
  label: z.string().max(80, "tooLong").nullable(),
  seats: z.number().int().positive().nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite(),
  points: z.array(pointSchema).nullable(),
  zIndex: z.number().int().min(0),
  color: z.enum(floorColors).nullable(),
});

function fail(code: FloorFailure["error"]["code"]): FloorFailure {
  return { ok: false, error: { code } };
}

export function parseFloorItem(
  input: unknown,
  floor: FloorBounds,
): { ok: true; item: FloorItemWrite } | FloorFailure {
  const parsed = rawSchema.safeParse(input);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.message === "tooLong");
    return fail(tooLong ? "tooLong" : "required");
  }

  const data = parsed.data;
  const label = data.label !== null && data.label.trim() !== "" ? data.label : null;

  let seats = data.kind === "table" ? data.seats : null;
  if (data.kind === "table" && seats !== null && (!Number.isInteger(seats) || seats < 1)) {
    return fail("required");
  }
  if (data.kind !== "table") seats = null;

  if (data.shape === "polygon" && (!data.points || data.points.length < 3)) {
    return fail("required");
  }

  const geometry = normalizeGeometry(
    {
      shape: data.shape as FloorShape,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      rotation: data.rotation,
      points: data.shape === "polygon" ? (data.points as Point[]) : null,
    },
    floor,
  );

  if (geometry.shape === "polygon" && (!geometry.points || geometry.points.length < 3)) {
    return fail("required");
  }

  return {
    ok: true,
    item: {
      kind: data.kind as FloorKind,
      label,
      seats,
      zIndex: data.zIndex,
      color: data.kind === "block" ? null : data.color,
      ...geometry,
    },
  };
}

export function parseItemId(input: unknown): number | null {
  const parsed = z.number().int().positive().safeParse(input);
  return parsed.success ? parsed.data : null;
}
