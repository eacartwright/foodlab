import { describe, expect, it } from "vitest";
import { locationLabel, matchLocation, withFound } from "./places";
import type { PlaceLocation } from "./types";

const loc = (id: string, address: string, more: Partial<PlaceLocation> = {}): PlaceLocation => ({ id, name: "", address, phone: "", hours: "", ...more });

describe("place locations", () => {
  it("labels a location by its name, else its street, else its number", () => {
    expect(locationLabel(loc("a", "3195 Monroe Ave, Rochester", { name: "Pittsford" }), 0)).toBe("Pittsford");
    expect(locationLabel(loc("a", "3195 Monroe Ave, Rochester"), 0)).toBe("3195 Monroe Ave");
    expect(locationLabel(loc("a", ""), 1)).toBe("Location 2");
  });

  it("matches an address however it's written", () => {
    const have = [loc("a", "3195 Monroe Ave., Rochester, NY")];
    expect(matchLocation(have, { name: "", address: "3195 monroe avenue", phone: "", hours: "" })?.id).toBe("a");
    expect(matchLocation(have, { name: "", address: "525 Monroe Ave", phone: "", hours: "" })).toBeUndefined();
  });

  it("fills in a location I have, adds the rest, and keeps what wasn't found", () => {
    const have = [loc("a", "3195 Monroe Ave", { phone: "(585) 555-0100", hours: "old" })];
    const out = withFound(have, [
      { name: "Pittsford", address: "3195 Monroe Ave, Rochester, NY 14618", phone: "", hours: "Daily 6am–midnight" },
      { name: "Perinton", address: "6600 Pittsford Palmyra Rd", phone: "+1 585 555 0199", hours: "" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: "a", name: "Pittsford", address: "3195 Monroe Ave, Rochester, NY 14618", phone: "(585) 555-0100", hours: "Daily 6am–midnight" });
    expect(out[1]).toMatchObject({ name: "Perinton", phone: "(585) 555-0199" });
    expect(have[0]!.name).toBe(""); // the place's own copy is untouched
  });

  it("puts the first found into a lone location with no address yet", () => {
    const out = withFound([loc("a", "", { phone: "(585) 555-0100" })], [{ name: "", address: "1 Main St", phone: "", hours: "9–5" }]);
    expect(out).toEqual([{ id: "a", name: "", address: "1 Main St", phone: "(585) 555-0100", hours: "9–5" }]);
  });
});
