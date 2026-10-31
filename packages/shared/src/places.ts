import type { ReadPlace } from "./ai";
import { newId } from "./id";
import { formatPhone, type PlaceLocation } from "./types";

// A place's locations (DESIGN.md §4.4, §5.12): telling them apart, and adding the ones AI found
// on the place's page.

export type FoundLocation = ReadPlace["locations"][number];

/** What a location is called in the dropdown: its name, else its street, else "Location 2". */
export const locationLabel = (l: PlaceLocation, i: number) => l.name || l.address.split(",")[0]!.trim() || `Location ${i + 1}`;

/** "3195 Monroe Ave." and "3195 monroe avenue, Rochester": the house number and the street's first word. */
const addressKey = (a: string) => {
  const s = a.toLowerCase();
  const m = s.match(/(\d+)\s+([a-z0-9]+)/);
  return m ? `${m[1]} ${m[2]}` : s.replace(/[^a-z0-9]+/g, " ").trim();
};

/** The location I already have at a found one's address, if any. */
export function matchLocation(have: PlaceLocation[], found: FoundLocation): PlaceLocation | undefined {
  if (!found.address) return undefined;
  const key = addressKey(found.address);
  return have.find((l) => l.address && addressKey(l.address) === key);
}

/**
 * Found locations added to a place's. One at an address I have fills that location in (what was
 * found wins; blanks keep what I had); a lone location with no address yet takes the first one
 * found; the rest are added at the end.
 */
export function withFound(have: PlaceLocation[], found: FoundLocation[]): PlaceLocation[] {
  const out = have.map((l) => ({ ...l }));
  const fill = (l: PlaceLocation, f: FoundLocation) => {
    l.name = f.name || l.name;
    l.address = f.address || l.address;
    l.phone = f.phone ? formatPhone(f.phone) : l.phone;
    l.hours = f.hours || l.hours;
  };
  for (const f of found) {
    const same = matchLocation(out, f);
    if (same) fill(same, f);
    else if (out.length === 1 && !out[0]!.address) fill(out[0]!, f);
    else out.push({ id: newId(), name: f.name, address: f.address, phone: formatPhone(f.phone), hours: f.hours });
  }
  return out;
}
