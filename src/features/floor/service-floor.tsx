"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  startTransition,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FloorPlan } from "@/features/floor/floor-plan";
import { centerOf, compareItems, fitView, worldToScreen, type Size } from "@/features/floor/geometry";
import type { FloorData, FloorItem, FloorPlanItem } from "@/features/floor/types";
import type { OrderActionResult } from "@/features/orders/action-result";
import {
  addProduct,
  cancelOrder,
  closeOrder,
  removeLine,
  sendOrder,
  setLineNote,
  setLineQuantity,
} from "@/features/orders/actions";
import { readDraft, useDraft, writeDraft } from "@/features/orders/draft-store";
import { OrderPanel, type TicketHandlers } from "@/features/orders/order-panel";
import {
  ticketSummary,
  type DraftLine,
  type Menu,
  type MenuProduct,
  type OpenOrder,
  type TicketLine,
} from "@/features/orders/types";
import { formatPrice } from "@/lib/money";

const MIN_TARGET_PX = 44;
const WIDE_QUERY = "(min-width: 64rem)";

type TableStatus = "free" | "occupied";

// Optimistic edits to open orders. Each one is replaced by the server's copy
// once its action finishes and the page re-renders.
type OrderOp =
  | { type: "open"; tableId: number; lines: DraftLine[] }
  | { type: "add"; tableId: number; product: MenuProduct }
  | { type: "quantity"; tableId: number; productId: number; quantity: number }
  | { type: "note"; tableId: number; productId: number; note: string | null }
  | { type: "remove"; tableId: number; productId: number }
  | { type: "clear"; tableId: number };

export function ServiceFloor({
  floor,
  openOrders,
  menu,
}: {
  floor: FloorData;
  openOrders: OpenOrder[];
  menu: Menu;
}) {
  const t = useTranslations("floor");
  const o = useTranslations("orders");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const wide = useWide();
  const frameRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [orders, applyOrderOp] = useOptimistic(openOrders, applyOp);

  const ordersByItem = useMemo(
    () => new Map(orders.map((order) => [order.floorItemId, order])),
    [orders],
  );
  const tables = useMemo(
    () => floor.items.filter((item) => item.kind === "table").sort(compareItems),
    [floor.items],
  );

  const param = searchParams.get("table");
  const selected = tables.find((item) => String(item.id) === param) ?? null;
  const selectedOrder = selected ? (ordersByItem.get(selected.id) ?? null) : null;
  const draft = useDraft(selected && !selectedOrder ? selected.id : null);

  function select(id: number | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (id === null) next.delete("table");
    else next.set("table", String(id));
    const query = next.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function mutate(
    op: OrderOp,
    call: () => Promise<OrderActionResult>,
    after?: (result: OrderActionResult) => void,
  ) {
    startTransition(async () => {
      applyOrderOp(op);
      const result = await call();
      if (!result.ok) toast.error(errors(result.error.code));
      after?.(result);
    });
  }

  const handlers: TicketHandlers = selected
    ? selectedOrder
      ? openOrderHandlers(selected.id, mutate)
      : draftHandlers(selected.id)
    : NO_HANDLERS;

  function send() {
    if (!selected || draft.length === 0) return;
    const tableId = selected.id;
    const lines = draft;
    mutate(
      { type: "open", tableId, lines },
      () =>
        sendOrder({
          tableId,
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            note: line.note,
          })),
        }),
      (result) => {
        // On a lost race the other device's order is shown instead; the draft goes.
        if (result.ok || result.error.code === "orderAlreadyOpen") writeDraft(tableId, []);
        if (result.ok) toast.success(o("sent"));
      },
    );
  }

  function finish(kind: "close" | "cancel") {
    if (!selected) return;
    const tableId = selected.id;
    mutate(
      { type: "clear", tableId },
      () => (kind === "close" ? closeOrder({ tableId }) : cancelOrder({ tableId })),
      (result) => {
        if (result.ok) toast.success(o(kind === "close" ? "closed" : "cancelled"));
      },
    );
  }

  const planItems: FloorPlanItem[] = floor.items.map((item) => {
    if (item.kind !== "table") return item;
    const order = ordersByItem.get(item.id);
    const summary = order ? ticketSummary(order.lines) : null;
    return {
      ...item,
      fill: order ? "var(--status-occupied)" : "var(--status-free)",
      ink: order ? "var(--primary-foreground)" : "var(--foreground)",
      seatsLabel: item.seats ? t("seats", { count: item.seats }) : null,
      detailLabel: summary
        ? `${t("items", { count: summary.itemCount })} · ${formatPrice(summary.totalCents, locale)}`
        : null,
    };
  });

  const framed =
    viewport && viewport.width > 1 && viewport.height > 1
      ? { ...fitView(floor, viewport), viewport }
      : null;

  const statusOf = (item: FloorItem): TableStatus =>
    ordersByItem.has(item.id) ? "occupied" : "free";

  const panel = (inSheet: boolean) => (
    <OrderPanel
      inSheet={inSheet}
      table={selected}
      occupied={selectedOrder !== null}
      lines={selectedOrder ? selectedOrder.lines : draftTicket(draft)}
      menu={menu}
      handlers={handlers}
      onSend={send}
      onDiscard={() => selected && writeDraft(selected.id, [])}
      onClose={() => finish("close")}
      onCancel={() => finish("cancel")}
    />
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <section
        aria-label={t("canvas")}
        ref={frameRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted"
      >
        {floor.items.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center ps-6 pe-6 text-center text-2xl leading-snug text-muted-foreground">
            {t("empty")}
          </p>
        ) : framed ? (
          <>
            <FloorPlan
              floorWidth={floor.width}
              floorHeight={floor.height}
              items={planItems}
              view={framed.view}
              viewport={framed.viewport}
              selectedId={selected?.id ?? null}
              className="pointer-events-none absolute inset-0 select-none"
            />
            {tables.map((item) => {
              const status = statusOf(item);
              const center = worldToScreen(centerOf(item), framed.view, framed.viewport);
              const width = Math.max(item.width * framed.scale, MIN_TARGET_PX);
              const height = Math.max(item.height * framed.scale, MIN_TARGET_PX);
              const isSelected = item.id === selected?.id;
              const statusText = t(`status.${status}`);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-table={item.id}
                  data-status={status}
                  aria-pressed={isSelected}
                  aria-label={
                    item.label
                      ? t("tableButton", { label: item.label, status: statusText })
                      : t("tableButtonUnlabeled", { status: statusText })
                  }
                  onClick={() => select(item.id)}
                  className={cn(
                    "absolute cursor-pointer bg-transparent outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/60",
                    item.shape === "circle" ? "rounded-full" : "rounded-md",
                    isSelected && "outline-3 outline-offset-3 outline-primary",
                  )}
                  style={{
                    left: center.x - width / 2,
                    top: center.y - height / 2,
                    width,
                    height,
                    transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                  }}
                />
              );
            })}
          </>
        ) : null}
      </section>
      <aside
        aria-label={t("panel")}
        className="hidden w-2/5 shrink-0 flex-col overflow-hidden border-s border-border bg-card lg:flex"
      >
        {wide ? panel(false) : null}
      </aside>
      <Sheet
        open={!wide && selected !== null}
        onOpenChange={(open) => {
          if (!open) select(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none"
        >
          <div className="flex shrink-0 items-center border-b border-border ps-2 pe-2 py-2">
            <Button
              variant="ghost"
              className="h-11 min-h-11 gap-2 px-3 text-base"
              onClick={() => select(null)}
            >
              <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
              {t("back")}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{wide ? null : panel(true)}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const NO_HANDLERS: TicketHandlers = {
  add: () => {},
  setQuantity: () => {},
  setNote: () => {},
  remove: () => {},
};

function draftTicket(lines: DraftLine[]): TicketLine[] {
  return lines.map((line) => ({ ...line, key: `draft-${line.productId}` }));
}

// Each call reads the stored draft, so taps faster than a render are not lost.
function draftHandlers(tableId: number): TicketHandlers {
  const update = (productId: number, change: (line: DraftLine) => DraftLine | null) =>
    writeDraft(
      tableId,
      readDraft(tableId).flatMap((line) => {
        if (line.productId !== productId) return [line];
        const next = change(line);
        return next ? [next] : [];
      }),
    );

  return {
    add: (product) => {
      const draft = readDraft(tableId);
      if (draft.some((line) => line.productId === product.id)) {
        update(product.id, (line) => ({ ...line, quantity: line.quantity + 1 }));
        return;
      }
      writeDraft(tableId, [
        ...draft,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.priceCents,
          quantity: 1,
          note: null,
        },
      ]);
    },
    setQuantity: (line, quantity) =>
      update(line.productId, (current) => ({ ...current, quantity: Math.max(1, quantity) })),
    setNote: (line, note) => update(line.productId, (current) => ({ ...current, note })),
    remove: (line) => update(line.productId, () => null),
  };
}

function openOrderHandlers(
  tableId: number,
  mutate: (op: OrderOp, call: () => Promise<OrderActionResult>) => void,
): TicketHandlers {
  return {
    add: (product) =>
      mutate({ type: "add", tableId, product }, () =>
        addProduct({ tableId, productId: product.id }),
      ),
    setQuantity: (line, quantity) =>
      mutate({ type: "quantity", tableId, productId: line.productId, quantity }, () =>
        setLineQuantity({ tableId, productId: line.productId, quantity }),
      ),
    setNote: (line, note) =>
      mutate({ type: "note", tableId, productId: line.productId, note }, () =>
        setLineNote({ tableId, productId: line.productId, note }),
      ),
    remove: (line) =>
      mutate({ type: "remove", tableId, productId: line.productId }, () =>
        removeLine({ tableId, productId: line.productId }),
      ),
  };
}

function applyOp(orders: OpenOrder[], op: OrderOp): OpenOrder[] {
  if (op.type === "open") {
    if (orders.some((order) => order.floorItemId === op.tableId)) return orders;
    return [
      ...orders,
      { id: -op.tableId, floorItemId: op.tableId, lines: draftTicket(op.lines) },
    ];
  }
  if (op.type === "clear") {
    return orders.filter((order) => order.floorItemId !== op.tableId);
  }
  return orders.map((order) => {
    if (order.floorItemId !== op.tableId) return order;
    return { ...order, lines: applyLineOp(order.lines, op) };
  });
}

// Like the server, edits act on the first line for a product.
function applyLineOp(lines: TicketLine[], op: Exclude<OrderOp, { type: "open" | "clear" }>) {
  const productId = op.type === "add" ? op.product.id : op.productId;
  const index = lines.findIndex((line) => line.productId === productId);
  if (op.type === "add") {
    if (index === -1) {
      return [
        ...lines,
        {
          key: `pending-${productId}`,
          productId,
          name: op.product.name,
          unitPriceCents: op.product.priceCents,
          quantity: 1,
          note: null,
        },
      ];
    }
  }
  if (index === -1) return lines;
  if (op.type === "remove") return lines.filter((_, at) => at !== index);
  return lines.map((line, at) => {
    if (at !== index) return line;
    if (op.type === "add") return { ...line, quantity: line.quantity + 1 };
    if (op.type === "quantity") return { ...line, quantity: op.quantity };
    return { ...line, note: op.note };
  });
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}
