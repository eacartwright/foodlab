// Wikipedia lookups for foods (DESIGN.md §5.13): search for a food's article, and an article's
// summary (first paragraph, picture) for its page. Wikipedia's public REST interface, asked
// openly as foodlab; summaries are kept for a day so a page view doesn't ask every time.
import { wikiArticle, wikiUrl, type WikiHit, type WikiSummary } from "@foodlab/shared";

const UA = "foodlab/1.0 (personal recipe app; https://github.com/eacartwright/foodlab)";
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: WikiSummary | null }>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia: ${res.status}`);
  return res.json();
}

type Thumb = { url?: string; source?: string } | null | undefined;
const thumbUrl = (t: Thumb) => {
  const u = t?.source ?? t?.url;
  return u ? (u.startsWith("//") ? `https:${u}` : u) : null;
};

/** Articles matching a search ("red leaf lettuce"), best first. */
export async function wikiSearch(q: string, lang = "en"): Promise<WikiHit[]> {
  const query = q.trim().slice(0, 200);
  if (!query) return [];
  const data = (await getJson(`https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=8`)) as {
    pages?: { key: string; title: string; description?: string | null; thumbnail?: Thumb }[];
  } | null;
  return (data?.pages ?? []).map((p) => ({
    url: wikiUrl({ lang, title: p.key, section: "" }),
    title: p.title,
    description: p.description ?? "",
    thumb: thumbUrl(p.thumbnail),
  }));
}

/** An article's summary, or null if there's no such article. Follows redirects. */
export async function wikiSummary(link: string): Promise<WikiSummary | null> {
  const a = wikiArticle(link);
  if (!a) return null;
  const key = `${a.lang}:${a.title}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const data = (await getJson(`https://${a.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(a.title)}?redirect=true`)) as {
    type?: string;
    title?: string;
    titles?: { canonical?: string };
    description?: string;
    extract?: string;
    thumbnail?: Thumb;
  } | null;
  const value: WikiSummary | null = data
    ? {
        url: wikiUrl({ lang: a.lang, title: data.titles?.canonical ?? a.title, section: a.section }),
        title: data.title ?? a.title.replace(/_/g, " "),
        description: data.description ?? "",
        extract: data.extract ?? "",
        thumb: thumbUrl(data.thumbnail),
        ambiguous: data.type === "disambiguation",
      }
    : null;
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}
