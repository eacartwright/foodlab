import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_MODELS, aiOf, Invalid, KINDS, recipeFromText, type Kind, type ReadRecipe } from "@foodlab/shared";
import { AiStopped, aiRead, pagePrompt, usage, type AiResult } from "./ai";
import { startBackups } from "./backup";
import { openDb } from "./db";
import { FileStore, MAX_FILE } from "./files";
import { fetchPhoto, readRecipe } from "./readRecipe";
import { writeDevNotes } from "./devNotesFile";
import { Store } from "./store";

const PORT = Number(process.env.PORT ?? 8788);
const DB_FILE = process.env.FOODLAB_DB ?? fileURLToPath(new URL("../../../data/foodlab.db", import.meta.url));
const BACKUP_DIR = process.env.FOODLAB_BACKUP_DIR ?? join(dirname(DB_FILE), "backups");
const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));
const DEV_NOTES_FILE = join(dirname(DB_FILE), "dev-notes.md");
const FILES_DIR = process.env.FOODLAB_FILES_DIR ?? join(dirname(DB_FILE), "files");

const db = openDb(DB_FILE);
const store = new Store(db);
const files = new FileStore(db, FILES_DIR);
const backups = startBackups(db, BACKUP_DIR, FILES_DIR);
writeDevNotes(DEV_NOTES_FILE, store.state);

// The build being served, named by its hashed script ("/assets/index-Bx3k.js"). The app compares
// it with its own and offers Update when they differ (an installed app can run for days).
const BUILD = existsSync(join(WEB_DIST, "index.html"))
  ? (/src="(\/assets\/[^"]+\.js)"/.exec(readFileSync(join(WEB_DIST, "index.html"), "utf8"))?.[1] ?? "")
  : "";

export const app = new Hono();

if (BUILD)
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("X-Foodlab-Build", BUILD);
  });

app.get("/api/health", (c) => c.json({ ok: true, rev: store.rev, lastBackup: backups.latest() }));

// A file, by id (photos, dev note attachments). The name after it is for people and is ignored.
// Never changes, so cached for good (also on the phone, so photos seen once show offline).
app.get("/api/files/:id/:name?", (c) => {
  const id = c.req.param("id");
  const file = /^[0-9a-f-]{36}$/.test(id) ? files.read(id) : null;
  if (!file) return c.json({ error: "No such file" }, 404);
  const inline = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/.test(file.info.type);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.info.type,
      "content-length": String(file.info.size),
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.info.name)}`,
    },
  });
});

// Upload: the raw bytes as the body, the type as Content-Type, the name in X-File-Name
// (URL-encoded). Answers with the file's id; the record that uses it is saved separately.
app.post("/api/files", async (c) => {
  const tooBig = { error: `Files can be up to ${MAX_FILE / 1024 / 1024} MB` };
  if (Number(c.req.header("content-length") ?? 0) > MAX_FILE) return c.json(tooBig, 413);
  const data = new Uint8Array(await c.req.arrayBuffer());
  if (!data.byteLength) return c.json({ error: "Empty file" }, 400);
  if (data.byteLength > MAX_FILE) return c.json(tooBig, 413);
  let name = "file";
  try {
    name = decodeURIComponent(c.req.header("x-file-name") ?? "file");
  } catch {
    // Not URL-encoded: keep "file".
  }
  return c.json(files.save(data, name, c.req.header("content-type") ?? ""));
});

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
    const saved = store.put(kind, c.req.param("id"), body);
    if (kind === "devnotes") writeDevNotes(DEV_NOTES_FILE, store.state);
    return c.json(saved);
  } catch (err) {
    if (err instanceof Invalid) return c.json({ error: err.message }, 400);
    console.error(err);
    store.reload();
    return c.json({ error: "Couldn't save" }, 500);
  }
});

// A shared recipe page, read (DESIGN.md §5.5): its recipe data, else Claude reads its text.
// Nothing is saved but the AI's cost: the app makes the recipe.
app.get("/api/read-recipe", async (c) => {
  const url = c.req.query("url") ?? "";
  const r = await readRecipe(url);
  if ("recipe" in r) return c.json({ recipe: r.recipe, via: "page", photo: r.photo });
  if (r.error !== "none") return c.json(r);
  try {
    const ai = await aiRead(db, aiOf(store.state), pagePrompt(url, r.html), "read");
    if (ai.recipe) return c.json({ ...aiReply(ai), via: "ai", photo: r.photo });
    return c.json({ error: "none", message: "No recipe found on the page", ...aiReply(ai) });
  } catch (err) {
    return c.json({ error: "none", message: `No recipe data on the page${aiWhy(err)}` });
  }
});

// A read recipe's suggested photo (DESIGN.md §5.5), fetched here because sites often won't let
// another page show their pictures. The app shrinks and uploads it like any photo.
app.get("/api/fetch-photo", async (c) => {
  const photo = await fetchPhoto(c.req.query("url") ?? "");
  if (!photo) return c.json({ error: "No photo there" }, 404);
  return new Response(photo.data, { headers: { "content-type": photo.type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
});

// Pasted recipe text: Claude reads it when AI is on, else the plain reader (recipeFromText).
app.post("/api/read-text", async (c) => {
  const body = await jsonBody(c);
  const text = typeof body?.text === "string" ? body.text.slice(0, 60_000) : "";
  if (!text.trim()) return c.json({ error: "failed", message: "Nothing to read" }, 400);
  try {
    const ai = await aiRead(db, aiOf(store.state), text, "paste");
    if (ai.recipe) return c.json({ ...aiReply(ai), via: "ai" });
  } catch (err) {
    return c.json({ recipe: recipeFromText(text), via: "text", note: aiWhy(err).replace(/^ \(|\)$/g, "") });
  }
  return c.json({ recipe: recipeFromText(text), via: "text" });
});

// Settings → AI: this month's use.
app.get("/api/ai", (c) => c.json(usage(db)));

// Settings → AI → Compare: the same recipe through every model, and the plain reader.
app.post("/api/ai/compare", async (c) => {
  const body = await jsonBody(c);
  let text = typeof body?.text === "string" ? body.text.slice(0, 60_000) : "";
  let plain: ReadRecipe | null = text ? recipeFromText(text) : null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (url) {
    const r = await readRecipe(url);
    if (!("html" in r)) return c.json({ error: r.error, message: r.message });
    // With recipe data or without, Claude gets the page's text, to compare.
    plain = "recipe" in r ? r.recipe : null;
    text = pagePrompt(url, r.html);
  }
  if (!text.trim()) return c.json({ error: "failed", message: "Nothing to read" }, 400);
  const ai = aiOf(store.state);
  const results = await Promise.all(
    AI_MODELS.map(async (m) => {
      try {
        return aiReply(await aiRead(db, { ...ai, model: m.id }, text, "compare", m.id));
      } catch (err) {
        return { model: m.id, error: aiWhy(err).replace(/^ \(|\)$/g, "") || "Failed" };
      }
    }),
  );
  return c.json({ plain, results });
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

const aiReply = (a: AiResult) => ({ recipe: a.recipe, model: a.model, costUsd: a.costUsd, tokens: a.tokens, ms: a.ms, alerts: a.alerts, limitUsd: aiOf(store.state).monthlyLimitUsd });

/** Why Claude wasn't used, for the app to show: " (AI: …)". */
function aiWhy(err: unknown): string {
  if (err instanceof AiStopped) return ` (AI: ${err.message})`;
  console.error(err);
  return " (AI: the call failed)";
}

async function jsonBody(c: { req: { header: (n: string) => string | undefined; json: () => Promise<unknown> } }): Promise<Record<string, unknown> | undefined> {
  if (!(c.req.header("content-type") ?? "").startsWith("application/json")) return undefined;
  const b = await c.req.json().catch(() => undefined);
  return b && typeof b === "object" ? (b as Record<string, unknown>) : undefined;
}

// In production the server also serves the built web app.
if (existsSync(WEB_DIST)) {
  // Built assets have hashed names and never change. Everything else (index.html, the manifest)
  // must be revalidated, or the installed app keeps running an old build.
  app.use("/*", async (c, next) => {
    await next();
    if (c.req.path.startsWith("/api/files/")) return; // its own: cached for good
    c.header("Cache-Control", c.req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  });
  app.use("/*", serveStatic({ root: WEB_DIST }));
  // Any other path is a page of the app (/foods/…, /share?…).
  app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));
}

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`foodlab server on http://localhost:${info.port}  (db: ${DB_FILE}, files: ${FILES_DIR}, backups: ${BACKUP_DIR})`);
});
