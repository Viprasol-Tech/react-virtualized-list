import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
} from "react";
import { computeRange, rangeLength } from "./windowing.js";

export interface VirtualListProps {
  /** Total number of items in the list. */
  itemCount: number;
  /** Fixed height of each row, in pixels. */
  itemHeight: number;
  /** Height of the scrollable viewport, in pixels. */
  height: number;
  /**
   * Render a single row. Receives the absolute item index and a style object
   * that MUST be spread onto the row's root element for correct positioning.
   */
  renderItem: (index: number, style: CSSProperties) => ReactNode;
  /** Extra rows to render above and below the visible window. Default 2. */
  overscan?: number;
  /** Optional width of the viewport. Default "100%". */
  width?: number | string;
  /** Optional className for the outer scroll container. */
  className?: string;
  /** Optional inline style merged onto the outer scroll container. */
  style?: CSSProperties;
  /** Optional data-testid forwarded to the outer scroll container. */
  "data-testid"?: string;
}

/**
 * VirtualList renders only the rows that fall within the viewport (plus an
 * overscan buffer), keeping the DOM small even for very large datasets.
 *
 * Positioning strategy: an outer scroll container holds a single spacer div
 * sized to the full list height (itemCount * itemHeight). The rendered window
 * of rows is wrapped in an absolutely-positioned layer translated to the
 * correct offsetY, so the browser's native scrollbar reflects the full list.
 */
export function VirtualList({
  itemCount,
  itemHeight,
  height,
  renderItem,
  overscan = 2,
  width = "100%",
  className,
  style,
  ...rest
}: VirtualListProps): ReactNode {
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);
  const pendingTop = useRef(0);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    pendingTop.current = e.currentTarget.scrollTop;
    // Coalesce rapid scroll events into one state update per animation frame.
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(pendingTop.current);
    });
  }, []);

  const range = computeRange(scrollTop, itemHeight, height, itemCount, overscan);
  const count = rangeLength(range);

  const rows: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const index = range.start + i;
    const rowStyle: CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: itemHeight,
      transform: `translateY(${i * itemHeight}px)`,
    };
    rows.push(renderItem(index, rowStyle));
  }

  const outerStyle: CSSProperties = {
    position: "relative",
    overflowY: "auto",
    height,
    width,
    ...style,
  };

  return (
    <div
      className={className}
      style={outerStyle}
      onScroll={handleScroll}
      data-testid={rest["data-testid"]}
    >
      {/* Spacer establishes the full scrollable height. */}
      <div style={{ height: range.totalHeight, position: "relative" }}>
        {/* Rendered window translated to the first visible row. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${range.offsetY}px)`,
          }}
        >
          {rows}
        </div>
      </div>
    </div>
  );
}
