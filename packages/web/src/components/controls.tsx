import {
  MEAL_TAGS,
  RATINGS,
  RATING_EMOJI,
  RATING_LABEL,
  nameKey,
  type Food,
  type Id,
  type Rating,
  type Tag,
} from "@foodlab/shared";
import { createContext, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ensureTag } from "../actions";
import { A } from "../router";
import { useData } from "../sync";

// Inputs that edit a record in place and save as you go.

/** The id of the label of the Field a control is in: its name, so no box needs a placeholder to have one. */
const FieldLabel = createContext<string | undefined>(undefined);

/** A control's name from its Field's label, unless it has its own (aria-label wins). */
function useFieldName(own: { "aria-label"?: string; "aria-labelledby"?: string }) {
  const labelId = useContext(FieldLabel);
  return own["aria-label"] || own["aria-labelledby"] || !labelId ? {} : { "aria-labelledby": labelId };
}

/**
 * A text box that saves on Enter or when it loses focus (Esc puts it back). Its draft resets
 * during render when the record's value changes, so typing never leaks into another record.
 */
export function DraftInput({
  value,
  onCommit,
  required,
  ...rest
}: { value: string; onCommit: (v: string) => void; required?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (value !== base) {
    setBase(value);
    setDraft(value);
  }
  const commit = () => {
    const v = draft.trim();
    if (required && !v) return setDraft(value);
    if (v !== value) onCommit(v);
  };
  const name = useFieldName(rest);
  return (
    <input
      {...name}
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          e.stopPropagation();
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
}

/** A number box: blank = none. */
export function NumberInput({
  value,
  onCommit,
  ...rest
}: { value: number | null; onCommit: (v: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <DraftInput
      inputMode="decimal"
      {...rest}
      value={value === null ? "" : String(value)}
      onCommit={(s) => {
        const n = s === "" ? null : Number(s.replace(",", "."));
        onCommit(n === null || (Number.isFinite(n) && n >= 0) ? n : value);
      }}
    />
  );
}

/**
 * A text area that saves when it loses focus, the app is hidden or the page closes. Grows with its text.
 * Not on a pause in typing: the server trims the text, and its reply reset the draft mid-typing
 * (lost the trailing space, cursor stepped back; 2026-10-26).
 */
export function DraftTextarea({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (value !== base) {
    setBase(value);
    setDraft(value);
  }
  const latest = useRef({ draft, value, onCommit });
  latest.current = { draft, value, onCommit };
  const commit = () => {
    const l = latest.current;
    if (l.draft !== l.value) l.onCommit(l.draft);
  };
  useEffect(() => {
    // Switching apps on the phone doesn't blur the field.
    const hide = () => document.visibilityState === "hidden" && commit();
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      commit();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [draft]);
  const name = useFieldName(rest);
  return (
    <textarea
      ref={ref}
      {...name}
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

export interface Option {
  id: Id;
  label: string;
  hint?: string;
}

/** Best matches first: names starting with the text, then words starting with it, then containing it. */
function filterOptions(options: Option[], text: string, limit = 40): Option[] {
  const t = text.trim().toLowerCase();
  if (!t) return options.slice(0, limit);
  const k = nameKey(t);
  const scored: [number, Option][] = [];
  for (const o of options) {
    const l = o.label.toLowerCase();
    const s = l.startsWith(t) || nameKey(o.label) === k ? 0 : l.includes(` ${t}`) ? 1 : l.includes(t) ? 2 : -1;
    if (s >= 0) scored.push([s, o]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label))
    .slice(0, limit)
    .map(([, o]) => o);
}

/**
 * Pick one record by typing part of its name. Shows the chosen one's name when idle; typing
 * filters; Enter picks the highlighted one, or makes a new one when `onCreate` is given.
 */
export function Picker({
  value,
  options,
  onChange,
  onCreate,
  placeholder = "None",
  createLabel = "Add",
  clearable = true,
  autoFocus,
  keepOpen,
  startText = "",
  id,
  "aria-label": ariaLabel,
}: {
  value: Id | null;
  options: Option[];
  onChange: (id: Id | null) => void;
  onCreate?: (text: string) => Id;
  placeholder?: string;
  createLabel?: string;
  clearable?: boolean;
  autoFocus?: boolean;
  /** For adding several (MultiPicker): clear the text after a pick and stay focused. */
  keepOpen?: boolean;
  /** Typed in already when an empty picker opens (an ingredient line's food name), selected to type over. */
  startText?: string;
  id?: string;
  /** Its name when it isn't in a Field (in one, the Field's label is). */
  "aria-label"?: string;
}) {
  const name = useFieldName({ "aria-label": ariaLabel });
  const selected = options.find((o) => o.id === value);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const shown = open ? filterOptions(options.filter((o) => o.id !== value || !keepOpen), text) : [];
  const exact = shown.some((o) => nameKey(o.label) === nameKey(text));
  const canCreate = !!onCreate && !!text.trim() && !exact;
  const total = shown.length + (canCreate ? 1 : 0);

  const pick = (o: Option | "create") => {
    const idPicked = o === "create" ? onCreate!(text.trim()) : o.id;
    onChange(idPicked);
    setText("");
    setActive(0);
    if (keepOpen) return;
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className={`picker ${open ? "open" : ""}`}>
      <input
        id={id}
        aria-label={ariaLabel}
        {...name}
        ref={input}
        autoFocus={autoFocus}
        className={`input ${!selected && !open ? "unset" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={open ? "Type to find…" : placeholder}
        value={open ? text : (selected?.label ?? "")}
        onFocus={(e) => {
          const start = selected ? "" : startText;
          setOpen(true);
          setText(start);
          setActive(0);
          if (start) {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, total - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (active < shown.length) pick(shown[active]!);
            else if (canCreate) pick("create");
          } else if (e.key === "Escape") {
            e.stopPropagation();
            input.current?.blur();
          }
        }}
      />
      {clearable && selected && !open && (
        <button className="picker-clear" aria-label="Clear" onClick={() => onChange(null)}>
          ✕
        </button>
      )}
      {open && total > 0 && (
        <ul className="picker-list" id={listId} role="listbox">
          {shown.map((o, n) => (
            <li
              key={o.id}
              role="option"
              aria-selected={n === active}
              className={n === active ? "active" : ""}
              // Before the input's blur, so the pick lands.
              onPointerDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
            >
              <span>{o.label}</span>
              {o.hint && <span className="muted small">{o.hint}</span>}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === shown.length}
              className={`create ${active === shown.length ? "active" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                pick("create");
              }}
            >
              + {createLabel} “{text.trim()}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Several records: chips for the chosen ones, a picker to add more. */
export function MultiPicker({
  values,
  options,
  onChange,
  onCreate,
  placeholder = "Add…",
  createLabel,
  linkTo,
}: {
  values: Id[];
  options: Option[];
  onChange: (ids: Id[]) => void;
  onCreate?: (text: string) => Id;
  placeholder?: string;
  createLabel?: string;
  linkTo?: (id: Id) => string;
}) {
  const label = (id: Id) => options.find((o) => o.id === id)?.label ?? "(deleted)";
  return (
    <div className="multi">
      {values.map((id) => (
        <span className="chip chip-set" key={id}>
          {linkTo ? <A href={linkTo(id)}>{label(id)}</A> : label(id)}
          <button aria-label={`Remove ${label(id)}`} onClick={() => onChange(values.filter((v) => v !== id))}>
            ✕
          </button>
        </span>
      ))}
      <Picker
        value={null}
        keepOpen
        clearable={false}
        options={options.filter((o) => !values.includes(o.id))}
        placeholder={placeholder}
        createLabel={createLabel}
        onCreate={onCreate}
        onChange={(id) => id && onChange([...values, id])}
      />
    </div>
  );
}

/** 👎 👍 ❤️: tapping the chosen one clears it. */
export function RatingInput({ value, onChange, size = "" }: { value: Rating | null; onChange: (r: Rating | null) => void; size?: "big" | "" }) {
  return (
    <div className={`rating-input ${size}`} role="group" aria-label="Rating">
      {RATINGS.map((r) => (
        <button
          key={r}
          className={value === r ? "on" : ""}
          aria-pressed={value === r}
          title={RATING_LABEL[r]}
          onClick={() => onChange(value === r ? null : r)}
        >
          {RATING_EMOJI[r]}
        </button>
      ))}
    </div>
  );
}

/** A row of choices; tapping the chosen one clears it when `clearable`. */
export function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
  clearable = true,
  label,
}: {
  value: T | null;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T | null) => void;
  clearable?: boolean;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          className={value === o ? "on" : ""}
          aria-pressed={value === o}
          onClick={() => onChange(value === o ? (clearable ? null : o) : o)}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

/** Meal tags as chips, then personal tags. */
/** A tag a thing gets from a food it's a kind of: shown, not edited here. */
export type InheritedTag = { tag: Tag; from: Food };

export function TagEditor({ value, onChange, inherited = [] }: { value: Id[]; onChange: (ids: Id[]) => void; inherited?: InheritedTag[] }) {
  const { view } = useData();
  const personal = view.tags.filter((t) => t.kind === "personal");
  const toggle = (id: Id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="stack-sm">
      <div className="chips">
        {MEAL_TAGS.map((t) => (
          <button key={t.id} className={`chip ${value.includes(t.id) ? "chip-on" : ""}`} aria-pressed={value.includes(t.id)} onClick={() => toggle(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <MultiPicker
        values={value.filter((id) => !MEAL_TAGS.some((m) => m.id === id))}
        options={personal.map((t) => ({ id: t.id, label: t.name }))}
        onChange={(ids) => onChange([...value.filter((id) => MEAL_TAGS.some((m) => m.id === id)), ...ids])}
        onCreate={ensureTag}
        placeholder="Add a tag…"
        createLabel="New tag"
      />
      {inherited.length > 0 && (
        <div className="chips">
          {inherited.map(({ tag, from }) => (
            <span key={tag.id} className="chip chip-inherited" title={`From ${from.name}`}>
              {tag.name}
              <span className="sr-only"> (from {from.name})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A list of links: each opens in a new tab; type or paste one to add it. */
export function LinksEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...value, /^[a-z]+:/i.test(t) ? t : `https://${t}`]);
    setText("");
  };
  return (
    <div className="stack-sm">
      {value.map((l, n) => (
        <div className="link-row" key={n}>
          <a href={l} target="_blank" rel="noreferrer noopener">
            {l.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
          <button className="btn icon subtle" aria-label="Remove link" onClick={() => onChange(value.filter((_, i) => i !== n))}>
            ✕
          </button>
        </div>
      ))}
      <input
        className="input"
        inputMode="url"
        aria-label="Add a link"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
    </div>
  );
}

/** A labeled row on a page: label left on desktop, above on the phone. */
export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  const labelId = useId();
  return (
    <div className="field">
      <label className="field-label" id={labelId} htmlFor={htmlFor}>
        {label}
      </label>
      <div className="field-control">
        <FieldLabel.Provider value={labelId}>{children}</FieldLabel.Provider>
      </div>
    </div>
  );
}

export const KIND_ICON = { recipes: "🍳", products: "🛒", foods: "🥕", stores: "🏪" } as const;
export const KIND_ONE = { recipes: "Recipe", products: "Product", foods: "Food", stores: "Store" } as const;

/**
 * The line above a page: "🥕 FOOD › Condiment › Mustard". The kind goes to its list, each crumb
 * to its page; the › between them are plain, and nothing trails (the page's name is the title
 * below). `children` go after it (a spacer and ✏️ Edit).
 */
export function PageKind({ kind, trail = [], children }: { kind: keyof typeof KIND_ONE; trail?: { href: string; label: string }[]; children?: ReactNode }) {
  return (
    <div className="page-kind">
      <nav className="crumbs" aria-label="Breadcrumb">
        <A className="kind-link" href={`/${kind}`}>
          {KIND_ICON[kind]} {KIND_ONE[kind]}
        </A>
        {trail.map((t) => (
          <span key={t.href} className="crumb">
            <span className="crumb-sep" aria-hidden>
              ›
            </span>
            <A href={t.href}>{t.label}</A>
          </span>
        ))}
      </nav>
      {children}
    </div>
  );
}
