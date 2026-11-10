"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The width of the element `ref` is attached to. `measured` is false until
 * the first measure, so a chart can stay hidden instead of flashing at the
 * fallback width.
 */
export function useChartWidth(fallback = 640, min = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(min, entry.contentRect.width));
      setMeasured(true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [min]);

  return { ref, width, measured };
}
