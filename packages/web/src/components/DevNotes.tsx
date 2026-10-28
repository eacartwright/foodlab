import { fileUrl, nameOf, type Attachment, type DevNote } from "@foodlab/shared";
import { useRef, useState } from "react";
import { addDevNote, editDevNote, removeDevNote } from "../actions";
import { A } from "../router";
import { data, put, useData } from "../sync";
import { showToast } from "../toast";
import { DraftTextarea } from "./controls";
import { Dialog } from "./Dialog";
import { uploadFile } from "../uploads";

// Ideas and bugs noticed while using the app, kept apart from the food (DESIGN.md §5.7). Each
// can remember the page it was written on; Copy puts the open ones on the clipboard for a work
// session, and the server keeps them in data/dev-notes.md for Claude to read.

const WITH_PAGE = "foodlab:devnote-page";
const readWithPage = () => {
  try {
    return localStorage.getItem(WITH_PAGE) === "1";
  } catch {
    return false;
  }
};

/** "Product: Bell & Evans Gluten Free Chicken Breasts" for /products/<id>, else the path. */
function pageLabel(path: string): string {
  const { state } = data();
  const m = /^\/(foods|products|recipes|stores)\/([^/?]+)/.exec(path);
  const rec = m ? state[m[1] as "foods"][decodeURIComponent(m[2]!)] : undefined;
  if (m && rec) return `${{ foods: "Food", products: "Product", recipes: "Recipe", stores: "Store" }[m[1] as "foods"]}: ${nameOf(rec)}`;
  return path === "/" ? "Search" : path;
}

/** 📎: pick files (on the phone, photos or the camera too); each is uploaded, then handed over. */
function AttachButton({ onAttach }: { onAttach: (f: Attachment) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const attach = async (files: File[]) => {
    setBusy((n) => n + files.length);
    for (const f of files) {
      try {
        onAttach(await uploadFile(f));
      } catch (err) {
        showToast((err as Error).message);
      }
      setBusy((n) => n - 1);
    }
  };
  return (
    <>
      <button className="btn icon subtle" aria-label="Attach a photo or file" title="Attach a photo or file" disabled={busy > 0} onClick={() => input.current?.click()}>
        {busy ? "…" : "📎"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void attach([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** A note's files: pictures as small previews, the rest by name; each opens in a new tab. */
function Attached({ files, onRemove }: { files: Attachment[]; onRemove?: (f: Attachment) => void }) {
  if (!files.length) return null;
  return (
    <span className="attached">
      {files.map((f) => (
        <span key={f.id} className="attached-file">
          <a href={fileUrl(f.id, f.name)} target="_blank" rel="noreferrer noopener" title={f.name}>
            {f.type.startsWith("image/") ? <img src={fileUrl(f.id)} alt={f.name} loading="lazy" /> : `📄 ${f.name}`}
          </a>
          {onRemove && (
            <button className="btn icon subtle" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f)}>
              ✕
            </button>
          )}
        </span>
      ))}
    </span>
  );
}

const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function DevNotesDialog({ onClose }: { onClose: () => void }) {
  const { state } = useData();
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [withPage, setWithPage] = useState(readWithPage);
  const [files, setFiles] = useState<Attachment[]>([]);
  const notes = Object.values(state.devnotes)
    .filter((n) => !n.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);
  const open = notes.filter((n) => !n.done);
  const done = notes.filter((n) => n.done);
  const add = () => {
    if (!text.trim()) return;
    addDevNote(text.trim(), withPage, files);
    setText("");
    setFiles([]);
  };
  const copy = async () => {
    const md = open.map((n) => `- ${n.text.replace(/\n/g, "\n  ")} (${n.path ? `${pageLabel(n.path)}, ` : ""}${fmt(n.createdAt)})`).join("\n");
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
          <AttachButton onAttach={(f) => setFiles((fs) => [...fs, f])} />
          <button className="btn primary" disabled={!text.trim()} onClick={add}>
            Add
          </button>
        </div>
        <Attached files={files} onRemove={(f) => setFiles((fs) => fs.filter((x) => x.id !== f.id))} />
        <label className="inline small muted">
          <input
            type="checkbox"
            checked={withPage}
            onChange={(e) => {
              setWithPage(e.target.checked);
              try {
                localStorage.setItem(WITH_PAGE, e.target.checked ? "1" : "0");
              } catch {
                // Not remembered.
              }
            }}
          />
          Link it to this page ({pageLabel(location.pathname + location.search)})
        </label>
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

/** Changes to the latest copy of a note (an upload can finish after other edits). */
const saveNote = (n: DevNote, patch: (now: DevNote) => Partial<DevNote>) => {
  const now = data().state.devnotes[n.id] ?? n;
  put("devnotes", { ...now, ...patch(now) });
};

function NoteRow({ n, onNavigate }: { n: DevNote; onNavigate: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={n.done ? "done" : ""}>
      <input
        type="checkbox"
        checked={n.done}
        aria-label={n.done ? "Not done" : "Done"}
        onChange={(e) => put("devnotes", { ...(data().state.devnotes[n.id] ?? n), done: e.target.checked })}
      />
      <span className="note-main">
        {editing ? (
          <DraftTextarea className="input" autoFocus value={n.text} onCommit={(t) => editDevNote(n, t)} aria-label="Note" />
        ) : (
          <span className="note-text">{n.text}</span>
        )}
        <span className="muted small">
          {fmt(n.createdAt)}
          {n.path && (
            <>
              {" · "}
              <A href={n.path} onClick={onNavigate}>
                {pageLabel(n.path)}
              </A>
            </>
          )}
        </span>
        <Attached files={n.files} onRemove={editing ? (f) => saveNote(n, (now) => ({ files: now.files.filter((x) => x.id !== f.id) })) : undefined} />
      </span>
      <AttachButton onAttach={(f) => saveNote(n, (now) => ({ files: [...now.files, f] }))} />
      <button className="btn icon subtle" aria-label={editing ? "Done editing" : "Edit note"} onClick={() => setEditing(!editing)}>
        {editing ? "✓" : "✎"}
      </button>
      <button className="btn icon subtle" aria-label="Delete note" onClick={() => removeDevNote(n)}>
        ✕
      </button>
    </li>
  );
}
