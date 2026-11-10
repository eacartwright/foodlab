// Wikipedia links on foods (DESIGN.md §4.2, §5.13): a link is stored as its tidy article URL,
// https://<lang>.wikipedia.org/wiki/<Title>, section kept ("Lettuce#Varieties").

export interface WikiArticle {
  lang: string;
  /** The title as in the URL: underscores, percent-decoded ("Red_leaf_lettuce"). */
  title: string;
  /** "#Varieties", or "". */
  section: string;
}

const WIKI = /^https?:\/\/([a-z][a-z-]{1,15})(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)(#[^?]*)?/i;

/** The article a link points at, or null if it isn't a Wikipedia article link. */
export function wikiArticle(url: string): WikiArticle | null {
  const m = WIKI.exec(url.trim());
  if (!m) return null;
  let title: string;
  try {
    title = decodeURIComponent(m[2]!);
  } catch {
    title = m[2]!;
  }
  title = title.replace(/ /g, "_");
  if (!title || /^(Special|File|Category|Help|Talk|User|Wikipedia|Template|Portal):/i.test(title)) return null;
  return { lang: m[1]!.toLowerCase(), title, section: m[3] ?? "" };
}

/** The tidy URL for an article: https://en.wikipedia.org/wiki/Red_leaf_lettuce */
export function wikiUrl(a: WikiArticle): string {
  return `https://${a.lang}.wikipedia.org/wiki/${encodeURIComponent(a.title).replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}${a.section}`;
}

/** The article's name for showing: "Red leaf lettuce". */
export function wikiName(url: string): string {
  const a = wikiArticle(url);
  return a ? a.title.replace(/_/g, " ") : url;
}

/** What the server's Wikipedia lookups return. */
export interface WikiSummary {
  url: string;
  title: string;
  /** Wikipedia's one-line description ("Leaf vegetable"), or "". */
  description: string;
  /** The article's first paragraph. */
  extract: string;
  thumb: string | null;
  /** True for a disambiguation page ("Chard (disambiguation)"): not an article about one thing. */
  ambiguous: boolean;
}
export interface WikiHit {
  url: string;
  title: string;
  description: string;
  thumb: string | null;
}
