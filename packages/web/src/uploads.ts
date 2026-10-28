import type { Attachment, Photo } from "@foodlab/shared";

// Photos and files (DESIGN.md §5.11) go straight to the server (POST /api/files), which keeps
// them and answers with an id; the record that shows them is saved through the outbox as usual.
// Unlike edits, an upload needs the server: it isn't queued while offline. Same as sideshow's.

/** The server's limit (files.ts MAX_FILE). */
export const MAX_UPLOAD = 25 * 1024 * 1024;
/** A photo's longest side: sharp on a phone or a laptop, a few hundred KB instead of a 12 MP original. */
const PHOTO_PX = 1600;
/** The copy for lists and strips. */
const THUMB_PX = 400;

async function send(body: Blob, name: string, type: string): Promise<string> {
  if (body.size > MAX_UPLOAD) throw new Error(`${name} is over ${MAX_UPLOAD / 1024 / 1024} MB`);
  let res: Response;
  try {
    res = await fetch("/api/files", {
      method: "POST",
      headers: { "content-type": type || "application/octet-stream", "x-file-name": encodeURIComponent(name) },
      body,
      redirect: "manual",
    });
  } catch {
    throw new Error("Couldn't upload: no connection to foodlab. Try again when online");
  }
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403) throw new Error("Signed out: reload to sign in, then add it again");
  if (res.status === 413) throw new Error(`${name} is too big`);
  if (!res.ok) throw new Error("Couldn't upload it: try again");
  return ((await res.json()) as { id: string }).id;
}

/** The picture at most `px` on its longest side, as a JPEG (turned the right way up). */
async function shrink(file: Blob, px: number): Promise<Blob> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that picture");
  }
  const scale = Math.min(1, px / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't read that picture");
  return blob;
}

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** A photo for a product or recipe: the picture and its thumbnail, both shrunk first. */
export async function uploadPhoto(file: File): Promise<Photo> {
  const base = (file.name.replace(/\.[^.]*$/, "") || `photo-${stamp()}`).slice(0, 80);
  const [big, small] = await Promise.all([shrink(file, PHOTO_PX), shrink(file, THUMB_PX)]);
  const [id, thumb] = await Promise.all([send(big, `${base}.jpg`, "image/jpeg"), send(small, `${base}-thumb.jpg`, "image/jpeg")]);
  return { id, thumb };
}

/** A file for a dev note, as it is (a screenshot should stay sharp). A pasted one is "image.png": name it by when. */
export async function uploadFile(file: File): Promise<Attachment> {
  const name = file.name && file.name !== "image.png" ? file.name : `screenshot-${stamp()}.${file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png"}`;
  return { id: await send(file, name, file.type), name, type: file.type };
}
