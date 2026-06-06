import { describe, it, expect } from "vitest";
import { computeRange, rangeLength, clamp } from "../windowing.js";

describe("clamp", () => {
  it("clamps below the minimum", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above the maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("passes values within range through", () => {
    expect(clamp(7, 0, 10)).toBe(7);
  });
});

describe("computeRange", () => {
  it("computes the window at the very top with no overscan", () => {
    // itemHeight 20, viewport 100 -> ceil(100/20)+1 = 6 rows visible.
    // start = 0, end = 0 + 6 - 1 = 5.
    const r = computeRange(0, 20, 100, 1000, 0);
    expect(r).toEqual({ start: 0, end: 5, offsetY: 0, totalHeight: 20000 });
  });

  it("applies overscan symmetrically", () => {
    // scrollTop 200 -> firstVisible = 10. visibleCount = 6 -> lastVisible = 15.
    // overscan 2 -> start = 8, end = 17. offsetY = 8 * 20 = 160.
    const r = computeRange(200, 20, 100, 1000, 2);
    expect(r).toEqual({ start: 8, end: 17, offsetY: 160, totalHeight: 20000 });
  });

  it("clamps the start to zero near the top even with overscan", () => {
    // scrollTop 20 -> firstVisible = 1. start = 1 - 5 = -4 -> clamped to 0.
    const r = computeRange(20, 20, 100, 1000, 5);
    expect(r.start).toBe(0);
    expect(r.offsetY).toBe(0);
  });

  it("clamps the end to the last index near the bottom", () => {
    // 50 items, itemHeight 20, totalHeight = 1000. Scroll near the bottom.
    // scrollTop 999 (clamped to 999) -> firstVisible = floor(999/20) = 49.
    // visibleCount = 6 -> lastVisible = 54 -> clamped to 49.
    const r = computeRange(999, 20, 100, 50, 0);
    expect(r.end).toBe(49);
    expect(r.start).toBeLessThanOrEqual(r.end);
    expect(r.totalHeight).toBe(1000);
  });

  it("handles a partially-scrolled position with the +1 row buffer", () => {
    // scrollTop 30 -> firstVisible = floor(30/20) = 1.
    // visibleCount = ceil(100/20)+1 = 6 -> lastVisible = 6.
    const r = computeRange(30, 20, 100, 1000, 0);
    expect(r.start).toBe(1);
    expect(r.end).toBe(6);
    expect(r.offsetY).toBe(20);
  });

  it("returns an empty range for an empty list", () => {
    const r = computeRange(0, 20, 100, 0, 3);
    expect(r).toEqual({ start: 0, end: -1, offsetY: 0, totalHeight: 0 });
    expect(rangeLength(r)).toBe(0);
  });

  it("never renders past the available items when the list is short", () => {
    // 3 items only, large viewport.
    const r = computeRange(0, 40, 1000, 3, 5);
    expect(r.start).toBe(0);
    expect(r.end).toBe(2);
    expect(rangeLength(r)).toBe(3);
  });

  it("throws when itemHeight is not positive", () => {
    expect(() => computeRange(0, 0, 100, 10)).toThrow(/itemHeight/);
    expect(() => computeRange(0, -5, 100, 10)).toThrow(/itemHeight/);
  });

  it("clamps negative scrollTop to the top", () => {
    const r = computeRange(-500, 20, 100, 1000, 0);
    expect(r.start).toBe(0);
    expect(r.offsetY).toBe(0);
  });
});

describe("rangeLength", () => {
  it("counts inclusive ranges", () => {
    expect(rangeLength({ start: 8, end: 17, offsetY: 0, totalHeight: 0 })).toBe(10);
  });
  it("returns zero for an inverted/empty range", () => {
    expect(rangeLength({ start: 0, end: -1, offsetY: 0, totalHeight: 0 })).toBe(0);
  });
});
