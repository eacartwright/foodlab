import { useState } from "react";
import { refresh, useData } from "../sync";
import { setThemePref, themePref, type ThemePref } from "../theme";
import { Dialog } from "./Dialog";
import { Field, Segmented } from "./controls";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { state, pending, status } = useData();
  const [theme, setTheme] = useState<ThemePref>(themePref());
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
