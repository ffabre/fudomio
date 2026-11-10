"use client";

import {
  MessageSquareTextIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetTitle } from "@/components/ui/sheet";
import type { FloorItem } from "@/features/floor/types";
import { matchesSearch } from "@/features/orders/search";
import {
  NOTE_MAX_LENGTH,
  ticketSummary,
  type Menu,
  type MenuProduct,
  type TicketLine,
} from "@/features/orders/types";
import { formatPrice } from "@/lib/money";

export type TicketHandlers = {
  add: (product: MenuProduct) => void;
  setQuantity: (line: TicketLine, quantity: number) => void;
  setNote: (line: TicketLine, note: string | null) => void;
  remove: (line: TicketLine) => void;
};

export function OrderPanel({
  inSheet,
  table,
  occupied,
  lines,
  menu,
  handlers,
  onSend,
  onDiscard,
  onClose,
  onCancel,
}: {
  inSheet: boolean;
  table: FloorItem | null;
  occupied: boolean;
  lines: TicketLine[];
  menu: Menu;
  handlers: TicketHandlers;
  onSend: () => void;
  onDiscard: () => void;
  onClose: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("floor");
  const o = useTranslations("orders");
  const locale = useLocale();
  const [confirm, setConfirm] = useState<"close" | "cancel" | null>(null);
  // The sheet needs a dialog title; the wide column uses a heading.
  const Title = inSheet ? SheetTitle : "h2";

  if (!table) {
    return (
      <div className="flex flex-1 items-center justify-center ps-6 pe-6 py-10">
        <p className="text-center text-xl text-muted-foreground">{t("selectTable")}</p>
      </div>
    );
  }

  const status = occupied ? "occupied" : "free";
  const { totalCents } = ticketSummary(lines);
  const quantities = new Map(lines.map((line) => [line.productId, line.quantity]));

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-panel-table={table.id}>
      <header className="flex shrink-0 flex-col gap-2 ps-5 pe-5 pt-5 pb-3">
        <Title className="text-2xl font-semibold tracking-tight text-foreground">
          {table.label ? t("tableNamed", { label: table.label }) : t("table")}
        </Title>
        <div className="flex flex-wrap items-center gap-3 text-base">
          <span
            data-status={status}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 font-medium",
              occupied
                ? "border-transparent bg-status-occupied text-primary-foreground"
                : "border-border bg-status-free text-foreground",
            )}
          >
            {t(`status.${status}`)}
          </span>
          {table.seats ? (
            <span className="text-muted-foreground">{t("seats", { count: table.seats })}</span>
          ) : null}
        </div>
      </header>

      <section
        aria-label={o("ticket")}
        className="max-h-[42%] min-h-16 shrink overflow-y-auto border-t border-border ps-5 pe-5"
      >
        <div className="flex items-center justify-between gap-3 pt-3">
          <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {o("ticket")}
          </h3>
          {!occupied && lines.length > 0 ? (
            <span className="text-sm font-medium text-muted-foreground">{o("draft")}</span>
          ) : null}
        </div>
        {lines.length === 0 ? (
          <p className="py-4 text-base text-muted-foreground">{o("emptyTicket")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((line) => (
              <TicketRow key={line.key} line={line} locale={locale} handlers={handlers} />
            ))}
          </ul>
        )}
      </section>

      <div className="flex shrink-0 items-baseline justify-between gap-4 border-y border-border bg-muted/50 ps-5 pe-5 py-3 text-lg">
        <span className="font-medium">{o("total")}</span>
        <span className="font-semibold tabular-nums" data-ticket-total>
          {formatPrice(totalCents, locale)}
        </span>
      </div>

      <ProductPicker menu={menu} quantities={quantities} onAdd={handlers.add} locale={locale} />

      <footer className="flex shrink-0 gap-3 border-t border-border ps-5 pe-5 py-3">
        {occupied ? (
          <>
            <Button
              variant="destructive"
              className="h-12 flex-1 text-base"
              onClick={() => setConfirm("cancel")}
            >
              {o("cancel")}
            </Button>
            <Button className="h-12 flex-1 text-base" onClick={() => setConfirm("close")}>
              {o("close")}
            </Button>
          </>
        ) : (
          <>
            {lines.length > 0 ? (
              <Button variant="outline" className="h-12 flex-1 text-base" onClick={onDiscard}>
                {o("discard")}
              </Button>
            ) : null}
            <Button
              className="h-12 flex-1 text-base"
              disabled={lines.length === 0}
              onClick={onSend}
            >
              {o("send")}
            </Button>
          </>
        )}
      </footer>

      <ConfirmDialog
        open={confirm === "close"}
        title={o("closeTitle")}
        body={
          table.label ? o("closeBody", { label: table.label }) : o("closeBodyUnlabeled")
        }
        confirmLabel={o("close")}
        keepLabel={o("keep")}
        onConfirm={() => {
          setConfirm(null);
          onClose();
        }}
        onDismiss={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        destructive
        title={o("cancelTitle")}
        body={o("cancelBody")}
        confirmLabel={o("cancel")}
        keepLabel={o("keep")}
        onConfirm={() => {
          setConfirm(null);
          onCancel();
        }}
        onDismiss={() => setConfirm(null)}
      />
    </div>
  );
}

function TicketRow({
  line,
  locale,
  handlers,
}: {
  line: TicketLine;
  locale: string;
  handlers: TicketHandlers;
}) {
  const o = useTranslations("orders");
  const [editing, setEditing] = useState(false);
  const name = line.name;

  function saveNote(value: string) {
    setEditing(false);
    const next = value.trim() === "" ? null : value.trim();
    if (next !== line.note) handlers.setNote(line, next);
  }

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0" data-line-product={line.productId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-medium break-words">{name}</p>
          {line.note && !editing ? (
            <p className="text-sm break-words text-muted-foreground italic">{line.note}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-base font-medium tabular-nums">
          {formatPrice(line.quantity * line.unitPriceCents, locale)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="size-11"
          aria-label={line.quantity === 1 ? o("remove", { name }) : o("decrease", { name })}
          onClick={() =>
            line.quantity === 1
              ? handlers.remove(line)
              : handlers.setQuantity(line, line.quantity - 1)
          }
        >
          <MinusIcon className="size-5" />
        </Button>
        <output
          aria-label={o("quantity")}
          className="min-w-8 text-center text-lg font-semibold tabular-nums"
        >
          {line.quantity}
        </output>
        <Button
          variant="outline"
          className="size-11"
          aria-label={o("increase", { name })}
          onClick={() => handlers.setQuantity(line, line.quantity + 1)}
        >
          <PlusIcon className="size-5" />
        </Button>
        <Button
          variant={line.note ? "secondary" : "ghost"}
          className="size-11"
          aria-label={line.note ? o("editNote", { name }) : o("addNote", { name })}
          aria-expanded={editing}
          onClick={() => setEditing((current) => !current)}
        >
          <MessageSquareTextIcon className="size-5" />
        </Button>
        <Button
          variant="ghost"
          className="ms-auto size-11 text-muted-foreground hover:text-destructive"
          aria-label={o("remove", { name })}
          onClick={() => handlers.remove(line)}
        >
          <Trash2Icon className="size-5" />
        </Button>
      </div>
      {editing ? (
        <Input
          autoFocus
          defaultValue={line.note ?? ""}
          maxLength={NOTE_MAX_LENGTH}
          aria-label={o("note", { name })}
          placeholder={o("notePlaceholder")}
          className="h-11 text-base"
          onBlur={(event) => saveNote(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.stopPropagation();
              event.currentTarget.value = line.note ?? "";
              event.currentTarget.blur();
            }
          }}
        />
      ) : null}
    </li>
  );
}

function ProductPicker({
  menu,
  quantities,
  onAdd,
  locale,
}: {
  menu: Menu;
  quantities: Map<number, number>;
  onAdd: (product: MenuProduct) => void;
  locale: string;
}) {
  const o = useTranslations("orders");
  const [query, setQuery] = useState("");
  const [categoryChoice, setCategoryChoice] = useState<number | null>(null);
  const [subcategoryChoice, setSubcategoryChoice] = useState<number | null>(null);

  const category =
    menu.categories.find((entry) => entry.id === categoryChoice) ?? menu.categories[0] ?? null;
  const subcategories = category
    ? menu.subcategories.filter((sub) => sub.categoryId === category.id)
    : [];
  const subcategory =
    subcategories.find((entry) => entry.id === subcategoryChoice) ?? subcategories[0] ?? null;
  const searching = query.trim() !== "";
  const subcategoryNames = new Map(menu.subcategories.map((sub) => [sub.id, sub.name]));

  const shown = searching
    ? menu.products.filter((product) => matchesSearch(product.name, query))
    : menu.products.filter((product) => product.subcategoryId === subcategory?.id);

  return (
    <section
      aria-label={o("menu")}
      className="flex min-h-48 flex-1 flex-col overflow-hidden"
    >
      <div className="flex shrink-0 flex-col gap-3 ps-5 pe-5 pt-3 pb-2">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") {
                event.stopPropagation();
                setQuery("");
              }
            }}
            aria-label={o("search")}
            placeholder={o("searchPlaceholder")}
            className="h-11 ps-10 pe-11 text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <Button
              variant="ghost"
              className="absolute end-0 top-0 size-11"
              aria-label={o("clearSearch")}
              onClick={() => setQuery("")}
            >
              <XIcon className="size-5" />
            </Button>
          ) : null}
        </div>
        {!searching && menu.categories.length > 0 ? (
          <>
            <ChipRow
              label={o("categories")}
              items={menu.categories}
              selectedId={category?.id ?? null}
              onSelect={(id) => {
                setCategoryChoice(id);
                setSubcategoryChoice(null);
              }}
            />
            <ChipRow
              label={o("subcategories")}
              items={subcategories}
              selectedId={subcategory?.id ?? null}
              onSelect={setSubcategoryChoice}
              subtle
            />
          </>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto ps-5 pe-5 pb-3">
        {menu.products.length === 0 ? (
          <p className="py-4 text-base text-muted-foreground">{o("emptyMenu")}</p>
        ) : shown.length === 0 ? (
          <p className="py-4 text-base text-muted-foreground">
            {searching ? o("noResults") : o("emptySubcategory")}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {shown.map((product) => {
              const count = quantities.get(product.id) ?? 0;
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    data-product={product.id}
                    onClick={() => onAdd(product)}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent ps-3 pe-3 py-2 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium break-words">
                        {product.name}
                      </span>
                      {searching ? (
                        <span className="block text-sm text-muted-foreground">
                          {subcategoryNames.get(product.subcategoryId)}
                        </span>
                      ) : null}
                    </span>
                    {count > 0 ? (
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary ps-2 pe-2 text-sm font-semibold text-primary-foreground tabular-nums">
                        <span aria-hidden>{count}</span>
                        <span className="sr-only">{o("onTicket", { count })}</span>
                      </span>
                    ) : null}
                    <span className="shrink-0 text-base tabular-nums text-muted-foreground">
                      {formatPrice(product.priceCents, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ChipRow({
  label,
  items,
  selectedId,
  onSelect,
  subtle = false,
}: {
  label: string;
  items: { id: number; name: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  subtle?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto ps-1 pe-1 pb-1">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Button
            key={item.id}
            variant={selected ? (subtle ? "secondary" : "default") : "outline"}
            aria-pressed={selected}
            className="h-11 shrink-0 rounded-full ps-4 pe-4 text-base"
            onClick={() => onSelect(item.id)}
          >
            {item.name}
          </Button>
        );
      })}
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  keepLabel,
  destructive = false,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  keepLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <AlertDialogHeader className="place-items-start text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" className="h-11 min-h-11 px-3" onClick={onDismiss}>
            {keepLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className="h-11 min-h-11 px-3"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
