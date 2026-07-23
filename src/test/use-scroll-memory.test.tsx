import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getScrollMemoryStorageKey,
  useScrollMemory,
} from "@/hooks/use-scroll-memory";

function ScrollMemoryHarness({ memoryKey }: { memoryKey: string }) {
  const scrollRef = useScrollMemory<HTMLDivElement>(memoryKey);
  return <div ref={scrollRef} data-testid="scroll-region" />;
}

describe("useScrollMemory", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("restores the last position when a scroll region mounts again", () => {
    const firstView = render(<ScrollMemoryHarness memoryKey="page:/tasks" />);
    const firstRegion = screen.getByTestId("scroll-region");

    firstRegion.scrollTop = 420;
    fireEvent.scroll(firstRegion);
    expect(
      window.sessionStorage.getItem(
        getScrollMemoryStorageKey("page:/tasks"),
      ),
    ).toBe("420");

    firstView.unmount();
    render(<ScrollMemoryHarness memoryKey="page:/tasks" />);

    expect(screen.getByTestId("scroll-region").scrollTop).toBe(420);
  });

  it("keeps positions isolated by page context", () => {
    window.sessionStorage.setItem(
      getScrollMemoryStorageKey("page:/tasks"),
      "180",
    );
    window.sessionStorage.setItem(
      getScrollMemoryStorageKey("page:/analytics"),
      "360",
    );

    const view = render(<ScrollMemoryHarness memoryKey="page:/tasks" />);
    expect(screen.getByTestId("scroll-region").scrollTop).toBe(180);

    view.rerender(<ScrollMemoryHarness memoryKey="page:/analytics" />);
    expect(screen.getByTestId("scroll-region").scrollTop).toBe(360);
  });
});
