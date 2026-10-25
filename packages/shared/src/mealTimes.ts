import { DEFAULT_MEAL_TIMES, SETTINGS_ID, type Id, type MealSlot, type State } from "./types";

// Which meal "What can I eat?" opens on, by the time of day (DESIGN.md §5.2). Each slot runs
// from its time until the next one's; the last runs past midnight to the first. App-wide.

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export const mealTimes = (state: State): MealSlot[] => state.settings[SETTINGS_ID]?.mealTimes ?? DEFAULT_MEAL_TIMES;

/** The meal for this moment: the latest slot that has started, else (before the first) the last. */
export function mealNow(slots: MealSlot[], now = new Date()): Id {
  const t = now.getHours() * 60 + now.getMinutes();
  const sorted = [...slots].sort((a, b) => minutes(a.from) - minutes(b.from));
  return (sorted.filter((s) => minutes(s.from) <= t).pop() ?? sorted[sorted.length - 1]!).tagId;
}
