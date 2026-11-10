import type { ReactNode } from "react";
import { cn } from "cn";
import { itemFill, labelFill } from "@/features/floor/appearance";
import {
  centerOf,
  compareItems,
  labelAnchor,
  viewBoxOf,
  type Size,
  type View,
} from "@/features/floor/geometry";
import type { FloorPlanItem, Point } from "@/features/floor/types";

export function FloorPlan({
  floorWidth,
  floorHeight,
  items,
  view,
  viewport,
  selectedId = null,
  draftPoints = [],
  draftCursor = null,
  className,
  children,
}: {
  floorWidth: number;
  floorHeight: number;
  items: FloorPlanItem[];
  view: View;
  viewport?: Size;
  selectedId?: number | null;
  draftPoints?: Point[];
  draftCursor?: Point | null;
  className?: string;
  children?: ReactNode;
}) {
  const ordered = items.slice().sort(compareItems);
  const marker = markerSize(view, viewport);

  return (
    <svg
      viewBox={viewBoxOf(view)}
      className={cn("h-full w-full font-sans", className)}
    >
      <rect
        x={0}
        y={0}
        width={floorWidth}
        height={floorHeight}
        fill="var(--floor-canvas)"
        stroke="var(--border)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {ordered.map((item) => (
        <FloorShape key={item.id} item={item} selected={item.id === selectedId} />
      ))}
      {draftPoints.length > 0 ? (
        <g>
          <polyline
            points={polyline(draftCursor ? [...draftPoints, draftCursor] : draftPoints)}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {draftPoints.map((point, index) => (
            <circle
              key={`${point.x}:${point.y}:${index}`}
              cx={point.x}
              cy={point.y}
              r={index === 0 ? marker * 1.4 : marker}
              fill={index === 0 ? "var(--primary)" : "var(--card)"}
              stroke="var(--primary)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ) : null}
      {children}
    </svg>
  );
}

function FloorShape({
  item,
  selected,
}: {
  item: FloorPlanItem;
  selected: boolean;
}) {
  const fill = item.fill ?? itemFill(item);
  const structure = item.kind === "block";
  const stroke = selected
    ? "var(--primary)"
    : structure
      ? "var(--muted-foreground)"
      : item.kind === "outline"
        ? "var(--floor-outline)"
        : "var(--foreground)";
  const strokeWidth = selected ? 3 : item.kind === "outline" ? 4 : 1.5;
  const ink = item.ink ?? labelFill(item);
  const transform =
    item.rotation === 0
      ? undefined
      : `rotate(${item.rotation} ${centerOf(item).x} ${centerOf(item).y})`;
  const anchor = labelAnchor(item);
  const labelSize = Math.max(
    14,
    Math.min(32, Math.min(item.width, item.height) * 0.34),
  );
  const seatsSize = Math.max(11, labelSize * 0.62);
  const lines = [
    item.label ? { text: item.label, size: labelSize, weight: 600, opacity: 1 } : null,
    item.seatsLabel
      ? { text: item.seatsLabel, size: seatsSize, weight: 500, opacity: 0.75 }
      : null,
    item.detailLabel
      ? { text: item.detailLabel, size: seatsSize, weight: 600, opacity: 0.9 }
      : null,
  ].filter((line) => line !== null);
  const showLabel = item.kind !== "outline" && lines.length > 0;
  const gap = 1.15;
  const blockHeight = lines.reduce((sum, line) => sum + line.size * gap, 0);

  return (
    <g
      data-floor-item={item.id}
      data-kind={item.kind}
      data-shape={item.shape}
      data-color={item.color ?? ""}
    >
      <g transform={transform}>
        {item.shape === "circle" ? (
          <circle
            cx={centerOf(item).x}
            cy={centerOf(item).y}
            r={item.width / 2}
            fill={fill}
            fillOpacity={structure ? 0.72 : 1}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {item.shape === "square" || item.shape === "rectangle" ? (
          <rect
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            rx={item.kind === "table" ? 8 : 2}
            fill={fill}
            fillOpacity={structure ? 0.72 : 1}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {item.shape === "polygon" && item.points ? (
          <polygon
            points={polyline(item.points)}
            fill={fill}
            fillOpacity={structure ? 0.72 : 1}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        ) : null}
        {item.kind === "table" && item.shape !== "polygon" ? <TableTop item={item} /> : null}
      </g>
      {showLabel ? (
        <text
          x={anchor.x}
          y={anchor.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          fontSize={labelSize}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {lines.map((line, index) => {
            const previous = lines[index - 1];
            const dy =
              index === 0
                ? -blockHeight / 2 + (line.size * gap) / 2
                : ((previous?.size ?? line.size) * gap) / 2 + (line.size * gap) / 2;
            return (
              <tspan
                key={index}
                x={anchor.x}
                dy={dy}
                fontSize={line.size}
                fontWeight={line.weight}
                fillOpacity={line.opacity}
              >
                {line.text}
              </tspan>
            );
          })}
        </text>
      ) : null}
    </g>
  );
}

function TableTop({ item }: { item: FloorPlanItem }) {
  const inset = Math.min(item.width, item.height) * 0.12;
  if (item.shape === "circle") {
    return (
      <circle
        cx={centerOf(item).x}
        cy={centerOf(item).y}
        r={Math.max(item.width / 2 - inset, 1)}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity={0.28}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  return (
    <rect
      x={item.x + inset}
      y={item.y + inset}
      width={Math.max(item.width - inset * 2, 1)}
      height={Math.max(item.height - inset * 2, 1)}
      rx={4}
      fill="none"
      stroke="var(--foreground)"
      strokeOpacity={0.28}
      strokeWidth={1.25}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function polyline(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function markerSize(view: View, viewport?: Size): number {
  if (!viewport || viewport.width <= 0 || view.width <= 0) return 6;
  return 6 / (viewport.width / view.width);
}
