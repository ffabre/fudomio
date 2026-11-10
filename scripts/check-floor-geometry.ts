import assert from "node:assert/strict";
import {
  FIT_PADDING_PX,
  axisAlignedBounds,
  cameraView,
  cornerPoint,
  draggedShape,
  fitView,
  hitsBody,
  labelAnchor,
  moveVertex,
  panBy,
  placedTable,
  pointInPolygon,
  resizeItem,
  rotateToPointer,
  snapRotation,
  snapValue,
  translateItem,
  withShape,
  zoomAt,
  type BoxItem,
} from "../src/features/floor/geometry.ts";
import { nextTableLabel, nextZIndex } from "../src/features/floor/labels.ts";

const floor = { width: 1600, height: 1000 };

function close(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} !== ${expected}`);
}

const fitted = fitView(floor, { width: 800, height: 600 }, FIT_PADDING_PX);
const cameraFitted = cameraView(
  floor,
  { width: 800, height: 600 },
  FIT_PADDING_PX,
  { zoom: 1, panX: 0, panY: 0 },
);
close(cameraFitted.view.x, fitted.view.x, "fit x");
close(cameraFitted.view.y, fitted.view.y, "fit y");
close(cameraFitted.view.width, fitted.view.width, "fit width");
close(cameraFitted.scale, fitted.scale, "fit scale");

const camera = { zoom: 1, panX: 40, panY: -20 };
const current = cameraView(floor, { width: 800, height: 600 }, 16, camera);
const world = {
  x: current.view.x + current.view.width * 0.25,
  y: current.view.y + current.view.height * 0.7,
};
const zoomed = zoomAt(camera, floor, { width: 800, height: 600 }, 16, world, 1.5);
const next = cameraView(floor, { width: 800, height: 600 }, 16, zoomed);
close((world.x - next.view.x) / next.view.width, 0.25, "zoom fraction x");
close((world.y - next.view.y) / next.view.height, 0.7, "zoom fraction y");
assert.equal(zoomed.zoom, 1.5);

const panned = panBy(camera, current.fitScale, 10, 0);
assert.ok(panned.panX < camera.panX, "drag right moves the view left");

const table: BoxItem = {
  shape: "rectangle",
  x: 200,
  y: 200,
  width: 80,
  height: 40,
  rotation: 0,
  points: null,
};
const fixed = cornerPoint(table, "nw");
const grown = resizeItem(
  table,
  "se",
  { x: 200 + 120, y: 200 + 60 },
  false,
  floor,
);
close(grown.x, 200, "resize x");
close(grown.y, 200, "resize y");
close(grown.width, 120, "resize width");
close(grown.height, 60, "resize height");
const stillFixed = cornerPoint(grown, "nw");
close(stillFixed.x, fixed.x, "fixed corner x");
close(stillFixed.y, fixed.y, "fixed corner y");

const squared = resizeItem(
  { ...table, shape: "square", width: 80, height: 80 },
  "se",
  { x: 280, y: 300 },
  false,
  floor,
);
assert.equal(squared.width, squared.height);
close(squared.width, 100, "square side");

const circled = resizeItem(
  { ...table, shape: "circle", width: 72, height: 72 },
  "se",
  { x: table.x + 90, y: table.y + 40 },
  false,
  floor,
);
assert.equal(circled.width, circled.height);

const snapped = resizeItem(table, "se", { x: 200 + 76, y: 200 + 44 }, true, floor);
assert.equal(snapped.width % 8, 0);
assert.equal(snapped.height % 8, 0);

const rotated = rotateToPointer(table, { x: table.x + 40, y: table.y + 20 - 80 }, false, floor);
close(rotated.rotation, 0, "handle above is 0 degrees");
const turned = rotateToPointer(table, { x: 400, y: 220 }, true, floor);
assert.equal(turned.rotation % 15, 0);

const wide: BoxItem = {
  shape: "rectangle",
  x: 100,
  y: 100,
  width: 80,
  height: 40,
  rotation: 0,
  points: null,
};
const asSquare = withShape(wide, "square", floor);
assert.equal(asSquare.shape, "square");
assert.equal(asSquare.width, 80);
assert.equal(asSquare.height, 80);
close(asSquare.x + asSquare.width / 2, 140, "square center x");
close(asSquare.y + asSquare.height / 2, 120, "square center y");

const asPolygon = withShape({ ...wide, rotation: 90 }, "polygon", floor);
assert.equal(asPolygon.shape, "polygon");
assert.equal(asPolygon.rotation, 0);
assert.equal(asPolygon.points?.length, 4);
const rotatedBox = axisAlignedBounds({ ...wide, rotation: 90 });
close(rotatedBox.width, 40, "rotated aabb width");
close(rotatedBox.height, 80, "rotated aabb height");

const lShape: BoxItem = {
  shape: "polygon",
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  rotation: 0,
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 80 },
    { x: 80, y: 80 },
    { x: 80, y: 200 },
    { x: 0, y: 200 },
  ],
};
assert.equal(pointInPolygon({ x: 20, y: 150 }, lShape.points ?? []), true);
assert.equal(pointInPolygon({ x: 150, y: 150 }, lShape.points ?? []), false);
assert.equal(
  hitsBody({ ...lShape, kind: "table" }, { x: 20, y: 150 }, 0),
  true,
);
assert.equal(
  hitsBody({ ...lShape, kind: "outline" }, { x: 20, y: 150 }, 4),
  true,
);
assert.equal(
  hitsBody({ ...lShape, kind: "outline" }, { x: 200, y: 40 }, 4),
  true,
);
const anchor = labelAnchor(lShape);
assert.equal(pointInPolygon(anchor, lShape.points ?? []), true);

const moved = moveVertex(lShape, 2, { x: 180, y: 60 }, true, floor);
assert.equal(moved.points?.[2]?.x, 184);
assert.equal(moved.points?.[2]?.y, 64);
close(moved.x, 0, "vertex bbox x");
close(moved.width, 200, "vertex bbox width");

const dropped = placedTable("circle", { x: 400, y: 300 }, true, floor);
assert.equal(dropped.width, 72);
assert.equal(dropped.height, 72);
assert.equal(dropped.x % 8, 0);
assert.equal(dropped.y % 8, 0);

const dragged = draggedShape("rectangle", { x: 40, y: 40 }, { x: 40, y: 40 }, true, floor);
assert.equal(dragged.width, 0);
assert.equal(dragged.height, 0);
const stretched = draggedShape("rectangle", { x: 40, y: 40 }, { x: 200, y: 100 }, true, floor);
assert.equal(stretched.width, 160);
assert.equal(stretched.height, 64);
const square = draggedShape("square", { x: 40, y: 40 }, { x: 120, y: 80 }, true, floor);
assert.equal(square.width, 80);
assert.equal(square.height, 80);
const circle = draggedShape("circle", { x: 200, y: 200 }, { x: 100, y: 80 }, true, floor);
assert.equal(circle.width, circle.height);
assert.equal(circle.x, 80);
assert.equal(circle.y, 80);

const shoved = translateItem({ ...table, x: -20, y: 10 }, 0, 0, floor);
assert.ok(shoved.x >= 0, "clamped inside the floor");
const edge = translateItem({ ...table, x: 1580, y: 10 }, 40, 0, floor);
assert.ok(edge.x + edge.width <= floor.width, "cannot leave the right edge");

assert.equal(snapValue(12), 16);
assert.equal(snapValue(12, false), 12);
assert.equal(snapRotation(7, true), 0);
assert.equal(snapRotation(8, true), 15);
assert.equal(snapRotation(10, false), 10);

assert.equal(nextTableLabel([{ label: "1" }, { label: "3" }, { label: "Bar" }]), "2");
assert.equal(nextTableLabel([{ label: "02" }]), "1");
assert.equal(nextZIndex([], "outline"), 0);
assert.equal(nextZIndex([{ kind: "outline", zIndex: 0 }], "outline"), 1);
assert.equal(nextZIndex([], "block"), 1);
assert.equal(nextZIndex([], "table"), 2);

console.log("floor geometry ok");
