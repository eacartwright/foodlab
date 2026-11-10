import { modelLabel, recipeFromText, type FoundLocation, type ReadRecipe, type Recipe } from "@foodlab/shared";
import { data, put } from "./sync";
import { showToast } from "./toast";
import { uploadPhoto } from "./uploads";

// Reading recipes (and places) through the server, which may ask Claude (DESIGN.md §5.5, §5.9).

export interface ReadReply {
  recipe?: ReadRecipe | null;
  /** page = the page's recipe data, ai = Claude, text = the plain reader. */
  via?: "page" | "ai" | "text";
  model?: string;
  costUsd?: number;
  alerts?: number[];
  limitUsd?: number | null;
  error?: string;
  message?: string;
  /** Why Claude wasn't used. */
  note?: string;
  /** The page's own picture of the dish (a link), to suggest as the recipe's photo. */
  photo?: string;
}

/** "0.31¢", "$1.20". */
export const money = (usd: number) => (usd < 0.01 ? `${(usd * 100).toFixed(2)}¢` : `$${usd.toFixed(2)}`);

/** How a recipe was read, for Quick add: "Opus 5.5 · 3.10¢". */
export const viaText = (r: ReadReply) => (r.via === "ai" && r.model ? `${modelLabel(r.model)} · ${money(r.costUsd ?? 0)}` : "");

/** A call that crossed an alert level says so. */
export function aiAlert(r: ReadReply) {
  if (!r.alerts?.length || !r.limitUsd) return;
  const top = Math.max(...r.alerts);
  showToast(top >= 100 ? `AI: this month's $${r.limitUsd} cap is used up. No more AI reading until next month (Settings → AI).` : `AI: ${top}% of this month's $${r.limitUsd} is used.`);
}

export async function readLink(url: string): Promise<ReadReply> {
  try {
    const r = (await (await fetch(`/api/read-recipe?url=${encodeURIComponent(url)}`)).json()) as ReadReply;
    aiAlert(r);
    return r;
  } catch {
    return { error: "failed", message: "Couldn't reach foodlab (offline?)" };
  }
}

/** A read recipe's suggested photo, fetched through foodlab (sites often won't let another page show theirs). */
export async function fetchPhoto(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/fetch-photo?url=${encodeURIComponent(url)}`);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/**
 * A saved recipe's photo from its link (the page's own picture of the dish), added to the latest
 * copy. False when no link has one; throws when foodlab can't be reached or the upload fails.
 */
export async function photoFromLink(r: Recipe): Promise<boolean> {
  for (const link of r.links.filter((l) => /^https?:\/\//i.test(l))) {
    let res: Response;
    try {
      res = await fetch(`/api/page-photo?url=${encodeURIComponent(link)}`);
    } catch {
      throw new Error("Couldn't reach foodlab (offline?)");
    }
    if (!res.ok) continue;
    const blob = await res.blob();
    const photo = await uploadPhoto(new File([blob], `${r.name.slice(0, 60)}.jpg`, { type: blob.type }));
    const now = data().state.recipes[r.id] ?? r;
    put("recipes", { ...now, photos: [...now.photos, photo] });
    return true;
  }
  return false;
}

/** Recipes with a link and no photo yet: Settings → Data → Find photos. */
export const photoless = (recipes: Record<string, Recipe>) => Object.values(recipes).filter((r) => !r.deleted && !r.photos.length && r.links.some((l) => /^https?:\/\//i.test(l)));

/** Pasted text: Claude on the server, or the plain reader here when offline. */
export async function readText(text: string): Promise<ReadReply> {
  try {
    const res = await fetch("/api/read-text", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const r = (await res.json()) as ReadReply;
    aiAlert(r);
    return r;
  } catch {
    return { recipe: recipeFromText(text), via: "text", note: "offline" };
  }
}

export interface PlaceReply {
  locations?: FoundLocation[];
  model?: string;
  costUsd?: number;
  alerts?: number[];
  limitUsd?: number | null;
  error?: string;
  message?: string;
}

export type ClassicSuggestion = { name: string; role: "required" | "usual"; note: string };
export type ClassicReply = { ingredients?: ClassicSuggestion[]; error?: string; message?: string; model?: string; costUsd?: number; alerts?: number[]; limitUsd?: number | null };

/** A classic's defining ingredients, suggested by the AI model on the server (DESIGN.md §5.14). */
export async function suggestClassic(input: { name: string; parent: string; wiki: string }): Promise<ClassicReply> {
  try {
    const res = await fetch("/api/ai/classic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const r = (await res.json()) as ClassicReply;
    aiAlert(r as ReadReply);
    return r;
  } catch {
    return { error: "failed", message: "Couldn't reach foodlab (offline?)" };
  }
}

/** A place's page (a link) or text copied from it, read on the server for its locations (DESIGN.md §5.12). */
export async function readPlace(input: { url: string } | { text: string }): Promise<PlaceReply> {
  try {
    const res = await fetch("/api/ai/place", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const r = (await res.json()) as PlaceReply;
    aiAlert(r);
    return r;
  } catch {
    return { error: "failed", message: "Couldn't reach foodlab (offline?)" };
  }
}
