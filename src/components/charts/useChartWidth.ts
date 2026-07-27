"use client";

import { useEffect, useRef, useState } from "react";

/** Tracks a container's width so charts can redraw on layout and viewport changes. */
export function useChartWidth<T extends HTMLElement = HTMLDivElement>(
  fallback = 640
) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });

    observer.observe(element);
    setWidth(element.clientWidth || fallback);

    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
