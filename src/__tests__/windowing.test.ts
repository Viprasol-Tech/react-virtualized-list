import { describe, it, expect } from "vitest";
import {
  computeRange,
  computeVariableRange,
  computeGridRange,
  rangeLength,
  clamp,
  itemOffset,
  scrollOffsetForIndex,
  scrollOffsetForVariableIndex,
  SizeCache,
} from "../windowing.js";

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

describe("itemOffset", () => {
  it("returns the leading edge for a fixed-size list", () => {
    expect(itemOffset(0, 20)).toBe(0);
    expect(itemOffset(5, 20)).toBe(100);
  });
  it("clamps negative indices to zero", () => {
    expect(itemOffset(-3, 20)).toBe(0);
  });
  it("throws when itemHeight is not positive", () => {
    expect(() => itemOffset(1, 0)).toThrow(/itemHeight/);
  });
});

describe("scrollOffsetForIndex", () => {
  it("aligns to the start", () => {
    expect(scrollOffsetForIndex(10, 20, 100, 1000, 0, "start")).toBe(200);
  });

  it("aligns to the end (item bottom flush with viewport bottom)", () => {
    // item 10 spans 200..220; end align -> 220 - 100 = 120.
    expect(scrollOffsetForIndex(10, 20, 100, 1000, 0, "end")).toBe(120);
  });

  it("aligns to the center", () => {
    // 200 - (100 - 20) / 2 = 200 - 40 = 160.
    expect(scrollOffsetForIndex(10, 20, 100, 1000, 0, "center")).toBe(160);
  });

  it("auto: no change when the item is already fully visible", () => {
    // viewing 100..200 currently; item 6 spans 120..140 -> visible.
    expect(scrollOffsetForIndex(6, 20, 100, 1000, 100, "auto")).toBe(100);
  });

  it("auto: scrolls up to reveal an item above the viewport", () => {
    // currently at 500; item 0 is above -> align to its top (0).
    expect(scrollOffsetForIndex(0, 20, 100, 1000, 500, "auto")).toBe(0);
  });

  it("auto: scrolls down to reveal an item below the viewport", () => {
    // currently at 0 (viewing 0..100); item 20 spans 400..420 -> 420 - 100 = 320.
    expect(scrollOffsetForIndex(20, 20, 100, 1000, 0, "auto")).toBe(320);
  });

  it("clamps the result to the maximum scrollable offset", () => {
    // 50 items * 20 = 1000 total; maxScroll = 1000 - 100 = 900.
    expect(scrollOffsetForIndex(49, 20, 100, 50, 0, "start")).toBe(900);
  });

  it("clamps an out-of-range index", () => {
    expect(scrollOffsetForIndex(9999, 20, 100, 10, 0, "start")).toBe(100);
  });
});

describe("SizeCache", () => {
  it("seeds every item with the estimate", () => {
    const c = new SizeCache(4, 25);
    expect(c.length).toBe(4);
    expect(c.size(0)).toBe(25);
    expect(c.totalSize()).toBe(100);
    expect(c.offset(2)).toBe(50);
    expect(c.offset(4)).toBe(100);
  });

  it("records a measured size and patches prefix sums", () => {
    const c = new SizeCache(4, 25);
    expect(c.setSize(1, 75)).toBe(true);
    expect(c.size(1)).toBe(75);
    expect(c.offset(2)).toBe(100); // 25 + 75
    expect(c.totalSize()).toBe(150); // 25 + 75 + 25 + 25
  });

  it("setSize returns false when the size is unchanged or invalid", () => {
    const c = new SizeCache(3, 25);
    expect(c.setSize(0, 25)).toBe(false);
    expect(c.setSize(-1, 30)).toBe(false);
    expect(c.setSize(5, 30)).toBe(false);
  });

  it("indexAt maps a pixel position to the containing item", () => {
    const c = new SizeCache(4, 25); // edges at 0,25,50,75,100
    expect(c.indexAt(-10)).toBe(0);
    expect(c.indexAt(0)).toBe(0);
    expect(c.indexAt(24)).toBe(0);
    expect(c.indexAt(25)).toBe(1);
    expect(c.indexAt(60)).toBe(2);
    expect(c.indexAt(1000)).toBe(3); // beyond total -> last item
  });

  it("indexAt respects variable sizes after measurement", () => {
    const c = new SizeCache(3, 10); // edges 0,10,20,30
    c.setSize(0, 100); // edges now 0,100,110,120
    expect(c.indexAt(50)).toBe(0);
    expect(c.indexAt(105)).toBe(1);
    expect(c.indexAt(115)).toBe(2);
  });

  it("resize grows with estimates and preserves measurements", () => {
    const c = new SizeCache(2, 10);
    c.setSize(0, 50);
    c.resize(4);
    expect(c.length).toBe(4);
    expect(c.size(0)).toBe(50); // preserved
    expect(c.size(3)).toBe(10); // new -> estimate
    expect(c.totalSize()).toBe(80); // 50 + 10 + 10 + 10
  });

  it("resize shrinks and drops trailing items", () => {
    const c = new SizeCache(4, 10);
    c.resize(2);
    expect(c.length).toBe(2);
    expect(c.totalSize()).toBe(20);
  });

  it("rejects a non-positive estimate", () => {
    expect(() => new SizeCache(3, 0)).toThrow(/estimate/);
  });
});

describe("computeVariableRange", () => {
  it("returns an empty range for an empty cache", () => {
    const c = new SizeCache(0, 20);
    expect(computeVariableRange(0, 100, c, 2)).toEqual({
      start: 0,
      end: -1,
      offsetY: 0,
      totalHeight: 0,
    });
  });

  it("windows a uniform variable list like the fixed path", () => {
    const c = new SizeCache(1000, 20);
    const r = computeVariableRange(200, 100, c, 0);
    // firstVisible = indexAt(200) = 10; lastVisible = indexAt(300) = 15.
    expect(r.start).toBe(10);
    expect(r.end).toBe(15);
    expect(r.offsetY).toBe(200);
    expect(r.totalHeight).toBe(20000);
  });

  it("applies overscan symmetrically", () => {
    const c = new SizeCache(1000, 20);
    const r = computeVariableRange(200, 100, c, 2);
    expect(r.start).toBe(8);
    expect(r.end).toBe(17);
    expect(r.offsetY).toBe(160);
  });

  it("handles non-uniform measured sizes", () => {
    const c = new SizeCache(5, 10); // edges 0,10,20,30,40,50
    c.setSize(0, 100); // edges 0,100,110,120,130,140
    const r = computeVariableRange(0, 50, c, 0);
    expect(r.start).toBe(0);
    expect(r.offsetY).toBe(0);
    expect(r.totalHeight).toBe(140);
  });

  it("clamps the end at the last item near the bottom", () => {
    const c = new SizeCache(50, 20); // total 1000
    const r = computeVariableRange(999, 100, c, 0);
    expect(r.end).toBe(49);
    expect(r.start).toBeLessThanOrEqual(r.end);
  });
});

describe("scrollOffsetForVariableIndex", () => {
  it("aligns to the start using cached offsets", () => {
    const c = new SizeCache(100, 20);
    expect(scrollOffsetForVariableIndex(10, 100, c, 0, "start")).toBe(200);
  });

  it("aligns to the end", () => {
    const c = new SizeCache(100, 20);
    // item 10 spans 200..220 -> 220 - 100 = 120.
    expect(scrollOffsetForVariableIndex(10, 100, c, 0, "end")).toBe(120);
  });

  it("returns 0 for an empty cache", () => {
    const c = new SizeCache(0, 20);
    expect(scrollOffsetForVariableIndex(3, 100, c, 0, "start")).toBe(0);
  });

  it("auto keeps a fully-visible item in place", () => {
    const c = new SizeCache(100, 20);
    expect(scrollOffsetForVariableIndex(6, 100, c, 100, "auto")).toBe(100);
  });
});

describe("computeGridRange", () => {
  it("windows rows and columns independently", () => {
    const g = computeGridRange({
      scrollTop: 200,
      scrollLeft: 300,
      rowHeight: 20,
      columnWidth: 50,
      viewportHeight: 100,
      viewportWidth: 150,
      rowCount: 1000,
      columnCount: 1000,
      overscan: 0,
    });
    // rows: firstVisible 10, visibleCount ceil(100/20)+1 = 6 -> 10..15
    expect(g.rowStart).toBe(10);
    expect(g.rowEnd).toBe(15);
    expect(g.offsetY).toBe(200);
    // cols: firstVisible floor(300/50)=6, visibleCount ceil(150/50)+1 = 4 -> 6..9
    expect(g.colStart).toBe(6);
    expect(g.colEnd).toBe(9);
    expect(g.offsetX).toBe(300);
    expect(g.totalHeight).toBe(20000);
    expect(g.totalWidth).toBe(50000);
  });

  it("applies overscan on both axes", () => {
    const g = computeGridRange({
      scrollTop: 200,
      scrollLeft: 300,
      rowHeight: 20,
      columnWidth: 50,
      viewportHeight: 100,
      viewportWidth: 150,
      rowCount: 1000,
      columnCount: 1000,
      overscan: 1,
    });
    expect(g.rowStart).toBe(9);
    expect(g.colStart).toBe(5);
  });

  it("clamps an empty grid", () => {
    const g = computeGridRange({
      scrollTop: 0,
      scrollLeft: 0,
      rowHeight: 20,
      columnWidth: 50,
      viewportHeight: 100,
      viewportWidth: 150,
      rowCount: 0,
      columnCount: 0,
    });
    expect(g.rowEnd).toBe(-1);
    expect(g.colEnd).toBe(-1);
  });
});
