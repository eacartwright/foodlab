// A food's Wikipedia article (DESIGN.md §5.13): the Wikipedia field (Find, pick, paste a link)
// and the About card (its first paragraph and picture), fetched through the server.
import { wikiArticle, wikiName, wikiUrl, type WikiHit, type WikiSummary } from "@foodlab/shared";
import { useEffect, useRef, useState } from "react";

const summaries = new Map<string, WikiSummary | null>();

export function useWikiSummary(url: string): { summary: WikiSummary | null; failed: boolean } {
  const [, bump] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!url || summaries.has(url)) return;
    let live = true;
    fetch(`/api/wiki/summary?url=${encodeURIComponent(url)}`)
      .then(async (r) => {
        if (r.status === 404) summaries.set(url, null);
        else if (r.ok) summaries.set(url, (await r.json()) as WikiSummary);
        else throw new Error();
        if (live) bump((n) => n + 1);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url]);
  return { summary: summaries.get(url) ?? null, failed };
}

/** The article's first paragraph and picture, credited to Wikipedia. Nothing while offline. */
export function WikiAbout({ url }: { url: string }) {
  const { summary } = useWikiSummary(url);
  const [open, setOpen] = useState(false);
  if (!summary) return null;
  if (summary.ambiguous) return <p className="warn small">That Wikipedia link is a list of meanings, not one article: pick the one you mean.</p>;
  return (
    <section className="wiki-about" aria-label="About">
      {summary.thumb && <img src={summary.thumb} alt="" loading="lazy" />}
      <p className={open ? "" : "clamp"}>{summary.extract}</p>
      <p className="small muted">
        {summary.extract.length > 260 && (
          <>
            <button className="link-btn" onClick={() => setOpen(!open)}>
              {open ? "Less" : "More"}
            </button>{" "}
            ·{" "}
          </>
        )}
        <a href={summary.url} target="_blank" rel="noopener noreferrer">
          Wikipedia ↗
        </a>
      </p>
    </section>
  );
}

/** The Wikipedia field: the article, or Find (search, prefilled with the name) and paste. */
export function WikiField({ value, name, onChange }: { value: string; name: string; onChange: (url: string) => void }) {
  const [finding, setFinding] = useState(false);
  if (finding) return <WikiFinder name={name} onPick={(u) => (onChange(u), setFinding(false))} onCancel={() => setFinding(false)} />;
  if (!value)
    return (
      <button className="btn subtle" onClick={() => setFinding(true)}>
        🔍 Find
      </button>
    );
  return (
    <span className="inline">
      <a href={value} target="_blank" rel="noopener noreferrer">
        {wikiName(value)} ↗
      </a>
      <button className="btn subtle" onClick={() => setFinding(true)}>
        Change
      </button>
      <button className="btn icon subtle" aria-label="Remove the Wikipedia link" title="Remove" onClick={() => onChange("")}>
        ✕
      </button>
    </span>
  );
}

function WikiFinder({ name, onPick, onCancel }: { name: string; onPick: (url: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState(name);
  const [hits, setHits] = useState<WikiHit[] | null>(null);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const pasted = wikiArticle(q);
  useEffect(() => {
    if (pasted || !q.trim()) return setHits(null);
    const n = ++seq.current;
    const t = setTimeout(() => {
      fetch(`/api/wiki/search?q=${encodeURIComponent(q)}`)
        .then(async (r) => {
          const body = (await r.json()) as { hits?: WikiHit[]; error?: string };
          if (n !== seq.current) return;
          if (!r.ok) throw new Error(body.error);
          setError("");
          setHits(body.hits ?? []);
        })
        .catch(() => n === seq.current && setError("Can't reach Wikipedia right now."));
    }, 300);
    return () => clearTimeout(t);
  }, [q, pasted]);
  return (
    <div className="wiki-finder">
      <span className="inline">
        <input
          className="input"
          aria-label="Search Wikipedia, or paste a link"
          autoFocus
          value={q}
          enterKeyHint="search"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && pasted) onPick(wikiUrl(pasted));
          }}
        />
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </span>
      {pasted && (
        <button className="btn primary" onClick={() => onPick(wikiUrl(pasted))}>
          Use {wikiName(wikiUrl(pasted))}
        </button>
      )}
      {error && <p className="warn small">{error}</p>}
      {hits && !pasted && (
        <div className="wiki-hits" role="list">
          {hits.length === 0 && <p className="empty-line">No articles found.</p>}
          {hits.map((h) => (
            <button key={h.url} role="listitem" className="wiki-hit" onClick={() => onPick(h.url)}>
              {h.thumb ? <img src={h.thumb} alt="" loading="lazy" /> : <span className="wiki-thumb-none" aria-hidden />}
              <span>
                <span className="strong">{h.title}</span>
                {h.description && <span className="muted small"> · {h.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
