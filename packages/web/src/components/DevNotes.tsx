import { nameOf, type DevNote } from "@foodlab/shared";
import { useState } from "react";
import { addDevNote, removeDevNote } from "../actions";
import { A } from "../router";
import { data, put, useData } from "../sync";
import { showToast } from "../toast";
import { Dialog } from "./Dialog";

// Ideas and bugs noticed while using the app, kept apart from the food (DESIGN.md §5.7). Each
// remembers the page it was written on; Copy puts the open ones on the clipboard for a work session.

/** "Product: Bell & Evans Gluten Free Chicken Breasts" for /products/<id>, else the path. */
function pageLabel(path: string): string {
  const { state } = data();
  const m = /^\/(foods|products|recipes|stores)\/([^/?]+)/.exec(path);
  const rec = m ? state[m[1] as "foods"][decodeURIComponent(m[2]!)] : undefined;
  if (m && rec) return `${{ foods: "Food", products: "Product", recipes: "Recipe", stores: "Store" }[m[1] as "foods"]}: ${nameOf(rec)}`;
  return path === "/" ? "Search" : path;
}

const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function DevNotesDialog({ onClose }: { onClose: () => void }) {
  const { state } = useData();
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const notes = Object.values(state.devnotes)
    .filter((n) => !n.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);
  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);
  const add = () => {
    if (!text.trim()) return;
    addDevNote(text.trim());
    setText("");
  };
  const copy = async () => {
    const md = open.map((n) => `- ${n.text.replace(/\n/g, "\n  ")} (${pageLabel(n.path)}, ${fmt(n.createdAt)})`).join("\n");
    try {
      await navigator.clipboard.writeText(md);
      showToast(`Copied ${open.length} note${open.length === 1 ? "" : "s"}`);
    } catch {
      showToast("Couldn't copy here (the clipboard needs https)");
    }
  };

  return (
    <Dialog
      title="Dev Notes"
      onClose={onClose}
      className="dev-notes"
      actions={
        open.length > 0 && (
          <button className="btn subtle" onClick={() => void copy()} title="The open notes as a Markdown list">
            Copy
          </button>
        )
      }
    >
      <div className="stack">
        <div className="inline">
          <textarea
            className="input grow"
            rows={2}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            aria-label="New note"
          />
          <button className="btn primary" disabled={!text.trim()} onClick={add}>
            Add
          </button>
        </div>
        <ul className="notes">
          {open.map((n) => (
            <NoteRow key={n.id} n={n} onNavigate={onClose} />
          ))}
        </ul>
        {done.length > 0 && (
          <>
            <button className="btn subtle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
              {showDone ? "Hide" : "Show"} done ({done.length})
            </button>
            {showDone && (
              <ul className="notes">
                {done.map((n) => (
                  <NoteRow key={n.id} n={n} onNavigate={onClose} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

function NoteRow({ n, onNavigate }: { n: DevNote; onNavigate: () => void }) {
  return (
    <li className={n.done ? "done" : ""}>
      <input
        type="checkbox"
        checked={n.done}
        aria-label={n.done ? "Not done" : "Done"}
        onChange={(e) => put("devnotes", { ...(data().state.devnotes[n.id] ?? n), done: e.target.checked })}
      />
      <span className="note-main">
        <span className="note-text">{n.text}</span>
        <span className="muted small">
          {fmt(n.createdAt)} ·{" "}
          <A href={n.path || "/"} onClick={onNavigate}>
            {pageLabel(n.path)}
          </A>
        </span>
      </span>
      <button className="btn icon subtle" aria-label="Delete note" onClick={() => removeDevNote(n)}>
        ✕
      </button>
    </li>
  );
}
