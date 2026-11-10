"use client";

import { useSyncExternalStore } from "react";
import type { DraftLine } from "@/features/orders/types";

// Unsent tickets live per table in sessionStorage, so a refresh or a language
// switch keeps them. The key has no locale on purpose.
const PREFIX = "fudo:draft:";
const EMPTY: DraftLine[] = [];

const listeners = new Set<() => void>();
const parsed = new Map<number, { raw: string | null; lines: DraftLine[] }>();
// Fallback when storage is blocked: the draft then lasts until the tab closes.
const memory = new Map<number, string>();

function readRaw(tableId: number): string | null {
  try {
    return window.sessionStorage.getItem(PREFIX + tableId);
  } catch {
    return memory.get(tableId) ?? null;
  }
}

function writeRaw(tableId: number, raw: string | null) {
  try {
    if (raw === null) window.sessionStorage.removeItem(PREFIX + tableId);
    else window.sessionStorage.setItem(PREFIX + tableId, raw);
  } catch {
    if (raw === null) memory.delete(tableId);
    else memory.set(tableId, raw);
  }
}

function parse(raw: string | null): DraftLine[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    const lines: DraftLine[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const line = entry as Record<string, unknown>;
      if (
        typeof line.productId !== "number" ||
        typeof line.name !== "string" ||
        typeof line.unitPriceCents !== "number" ||
        typeof line.quantity !== "number" ||
        line.quantity < 1
      ) {
        continue;
      }
      lines.push({
        productId: line.productId,
        name: line.name,
        unitPriceCents: line.unitPriceCents,
        quantity: Math.floor(line.quantity),
        note: typeof line.note === "string" && line.note !== "" ? line.note : null,
      });
    }
    return lines;
  } catch {
    return EMPTY;
  }
}

export function readDraft(tableId: number): DraftLine[] {
  const raw = readRaw(tableId);
  const cached = parsed.get(tableId);
  if (cached && cached.raw === raw) return cached.lines;
  const lines = parse(raw);
  parsed.set(tableId, { raw, lines });
  return lines;
}

export function writeDraft(tableId: number, lines: DraftLine[]) {
  writeRaw(tableId, lines.length === 0 ? null : JSON.stringify(lines));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDraft(tableId: number | null): DraftLine[] {
  return useSyncExternalStore(
    subscribe,
    () => (tableId === null ? EMPTY : readDraft(tableId)),
    () => EMPTY,
  );
}
