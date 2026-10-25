import { blank, DEFAULT_MEAL_TIMES, MEAL_TAGS, mealTimes, SETTINGS_ID, type MealSlot } from "@foodlab/shared";
import { useState } from "react";
import { data, put, refresh, useData } from "../sync";
import { setThemePref, themePref, type ThemePref } from "../theme";
import { Dialog } from "./Dialog";
import { Field, Segmented } from "./controls";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { state, pending, status } = useData();
  const [theme, setTheme] = useState<ThemePref>(themePref());
  const slots = mealTimes(state);
  const saveSlots = (mealTimes: MealSlot[]) => put("settings", { ...(data().state.settings[SETTINGS_ID] ?? blank.settings()), mealTimes });
  const changeSlot = (i: number, change: Partial<MealSlot>) => saveSlots(mealTimes(data().state).map((s, j) => (j === i ? { ...s, ...change } : s)));
  const count = (k: "foods" | "products" | "recipes" | "stores") => Object.values(state[k]).filter((x) => !x.deleted).length;
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="fields">
        <Field label="Colors">
          <Segmented
            value={theme}
            options={["system", "light", "dark"] as const}
            labels={{ system: "System", light: "Light", dark: "Dark" }}
            clearable={false}
            onChange={(t) => {
              if (!t) return;
              setTheme(t);
              setThemePref(t);
            }}
          />
          <p className="muted small">This device only.</p>
        </Field>
        <Field label="Meal times">
          <div className="meal-times">
            {slots.map((s, i) => (
              <div className="inline" key={i}>
                <input
                  type="time"
                  className="input"
                  value={s.from}
                  aria-label={`Slot ${i + 1} starts`}
                  onChange={(e) => e.target.value && changeSlot(i, { from: e.target.value })}
                />
                <select className="select grow" value={s.tagId} aria-label={`Slot ${i + 1} meal`} onChange={(e) => changeSlot(i, { tagId: e.target.value })}>
                  {MEAL_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <button className="btn subtle" onClick={() => saveSlots(DEFAULT_MEAL_TIMES)}>
              Reset
            </button>
          </div>
        </Field>
        <Field label="Data">
          <p className="small">
            {count("foods")} foods · {count("products")} products · {count("recipes")} recipes · {count("stores")} stores
            <br />
            Version {state.rev} · {pending ? `${pending} change${pending === 1 ? "" : "s"} waiting to save` : "everything saved"} ({status})
          </p>
          <button className="btn" onClick={() => void refresh()}>
            Reload from the server
          </button>
        </Field>
      </div>
    </Dialog>
  );
}
