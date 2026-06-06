import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CSSProperties } from "react";
import { VirtualList, type VirtualListHandle } from "../VirtualList.js";

// Make requestAnimationFrame run synchronously so scroll-driven state
// updates are flushed deterministically inside act().
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Row(index: number, style: CSSProperties) {
  return (
    <div key={index} style={style} data-testid={`row-${index}`}>
      Item {index}
    </div>
  );
}

describe("<VirtualList />", () => {
  it("renders only the visible window of rows, not all items", () => {
    // 10000 items, 20px rows, 100px viewport, overscan 2.
    // Visible at top: rows 0..5, plus 2 overscan below -> 0..7 (8 rows).
    render(
      <VirtualList
        itemCount={10000}
        itemHeight={20}
        height={100}
        overscan={2}
        renderItem={Row}
        data-testid="list"
      />,
    );

    // First few rows are present.
    expect(screen.getByTestId("row-0")).toBeInTheDocument();
    expect(screen.getByTestId("row-7")).toBeInTheDocument();

    // A far-away row is NOT in the DOM (proves virtualization).
    expect(screen.queryByTestId("row-5000")).not.toBeInTheDocument();
    expect(screen.queryByTestId("row-9999")).not.toBeInTheDocument();

    // DOM holds only the small window, not 10000 nodes.
    const rendered = screen.getAllByText(/^Item \d+$/);
    expect(rendered.length).toBeLessThan(20);
  });

  it("changes which rows render when the container is scrolled", () => {
    render(
      <VirtualList
        itemCount={10000}
        itemHeight={20}
        height={100}
        overscan={2}
        renderItem={Row}
        data-testid="list"
      />,
    );

    expect(screen.getByTestId("row-0")).toBeInTheDocument();
    expect(screen.queryByTestId("row-100")).not.toBeInTheDocument();

    const list = screen.getByTestId("list");

    // jsdom doesn't lay out elements, so scrollTop must be assigned manually.
    act(() => {
      Object.defineProperty(list, "scrollTop", { value: 2000, configurable: true });
      fireEvent.scroll(list);
    });

    // scrollTop 2000 / 20 = row 100 first visible. Rows around 100 now render;
    // the original top rows have been unmounted.
    expect(screen.getByTestId("row-100")).toBeInTheDocument();
    expect(screen.queryByTestId("row-0")).not.toBeInTheDocument();
  });

  it("renders the full set when the list is shorter than the viewport", () => {
    render(
      <VirtualList
        itemCount={3}
        itemHeight={30}
        height={400}
        renderItem={Row}
        data-testid="list"
      />,
    );

    expect(screen.getByTestId("row-0")).toBeInTheDocument();
    expect(screen.getByTestId("row-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-2")).toBeInTheDocument();
    expect(screen.getAllByText(/^Item \d+$/).length).toBe(3);
  });

  it("exposes role=list and aria-rowcount for accessibility", () => {
    render(
      <VirtualList
        itemCount={500}
        itemHeight={20}
        height={100}
        renderItem={Row}
        aria-label="Numbers"
      />,
    );
    const list = screen.getByRole("list", { name: "Numbers" });
    expect(list).toHaveAttribute("aria-rowcount", "500");
    // First row carries posinset / setsize metadata.
    const item = screen.getByTestId("row-0").parentElement;
    expect(item).toHaveAttribute("role", "listitem");
    expect(item).toHaveAttribute("aria-posinset", "1");
    expect(item).toHaveAttribute("aria-setsize", "500");
  });

  it("scrollToIndex via ref reveals a distant row", () => {
    const ref = createRef<VirtualListHandle>();
    render(
      <VirtualList
        ref={ref}
        itemCount={10000}
        itemHeight={20}
        height={100}
        overscan={0}
        renderItem={Row}
        data-testid="list"
      />,
    );

    expect(screen.queryByTestId("row-300")).not.toBeInTheDocument();

    act(() => {
      ref.current!.scrollToIndex(300, "start");
    });

    expect(screen.getByTestId("row-300")).toBeInTheDocument();
    // start align -> offset = 300 * 20 = 6000.
    expect(ref.current!.getScrollOffset()).toBe(6000);
  });

  it("scrollToOffset updates the rendered window and reported offset", () => {
    const ref = createRef<VirtualListHandle>();
    render(
      <VirtualList
        ref={ref}
        itemCount={10000}
        itemHeight={20}
        height={100}
        overscan={0}
        renderItem={Row}
      />,
    );

    act(() => {
      ref.current!.scrollToOffset(1000);
    });

    expect(ref.current!.getScrollOffset()).toBe(1000);
    expect(screen.getByTestId("row-50")).toBeInTheDocument();
  });

  it("renders a sticky header and footer when provided", () => {
    render(
      <VirtualList
        itemCount={100}
        itemHeight={20}
        height={100}
        renderItem={Row}
        stickyHeader={<div data-testid="hdr">Header</div>}
        stickyFooter={<div data-testid="ftr">Footer</div>}
      />,
    );
    expect(screen.getByTestId("hdr")).toBeInTheDocument();
    expect(screen.getByTestId("ftr")).toBeInTheDocument();
  });

  it("supports horizontal mode (scrollLeft drives the window)", () => {
    render(
      <VirtualList
        direction="horizontal"
        itemCount={10000}
        itemHeight={50}
        height={400}
        overscan={0}
        renderItem={Row}
        data-testid="list"
      />,
    );

    expect(screen.getByTestId("row-0")).toBeInTheDocument();
    const list = screen.getByTestId("list");

    act(() => {
      Object.defineProperty(list, "scrollLeft", { value: 5000, configurable: true });
      fireEvent.scroll(list);
    });

    // 5000 / 50 = column 100 first visible.
    expect(screen.getByTestId("row-100")).toBeInTheDocument();
    expect(screen.queryByTestId("row-0")).not.toBeInTheDocument();
  });

  it("calls onRangeChange with the visible window", () => {
    const onRangeChange = vi.fn();
    render(
      <VirtualList
        itemCount={1000}
        itemHeight={20}
        height={100}
        overscan={0}
        renderItem={Row}
        onRangeChange={onRangeChange}
      />,
    );
    expect(onRangeChange).toHaveBeenCalled();
    const last = onRangeChange.mock.calls.at(-1)![0];
    expect(last.start).toBe(0);
    expect(last.totalHeight).toBe(20000);
  });

  it("accepts a function for variable item heights", () => {
    render(
      <VirtualList
        itemCount={1000}
        itemHeight={(i) => (i % 2 === 0 ? 40 : 20)}
        height={120}
        overscan={0}
        renderItem={Row}
        data-testid="list"
      />,
    );
    // Mixed sizes still render the top window without throwing.
    expect(screen.getByTestId("row-0")).toBeInTheDocument();
    expect(screen.queryByTestId("row-500")).not.toBeInTheDocument();
  });
});
