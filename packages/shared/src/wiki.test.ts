import { describe, expect, it } from "vitest";
import { validators } from "./validate";
import { wikiArticle, wikiName, wikiUrl } from "./wiki";

describe("Wikipedia links", () => {
  it("reads an article link, tidies it, keeps the section", () => {
    expect(wikiArticle("https://en.m.wikipedia.org/wiki/Red_leaf_lettuce")).toEqual({ lang: "en", title: "Red_leaf_lettuce", section: "" });
    expect(wikiUrl(wikiArticle("http://en.wikipedia.org/wiki/Lettuce#Varieties")!)).toBe("https://en.wikipedia.org/wiki/Lettuce#Varieties");
    expect(wikiUrl(wikiArticle("https://en.wikipedia.org/wiki/Cr%C3%A8me_fra%C3%AEche")!)).toBe("https://en.wikipedia.org/wiki/Cr%C3%A8me_fra%C3%AEche");
    expect(wikiName("https://en.wikipedia.org/wiki/Cr%C3%A8me_fra%C3%AEche")).toBe("Crème fraîche");
    expect(wikiUrl(wikiArticle("https://en.wikipedia.org/wiki/Chard_(disambiguation)")!)).toBe("https://en.wikipedia.org/wiki/Chard_(disambiguation)");
  });

  it("refuses what isn't an article", () => {
    expect(wikiArticle("https://example.com/wiki/Lettuce")).toBeNull();
    expect(wikiArticle("https://en.wikipedia.org/wiki/Special:Search")).toBeNull();
    expect(() => validators.foods({ name: "Lettuce", wiki: "https://example.com" }, "f", 0)).toThrow(/Wikipedia/);
    expect(validators.foods({ name: "Lettuce", wiki: " https://en.m.wikipedia.org/wiki/Lettuce " }, "f", 0).wiki).toBe("https://en.wikipedia.org/wiki/Lettuce");
    expect(validators.foods({ name: "Lettuce" }, "f", 0).wiki).toBe("");
  });
});
