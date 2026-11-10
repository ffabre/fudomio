"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FloorErrorCode } from "@/features/floor/action-result";
import { itemFill } from "@/features/floor/appearance";
import {
  createFloorItem,
  deleteFloorItem,
  updateFloorItem,
} from "@/features/floor/actions";
import { FloorPlan } from "@/features/floor/floor-plan";
import {
  FIT_PADDING_PX,
  GRID,
  MAX_ZOOM,
  MIN_SIZE,
  MIN_ZOOM,
  DUPLICATE_OFFSET,
  boundsOfPoints,
  cameraView,
  clampPoint,
  clampZoom,
  cornerPoint,
  draggedShape,
  hitCorner,
  hitsRotateHandle,
  moveVertex,
  nearestVertex,
  panBy,
  resizeItem,
  rotateHandlePoint,
  rotateToPointer,
  snapPoint,
  snapValue,
  topCenter,
  topmostItem,
  translateItem,
  viewBoxOf,
  withShape,
  zoomAt,
  type BoxItem,
  type Camera,
  type Corner,
  type FloorBounds,
} from "@/features/floor/geometry";
import { nextTableLabel, nextZIndex } from "@/features/floor/labels";
import {
  floorColors,
  floorShapes,
  type FloorColor,
  type FloorData,
  type FloorItem,
  type FloorItemWrite,
  type FloorShape,
  type Point,
} from "@/features/floor/types";

const tools = [
  "select",
  "hand",
  "circle",
  "square",
  "rectangle",
  "polygon",
  "outline",
] as const;

type Tool = (typeof tools)[number];
type DrawTool = "polygon" | "outline";
type SaveState = "idle" | "saving" | "saved" | "error";
type ShownError = FloorErrorCode | "databaseUnavailable";

const toolMessage = {
  select: "tools.select",
  hand: "tools.hand",
  circle: "tools.circle",
  square: "tools.square",
  rectangle: "tools.rectangle",
  polygon: "tools.polygon",
  outline: "tools.outline",
} as const;

function dragShape(tool: Tool): "circle" | "square" | "rectangle" | null {
  if (tool === "circle" || tool === "square" || tool === "rectangle") return tool;
  return null;
}

const shapeMessage = {
  circle: "shapes.circle",
  square: "shapes.square",
  rectangle: "shapes.rectangle",
  polygon: "shapes.polygon",
} as const;

type Gesture =
  | {
      type: "move";
      pointerId: number;
      id: number;
      origin: Point;
      originClient: Point;
      start: FloorItem;
      moved: boolean;
    }
  | {
      type: "resize";
      pointerId: number;
      id: number;
      corner: Corner;
      start: FloorItem;
    }
  | {
      type: "rotate";
      pointerId: number;
      id: number;
      start: FloorItem;
    }
  | {
      type: "vertex";
      pointerId: number;
      id: number;
      index: number;
      start: FloorItem;
    }
  | {
      type: "shape";
      pointerId: number;
      kind: "table" | "block";
      shape: "circle" | "square" | "rectangle";
      origin: Point;
    }
  | {
      type: "draw";
      pointerId: number;
      tool: DrawTool;
      origin: Point;
      originClient: Point;
      moved: boolean;
    }
  | { type: "pan"; pointerId: number; lastX: number; lastY: number };

function worldFromSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Point | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const world = point.matrixTransform(matrix.inverse());
  return { x: world.x, y: world.y };
}

function fingerprint(item: FloorItem | FloorItemWrite): string {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return JSON.stringify({
    kind: item.kind,
    shape: item.shape,
    label: item.label,
    seats: item.seats,
    x: round(item.x),
    y: round(item.y),
    width: round(item.width),
    height: round(item.height),
    rotation: round(item.rotation),
    points: item.points?.map((point) => ({ x: round(point.x), y: round(point.y) })) ?? null,
    zIndex: item.zIndex,
    color: item.color,
  });
}

function toWrite(item: FloorItem): FloorItemWrite {
  return {
    kind: item.kind,
    shape: item.shape,
    label: item.label,
    seats: item.seats,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    points: item.points,
    zIndex: item.zIndex,
    color: item.color,
  };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function FloorEditor({ floor }: { floor: FloorData }) {
  const t = useTranslations("layout");
  const errors = useTranslations("errors");
  const bounds = useMemo<FloorBounds>(
    () => ({ width: floor.width, height: floor.height }),
    [floor.width, floor.height],
  );

  const [items, setItems] = useState(floor.items);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [snap, setSnap] = useState(true);
  const [camera, setCamera] = useState<Camera>({ zoom: 1, panX: 0, panY: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [placeKind, setPlaceKind] = useState<"table" | "block">("table");
  const [shapePreview, setShapePreview] = useState<{
    kind: "table" | "block";
    box: BoxItem;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorCode, setErrorCode] = useState<ShownError | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [spaceDown, setSpaceDown] = useState(false);

  const itemsRef = useRef(items);
  const selectedRef = useRef(selectedId);
  const snapRef = useRef(snap);
  const toolRef = useRef(tool);
  const placeKindRef = useRef(placeKind);
  const draftRef = useRef(draft);
  const viewportSizeRef = useRef(viewport);
  const scaleRef = useRef(1);
  const fitScaleRef = useRef(1);
  const savedRef = useRef(new Map(floor.items.map((item) => [item.id, item])));
  const tempId = useRef(-1);
  const chain = useRef(Promise.resolve());
  const timers = useRef(new Map<number, number>());
  const inflight = useRef(0);
  const savedTimer = useRef<number | null>(null);
  const spaceRef = useRef(false);
  const deleteOpenRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<{
    nudge: (dx: number, dy: number) => void;
    finishDraft: () => void;
    popVertex: () => void;
  }>({
    nudge: () => {},
    finishDraft: () => {},
    popVertex: () => {},
  });

  const framed =
    viewport.width >= 2 && viewport.height >= 2
      ? cameraView(bounds, viewport, FIT_PADDING_PX, camera)
      : null;

  function commit(next: FloorItem[]) {
    itemsRef.current = next;
    setItems(next);
  }

  function select(id: number | null) {
    selectedRef.current = id;
    setSelectedId(id);
  }

  function beginSave() {
    inflight.current += 1;
    setSaveState("saving");
    setErrorCode(null);
  }

  function endSave(ok: boolean, code?: ShownError) {
    inflight.current = Math.max(0, inflight.current - 1);
    if (inflight.current > 0) return;
    if (!ok) {
      setSaveState("error");
      setErrorCode(code ?? "required");
      return;
    }
    setSaveState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => {
      setSaveState((state) => (state === "saved" ? "idle" : state));
    }, 1600);
  }

  function rollback(id: number) {
    const previous = savedRef.current.get(id);
    if (!previous) {
      commit(itemsRef.current.filter((item) => item.id !== id));
      if (selectedRef.current === id) select(null);
    } else {
      commit(itemsRef.current.map((item) => (item.id === id ? previous : item)));
    }
    setRevision((value) => value + 1);
  }

  function enqueue(id: number) {
    chain.current = chain.current
      .then(() => writeItem(id))
      .catch((error: unknown) => {
        console.error(error);
      });
  }

  function schedule(id: number, delay: number) {
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      timers.current.delete(id);
      enqueue(id);
    }, delay);
    timers.current.set(id, timer);
  }

  async function writeItem(id: number) {
    if (id < 0) return;
    const snapshot = itemsRef.current.find((item) => item.id === id);
    if (!snapshot) return;
    const saved = savedRef.current.get(id);
    if (saved && fingerprint(saved) === fingerprint(snapshot)) return;
    beginSave();
    try {
      const result = await updateFloorItem({
        floorId: floor.id,
        id,
        item: toWrite(snapshot),
      });
      if (!result.ok) {
        rollback(id);
        endSave(false, result.error.code);
        return;
      }
      savedRef.current.set(id, result.item);
      const latest = itemsRef.current.find((item) => item.id === id);
      if (latest && fingerprint(latest) === fingerprint(snapshot)) {
        commit(itemsRef.current.map((item) => (item.id === id ? result.item : item)));
      } else if (latest) {
        enqueue(id);
      }
      endSave(true);
    } catch (error) {
      console.error(error);
      rollback(id);
      endSave(false, "databaseUnavailable");
    }
  }

  function putItem(nextItem: FloorItem, when: "now" | "none") {
    commit(itemsRef.current.map((item) => (item.id === nextItem.id ? nextItem : item)));
    if (when === "now") enqueue(nextItem.id);
  }

  function patchItem(
    id: number,
    patch: Partial<FloorItem>,
    when: "now" | "debounce" | "none",
  ) {
    commit(
      itemsRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    if (when === "now") enqueue(id);
    if (when === "debounce") schedule(id, 400);
  }

  function stamp(item: FloorItemWrite): FloorItem {
    return { ...item, id: tempId.current-- };
  }

  async function createItem(draftItem: FloorItem) {
    const sent = fingerprint(draftItem);
    commit([...itemsRef.current, draftItem]);
    select(draftItem.id);
    beginSave();
    try {
      const result = await createFloorItem({
        floorId: floor.id,
        item: toWrite(draftItem),
      });
      if (!result.ok) {
        commit(itemsRef.current.filter((item) => item.id !== draftItem.id));
        if (selectedRef.current === draftItem.id) select(null);
        endSave(false, result.error.code);
        return;
      }
      const local = itemsRef.current.find((item) => item.id === draftItem.id);
      savedRef.current.set(result.item.id, result.item);
      if (!local) {
        endSave(true);
        return;
      }
      if (fingerprint(local) === sent) {
        commit(
          itemsRef.current.map((item) =>
            item.id === draftItem.id ? result.item : item,
          ),
        );
        if (selectedRef.current === draftItem.id) select(result.item.id);
        endSave(true);
        return;
      }
      const merged: FloorItem = { ...local, id: result.item.id };
      commit(
        itemsRef.current.map((item) => (item.id === draftItem.id ? merged : item)),
      );
      if (selectedRef.current === draftItem.id) select(result.item.id);
      endSave(true);
      enqueue(result.item.id);
    } catch (error) {
      console.error(error);
      commit(itemsRef.current.filter((item) => item.id !== draftItem.id));
      if (selectedRef.current === draftItem.id) select(null);
      endSave(false, "databaseUnavailable");
    }
  }

  function placeDragged(kind: "table" | "block", box: BoxItem) {
    setShapePreview(null);
    if (box.width < MIN_SIZE || box.height < MIN_SIZE) return;
    void createItem(
      stamp({
        kind,
        label: kind === "table" ? nextTableLabel(itemsRef.current) : null,
        seats: null,
        zIndex: nextZIndex(itemsRef.current, kind),
        color: null,
        ...box,
      }),
    );
  }

  function changeType(id: number, kind: "table" | "block") {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item || item.kind === "outline" || item.kind === kind) return;
    const others = itemsRef.current.filter((entry) => entry.id !== id);
    const numbered = item.label !== null && /^[1-9]\d{0,8}$/.test(item.label);
    putItem(
      {
        ...item,
        kind,
        seats: kind === "table" ? item.seats : null,
        label:
          kind === "table"
            ? (item.label ?? nextTableLabel(others))
            : numbered
              ? null
              : item.label,
        zIndex: nextZIndex(others, kind),
        color: kind === "block" ? null : item.color,
      },
      "now",
    );
    setRevision((value) => value + 1);
  }

  function finishDraft() {
    const points = draftRef.current;
    const active = toolRef.current;
    if ((active !== "polygon" && active !== "outline") || points.length < 3) return;
    const kind = active === "outline" ? "outline" : placeKindRef.current;
    const clamped = points.map((point) =>
      clampPoint(snapRef.current ? snapPoint(point, true) : point, bounds),
    );
    const box = boundsOfPoints(clamped);
    draftRef.current = [];
    setDraft([]);
    setCursor(null);
    void createItem(
      stamp({
        kind,
        shape: "polygon",
        label: kind === "table" ? nextTableLabel(itemsRef.current) : null,
        seats: null,
        zIndex: nextZIndex(itemsRef.current, kind),
        color: null,
        x: box.x,
        y: box.y,
        width: box.width > 0 ? box.width : 0.001,
        height: box.height > 0 ? box.height : 0.001,
        rotation: 0,
        points: clamped,
      }),
    );
  }

  function addVertex(point: Point) {
    const snapped = clampPoint(
      snapRef.current ? snapPoint(point, true) : point,
      bounds,
    );
    const points = draftRef.current;
    const first = points[0];
    if (points.length >= 3 && first) {
      const tolerance = 12 / scaleRef.current;
      if (Math.hypot(snapped.x - first.x, snapped.y - first.y) <= tolerance) {
        finishDraft();
        return;
      }
    }
    const next = [...points, snapped];
    draftRef.current = next;
    setDraft(next);
  }

  function popVertex() {
    const next = draftRef.current.slice(0, -1);
    draftRef.current = next;
    setDraft(next);
    if (next.length === 0) setCursor(null);
  }

  function nudge(dx: number, dy: number) {
    const id = selectedRef.current;
    if (id === null) return;
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item) return;
    putItem(translateItem(item, dx, dy, bounds), "none");
    schedule(id, 400);
  }

  function duplicate() {
    if (draftRef.current.length > 0) return;
    const id = selectedRef.current;
    if (id === null) return;
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item || item.kind === "outline") return;
    const moved = translateItem(item, DUPLICATE_OFFSET, DUPLICATE_OFFSET, bounds);
    void createItem(
      stamp({
        kind: item.kind,
        shape: moved.shape,
        label: item.kind === "table" ? nextTableLabel(itemsRef.current) : item.label,
        seats: item.kind === "table" ? item.seats : null,
        zIndex: nextZIndex(itemsRef.current, item.kind),
        color: item.kind === "block" ? null : item.color,
        x: moved.x,
        y: moved.y,
        width: moved.width,
        height: moved.height,
        rotation: moved.rotation,
        points: moved.points,
      }),
    );
  }

  async function removeSelected(): Promise<{ ok: true } | { ok: false; error: { code: ShownError } }> {
    const id = selectedRef.current;
    if (id === null) return { ok: true };
    if (id < 0) {
      commit(itemsRef.current.filter((item) => item.id !== id));
      select(null);
      return { ok: true };
    }
    beginSave();
    try {
      const result = await deleteFloorItem(id);
      if (!result.ok) {
        endSave(false, result.error.code);
        return result;
      }
      savedRef.current.delete(id);
      commit(itemsRef.current.filter((item) => item.id !== id));
      select(null);
      endSave(true);
      return { ok: true };
    } catch (error) {
      console.error(error);
      endSave(false, "databaseUnavailable");
      return { ok: false, error: { code: "databaseUnavailable" } };
    }
  }

  function chooseTool(next: Tool) {
    toolRef.current = next;
    setTool(next);
    draftRef.current = [];
    setDraft([]);
    setCursor(null);
    setShapePreview(null);
    if (next === "polygon" || next === "outline") select(null);
  }

  function worldFromEvent(event: { clientX: number; clientY: number }): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    return worldFromSvg(svg, event.clientX, event.clientY);
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (gestureRef.current) return;
    const pan =
      event.button === 1 || toolRef.current === "hand" || spaceRef.current;
    if (event.button !== 0 && !pan) return;
    if (event.button === 1) event.preventDefault();
    const world = worldFromEvent(event);
    if (!world) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    frameRef.current?.focus({ preventScroll: true });

    if (pan) {
      gestureRef.current = {
        type: "pan",
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      return;
    }

    const active = toolRef.current;
    const shape = dragShape(active);
    if (shape) {
      gestureRef.current = {
        type: "shape",
        pointerId: event.pointerId,
        kind: placeKindRef.current,
        shape,
        origin: world,
      };
      setShapePreview(null);
      return;
    }
    if (active === "polygon" || active === "outline") {
      gestureRef.current = {
        type: "draw",
        pointerId: event.pointerId,
        tool: active,
        origin: world,
        originClient: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      return;
    }
    const selected = itemsRef.current.find((item) => item.id === selectedRef.current);
    const handleReach = 22 / scaleRef.current;
    if (selected && active === "select") {
      if (selected.shape === "polygon" && selected.points) {
        const index = nearestVertex(selected.points, world, handleReach);
        if (index !== null) {
          gestureRef.current = {
            type: "vertex",
            pointerId: event.pointerId,
            id: selected.id,
            index,
            start: selected,
          };
          return;
        }
      } else if (hitsRotateHandle(selected, world, handleReach, 28 / scaleRef.current)) {
        gestureRef.current = {
          type: "rotate",
          pointerId: event.pointerId,
          id: selected.id,
          start: selected,
        };
        return;
      } else {
        const corner = hitCorner(selected, world, handleReach);
        if (corner) {
          gestureRef.current = {
            type: "resize",
            pointerId: event.pointerId,
            id: selected.id,
            corner,
            start: selected,
          };
          return;
        }
      }
    }

    const hit = topmostItem(itemsRef.current, world, 8 / scaleRef.current);
    if (!hit) {
      select(null);
      return;
    }
    select(hit.id);
    gestureRef.current = {
      type: "move",
      pointerId: event.pointerId,
      id: hit.id,
      origin: world,
      originClient: { x: event.clientX, y: event.clientY },
      start: hit,
      moved: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const world = worldFromEvent(event);
    if (!world) return;
    const gesture = gestureRef.current;
    if (!gesture) {
      if (
        (toolRef.current === "polygon" || toolRef.current === "outline") &&
        draftRef.current.length > 0
      ) {
        setCursor(world);
      }
      return;
    }
    if (event.pointerId !== gesture.pointerId) return;

    if (gesture.type === "pan") {
      const dx = event.clientX - gesture.lastX;
      const dy = event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      setCamera((current) => panBy(current, fitScaleRef.current, dx, dy));
      return;
    }
    if (gesture.type === "shape") {
      const box = draggedShape(
        gesture.shape,
        gesture.origin,
        world,
        snapRef.current,
        bounds,
      );
      setShapePreview({ kind: gesture.kind, box });
      return;
    }
    if (gesture.type === "draw") {
      if (
        Math.hypot(
          event.clientX - gesture.originClient.x,
          event.clientY - gesture.originClient.y,
        ) > 4
      ) {
        gesture.moved = true;
      }
      return;
    }
    if (gesture.type === "move") {
      if (
        Math.hypot(
          event.clientX - gesture.originClient.x,
          event.clientY - gesture.originClient.y,
        ) > 4
      ) {
        gesture.moved = true;
      }
      if (!gesture.moved) return;
      const dx = world.x - gesture.origin.x;
      const dy = world.y - gesture.origin.y;
      const snappedX = snapRef.current
        ? snapValue(gesture.start.x + dx)
        : gesture.start.x + dx;
      const snappedY = snapRef.current
        ? snapValue(gesture.start.y + dy)
        : gesture.start.y + dy;
      putItem(
        translateItem(
          gesture.start,
          snappedX - gesture.start.x,
          snappedY - gesture.start.y,
          bounds,
        ),
        "none",
      );
      return;
    }
    if (gesture.type === "resize") {
      putItem(
        resizeItem(gesture.start, gesture.corner, world, snapRef.current, bounds),
        "none",
      );
      return;
    }
    if (gesture.type === "rotate") {
      putItem(rotateToPointer(gesture.start, world, snapRef.current, bounds), "none");
      return;
    }
    putItem(
      moveVertex(gesture.start, gesture.index, world, snapRef.current, bounds),
      "none",
    );
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gestureRef.current = null;
    const world = worldFromEvent(event);
    if (gesture.type === "move" && gesture.moved) enqueue(gesture.id);
    if (
      gesture.type === "resize" ||
      gesture.type === "rotate" ||
      gesture.type === "vertex"
    ) {
      enqueue(gesture.id);
    }
    if (gesture.type === "draw" && !gesture.moved) {
      const hit =
        draftRef.current.length === 0
          ? topmostItem(itemsRef.current, gesture.origin, 8 / scaleRef.current)
          : null;
      if (hit) {
        chooseTool("select");
        select(hit.id);
      } else {
        addVertex(gesture.origin);
      }
    }
    if (gesture.type === "shape") {
      const box = draggedShape(
        gesture.shape,
        gesture.origin,
        world ?? gesture.origin,
        snapRef.current,
        bounds,
      );
      if (box.width >= MIN_SIZE && box.height >= MIN_SIZE) {
        placeDragged(gesture.kind, box);
      } else {
        setShapePreview(null);
        const hit = topmostItem(
          itemsRef.current,
          gesture.origin,
          8 / scaleRef.current,
        );
        select(hit ? hit.id : null);
      }
    }
  }

  useLayoutEffect(() => {
    itemsRef.current = items;
    selectedRef.current = selectedId;
    snapRef.current = snap;
    toolRef.current = tool;
    placeKindRef.current = placeKind;
    draftRef.current = draft;
    viewportSizeRef.current = viewport;
    deleteOpenRef.current = deleteOpen;
    if (framed) {
      scaleRef.current = framed.scale;
      fitScaleRef.current = framed.fitScale;
    }
    actionsRef.current = { nudge, finishDraft, popVertex };
  });

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      viewportSizeRef.current = next;
      setViewport(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      const svg = svgRef.current;
      const size = viewportSizeRef.current;
      if (!svg || size.width < 2 || size.height < 2) return;
      event.preventDefault();
      const world = worldFromSvg(svg, event.clientX, event.clientY);
      if (!world) return;
      const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
      setCamera((current) =>
        zoomAt(current, bounds, size, FIT_PADDING_PX, world, current.zoom * factor),
      );
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [bounds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target) || deleteOpenRef.current) return;
      if (event.key === " ") {
        event.preventDefault();
        spaceRef.current = true;
        setSpaceDown(true);
      }
      if (event.key === "Escape") {
        if (draftRef.current.length > 0) {
          draftRef.current = [];
          setDraft([]);
          setCursor(null);
          return;
        }
        select(null);
        return;
      }
      const drawing =
        toolRef.current === "polygon" || toolRef.current === "outline";
      if ((event.key === "Backspace" || event.key === "Delete") && drawing && draftRef.current.length > 0) {
        event.preventDefault();
        actionsRef.current.popVertex();
        return;
      }
      if (event.key === "Enter" && drawing) {
        event.preventDefault();
        actionsRef.current.finishDraft();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        if (selectedRef.current === null) return;
        event.preventDefault();
        setDeleteOpen(true);
        return;
      }
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return;
      }
      if (selectedRef.current === null) return;
      event.preventDefault();
      const step = event.shiftKey ? GRID : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      actionsRef.current.nudge(dx, dy);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== " ") return;
      spaceRef.current = false;
      setSpaceDown(false);
    }
    function onBlur() {
      spaceRef.current = false;
      setSpaceDown(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const planItems = items;
  const handleReach = framed ? 7 / framed.scale : 7;
  const rotateGap = framed ? 28 / framed.scale : 28;
  const canDuplicate =
    selected !== null && selected.kind !== "outline" && draft.length === 0;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-floor-editor={floor.id}
      data-floor-name={floor.name}
    >
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        className="flex max-h-40 shrink-0 flex-wrap items-center gap-1 overflow-y-auto border-b border-border bg-card px-2 py-2"
      >
        {tools.map((entry) => (
          <Button
            key={entry}
            type="button"
            variant={tool === entry ? "default" : "outline"}
            aria-pressed={tool === entry}
            className="h-11 min-h-11 shrink-0 px-3"
            onClick={() => chooseTool(entry)}
          >
            {t(toolMessage[entry])}
          </Button>
        ))}
        <Button
          type="button"
          variant={placeKind === "table" ? "default" : "outline"}
          aria-pressed={placeKind === "table"}
          className="h-11 min-h-11 shrink-0 px-3"
          onClick={() => {
            placeKindRef.current = "table";
            setPlaceKind("table");
          }}
        >
          {t("types.table")}
        </Button>
        <Button
          type="button"
          variant={placeKind === "block" ? "default" : "outline"}
          aria-pressed={placeKind === "block"}
          className="h-11 min-h-11 shrink-0 px-3"
          onClick={() => {
            placeKindRef.current = "block";
            setPlaceKind("block");
          }}
        >
          {t("types.structure")}
        </Button>
        <Button
          type="button"
          variant={snap ? "default" : "outline"}
          aria-pressed={snap}
          className="h-11 min-h-11 shrink-0 px-3"
          onClick={() => setSnap((value) => !value)}
        >
          {t("snap")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          disabled={camera.zoom <= MIN_ZOOM + 0.001}
          onClick={() => setCamera((current) => ({ ...current, zoom: clampZoom(current.zoom / 1.2) }))}
        >
          {t("zoomOut")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          disabled={camera.zoom >= MAX_ZOOM - 0.001}
          onClick={() => setCamera((current) => ({ ...current, zoom: clampZoom(current.zoom * 1.2) }))}
        >
          {t("zoomIn")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          onClick={() => setCamera({ zoom: 1, panX: 0, panY: 0 })}
        >
          {t("fit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          disabled={!canDuplicate}
          onClick={duplicate}
        >
          {t("duplicate")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          disabled={selected === null}
          onClick={() => setDeleteOpen(true)}
        >
          {t("delete")}
        </Button>
        <span
          className="ms-auto flex min-h-11 max-w-full items-center px-2 text-sm"
          aria-live="polite"
          data-save-state={saveState}
        >
          {saveState === "saving" ? t("saving") : null}
          {saveState === "saved" ? t("saved") : null}
          {saveState === "error" && errorCode ? (
            <span className="text-destructive">{errors(errorCode)}</span>
          ) : null}
        </span>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <div
          ref={frameRef}
          role="application"
          aria-label={t("canvas")}
          tabIndex={0}
          data-tool={tool}
          data-snap={snap ? "on" : "off"}
          className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
            tool === "hand" || spaceDown ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair"
          }`}
        >
          {framed ? (
            <>
              <FloorPlan
                floorWidth={floor.width}
                floorHeight={floor.height}
                items={planItems}
                view={framed.view}
                viewport={viewport}
                selectedId={selectedId}
                draftPoints={draft}
                draftCursor={cursor}
                className="pointer-events-none absolute inset-0"
              />
              <svg
                ref={svgRef}
                viewBox={viewBoxOf(framed.view)}
                className="absolute inset-0 h-full w-full touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onAuxClick={(event) => event.preventDefault()}
              >
                <rect
                  x={framed.view.x}
                  y={framed.view.y}
                  width={framed.view.width}
                  height={framed.view.height}
                  fill="transparent"
                />
                {shapePreview ? (
                  shapePreview.box.shape === "circle" ? (
                    <ellipse
                      cx={shapePreview.box.x + shapePreview.box.width / 2}
                      cy={shapePreview.box.y + shapePreview.box.height / 2}
                      rx={shapePreview.box.width / 2}
                      ry={shapePreview.box.height / 2}
                      fill={itemFill({ kind: shapePreview.kind, color: null })}
                      fillOpacity={0.7}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <rect
                      x={shapePreview.box.x}
                      y={shapePreview.box.y}
                      width={shapePreview.box.width}
                      height={shapePreview.box.height}
                      fill={itemFill({ kind: shapePreview.kind, color: null })}
                      fillOpacity={0.7}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                ) : null}
                {selected && tool === "select" && selected.shape !== "polygon" ? (
                  <g>
                    <line
                      x1={topCenter(selected).x}
                      y1={topCenter(selected).y}
                      x2={rotateHandlePoint(selected, rotateGap).x}
                      y2={rotateHandlePoint(selected, rotateGap).y}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={rotateHandlePoint(selected, rotateGap).x}
                      cy={rotateHandlePoint(selected, rotateGap).y}
                      r={handleReach}
                      fill="var(--card)"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                    {(["nw", "ne", "se", "sw"] as Corner[]).map((corner) => {
                      const point = cornerPoint(selected, corner);
                      return (
                        <circle
                          key={corner}
                          cx={point.x}
                          cy={point.y}
                          r={handleReach}
                          fill="var(--card)"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                ) : null}
                {selected && tool === "select" && selected.shape === "polygon"
                  ? selected.points?.map((point, index) => (
                      <circle
                        key={`${point.x}:${point.y}:${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={handleReach}
                        fill="var(--card)"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))
                  : null}
              </svg>
            </>
          ) : null}
          {items.length === 0 && draft.length === 0 && !shapePreview ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <p className="max-w-sm rounded-xl bg-card/95 px-4 py-3 text-center text-base text-muted-foreground shadow-sm">
                {t("empty")}
              </p>
            </div>
          ) : null}
        </div>
        {selected ? (
          <aside className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border bg-card md:max-h-none md:w-72 md:border-t-0 md:border-s">
            <Properties
              key={`${selected.id}:${revision}`}
              item={selected}
              onLabel={(label) => patchItem(selected.id, { label }, "debounce")}
              onShape={(shape) => {
                const current = itemsRef.current.find((item) => item.id === selected.id);
                if (!current) return;
                putItem(withShape(current, shape, bounds), "now");
                setRevision((value) => value + 1);
              }}
              onColor={(color) => patchItem(selected.id, { color }, "now")}
              onType={(kind) => changeType(selected.id, kind)}
              onDelete={() => setDeleteOpen(true)}
            />
          </aside>
        ) : null}
      </div>
      {deleteOpen && selected ? (
        <DeleteItemDialog
          item={selected}
          onClose={() => setDeleteOpen(false)}
          onDelete={removeSelected}
        />
      ) : null}
    </div>
  );
}

function Properties({
  item,
  onLabel,
  onShape,
  onColor,
  onType,
  onDelete,
}: {
  item: FloorItem;
  onLabel: (label: string | null) => void;
  onShape: (shape: FloorShape) => void;
  onColor: (color: FloorColor | null) => void;
  onType: (kind: "table" | "block") => void;
  onDelete: () => void;
}) {
  const t = useTranslations("layout");
  const errors = useTranslations("errors");
  const [label, setLabel] = useState(item.label ?? "");
  const [labelError, setLabelError] = useState<string>();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-medium text-foreground">{t("properties")}</h2>
      {item.kind !== "outline" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="floor-label">{t("label")}</Label>
          <Input
            id="floor-label"
            value={label}
            autoComplete="off"
            className="h-11 min-h-11"
            aria-invalid={labelError ? true : undefined}
            onChange={(event) => {
              const value = event.target.value;
              setLabel(value);
              if (value.length > 80) {
                setLabelError(errors("tooLong"));
                return;
              }
              setLabelError(undefined);
              onLabel(value.trim() === "" ? null : value);
            }}
          />
          {labelError ? (
            <p role="alert" className="text-sm text-destructive">
              {labelError}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="floor-shape">{t("shape")}</Label>
        <NativeSelect
          id="floor-shape"
          value={item.shape}
          onChange={(event) => onShape(event.target.value as FloorShape)}
        >
          {floorShapes.map((shape) => (
            <option key={shape} value={shape}>
              {t(shapeMessage[shape])}
            </option>
          ))}
        </NativeSelect>
      </div>
      {item.shape === "polygon" ? (
        <p className="text-sm text-muted-foreground">{t("vertexHint")}</p>
      ) : null}
      {item.kind !== "outline" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="floor-type">{t("type")}</Label>
          <NativeSelect
            id="floor-type"
            value={item.kind === "table" ? "table" : "structure"}
            onChange={(event) => onType(event.target.value === "table" ? "table" : "block")}
          >
            <option value="table">{t("types.table")}</option>
            <option value="structure">{t("types.structure")}</option>
          </NativeSelect>
        </div>
      ) : null}
      {item.kind === "block" ? null : (
        <div className="flex flex-col gap-2">
          <Label>{t("color")}</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("color")}>
            <Button
              type="button"
              variant={item.color === null ? "default" : "outline"}
              aria-pressed={item.color === null}
              className="h-11 min-h-11 px-3"
              onClick={() => onColor(null)}
            >
              {t("colors.default")}
            </Button>
            {floorColors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t(`colors.${color}`)}
                aria-pressed={item.color === color}
                className={`size-11 rounded-md border-2 ${
                  item.color === color ? "border-primary" : "border-border"
                }`}
                style={{ backgroundColor: `var(--swatch-${color})` }}
                onClick={() => onColor(color)}
              />
            ))}
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="destructive"
        className="h-11 min-h-11"
        onClick={onDelete}
      >
        {t("delete")}
      </Button>
    </div>
  );
}

function DeleteItemDialog({
  item,
  onClose,
  onDelete,
}: {
  item: FloorItem;
  onClose: () => void;
  onDelete: () => Promise<{ ok: true } | { ok: false; error: { code: ShownError } }>;
}) {
  const t = useTranslations("layout");
  const errors = useTranslations("errors");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const title = item.label
    ? t("deleteNamed", { name: item.label })
    : item.kind === "table"
      ? t("deleteTable")
      : item.kind === "block"
        ? t("deleteBlock")
        : t("deleteOutline");

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <AlertDialogHeader className="place-items-start text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 px-3"
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 min-h-11 px-3"
            disabled={pending}
            onClick={() => {
              setMessage(undefined);
              startTransition(async () => {
                const result = await onDelete();
                if (!result.ok) {
                  setMessage(errors(result.error.code));
                  return;
                }
                onClose();
              });
            }}
          >
            {t("deleteConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
