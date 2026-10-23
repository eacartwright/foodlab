import {
  Invalid,
  RATING_EMOJI,
  View,
  newId,
  today,
  validators,
  type AnyRecord,
  type Id,
  type Kind,
  type LogEntry,
  type Product,
  type Recipe,
  type Records,
  type State,
} from "@foodlab/shared";
import { getRev, loadState, save, setRev, transaction, type DB } from "./db";

// The authoritative state: held in memory, written through to SQLite on every save.
// A save is a whole record (DESIGN.md §9): validated, its links checked, given the next rev.

export class Store {
  state: State;

  constructor(private db: DB) {
    this.state = loadState(db);
  }

  get rev() {
    return this.state.rev;
  }

  /** Save one record. Returns it as stored, plus any log entries the save wrote (rating changes). */
  put<K extends Kind>(kind: K, id: Id, body: unknown, now = Date.now()): { rev: number; record: Records[K]; log: LogEntry[] } {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Invalid("Bad id");
    const rec = validators[kind](body, id, now) as Records[K];
    const prev = this.state[kind][id] as Records[K] | undefined;
    if (prev) rec.createdAt = prev.createdAt;
    this.check(kind, rec, prev);

    const log: LogEntry[] = [];
    if ((kind === "products" || kind === "recipes") && !rec.deleted) {
      const before = (prev as Product | Recipe | undefined)?.rating ?? null;
      const after = (rec as Product | Recipe).rating;
      if (after && after !== before) {
        log.push({
          id: newId(),
          deleted: false,
          createdAt: now,
          updatedAt: now,
          rev: 0,
          itemKind: kind,
          itemId: id,
          date: today(new Date(now)),
          kind: "rating",
          rating: after,
          text: before ? `${RATING_EMOJI[before]} → ${RATING_EMOJI[after]}` : `Rated ${RATING_EMOJI[after]}`,
        });
      }
    }

    const rev = this.state.rev + 1;
    rec.rev = rev;
    for (const e of log) e.rev = rev;
    transaction(this.db, () => {
      (save[kind] as (db: DB, x: AnyRecord) => void)(this.db, rec);
      for (const e of log) save.log(this.db, e);
      setRev(this.db, rev);
    });
    (this.state[kind] as Record<Id, AnyRecord>)[id] = rec;
    for (const e of log) this.state.log[e.id] = e;
    this.state.rev = rev;
    return { rev, record: rec, log };
  }

  /** Links must point at records that exist; foods can't be their own ancestors; meal tags are fixed. */
  private check(kind: Kind, rec: AnyRecord, prev: AnyRecord | undefined) {
    const s = this.state;
    const need = (table: Record<Id, unknown>, id: Id | null, what: string) => {
      if (id && !table[id]) throw new Invalid(`${what}: no such record (${id})`);
    };
    const tags = (ids: Id[]) => ids.forEach((t) => need(s.tags, t, "tag"));
    switch (kind) {
      case "foods": {
        const f = rec as Records["foods"];
        need(s.foods, f.parentId, "parent");
        need(s.foods, f.formOfId, "form of");
        const v = new View(s);
        if (f.parentId && v.wouldLoop(f.id, f.parentId)) throw new Invalid("A food can't be inside itself");
        if (f.formOfId && v.wouldLoop(f.id, f.formOfId)) throw new Invalid("A food can't be a form of itself");
        tags(f.tagIds);
        break;
      }
      case "products": {
        const p = rec as Product;
        need(s.foods, p.foodId, "food");
        p.storeIds.forEach((x) => need(s.stores, x, "store"));
        tags(p.tagIds);
        break;
      }
      case "recipes": {
        const r = rec as Recipe;
        r.ingredients.forEach((i) => need(s.foods, i.foodId, "ingredient food"));
        const seen = new Set<Id>();
        for (const i of r.ingredients) {
          if (seen.has(i.id)) throw new Invalid("Two ingredients with the same id");
          seen.add(i.id);
        }
        tags(r.tagIds);
        break;
      }
      case "tags": {
        const t = rec as Records["tags"];
        const meal = prev && (prev as Records["tags"]).kind === "meal";
        if (meal && (t.kind !== "meal" || t.name !== (prev as Records["tags"]).name || t.deleted)) {
          throw new Invalid("Meal tags are fixed");
        }
        if (!meal && t.kind === "meal") throw new Invalid("Meal tags are fixed");
        break;
      }
      case "log": {
        const e = rec as LogEntry;
        need(s[e.itemKind], e.itemId, "item");
        break;
      }
    }
  }

  /** Reload from disk (after a failed write left memory ahead of the file). */
  reload() {
    this.state = loadState(this.db);
    this.state.rev = getRev(this.db);
  }
}
