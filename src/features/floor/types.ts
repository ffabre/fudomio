export const floorKinds = ["table", "block", "outline"] as const;
export const floorShapes = ["circle", "square", "rectangle", "polygon"] as const;
export const floorColors = ["sand", "linen", "clay", "sage", "sea", "stone", "wood", "ink"] as const;

export type FloorKind = (typeof floorKinds)[number];
export type FloorShape = (typeof floorShapes)[number];
export type FloorColor = (typeof floorColors)[number];

export type Point = { x: number; y: number };

export type FloorItem = {
  id: number;
  kind: FloorKind;
  shape: FloorShape;
  label: string | null;
  seats: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points: Point[] | null;
  zIndex: number;
  color: FloorColor | null;
};

export type FloorItemWrite = Omit<FloorItem, "id">;

export type FloorData = {
  id: number;
  name: string;
  width: number;
  height: number;
  items: FloorItem[];
};

export type FloorPlanItem = FloorItem & {
  seatsLabel?: string | null;
  detailLabel?: string | null;
  fill?: string;
  ink?: string;
};
