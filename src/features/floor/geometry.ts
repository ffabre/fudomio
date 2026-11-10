import type { FloorKind, FloorShape, Point } from "./types";

export const GRID = 8;
export const ROTATION_STEP = 15;
export const MIN_SIZE = 8;
export const DUPLICATE_OFFSET = 24;
export const FIT_PADDING_PX = 16;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const DEFAULT_FLOOR_WIDTH = 1600;
export const DEFAULT_FLOOR_HEIGHT = 1000;

export type FloorBounds = { width: number; height: number };
export type Size = { width: number; height: number };
export type View = { x: number; y: number; width: number; height: number };
export type Camera = { zoom: number; panX: number; panY: number };
export type Corner = "nw" | "ne" | "se" | "sw";

export type BoxItem = {
  shape: FloorShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points: Point[] | null;
};

const corners: Corner[] = ["nw", "ne", "se", "sw"];

const cornerSigns: Record<Corner, { x: number; y: number }> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
};

const kindOrder: Record<FloorKind, number> = {
  outline: 0,
  block: 1,
  table: 2,
};

export function viewBoxOf(view: View): string {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitView(
  floor: FloorBounds,
  viewport: Size,
  paddingPx: number = FIT_PADDING_PX,
): { view: View; scale: number } {
  const viewportWidth = Math.max(viewport.width, 1);
  const viewportHeight = Math.max(viewport.height, 1);
  const padding = Math.min(paddingPx, viewportWidth / 4, viewportHeight / 4);
  const innerWidth = Math.max(viewportWidth - padding * 2, 1);
  const innerHeight = Math.max(viewportHeight - padding * 2, 1);
  const scale = Math.min(
    innerWidth / Math.max(floor.width, 1),
    innerHeight / Math.max(floor.height, 1),
  );
  const width = viewportWidth / scale;
  const height = viewportHeight / scale;
  return {
    scale,
    view: {
      x: (floor.width - width) / 2,
      y: (floor.height - height) / 2,
      width,
      height,
    },
  };
}

export function cameraView(
  floor: FloorBounds,
  viewport: Size,
  paddingPx: number,
  camera: Camera,
): { view: View; scale: number; fitScale: number } {
  const fitted = fitView(floor, viewport, paddingPx);
  const zoom = clampZoom(camera.zoom);
  const scale = fitted.scale * zoom;
  const width = Math.max(viewport.width, 1) / scale;
  const height = Math.max(viewport.height, 1) / scale;
  const centerX = floor.width / 2 + camera.panX;
  const centerY = floor.height / 2 + camera.panY;
  return {
    fitScale: fitted.scale,
    scale,
    view: {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    },
  };
}

export function zoomAt(
  camera: Camera,
  floor: FloorBounds,
  viewport: Size,
  paddingPx: number,
  world: Point,
  nextZoom: number,
): Camera {
  const current = cameraView(floor, viewport, paddingPx, camera);
  const zoom = clampZoom(nextZoom);
  if (current.view.width === 0 || current.fitScale === 0) {
    return { ...camera, zoom };
  }
  const fractionX = (world.x - current.view.x) / current.view.width;
  const fractionY = (world.y - current.view.y) / current.view.height;
  const viewWidth = Math.max(viewport.width, 1) / (current.fitScale * zoom);
  const viewHeight = Math.max(viewport.height, 1) / (current.fitScale * zoom);
  return {
    zoom,
    panX: world.x - floor.width / 2 + viewWidth / 2 - fractionX * viewWidth,
    panY: world.y - floor.height / 2 + viewHeight / 2 - fractionY * viewHeight,
  };
}

export function panBy(
  camera: Camera,
  fitScale: number,
  dxPx: number,
  dyPx: number,
): Camera {
  const scale = Math.max(fitScale, 0.0001) * clampZoom(camera.zoom);
  return {
    ...camera,
    panX: camera.panX - dxPx / scale,
    panY: camera.panY - dyPx / scale,
  };
}

export function worldToScreen(point: Point, view: View, viewport: Size): Point {
  return {
    x: ((point.x - view.x) / view.width) * viewport.width,
    y: ((point.y - view.y) / view.height) * viewport.height,
  };
}

export function screenToWorld(point: Point, view: View, viewport: Size): Point {
  return {
    x: view.x + (point.x / viewport.width) * view.width,
    y: view.y + (point.y / viewport.height) * view.height,
  };
}

export function snapValue(value: number, enabled = true): number {
  if (!enabled) return value;
  return Math.round(value / GRID) * GRID;
}

export function snapPoint(point: Point, enabled: boolean): Point {
  return {
    x: snapValue(point.x, enabled),
    y: snapValue(point.y, enabled),
  };
}

export function normalizeRotation(degrees: number): number {
  const turned = degrees % 360;
  return turned < 0 ? turned + 360 : turned;
}

export function snapRotation(degrees: number, enabled: boolean): number {
  const normal = normalizeRotation(degrees);
  if (!enabled) return normal;
  return normalizeRotation(Math.round(normal / ROTATION_STEP) * ROTATION_STEP);
}

export function centerOf(item: Pick<BoxItem, "x" | "y" | "width" | "height">): Point {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

export function rotateVector(vector: Point, degrees: number): Point {
  const theta = (degrees * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

export function localToWorld(item: BoxItem, local: Point): Point {
  const center = centerOf(item);
  const rotated = rotateVector(local, item.rotation);
  return { x: center.x + rotated.x, y: center.y + rotated.y };
}

export function worldToLocal(item: BoxItem, world: Point): Point {
  const center = centerOf(item);
  return rotateVector(
    { x: world.x - center.x, y: world.y - center.y },
    -item.rotation,
  );
}

export function cornerPoint(item: BoxItem, corner: Corner): Point {
  const signs = cornerSigns[corner];
  return localToWorld(item, {
    x: (signs.x * item.width) / 2,
    y: (signs.y * item.height) / 2,
  });
}

export function topCenter(item: BoxItem): Point {
  return localToWorld(item, { x: 0, y: -item.height / 2 });
}

export function rotateHandlePoint(item: BoxItem, gap: number): Point {
  return localToWorld(item, { x: 0, y: -item.height / 2 - gap });
}

export function boundsOfPoints(points: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function axisAlignedBounds(item: BoxItem): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (item.shape === "polygon" && item.points && item.points.length > 0) {
    return boundsOfPoints(item.points);
  }
  if (normalizeRotation(item.rotation) === 0) {
    return { x: item.x, y: item.y, width: item.width, height: item.height };
  }
  return boundsOfPoints(corners.map((corner) => cornerPoint(item, corner)));
}

export function clampPoint(point: Point, floor: FloorBounds): Point {
  return {
    x: Math.min(floor.width, Math.max(0, point.x)),
    y: Math.min(floor.height, Math.max(0, point.y)),
  };
}

function applyDelta<T extends BoxItem>(item: T, dx: number, dy: number): T {
  return {
    ...item,
    x: item.x + dx,
    y: item.y + dy,
    points: item.points?.map((point) => ({
      x: point.x + dx,
      y: point.y + dy,
    })) ?? null,
  };
}

export function shiftIntoFloor<T extends BoxItem>(item: T, floor: FloorBounds): T {
  const bounds = axisAlignedBounds(item);
  let dx = 0;
  let dy = 0;
  if (bounds.width <= floor.width) {
    if (bounds.x < 0) dx = -bounds.x;
    else if (bounds.x + bounds.width > floor.width) {
      dx = floor.width - (bounds.x + bounds.width);
    }
  }
  if (bounds.height <= floor.height) {
    if (bounds.y < 0) dy = -bounds.y;
    else if (bounds.y + bounds.height > floor.height) {
      dy = floor.height - (bounds.y + bounds.height);
    }
  }
  if (dx === 0 && dy === 0) return item;
  return applyDelta(item, dx, dy);
}

export function containBox<T extends BoxItem>(item: T, floor: FloorBounds): T {
  if (item.shape === "polygon") {
    const points = (item.points ?? []).map((point) => clampPoint(point, floor));
    const bounds = boundsOfPoints(points);
    return {
      ...item,
      points,
      rotation: 0,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width > 0 ? bounds.width : 0.001,
      height: bounds.height > 0 ? bounds.height : 0.001,
    };
  }

  let current: T = { ...item, points: null };
  let bounds = axisAlignedBounds(current);
  if (
    (bounds.width > floor.width || bounds.height > floor.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  ) {
    const scale = Math.min(floor.width / bounds.width, floor.height / bounds.height);
    const center = centerOf(current);
    const width = current.width * scale;
    const height = current.height * scale;
    current = {
      ...current,
      width,
      height,
      x: center.x - width / 2,
      y: center.y - height / 2,
    };
    bounds = axisAlignedBounds(current);
  }
  return shiftIntoFloor(current, floor);
}

export function translateItem<T extends BoxItem>(
  item: T,
  dx: number,
  dy: number,
  floor: FloorBounds,
): T {
  return shiftIntoFloor(applyDelta(item, dx, dy), floor);
}

export function placedTable(
  shape: "circle" | "square" | "rectangle",
  anchor: Point,
  snap: boolean,
  floor: FloorBounds,
): BoxItem {
  const width = shape === "rectangle" ? 120 : 72;
  const height = 72;
  let x = anchor.x - width / 2;
  let y = anchor.y - height / 2;
  if (snap) {
    x = snapValue(x, true);
    y = snapValue(y, true);
  }
  return shiftIntoFloor(
    { shape, x, y, width, height, rotation: 0, points: null },
    floor,
  );
}

export function draggedShape(
  shape: "circle" | "square" | "rectangle",
  origin: Point,
  current: Point,
  snap: boolean,
  floor: FloorBounds,
): BoxItem {
  const start = snap ? snapPoint(origin, true) : origin;
  const end = snap ? snapPoint(current, true) : current;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let x: number;
  let y: number;
  let width: number;
  let height: number;
  if (shape === "rectangle") {
    width = Math.min(Math.abs(dx), floor.width);
    height = Math.min(Math.abs(dy), floor.height);
    x = Math.min(start.x, end.x);
    y = Math.min(start.y, end.y);
  } else {
    const side = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), floor.width, floor.height);
    width = side;
    height = side;
    x = dx < 0 ? start.x - side : start.x;
    y = dy < 0 ? start.y - side : start.y;
  }
  return shiftIntoFloor(
    { shape, x, y, width, height, rotation: 0, points: null },
    floor,
  );
}

export function resizeItem<T extends BoxItem>(
  start: T,
  corner: Corner,
  pointer: Point,
  snap: boolean,
  floor: FloorBounds,
): T {
  if (start.shape === "polygon") return start;
  const signs = cornerSigns[corner];
  const fixed = localToWorld(start, {
    x: (-signs.x * start.width) / 2,
    y: (-signs.y * start.height) / 2,
  });
  const theta = (start.rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = pointer.x - fixed.x;
  const dy = pointer.y - fixed.y;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  let width = Math.max(MIN_SIZE, signs.x * localX);
  let height = Math.max(MIN_SIZE, signs.y * localY);
  if (start.shape === "square" || start.shape === "circle") {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }
  if (snap) {
    width = Math.max(GRID, snapValue(width, true));
    height = Math.max(GRID, snapValue(height, true));
    if (start.shape === "square" || start.shape === "circle") {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }
  }
  const rotatedFixed = rotateVector(
    { x: (-signs.x * width) / 2, y: (-signs.y * height) / 2 },
    start.rotation,
  );
  const center = {
    x: fixed.x - rotatedFixed.x,
    y: fixed.y - rotatedFixed.y,
  };
  return containBox(
    {
      ...start,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      points: null,
    },
    floor,
  );
}

export function rotateToPointer<T extends BoxItem>(
  item: T,
  pointer: Point,
  snap: boolean,
  floor: FloorBounds,
): T {
  if (item.shape === "polygon") return item;
  const center = centerOf(item);
  const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
  const rotation = snapRotation((angle * 180) / Math.PI + 90, snap);
  return containBox({ ...item, rotation }, floor);
}

export function moveVertex<T extends BoxItem>(
  item: T,
  index: number,
  pointer: Point,
  snap: boolean,
  floor: FloorBounds,
): T {
  if (!item.points || index < 0 || index >= item.points.length) return item;
  const next = clampPoint(snap ? snapPoint(pointer, true) : pointer, floor);
  const points = item.points.map((point, pointIndex) =>
    pointIndex === index ? next : point,
  );
  const bounds = boundsOfPoints(points);
  return {
    ...item,
    points,
    rotation: 0,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width > 0 ? bounds.width : 0.001,
    height: bounds.height > 0 ? bounds.height : 0.001,
  };
}

export function rectangleCorners(item: BoxItem): Point[] {
  return corners.map((corner) => cornerPoint(item, corner));
}

export function withShape<T extends BoxItem>(
  item: T,
  shape: FloorShape,
  floor: FloorBounds,
): T {
  if (shape === item.shape) return item;
  if (shape === "polygon") {
    const points = rectangleCorners(item).map((point) => clampPoint(point, floor));
    const bounds = boundsOfPoints(points);
    return {
      ...item,
      shape,
      rotation: 0,
      points,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width > 0 ? bounds.width : 0.001,
      height: bounds.height > 0 ? bounds.height : 0.001,
    };
  }

  const center = centerOf(item);
  let width = item.width;
  let height = item.height;
  if (shape === "square" || shape === "circle") {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }
  return containBox(
    {
      ...item,
      shape,
      points: null,
      rotation: item.shape === "polygon" ? 0 : item.rotation,
      width,
      height,
      x: center.x - width / 2,
      y: center.y - height / 2,
    },
    floor,
  );
}

export function normalizeGeometry<T extends BoxItem>(
  item: T,
  floor: FloorBounds,
): T {
  if (item.shape === "polygon") {
    return containBox({ ...item, rotation: 0 }, floor);
  }
  let width = item.width;
  let height = item.height;
  if (item.shape === "circle" || item.shape === "square") {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }
  width = Math.min(Math.max(width, MIN_SIZE), floor.width);
  height = Math.min(Math.max(height, MIN_SIZE), floor.height);
  if (item.shape === "circle" || item.shape === "square") {
    const side = Math.min(width, height);
    width = side;
    height = side;
  }
  const center = centerOf(item);
  return containBox(
    {
      ...item,
      width,
      height,
      x: center.x - width / 2,
      y: center.y - height / 2,
      points: null,
      rotation: normalizeRotation(item.rotation),
    },
    floor,
  );
}

export function pointInPolygon(point: Point, points: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index];
    const prior = points[previous];
    if (!current || !prior) continue;
    const crosses =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) +
          current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function distanceToPolygonEdges(points: Point[], point: Point): number {
  let best = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (!start || !end) continue;
    best = Math.min(best, distanceToSegment(point, start, end));
  }
  return best;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function labelAnchor(item: BoxItem): Point {
  const center = centerOf(item);
  if (item.shape !== "polygon" || !item.points || item.points.length < 3) {
    return center;
  }
  if (pointInPolygon(center, item.points)) return center;
  let best = item.points[0] ?? center;
  let bestScore = -1;
  const steps = 9;
  for (let row = 0; row < steps; row += 1) {
    for (let column = 0; column < steps; column += 1) {
      const candidate = {
        x: item.x + ((column + 0.5) / steps) * item.width,
        y: item.y + ((row + 0.5) / steps) * item.height,
      };
      if (!pointInPolygon(candidate, item.points)) continue;
      const score = distanceToPolygonEdges(item.points, candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
}

export function hitsBody(
  item: BoxItem & { kind: FloorKind },
  point: Point,
  tolerance: number,
): boolean {
  return hitsFilled(item, point, tolerance);
}

function hitsFilled(item: BoxItem, point: Point, tolerance: number): boolean {
  if (item.shape === "circle") {
    const center = centerOf(item);
    return Math.hypot(point.x - center.x, point.y - center.y) <= item.width / 2 + tolerance;
  }
  if (item.shape === "polygon") {
    if (!item.points || item.points.length < 3) return false;
    return (
      pointInPolygon(point, item.points) ||
      distanceToPolygonEdges(item.points, point) <= tolerance
    );
  }
  const local = worldToLocal(item, point);
  return (
    Math.abs(local.x) <= item.width / 2 + tolerance &&
    Math.abs(local.y) <= item.height / 2 + tolerance
  );
}

export function compareItems(
  a: { kind: FloorKind; zIndex: number; id: number },
  b: { kind: FloorKind; zIndex: number; id: number },
): number {
  return kindOrder[a.kind] - kindOrder[b.kind] || a.zIndex - b.zIndex || a.id - b.id;
}

export function topmostItem<
  T extends BoxItem & { kind: FloorKind; zIndex: number; id: number },
>(items: T[], point: Point, tolerance: number): T | null {
  const ordered = items.slice().sort(compareItems);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const item = ordered[index];
    if (item && hitsBody(item, point, tolerance)) return item;
  }
  return null;
}

export function nearestVertex(
  points: Point[],
  point: Point,
  tolerance: number,
): number | null {
  let best = -1;
  let bestDistance = tolerance;
  points.forEach((vertex, index) => {
    const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best === -1 ? null : best;
}

export function hitCorner(
  item: BoxItem,
  point: Point,
  tolerance: number,
): Corner | null {
  if (item.shape === "polygon") return null;
  let best: Corner | null = null;
  let bestDistance = tolerance;
  for (const corner of corners) {
    const location = cornerPoint(item, corner);
    const distance = Math.hypot(location.x - point.x, location.y - point.y);
    if (distance <= bestDistance) {
      best = corner;
      bestDistance = distance;
    }
  }
  return best;
}

export function hitsRotateHandle(
  item: BoxItem,
  point: Point,
  tolerance: number,
  gap: number,
): boolean {
  if (item.shape === "polygon") return false;
  const handle = rotateHandlePoint(item, gap);
  return Math.hypot(handle.x - point.x, handle.y - point.y) <= tolerance;
}
