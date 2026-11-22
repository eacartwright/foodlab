import { SOURCE_KINDS, SOURCE_KIND_LABEL, siteHost, type Source } from "@foodlab/shared";
import { useState } from "react";
import { remove } from "../actions";
import { go, listPath } from "../router";
import { data, put, useData } from "../sync";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftInput, DraftTextarea, Field, PageKind, RatingInput, Segmented, TitleInput } from "./controls";
import { Deleted, NotFound } from "./FoodPage";
import { ItemRow, Section } from "./rows";

// A source (DESIGN.md §5.16): a favorite recipe website or cookbook. A website lists every recipe
// whose link is on its site; a book, the recipes that name it.

export function SourcePage({ id }: { id: string }) {
  const { view, state } = useData();
  const s = state.sources?.[id];
  const [confirm, setConfirm] = useState(false);
  if (!s) return <NotFound what="source" />;
  const save = (patch: Partial<Source>) => put("sources", { ...(data().state.sources[id] ?? s), ...patch });
  const recipes = view.recipesFromSource(s.id);
  const named = recipes.filter((r) => r.sourceId === s.id).length;
  const site = siteHost(s.url);

  return (
    <article className="page">
      {s.deleted && <Deleted onRestore={() => save({ deleted: false })} />}
      <PageKind kind="sources" as={s.kind === "book" ? { icon: "📚", label: "Book" } : { icon: "🌐", label: "Website" }}>
        <span className="spacer" />
        {site && (
          <a className="btn subtle" href={s.url} target="_blank" rel="noreferrer noopener" title={s.url}>
            🔗 {site} ↗
          </a>
        )}
      </PageKind>
      <div className="title-row">
        <TitleInput value={s.name} required aria-label="Name" onCommit={(name) => save({ name })} />
      </div>
      <div className="fields">
        <Field label="Kind">
          <Segmented value={s.kind} options={SOURCE_KINDS} labels={SOURCE_KIND_LABEL} clearable={false} onChange={(kind) => kind && save({ kind })} />
        </Field>
        <Field label="Link">
          <DraftInput className="input" type="url" inputMode="url" value={s.url} onCommit={(url) => save({ url: url.trim() })} />
        </Field>
        <Field label={s.kind === "book" ? "Author" : "By"}>
          <DraftInput className="input" value={s.author} onCommit={(author) => save({ author })} />
        </Field>
        <Field label="Rating">
          <RatingInput value={s.rating} onChange={(rating) => save({ rating })} />
        </Field>
        <Field label="Notes">
          <DraftTextarea className="input" rows={3} value={s.notes} onCommit={(notes) => save({ notes })} />
        </Field>
      </div>

      <Section title="Recipes" count={recipes.length}>
        {recipes.length > 0 ? (
          <div className="rows">{recipes.map((r) => <ItemRow key={r.id} view={view} kind="recipes" item={r} showKind={false} />)}</div>
        ) : (
          <p className="empty-line">
            {s.kind === "website" && !site ? "Add its link to find the recipes from it." : s.kind === "website" ? "No recipes with a link on this site yet." : "No recipes name it yet: pick it as a recipe's Source in Edit."}
          </p>
        )}
      </Section>

      <div className="page-foot">
        {!s.deleted && (
          <button className="btn danger" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Delete “${s.name}”?`}
          confirm="Delete"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            remove("sources", s);
            go(listPath("sources"), { replace: true });
          }}
        >
          <p>
            {named ? `${named} recipe${named === 1 ? "" : "s"} name${named === 1 ? "s" : ""} it; they keep their links.` : "No recipe names it."} You can undo this right after.
          </p>
        </ConfirmDialog>
      )}
    </article>
  );
}
