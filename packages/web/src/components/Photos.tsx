import { fileUrl, type Photo, type Recipe } from "@foodlab/shared";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { photoFromLink } from "../ai";
import { showToast } from "../toast";
import { uploadPhoto } from "../uploads";
import { Dialog } from "./Dialog";

// Photos on products and recipes (DESIGN.md §5.11): a strip of thumbnails, the first one the
// main one; tap for the full picture, where it can be made main or deleted (with Undo).
// `update` changes the latest copy's list, so two uploads finishing together both land.

type Update = (fn: (photos: Photo[]) => Photo[]) => void;

/** Uploads pictures one at a time, adding each to the latest list; `busy` counts the ones still going. */
function usePhotoUpload(update: Update) {
  const [busy, setBusy] = useState(0);
  const add = async (files: File[]) => {
    setBusy((n) => n + files.length);
    for (const f of files) {
      try {
        const photo = await uploadPhoto(f);
        update((ps) => [...ps, photo]);
      } catch (err) {
        showToast((err as Error).message);
      }
      setBusy((n) => n - 1);
    }
  };
  return { busy, add };
}

const pictures = (files: Iterable<File>) => [...files].filter((f) => f.type.startsWith("image/"));

/** 📷 Add photo: on the phone, the camera or the gallery. Several at once are fine. */
export function AddPhoto({ update, className = "btn" }: { update: Update; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { busy, add } = usePhotoUpload(update);
  return (
    <>
      <button className={className} disabled={busy > 0} onClick={() => input.current?.click()}>
        {busy ? `Adding ${busy}…` : "📷 Add photo"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** 🔗 Photo from link: a recipe saved without a photo gets its page's picture of the dish. */
export function PhotoFromLink({ recipe, className = "btn" }: { recipe: Recipe; className?: string }) {
  const [busy, setBusy] = useState(false);
  if (recipe.photos.length || !recipe.links.some((l) => /^https?:\/\//i.test(l))) return null;
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (!(await photoFromLink(recipe))) showToast("No photo on the recipe's page");
        } catch (err) {
          showToast((err as Error).message);
        }
        setBusy(false);
      }}
    >
      {busy ? "Looking…" : "🔗 Photo from link"}
    </button>
  );
}

/**
 * 📋 Paste photo: a picture copied on the phone (or anywhere), read from the clipboard. The
 * browser asks once to allow it. Not shown where the browser can't read pictures from it.
 */
function PastePhoto({ add }: { add: (files: File[]) => Promise<void> }) {
  if (!navigator.clipboard?.read) return null;
  const paste = async () => {
    let items: ClipboardItems;
    try {
      items = await navigator.clipboard.read();
    } catch {
      return showToast("Couldn't read the clipboard (allow it in the browser to paste)");
    }
    const files: File[] = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) files.push(new File([await item.getType(type)], `pasted.${type.split("/")[1]}`, { type }));
    }
    if (!files.length) return showToast("No picture on the clipboard");
    await add(files);
  };
  return (
    <button className="btn subtle" onClick={() => void paste()}>
      📋 Paste photo
    </button>
  );
}

/**
 * The thumbnails, then 📷 Add photo and 📋 Paste photo (and anything else that adds one).
 * A picture pasted anywhere on the page (Ctrl+V) is added too, unless a dialog is open or
 * something else took the paste.
 */
export function Photos({ photos, update, name, children }: { photos: Photo[]; update: Update; name: string; children?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const { busy, add } = usePhotoUpload(update);
  const latest = useRef(add);
  latest.current = add;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || document.querySelector("[aria-modal=true]")) return;
      const files = pictures(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      void latest.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
  return (
    <div className="photos">
      {photos.map((p, i) => (
        <button key={p.id} className="photo-thumb" onClick={() => setOpen(i)} aria-label={i === 0 ? "Main photo" : `Photo ${i + 1}`}>
          <img src={fileUrl(p.thumb)} alt="" loading="lazy" />
        </button>
      ))}
      <AddPhoto update={update} className="btn subtle" />
      <PastePhoto add={add} />
      {busy > 0 && <span className="muted small">Adding {busy}…</span>}
      {children}
      {open !== null && photos[open] && <PhotoViewer photos={photos} at={open} setAt={setOpen} update={update} name={name} />}
    </div>
  );
}

/** One photo, big: ‹ › through the rest, Make main, Delete. */
export function PhotoViewer({ photos, at, setAt, update, name }: { photos: Photo[]; at: number; setAt: (i: number | null) => void; update: Update; name: string }) {
  const p = photos[at]!;
  const close = () => setAt(null);
  return (
    <Dialog
      title={photos.length > 1 ? `${name} · ${at + 1} of ${photos.length}` : name}
      onClose={close}
      className="photo-viewer"
      actions={
        <>
          {at > 0 && (
            <button
              className="btn subtle"
              onClick={() => {
                update((ps) => [p, ...ps.filter((x) => x.id !== p.id)]);
                setAt(0);
              }}
            >
              Make main
            </button>
          )}
          <button
            className="btn subtle"
            onClick={() => {
              update((ps) => ps.filter((x) => x.id !== p.id));
              close();
              showToast("Deleted the photo", { label: "Undo", run: () => update((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps.slice(0, at), p, ...ps.slice(at)])) });
            }}
          >
            Delete
          </button>
        </>
      }
    >
      <div className="photo-big">
        <img src={fileUrl(p.id)} alt={name} />
        {photos.length > 1 && (
          <>
            <button className="btn icon photo-prev" aria-label="Previous photo" onClick={() => setAt((at - 1 + photos.length) % photos.length)}>
              ‹
            </button>
            <button className="btn icon photo-next" aria-label="Next photo" onClick={() => setAt((at + 1) % photos.length)}>
              ›
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
