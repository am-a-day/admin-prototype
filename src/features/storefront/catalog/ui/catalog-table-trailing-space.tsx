import { useEffect, useRef, useState, type RefObject } from "react";

const TRAILING_SPACE_RATIO = 0.38;
const TRAILING_SPACE_MIN_HEIGHT = 160;
const TRAILING_SPACE_MAX_HEIGHT = 320;

function clampTrailingSpaceHeight(viewportHeight: number) {
  return Math.min(
    TRAILING_SPACE_MAX_HEIGHT,
    Math.max(TRAILING_SPACE_MIN_HEIGHT, Math.round(viewportHeight * TRAILING_SPACE_RATIO)),
  );
}

export function CatalogTableTrailingSpace({
  scrollParentRef,
}: {
  scrollParentRef: RefObject<HTMLDivElement | null>;
}) {
  const spaceRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(TRAILING_SPACE_MIN_HEIGHT);

  useEffect(() => {
    const scrollParent = scrollParentRef.current;
    const space = spaceRef.current;
    if (!scrollParent || !space) return;

    const update = () => {
      const scrollRect = scrollParent.getBoundingClientRect();
      const spaceRect = space.getBoundingClientRect();
      const spaceStart = spaceRect.top - scrollRect.top + scrollParent.scrollTop;
      const adaptiveHeight = clampTrailingSpaceHeight(scrollParent.clientHeight);
      const remainingViewportHeight = Math.max(0, scrollParent.clientHeight - spaceStart);
      const nextHeight = Math.ceil(Math.max(adaptiveHeight, remainingViewportHeight));
      setHeight((current) => current === nextHeight ? current : nextHeight);
    };

    update();
    const layoutTimeout = window.setTimeout(update, 0);
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(scrollParent);
    if (space.parentElement) observer?.observe(space.parentElement);

    return () => {
      window.clearTimeout(layoutTimeout);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [scrollParentRef]);

  return (
    <div
      ref={spaceRef}
      data-catalog-table-trailing-space
      aria-hidden="true"
      style={{ height }}
      className="pointer-events-none w-full min-w-full shrink-0 bg-[#f5f5f4]"
    />
  );
}
