import { describe, expect, it } from "vitest";
import { costUsd, crossed, DEFAULT_AI } from "./ai";
import { validators } from "./validate";

describe("ai", () => {
  it("costs a call from list prices", () => {
    expect(costUsd("claude-opus-5-5", { input: 10_000, output: 1_000, cacheRead: 0 })).toBeCloseTo(0.06);
    expect(costUsd("claude-haiku-5-5", { input: 10_000, output: 1_000, cacheRead: 0 })).toBeCloseTo(0.0015);
    expect(costUsd("nope", { input: 1e6, output: 0, cacheRead: 0 })).toBe(0);
  });

  it("says which alert levels a call crossed", () => {
    const ai = { ...DEFAULT_AI, monthlyLimitUsd: 4, alertsAt: [75, 90] };
    expect(crossed(ai, 2.9, 3.1)).toEqual([75]);
    expect(crossed(ai, 2.9, 4.2)).toEqual([75, 90, 100]);
    expect(crossed(ai, 3.1, 3.2)).toEqual([]);
    expect(crossed({ ...ai, monthlyLimitUsd: null }, 0, 99)).toEqual([]);
  });

  it("validates the settings, defaulting a record from before", () => {
    const v = (ai: unknown) => validators.settings({ mealTimes: [{ from: "04:00", tagId: "meal-breakfast" }], ai }, "app", 1).ai;
    expect(v(undefined)).toEqual(DEFAULT_AI);
    expect(v({ model: "claude-haiku-5-5", monthlyLimitUsd: 2, alertsAt: [90, 75, 75] })).toEqual({ model: "claude-haiku-5-5", monthlyLimitUsd: 2, alertsAt: [75, 90] });
    expect(() => v({ model: "gpt", monthlyLimitUsd: 2, alertsAt: [] })).toThrow();
  });
});
