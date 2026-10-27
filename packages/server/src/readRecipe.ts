import { recipeFromHtml, type ReadRecipe } from "@foodlab/shared";

// Reading a shared recipe (DESIGN.md §5.5): fetch the page as foodlab, openly, and read the
// recipe it embeds. Sites that turn away anything but a browser get a "refused", and the app
// offers Paste instead.

/** The page comes along, for Claude to read (when there's no recipe data in it, or to compare). */
export type ReadResult = { recipe: ReadRecipe; html: string } | { error: "refused" | "failed"; message: string } | { error: "none"; message: string; html: string };

const MAX_BYTES = 5_000_000;
const UA = "Mozilla/5.0 (compatible; foodlab/1.0; personal recipe box)";

/** Not something on this machine or the home network. */
function allowed(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || (!h.includes(".") && !h.includes(":"))) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (h.includes(":") && (h === "::1" || /^(f[cd]|fe80)/.test(h))) return false;
  return true;
}

export async function readRecipe(raw: string): Promise<ReadResult> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "failed", message: "That isn't a link" };
  }
  if (!allowed(url)) return { error: "failed", message: "Only web pages can be read" };
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  } catch {
    return { error: "failed", message: "Couldn't reach the page" };
  }
  if (res.status === 401 || res.status === 403 || res.status === 429) return { error: "refused", message: "The site wouldn't let foodlab read it" };
  if (!res.ok) return { error: "failed", message: `The page answered ${res.status}` };
  const html = await readCapped(res);
  const recipe = recipeFromHtml(html);
  return recipe ? { recipe, html } : { error: "none", message: "No recipe found on the page", html };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
