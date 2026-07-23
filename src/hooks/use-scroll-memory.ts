import { useLayoutEffect, useRef, type RefObject } from "react";

const SCROLL_MEMORY_STORAGE_PREFIX = "time-butler:scroll-memory:v1:";

export function getScrollMemoryStorageKey(memoryKey: string): string {
  return `${SCROLL_MEMORY_STORAGE_PREFIX}${memoryKey}`;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readScrollTop(memoryKey: string): number | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const storedValue = storage.getItem(getScrollMemoryStorageKey(memoryKey));
    if (storedValue === null) return null;

    const scrollTop = Number(storedValue);
    if (Number.isFinite(scrollTop) && scrollTop >= 0) return scrollTop;

    storage.removeItem(getScrollMemoryStorageKey(memoryKey));
  } catch {
    return null;
  }

  return null;
}

function writeScrollTop(memoryKey: string, scrollTop: number): void {
  const storage = getSessionStorage();
  if (!storage || !Number.isFinite(scrollTop)) return;

  try {
    storage.setItem(
      getScrollMemoryStorageKey(memoryKey),
      String(Math.max(0, scrollTop)),
    );
  } catch {
    // Scroll memory is a progressive enhancement; storage failures should not
    // interrupt navigation or scrolling.
  }
}

export function useScrollMemory<T extends HTMLElement>(
  memoryKey: string,
): RefObject<T | null> {
  const elementRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let pendingScrollTop = readScrollTop(memoryKey);
    let restoring = false;
    let lastProgrammaticScrollTop: number | null = null;
    let restoreFrame: number | null = null;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const stopWaitingForContent = () => {
      mutationObserver?.disconnect();
      mutationObserver = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
    };

    const finishProgrammaticScroll = () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
      restoreFrame = window.requestAnimationFrame(() => {
        restoring = false;
        restoreFrame = null;
      });
    };

    const attemptRestore = () => {
      if (pendingScrollTop === null) return;

      restoring = true;
      element.scrollTop = pendingScrollTop;
      lastProgrammaticScrollTop = element.scrollTop;

      if (Math.abs(element.scrollTop - pendingScrollTop) <= 1) {
        pendingScrollTop = null;
        stopWaitingForContent();
      }

      finishProgrammaticScroll();
    };

    const observeContent = () => {
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(attemptRestore);
        resizeObserver.observe(element);
        for (const child of element.children) {
          if (child instanceof HTMLElement) resizeObserver.observe(child);
        }
      }

      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver((mutations) => {
          if (resizeObserver) {
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) {
                if (node instanceof HTMLElement) resizeObserver.observe(node);
              }
            }
          }
          attemptRestore();
        });
        mutationObserver.observe(element, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    };

    const handleScroll = () => {
      const isProgrammaticScroll =
        lastProgrammaticScrollTop !== null
        && Math.abs(element.scrollTop - lastProgrammaticScrollTop) <= 1;

      if (restoring || isProgrammaticScroll) {
        lastProgrammaticScrollTop = null;
        return;
      }

      pendingScrollTop = null;
      lastProgrammaticScrollTop = null;
      stopWaitingForContent();
      writeScrollTop(memoryKey, element.scrollTop);
    };

    element.addEventListener("scroll", handleScroll, { passive: true });

    if (pendingScrollTop !== null) {
      attemptRestore();
      if (pendingScrollTop !== null) observeContent();
    }

    return () => {
      element.removeEventListener("scroll", handleScroll);
      stopWaitingForContent();
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame);
      writeScrollTop(memoryKey, element.scrollTop);
    };
  }, [memoryKey]);

  return elementRef;
}
