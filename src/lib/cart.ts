"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { dec, moneyString, sum } from "@/lib/money";
import { MAX_LINES, MAX_QTY } from "@/lib/order-constants";

/**
 * The visitor's order basket. It lives in this browser only (localStorage), shared between tabs. It stores what is needed to
 * DISPLAY the basket; prices are never trusted: the server reads them from the database when the order is placed.
 */
export interface CartItem {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  /** Display price, as shown when the item was added. */
  price: string;
  image: string | null;
  quantity: number;
}

const KEY = "paramount-order-basket-v1";
const SNAPSHOT_KEY = "paramount-last-order-v1";
const EMPTY: CartItem[] = [];

let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

const isItem = (v: unknown): v is CartItem => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.variantId === "string" &&
    typeof o.productSlug === "string" &&
    typeof o.productName === "string" &&
    typeof o.sku === "string" &&
    typeof o.price === "string" &&
    typeof o.quantity === "number" &&
    Number.isInteger(o.quantity) &&
    o.quantity > 0
  );
};

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed.filter(isItem).slice(0, MAX_LINES) : EMPTY;
    return items.length ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(items: CartItem[]) {
  cache = items.length ? items : EMPTY;
  try {
    if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode): the basket still works for this page view */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => (cache ??= read());
const getServerSnapshot = () => EMPTY;

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    const current = getSnapshot();
    const existing = current.find((i) => i.variantId === item.variantId);
    if (existing) write(current.map((i) => (i === existing ? { ...i, price: item.price, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i)));
    else if (current.length < MAX_LINES) write([...current, { ...item, quantity: Math.min(MAX_QTY, quantity) }]);
  }, []);
  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const q = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity) || 1));
    write(getSnapshot().map((i) => (i.variantId === variantId ? { ...i, quantity: q } : i)));
  }, []);
  const remove = useCallback((variantId: string) => write(getSnapshot().filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => write(EMPTY), []);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const subtotal = useMemo(() => moneyString(sum(items.map((i) => dec(i.price).times(i.quantity)))), [items]);
  return { items, count, subtotal, add, setQuantity, remove, clear };
}

/** What the confirmation page shows after the basket has been emptied. Kept for this browser tab only. */
export interface OrderSnapshot {
  items: Pick<CartItem, "productName" | "variantLabel" | "price" | "quantity">[];
  subtotal: string;
  currency: string;
}

export function saveSnapshot(s: OrderSnapshot) {
  taken = undefined;
  try {
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let taken: OrderSnapshot | null | undefined;
const never = () => () => undefined;

/** The summary of the order just placed (read once per order; it survives re-renders even after the stored copy is dropped). */
export function useLastOrder(): OrderSnapshot | null {
  return useSyncExternalStore(never, () => (taken === undefined ? (taken = takeSnapshot()) : taken), () => null);
}

function takeSnapshot(): OrderSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as OrderSnapshot) : null;
  } catch {
    return null;
  }
}

export function dropSnapshot() {
  try {
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
