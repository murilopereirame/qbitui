"use client";

import { useState, useRef, useCallback } from "react";

export function useColumnResize(initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthsRef.current[colIndex];

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      const next = Math.max(40, startWidth + delta);
      setWidths((prev) => {
        const updated = [...prev];
        updated[colIndex] = next;
        return updated;
      });
    }

    function onEnd() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
  }, []);

  return { widths, startResize };
}
