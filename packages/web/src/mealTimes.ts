import { MEAL_TAGS, type Id } from "@foodlab/shared";

// Which meal "What can I eat?" opens on, by the time of day (DESIGN.md §5.2). Each slot runs
// from its time until the next one's; the last runs past midnight to the first. Per device.

export interface MealSlot {
  /** "HH:MM", local time. */
  from: string;
  tagId: Id;
}

const KEY = "foodlab:meal-times";

export const DEFAULT_SLOTS: MealSlot[] = [
  { from: "04:00", tagId: "meal-breakfast" },
  { from: "10:30", tagId: "meal-lunch" },
  { from: "16:00", tagId: "meal-dinner" },
  { from: "23:00", tagId: "meal-snack" },
];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function mealSlots(): MealSlot[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as MealSlot[] | null;
    if (Array.isArray(v) && v.length === DEFAULT_SLOTS.length && v.every((s) => /^\d\d:\d\d$/.test(s.from) && MEAL_TAGS.some((t) => t.id === s.tagId))) return v;
  } catch {
    // Storage blocked or garbled: the defaults.
  }
  return DEFAULT_SLOTS;
}

export function setMealSlots(slots: MealSlot[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
  } catch {
    // Not remembered.
  }
}

/** The meal for this moment: the latest slot that has started, else (before the first) the last. */
export function mealNow(slots = mealSlots(), now = new Date()): Id {
  const t = now.getHours() * 60 + now.getMinutes();
  const sorted = [...slots].sort((a, b) => minutes(a.from) - minutes(b.from));
  return (sorted.filter((s) => minutes(s.from) <= t).pop() ?? sorted[sorted.length - 1]!).tagId;
}
