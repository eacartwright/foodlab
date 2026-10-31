import {
  DISH_GF,
  GF_LABEL,
  PRODUCT_GF,
  type Dish,
  LOG_LABEL,
  RATING_EMOJI,
  STATUSES,
  STATUS_LABEL,
  today,
  type LogKind,
  type LogTarget,
  type Product,
  type Recipe,
  type View,
} from "@foodlab/shared";
import { useState } from "react";
import { addLog, removeLog } from "../actions";
import { useData } from "../sync";
import { Field, LinksEditor, RatingInput, Segmented, TagEditor, type InheritedTag } from "./controls";
import { Section } from "./rows";

// The fields recipes and products share (DESIGN.md §4.6), and their history.

export function EatingFields<T extends Product | Recipe | Dish>({ item, save, inheritedTags }: { item: T; save: (patch: Partial<T>) => void; inheritedTags?: InheritedTag[] }) {
  return (
    <>
      <Field label="Rating">
        <RatingInput value={item.rating} onChange={(rating) => save({ rating } as Partial<T>)} />
      </Field>
      <Field label="Status">
        <Segmented value={item.status} options={STATUSES} labels={STATUS_LABEL} clearable={false} onChange={(v) => save({ status: v ?? "tried" } as Partial<T>)} />
      </Field>
      {/* A product: how I know it's safe, or that it's someone else's; a dish: on the GF menu, GF
          if modified, or ask. A recipe is gluten-free by what goes in it; a non-GF version will be
          a variant (DESIGN.md §10). */}
      {("brand" in item || "placeId" in item) && (
        <Field label="Gluten-free">
          <Segmented
            value={item.glutenFree === "unknown" ? null : item.glutenFree}
            options={"placeId" in item ? DISH_GF : PRODUCT_GF}
            labels={GF_LABEL}
            onChange={(v) => save({ glutenFree: v ?? "unknown" } as Partial<T>)}
          />
        </Field>
      )}
      <Field label="Tags">
        <TagEditor value={item.tagIds} inherited={inheritedTags} onChange={(tagIds) => save({ tagIds } as Partial<T>)} />
      </Field>
      <Field label="Links">
        <LinksEditor value={item.links} onChange={(links) => save({ links } as Partial<T>)} />
      </Field>
    </>
  );
}

export const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y!, m! - 1, day!);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
};

/** "made 3×, last Oct 20", "bought once, Oct 24"; "" when the log has none. */
export function doneText(view: View, itemId: string, kind: "made" | "ate" | "bought"): string {
  const { count, last } = view.done(itemId, kind);
  if (!count || !last) return "";
  return count === 1 ? `${kind} once, ${fmtDate(last)}` : `${kind} ${count}×, last ${fmtDate(last)}`;
}

/** History: rating changes (automatic) and what I wrote down, newest first. */
export function LogSection({ itemKind, itemId }: { itemKind: LogTarget; itemId: string }) {
  const { view } = useData();
  const entries = view.logOf(itemId);
  const kinds: LogKind[] = itemKind === "recipes" ? ["made", "note"] : itemKind === "dishes" ? ["ate", "note"] : ["ate", "bought", "note"];
  const [kind, setKind] = useState<LogKind>(kinds[0]!);
  const [text, setText] = useState("");
  const [date, setDate] = useState(today());
  const add = () => {
    addLog(itemKind, itemId, kind, text.trim(), null, date || today());
    setText("");
    setDate(today());
  };
  const made = entries.filter((e) => e.kind === "made").length;
  return (
    <Section
      title="History"
      count={entries.length || undefined}
      actions={made ? <span className="muted small">made {made}×, last {fmtDate(entries.find((e) => e.kind === "made")!.date)}</span> : undefined}
    >
      <div className="log-add">
        <Segmented value={kind} options={kinds} labels={LOG_LABEL} clearable={false} onChange={(k) => setKind(k ?? kinds[0]!)} />
        <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input
          className="input grow"
          aria-label="Note"
          placeholder={itemKind === "recipes" ? "What changed, how it went…" : "What you thought…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="log">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="log-date">{fmtDate(e.date)}</span>
              <span className="log-kind">{e.kind === "rating" ? (e.rating ? RATING_EMOJI[e.rating] : "") : LOG_LABEL[e.kind]}</span>
              <span className="log-text">{e.kind === "rating" ? <span className="muted">{e.text}</span> : e.text}</span>
              <button className="btn icon subtle" aria-label="Delete entry" onClick={() => removeLog(e)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
