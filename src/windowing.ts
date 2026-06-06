/**
 * Pure windowing math for fixed-height virtualized lists.
 *
 * Given a scroll offset and viewport size, computeRange determines which
 * slice of items must be rendered, the vertical offset of the first rendered
 * item, and the total scrollable height. This module contains no React and is
 * fully deterministic so it can be unit-tested with hand-computed values.
 */

export interface VirtualRange {
  /** Index of the first item to render (inclusive). */
  start: number;
  /** Index of the last item to render (inclusive). */
  end: number;
  /** Pixel offset (translateY) to apply to the rendered window. */
  offsetY: number;
  /** Total height of the full list in pixels (start of the spacer). */
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
 * Compute the visible window of items for a fixed-height list.
 *
 * @param scrollTop  Current scroll offset of the viewport, in pixels.
 * @param itemHeight Height of each row, in pixels (must be > 0).
 * @param viewport   Height of the visible viewport, in pixels.
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
  // ceil of the viewport height plus one to cover a partially-scrolled top row.
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
