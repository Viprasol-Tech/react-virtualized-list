/**
 * Pure windowing math for virtualized lists and grids.
 *
 * Given a scroll offset and viewport size, computeRange determines which slice
 * of items must be rendered, the offset of the first rendered item, and the
 * total scrollable size. This module contains no React and is fully
 * deterministic so it can be unit-tested with hand-computed values.
 *
 * It supports both the simple fixed-size case (computeRange) and the
 * variable-size case backed by a prefix-sum {@link SizeCache}
 * (computeVariableRange), plus a 2D grid helper (computeGridRange).
 */

export interface VirtualRange {
  /** Index of the first item to render (inclusive). */
  start: number;
  /** Index of the last item to render (inclusive). */
  end: number;
  /** Pixel offset (translate) to apply to the rendered window. */
  offsetY: number;
  /** Total size of the full list in pixels (start of the spacer). */
  totalHeight: number;
}

/**
 * Clamp a number into the inclusive [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Compute the visible window of items for a fixed-size list.
 *
 * @param scrollTop  Current scroll offset of the viewport, in pixels.
 * @param itemHeight Size of each row, in pixels (must be > 0).
 * @param viewport   Size of the visible viewport, in pixels.
 * @param itemCount  Total number of items in the list.
 * @param overscan   Extra rows to render above/below the visible range.
 * @returns          The {start, end, offsetY, totalHeight} window descriptor.
 */
export function computeRange(
  scrollTop: number,
  itemHeight: number,
  viewport: number,
  itemCount: number,
  overscan = 0,
): VirtualRange {
  if (itemHeight <= 0) {
    throw new Error("itemHeight must be greater than 0");
  }

  const totalHeight = itemCount * itemHeight;

  // Empty list: nothing to render.
  if (itemCount <= 0) {
    return { start: 0, end: -1, offsetY: 0, totalHeight: 0 };
  }

  const safeScrollTop = clamp(scrollTop, 0, Math.max(0, totalHeight - 1));
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const lastIndex = itemCount - 1;

  // First visible row (before overscan).
  const firstVisible = Math.floor(safeScrollTop / itemHeight);

  // Number of rows that can be (partially) visible inside the viewport.
  // ceil of the viewport size plus one to cover a partially-scrolled top row.
  const visibleCount = Math.ceil(viewport / itemHeight) + 1;
  const lastVisible = firstVisible + visibleCount - 1;

  const start = clamp(firstVisible - safeOverscan, 0, lastIndex);
  const end = clamp(lastVisible + safeOverscan, 0, lastIndex);

  const offsetY = start * itemHeight;

  return { start, end, offsetY, totalHeight };
}

/**
 * Number of items in a computed range (0 for an empty range).
 */
export function rangeLength(range: VirtualRange): number {
  return Math.max(0, range.end - range.start + 1);
}

/**
 * Compute the pixel offset of a single item's leading edge in a fixed-size
 * list. Useful for `scrollToIndex` with `align: "start"`.
 */
export function itemOffset(index: number, itemHeight: number): number {
  if (itemHeight <= 0) {
    throw new Error("itemHeight must be greater than 0");
  }
  return Math.max(0, index) * itemHeight;
}

/** Where to position the target item within the viewport after a scroll. */
export type ScrollAlign = "start" | "center" | "end" | "auto";

/**
 * Compute the scroll offset needed to bring `index` into view, honoring the
 * requested alignment. With `align: "auto"`, the offset only changes when the
 * item is currently outside the viewport (the minimal nudge to reveal it).
 *
 * @param index        Target item index.
 * @param itemHeight   Fixed item size in pixels.
 * @param viewport     Viewport size in pixels.
 * @param itemCount    Total item count (for clamping the result).
 * @param currentScroll Current scroll offset (used only for "auto").
 * @param align        Desired alignment. Default "auto".
 */
export function scrollOffsetForIndex(
  index: number,
  itemHeight: number,
  viewport: number,
  itemCount: number,
  currentScroll = 0,
  align: ScrollAlign = "auto",
): number {
  if (itemHeight <= 0) {
    throw new Error("itemHeight must be greater than 0");
  }
  const lastIndex = Math.max(0, itemCount - 1);
  const i = clamp(Math.floor(index), 0, lastIndex);
  const totalHeight = itemCount * itemHeight;
  const maxScroll = Math.max(0, totalHeight - viewport);

  const itemStart = i * itemHeight;
  const itemEnd = itemStart + itemHeight;

  let target: number;
  switch (align) {
    case "start":
      target = itemStart;
      break;
    case "end":
      target = itemEnd - viewport;
      break;
    case "center":
      target = itemStart - (viewport - itemHeight) / 2;
      break;
    case "auto":
    default: {
      if (itemStart < currentScroll) {
        target = itemStart; // above the viewport -> align to top
      } else if (itemEnd > currentScroll + viewport) {
        target = itemEnd - viewport; // below the viewport -> align to bottom
      } else {
        target = currentScroll; // already fully visible -> no change
      }
      break;
    }
  }

  return clamp(target, 0, maxScroll);
}

/* -------------------------------------------------------------------------- */
/*  Variable-size windowing (measured rows)                                   */
/* -------------------------------------------------------------------------- */

/**
 * A prefix-sum cache of item sizes for variable-height (or width) lists.
 *
 * Offsets are stored so that `offset(i)` is the leading edge of item `i` and
 * `offset(count)` is the total size. Lookups by pixel use binary search, so
 * mapping a scroll position to an index is O(log n).
 */
export class SizeCache {
  private sizes: number[];
  /** Prefix sums: offsets[i] = sum of sizes[0..i-1]; length = count + 1. */
  private offsets: number[];

  /**
   * @param count    Number of items.
   * @param estimate Fallback size for items not yet measured (must be > 0).
   */
  constructor(
    private count: number,
    private estimate: number,
  ) {
    if (estimate <= 0) {
      throw new Error("estimate must be greater than 0");
    }
    if (count < 0) {
      throw new Error("count must be >= 0");
    }
    this.sizes = new Array(count).fill(estimate);
    this.offsets = SizeCache.buildOffsets(this.sizes);
  }

  private static buildOffsets(sizes: number[]): number[] {
    const offsets = new Array(sizes.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < sizes.length; i++) {
      offsets[i + 1] = offsets[i] + sizes[i];
    }
    return offsets;
  }

  /** Number of items tracked. */
  get length(): number {
    return this.count;
  }

  /** Size of a single item in pixels. */
  size(index: number): number {
    if (index < 0 || index >= this.count) return 0;
    return this.sizes[index];
  }

  /** Leading-edge pixel offset of `index` (offset(count) === totalSize). */
  offset(index: number): number {
    const i = clamp(index, 0, this.count);
    return this.offsets[i];
  }

  /** Total size of all items in pixels. */
  totalSize(): number {
    return this.offsets[this.count];
  }

  /**
   * Record a measured size for an item. Returns true if the size changed
   * (callers can use this to decide whether a re-render is needed).
   */
  setSize(index: number, size: number): boolean {
    if (index < 0 || index >= this.count || size < 0) return false;
    if (this.sizes[index] === size) return false;
    const delta = size - this.sizes[index];
    this.sizes[index] = size;
    // Patch the prefix sums after `index` in O(n - index).
    for (let i = index + 1; i <= this.count; i++) {
      this.offsets[i] += delta;
    }
    return true;
  }

  /**
   * Grow/shrink the tracked item count. New items use the estimate size;
   * removed items are dropped. Preserves all existing measurements.
   */
  resize(count: number): void {
    if (count < 0) throw new Error("count must be >= 0");
    if (count === this.count) return;
    if (count < this.count) {
      this.sizes.length = count;
    } else {
      for (let i = this.count; i < count; i++) this.sizes.push(this.estimate);
    }
    this.count = count;
    this.offsets = SizeCache.buildOffsets(this.sizes);
  }

  /**
   * Index of the item whose span contains `px`, via binary search. Pixels at
   * or beyond the total size resolve to the last item; negative pixels to 0.
   */
  indexAt(px: number): number {
    if (this.count === 0) return 0;
    if (px <= 0) return 0;
    const total = this.totalSize();
    if (px >= total) return this.count - 1;
    let lo = 0;
    let hi = this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      // offsets[mid + 1] is the trailing edge of item `mid`.
      if (this.offsets[mid + 1] <= px) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}

/**
 * Compute the visible window for a variable-size list backed by a SizeCache.
 *
 * @param scrollTop Current scroll offset, in pixels.
 * @param viewport  Viewport size, in pixels.
 * @param cache     Prefix-sum size cache.
 * @param overscan  Extra rows above/below the visible range.
 */
export function computeVariableRange(
  scrollTop: number,
  viewport: number,
  cache: SizeCache,
  overscan = 0,
): VirtualRange {
  const itemCount = cache.length;
  const totalHeight = cache.totalSize();

  if (itemCount <= 0) {
    return { start: 0, end: -1, offsetY: 0, totalHeight: 0 };
  }

  const safeOverscan = Math.max(0, Math.floor(overscan));
  const lastIndex = itemCount - 1;
  const safeScrollTop = clamp(scrollTop, 0, Math.max(0, totalHeight - 1));

  const firstVisible = cache.indexAt(safeScrollTop);
  const lastVisible = cache.indexAt(safeScrollTop + viewport);

  const start = clamp(firstVisible - safeOverscan, 0, lastIndex);
  const end = clamp(lastVisible + safeOverscan, 0, lastIndex);
  const offsetY = cache.offset(start);

  return { start, end, offsetY, totalHeight };
}

/**
 * Scroll offset to reveal `index` in a variable-size list.
 */
export function scrollOffsetForVariableIndex(
  index: number,
  viewport: number,
  cache: SizeCache,
  currentScroll = 0,
  align: ScrollAlign = "auto",
): number {
  const itemCount = cache.length;
  if (itemCount <= 0) return 0;
  const lastIndex = itemCount - 1;
  const i = clamp(Math.floor(index), 0, lastIndex);
  const totalHeight = cache.totalSize();
  const maxScroll = Math.max(0, totalHeight - viewport);

  const itemStart = cache.offset(i);
  const itemEnd = itemStart + cache.size(i);

  let target: number;
  switch (align) {
    case "start":
      target = itemStart;
      break;
    case "end":
      target = itemEnd - viewport;
      break;
    case "center":
      target = itemStart - (viewport - cache.size(i)) / 2;
      break;
    case "auto":
    default: {
      if (itemStart < currentScroll) {
        target = itemStart;
      } else if (itemEnd > currentScroll + viewport) {
        target = itemEnd - viewport;
      } else {
        target = currentScroll;
      }
      break;
    }
  }

  return clamp(target, 0, maxScroll);
}

/* -------------------------------------------------------------------------- */
/*  2D grid windowing                                                         */
/* -------------------------------------------------------------------------- */

export interface GridRange {
  /** Inclusive row window. */
  rowStart: number;
  rowEnd: number;
  /** Inclusive column window. */
  colStart: number;
  colEnd: number;
  /** Pixel offset of the first rendered row. */
  offsetY: number;
  /** Pixel offset of the first rendered column. */
  offsetX: number;
  /** Total height of all rows, in pixels. */
  totalHeight: number;
  /** Total width of all columns, in pixels. */
  totalWidth: number;
}

export interface GridRangeInput {
  scrollTop: number;
  scrollLeft: number;
  rowHeight: number;
  columnWidth: number;
  viewportHeight: number;
  viewportWidth: number;
  rowCount: number;
  columnCount: number;
  overscan?: number;
}

/**
 * Compute the visible 2D window of cells for a fixed-size grid. Rows and
 * columns are windowed independently via {@link computeRange}.
 */
export function computeGridRange(input: GridRangeInput): GridRange {
  const {
    scrollTop,
    scrollLeft,
    rowHeight,
    columnWidth,
    viewportHeight,
    viewportWidth,
    rowCount,
    columnCount,
    overscan = 0,
  } = input;

  const rows = computeRange(scrollTop, rowHeight, viewportHeight, rowCount, overscan);
  const cols = computeRange(scrollLeft, columnWidth, viewportWidth, columnCount, overscan);

  return {
    rowStart: rows.start,
    rowEnd: rows.end,
    colStart: cols.start,
    colEnd: cols.end,
    offsetY: rows.offsetY,
    offsetX: cols.offsetY,
    totalHeight: rows.totalHeight,
    totalWidth: cols.totalHeight,
  };
}
