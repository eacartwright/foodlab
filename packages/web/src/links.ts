// Outside links in the system browser (DESIGN.md §later, being tried on the Pixel). In the installed
// app on Android, Chrome opens outside links in its in-app view over the app. With this on, one click
// handler turns them into an Android intent link, so the default browser (or the matching app) opens
// them; the fallback URL opens the link as before. Per device, in localStorage, like Colors.

const KEY = "foodlab:links-in-browser";

export const isAndroid = /Android/i.test(navigator.userAgent);

export function linksInBrowser(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLinksInBrowser(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: stays off.
  }
}

/** intent://<host><path>#Intent;scheme=https;action=…VIEW;S.browser_fallback_url=<url>;end */
export function intentUrl(url: URL): string {
  const scheme = url.protocol.slice(0, -1);
  // Host, path, query, hash: Android splits at the last "#", so a link's own #fragment can stay.
  const rest = url.href.slice(url.protocol.length + 2);
  return `intent://${rest}#Intent;scheme=${scheme};action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}

export function startLinks() {
  if (!isAndroid) return;
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!linksInBrowser()) return;
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin === location.origin || (url.protocol !== "https:" && url.protocol !== "http:")) return;
    e.preventDefault();
    location.href = intentUrl(url);
  });
}
