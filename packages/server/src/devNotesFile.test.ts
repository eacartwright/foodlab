import { describe, expect, it } from "vitest";
import { blank, emptyState } from "@foodlab/shared";
import { devNotesMarkdown } from "./devNotesFile";

describe("devNotesMarkdown", () => {
  it("lists open then done, skips deleted, and keeps the page only when there is one", () => {
    const s = emptyState();
    s.devnotes.a = blank.devnotes("a", "Edit notes", "/recipes/r", Date.UTC(2026, 9, 25));
    s.devnotes.b = { ...blank.devnotes("b", "Two\nlines", "", Date.UTC(2026, 9, 26)), done: true };
    s.devnotes.c = { ...blank.devnotes("c", "Gone", ""), deleted: true };
    const md = devNotesMarkdown(s);
    expect(md).toContain("## Open (1)\n\n- Edit notes (2026-10-25, /recipes/r, id a)");
    expect(md).toContain("## Done (1)\n\n- Two\n  lines (2026-10-26, id b)");
    expect(md).not.toContain("Gone");
  });
});
