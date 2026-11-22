import type { GroceryItem, Id } from "./types";

/**
 * Dragging an item to `to` in the list (DESIGN.md §5.8): the list is ordered by `neededAt`, so the
 * moved item takes a stamp between its new neighbours. When there's no room between them (two
 * stamps a millisecond apart), the whole list is respaced. Returns what to save; `now` caps the
 * stamps, so something added later still goes on the end.
 */
export function moveGrocery(list: GroceryItem[], id: Id, to: number, now = Date.now()): { id: Id; neededAt: number }[] {
  const from = list.findIndex((g) => g.id === id);
  if (from < 0) return [];
  const order = list.filter((g) => g.id !== id);
  const at = Math.max(0, Math.min(to, order.length));
  if (at === from) return [];
  const before = order[at - 1]?.neededAt ?? null;
  const after = order[at]?.neededAt ?? null;
  const lo = before ?? Math.max(0, (after ?? now) - 60_000);
  const hi = after ?? Math.max(now, lo + 2);
  if (hi - lo >= 2) return [{ id, neededAt: Math.floor((lo + hi) / 2) }];
  order.splice(at, 0, list[from]!);
  const start = Math.min(order[0]!.neededAt ?? now, now - order.length * 1000);
  return order.map((g, i) => ({ id: g.id, neededAt: start + i * 1000 })).filter((x, i) => x.neededAt !== order[i]!.neededAt);
}
