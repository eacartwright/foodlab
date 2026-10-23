import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Invalid, KINDS, type Kind } from "@foodlab/shared";
import { startBackups } from "./backup";
import { openDb } from "./db";
import { Store } from "./store";

const PORT = Number(process.env.PORT ?? 8788);
const DB_FILE = process.env.FOODLAB_DB ?? fileURLToPath(new URL("../../../data/foodlab.db", import.meta.url));
const BACKUP_DIR = process.env.FOODLAB_BACKUP_DIR ?? join(dirname(DB_FILE), "backups");
const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));

const db = openDb(DB_FILE);
const store = new Store(db);
const backups = startBackups(db, BACKUP_DIR);

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, rev: store.rev, lastBackup: backups.latest() }));

// Everything, for the app to keep a copy of. A personal food database is small; the ETag lets
// a device that's up to date get a 304 instead.
app.get("/api/state", (c) => {
  const etag = `"rev-${store.rev}"`;
  if (c.req.header("if-none-match") === etag) return c.body(null, 304, { ETag: etag });
  c.header("ETag", etag);
  c.header("Cache-Control", "no-cache");
  return c.json(store.state);
});

// Save one whole record (DESIGN.md §9). Idempotent: the outbox may send the same version twice.
app.put("/api/:kind/:id", async (c) => {
  const kind = c.req.param("kind") as Kind;
  if (!KINDS.includes(kind)) return c.json({ error: "No such kind" }, 404);
  // Only JSON (a page on another site can't send that without the browser asking first).
  if (!(c.req.header("content-type") ?? "").startsWith("application/json")) return c.json({ error: "Expected JSON" }, 415);
  const body = await c.req.json().catch(() => undefined);
  if (body === undefined) return c.json({ error: "Expected JSON" }, 400);
  try {
    return c.json(store.put(kind, c.req.param("id"), body));
  } catch (err) {
    if (err instanceof Invalid) return c.json({ error: err.message }, 400);
    console.error(err);
    store.reload();
    return c.json({ error: "Couldn't save" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// In production the server also serves the built web app.
if (existsSync(WEB_DIST)) {
  // Built assets have hashed names and never change. Everything else (index.html, the manifest)
  // must be revalidated, or the installed app keeps running an old build.
  app.use("/*", async (c, next) => {
    await next();
    c.header("Cache-Control", c.req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  });
  app.use("/*", serveStatic({ root: WEB_DIST }));
  // Any other path is a page of the app (/foods/…, /share?…).
  app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));
}

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`foodlab server on http://localhost:${info.port}  (db: ${DB_FILE}, backups: ${BACKUP_DIR})`);
});
