# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **Variable row heights** — pass `itemHeight` as a function `(index) => px`,
  or enable `measure` to grow a prefix-sum size cache from real DOM
  measurements. Backed by the new exported `SizeCache` class and
  `computeVariableRange()` helper (O(log n) pixel-to-index via binary search).
- **Horizontal mode** — `direction="horizontal"` windows along the X axis
  (sizes and offsets map to width / `scrollLeft`).
- **Sticky headers & footers** — `stickyHeader` and `stickyFooter` render
  pinned above / below the scrolled content.
- **Imperative API via `ref`** (`VirtualListHandle`): `scrollToIndex(index, align)`,
  `scrollToOffset(offset)`, `getScrollOffset()`, `getScrollElement()`.
  Alignment supports `"start" | "center" | "end" | "auto"`.
- **Scroll-to-index math** — `scrollOffsetForIndex()` and
  `scrollOffsetForVariableIndex()` pure helpers.
- **2D grid windowing** — `computeGridRange()` plus `GridRange` / `GridRangeInput`
  types for virtualizing rows and columns independently.
- **Callbacks** — `onScrollOffsetChange` and `onRangeChange` for observing the
  list as it scrolls.
- **Accessibility** — `role="list"`, `aria-label`, `aria-rowcount` /
  `aria-colcount`, and per-row `aria-posinset` / `aria-setsize`.
- `itemOffset()` helper for fixed-size leading-edge math.

### Changed
- `VirtualList` is now wrapped in `forwardRef` to expose the imperative handle.
- Roughly doubled the test suite (windowing math + component render/interaction).

## [0.1.0] - 2025

### Added
- Initial release of react-virtualized-list: Virtualized (windowed) list rendering only visible rows for React.
