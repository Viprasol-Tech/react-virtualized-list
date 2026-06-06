import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type UIEvent,
} from "react";
import {
  computeRange,
  computeVariableRange,
  rangeLength,
  scrollOffsetForIndex,
  scrollOffsetForVariableIndex,
  SizeCache,
  type ScrollAlign,
  type VirtualRange,
} from "./windowing.js";

/** Layout direction of the list. */
export type VirtualListDirection = "vertical" | "horizontal";

/**
 * Imperative handle exposed via `ref`, mirroring common list APIs.
 */
export interface VirtualListHandle {
  /** Scroll so that `index` is visible, honoring `align` (default "auto"). */
  scrollToIndex: (index: number, align?: ScrollAlign) => void;
  /** Scroll to an absolute pixel offset along the scroll axis. */
  scrollToOffset: (offset: number) => void;
  /** Current scroll offset along the scroll axis, in pixels. */
  getScrollOffset: () => number;
  /** The underlying scroll container element (or null before mount). */
  getScrollElement: () => HTMLDivElement | null;
}

export interface VirtualListProps {
  /** Total number of items in the list. */
  itemCount: number;
  /**
   * Size of each row along the scroll axis, in pixels. Either a fixed number,
   * or a function `(index) => px` for variable sizing. With a function you
   * should also pass `estimatedItemHeight` for unmeasured items.
   */
  itemHeight: number | ((index: number) => number);
  /** Size of the scrollable viewport along the scroll axis, in pixels. */
  height: number;
  /**
   * Render a single row. Receives the absolute item index and a style object
   * that MUST be spread onto the row's root element for correct positioning.
   */
  renderItem: (index: number, style: CSSProperties) => ReactNode;
  /** Extra rows to render above/below (or left/right of) the window. Default 2. */
  overscan?: number;
  /** Scroll/layout direction. Default "vertical". */
  direction?: VirtualListDirection;
  /**
   * Measure rendered rows and use their real sizes (variable heights). When
   * true, `itemHeight` may be a number (initial estimate) or a function.
   * Default false.
   */
  measure?: boolean;
  /** Fallback size for unmeasured rows when `measure`/function sizing is used. */
  estimatedItemHeight?: number;
  /** Optional sticky header rendered above the scrolled content. */
  stickyHeader?: ReactNode;
  /** Optional sticky footer rendered below the scrolled content. */
  stickyFooter?: ReactNode;
  /** Called with the new scroll offset whenever the list scrolls. */
  onScrollOffsetChange?: (offset: number) => void;
  /** Called with the visible item range whenever it changes. */
  onRangeChange?: (range: VirtualRange) => void;
  /** Cross-axis size of the viewport. Default "100%". */
  width?: number | string;
  /** Accessible role for the scroll container. Default "list". */
  role?: string;
  /** Accessible label for the scroll container. */
  "aria-label"?: string;
  /** Optional className for the outer scroll container. */
  className?: string;
  /** Optional inline style merged onto the outer scroll container. */
  style?: CSSProperties;
  /** Optional data-testid forwarded to the outer scroll container. */
  "data-testid"?: string;
}

function asSizeFn(
  itemHeight: number | ((index: number) => number),
): (index: number) => number {
  return typeof itemHeight === "function" ? itemHeight : () => itemHeight;
}

/**
 * VirtualList renders only the rows that fall within the viewport (plus an
 * overscan buffer), keeping the DOM small even for very large datasets.
 *
 * Modes:
 *  - Fixed size: pass `itemHeight={number}`.
 *  - Variable size: pass `itemHeight={(i) => px}` and/or `measure` to grow the
 *    size cache from real DOM measurements.
 *  - Horizontal: pass `direction="horizontal"` (sizes/offsets map to the X axis).
 *
 * Positioning: an outer scroll container holds a spacer sized to the full list
 * extent. The rendered window of rows is absolutely positioned and translated
 * to the correct offset so the browser's native scrollbar reflects the full list.
 */
function VirtualListInner(
  props: VirtualListProps,
  ref: Ref<VirtualListHandle>,
): ReactNode {
  const {
    itemCount,
    itemHeight,
    height,
    renderItem,
    overscan = 2,
    direction = "vertical",
    measure = false,
    estimatedItemHeight,
    stickyHeader,
    stickyFooter,
    onScrollOffsetChange,
    onRangeChange,
    width = "100%",
    role = "list",
    className,
    style,
    ...rest
  } = props;

  const horizontal = direction === "horizontal";
  const sizeFn = useMemo(() => asSizeFn(itemHeight), [itemHeight]);
  const isVariable = measure || typeof itemHeight === "function";
  const estimate =
    estimatedItemHeight ??
    (typeof itemHeight === "number" ? itemHeight : 40);

  const [scrollOffset, setScrollOffset] = useState(0);
  // Bumped to force a re-render after measurements mutate the size cache.
  const [measureVersion, setMeasureVersion] = useState(0);
  const rafRef = useRef<number | null>(null);
  const pendingOffset = useRef(0);
  const scrollElRef = useRef<HTMLDivElement | null>(null);

  // Size cache for variable mode, seeded from the size function / estimate.
  const cacheRef = useRef<SizeCache | null>(null);
  if (isVariable) {
    if (cacheRef.current == null || cacheRef.current.length !== itemCount) {
      const next = new SizeCache(itemCount, estimate);
      // Seed from the size function (cheap; measurements override later).
      for (let i = 0; i < itemCount; i++) next.setSize(i, sizeFn(i));
      cacheRef.current = next;
    }
  } else {
    cacheRef.current = null;
  }

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      pendingOffset.current = horizontal ? el.scrollLeft : el.scrollTop;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setScrollOffset(pendingOffset.current);
      });
    },
    [horizontal],
  );

  const fixedSize = typeof itemHeight === "number" ? itemHeight : estimate;

  // Range computation: variable uses the prefix-sum cache, fixed uses math.
  // measureVersion is read so the memo recomputes after a measurement.
  const range = useMemo<VirtualRange>(() => {
    void measureVersion;
    if (isVariable && cacheRef.current) {
      return computeVariableRange(scrollOffset, height, cacheRef.current, overscan);
    }
    return computeRange(scrollOffset, fixedSize, height, itemCount, overscan);
  }, [isVariable, scrollOffset, height, overscan, fixedSize, itemCount, measureVersion]);

  // Notify range/offset subscribers without causing extra renders.
  const lastRangeRef = useRef<string>("");
  useLayoutEffect(() => {
    if (onRangeChange) {
      const key = `${range.start}:${range.end}:${range.offsetY}:${range.totalHeight}`;
      if (key !== lastRangeRef.current) {
        lastRangeRef.current = key;
        onRangeChange(range);
      }
    }
  }, [range, onRangeChange]);

  useLayoutEffect(() => {
    onScrollOffsetChange?.(scrollOffset);
  }, [scrollOffset, onScrollOffsetChange]);

  const scrollTo = useCallback(
    (offset: number) => {
      const el = scrollElRef.current;
      if (el) {
        if (horizontal) el.scrollLeft = offset;
        else el.scrollTop = offset;
      }
      // Update state directly too, so headless/jsdom callers see the change.
      pendingOffset.current = offset;
      setScrollOffset(offset);
    },
    [horizontal],
  );

  useImperativeHandle(
    ref,
    (): VirtualListHandle => ({
      scrollToIndex: (index, align = "auto") => {
        let target: number;
        if (isVariable && cacheRef.current) {
          target = scrollOffsetForVariableIndex(
            index,
            height,
            cacheRef.current,
            pendingOffset.current,
            align,
          );
        } else {
          target = scrollOffsetForIndex(
            index,
            fixedSize,
            height,
            itemCount,
            pendingOffset.current,
            align,
          );
        }
        scrollTo(target);
      },
      scrollToOffset: scrollTo,
      getScrollOffset: () => pendingOffset.current,
      getScrollElement: () => scrollElRef.current,
    }),
    [isVariable, height, fixedSize, itemCount, scrollTo],
  );

  // Refs to rendered rows for measurement.
  const rowEls = useRef(new Map<number, HTMLElement>());
  const setRowEl = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) rowEls.current.set(index, el);
      else rowEls.current.delete(index);
    },
    [],
  );

  // After paint, measure rendered rows and patch the cache when sizes differ.
  useLayoutEffect(() => {
    if (!measure || !cacheRef.current) return;
    const cache = cacheRef.current;
    let changed = false;
    for (const [index, el] of rowEls.current) {
      const measured = horizontal ? el.offsetWidth : el.offsetHeight;
      if (measured > 0 && cache.setSize(index, measured)) changed = true;
    }
    if (changed) setMeasureVersion((v) => v + 1);
  });

  const count = rangeLength(range);
  const cache = cacheRef.current;

  const rows: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const index = range.start + i;
    const size = isVariable && cache ? cache.size(index) : fixedSize;
    const lead =
      isVariable && cache ? cache.offset(index) - range.offsetY : i * fixedSize;

    const base: CSSProperties = {
      position: "absolute",
      ...(horizontal
        ? { top: 0, bottom: 0, left: 0, width: size, transform: `translateX(${lead}px)` }
        : { top: 0, left: 0, right: 0, height: size, transform: `translateY(${lead}px)` }),
    };

    const rowStyle: CSSProperties = measure
      ? // In measure mode let content drive the size; just position it.
        {
          position: "absolute",
          ...(horizontal
            ? { top: 0, bottom: 0, left: 0, transform: `translateX(${lead}px)` }
            : { top: 0, left: 0, right: 0, transform: `translateY(${lead}px)` }),
        }
      : base;

    rows.push(
      <div
        key={index}
        ref={setRowEl(index)}
        role="listitem"
        aria-posinset={index + 1}
        aria-setsize={itemCount}
        style={{ display: "contents" }}
      >
        {renderItem(index, rowStyle)}
      </div>,
    );
  }

  const outerStyle: CSSProperties = {
    position: "relative",
    [horizontal ? "overflowX" : "overflowY"]: "auto",
    height,
    width,
    ...style,
  };

  const spacerStyle: CSSProperties = horizontal
    ? { width: range.totalHeight, height: "100%", position: "relative" }
    : { height: range.totalHeight, width: "100%", position: "relative" };

  return (
    <div
      role={role}
      aria-label={rest["aria-label"]}
      aria-rowcount={!horizontal ? itemCount : undefined}
      aria-colcount={horizontal ? itemCount : undefined}
    >
      {stickyHeader != null && (
        <div style={{ position: "sticky", top: 0, zIndex: 1 }} data-sticky="header">
          {stickyHeader}
        </div>
      )}
      <div
        ref={scrollElRef}
        className={className}
        style={outerStyle}
        onScroll={handleScroll}
        data-testid={rest["data-testid"]}
      >
        <div style={spacerStyle}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              ...(horizontal
                ? { transform: `translateX(${range.offsetY}px)`, height: "100%" }
                : { transform: `translateY(${range.offsetY}px)`, right: 0 }),
            }}
          >
            {rows}
          </div>
        </div>
      </div>
      {stickyFooter != null && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 1 }} data-sticky="footer">
          {stickyFooter}
        </div>
      )}
    </div>
  );
}

/**
 * VirtualList component with imperative ref support. See {@link VirtualListProps}.
 */
export const VirtualList = forwardRef<VirtualListHandle, VirtualListProps>(
  VirtualListInner,
);
VirtualList.displayName = "VirtualList";
