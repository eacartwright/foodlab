import type { ReactNode } from "react";

// Light Markdown for notes and instructions: paragraphs, - / * bullets, 1. numbers, # headings,
// **bold**, *italic*, [links](url) and bare links. Built as React elements (never raw HTML).

const SAFE_URL = /^(https?:\/\/|mailto:|\/)/i;

/** Plain text between the marks, e.g. scaled amounts in a recipe's instructions. */
type Plain = (text: string, key: string) => ReactNode[];
const asIs: Plain = (text) => [text];

function inline(text: string, key: string, plain: Plain = asIs): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...plain(text.slice(last, m.index), `${key}-p${m.index}`));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<strong key={k}>{plain(m[1], k)}</strong>);
    else if (m[2]) out.push(<em key={k}>{plain(m[2], k)}</em>);
    else if (m[3] && m[4]) {
      out.push(
        SAFE_URL.test(m[4]) ? (
          <a key={k} href={m[4]} target="_blank" rel="noreferrer noopener">
            {m[3]}
          </a>
        ) : (
          m[0]
        ),
      );
    } else if (m[5]) {
      out.push(
        <a key={k} href={m[5]} target="_blank" rel="noreferrer noopener">
          {m[5].replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...plain(text.slice(last), `${key}-p${last}`));
  return out;
}

export function Markdown({ text, className = "", plain }: { text: string; className?: string; plain?: Plain }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const key = `b${b++}`;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(<h4 key={key}>{inline(h[2]!, key, plain)}</h4>);
      i++;
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const number = /^\s*\d+[.)]\s+/;
    for (const [re, Tag] of [
      [bullet, "ul"],
      [number, "ol"],
    ] as const) {
      if (re.test(line)) {
        const items: ReactNode[] = [];
        while (i < lines.length && re.test(lines[i]!)) {
          items.push(<li key={items.length}>{inline(lines[i]!.replace(re, ""), `${key}-${items.length}`, plain)}</li>);
          i++;
        }
        blocks.push(<Tag key={key}>{items}</Tag>);
        break;
      }
    }
    if (bullet.test(line) || number.test(line)) continue;
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !bullet.test(lines[i]!) && !number.test(lines[i]!) && !/^#{1,3}\s/.test(lines[i]!)) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p key={key}>
        {para.flatMap((l, n) => (n ? [<br key={`br${n}`} />, ...inline(l, `${key}-${n}`, plain)] : inline(l, `${key}-${n}`, plain)))}
      </p>,
    );
  }
  return <div className={`md ${className}`}>{blocks}</div>;
}
