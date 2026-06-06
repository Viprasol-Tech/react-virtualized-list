import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CSSProperties } from "react";
import { VirtualList } from "../VirtualList.js";

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
});
