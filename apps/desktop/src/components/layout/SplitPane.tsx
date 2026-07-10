import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface SplitPaneProps {
  direction: "horizontal" | "vertical";
  ratio: number;
  onRatioChange?: (ratio: number) => void;
  minRatio?: number;
  maxRatio?: number;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}

/** Two-pane resizable splitter (mouse-driven, no dependencies). */
export function SplitPane({
  direction,
  ratio,
  onRatioChange,
  minRatio = 0.15,
  maxRatio = 0.85,
  first,
  second,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localRatio, setLocalRatio] = useState(ratio);

  useEffect(() => setLocalRatio(ratio), [ratio]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const raw =
        direction === "horizontal"
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height;
      const next = Math.min(maxRatio, Math.max(minRatio, raw));
      setLocalRatio(next);
    };
    const onUp = () => {
      setDragging(false);
      setLocalRatio((r) => {
        onRatioChange?.(r);
        return r;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, direction, minRatio, maxRatio, onRatioChange]);

  const isH = direction === "horizontal";
  return (
    <div
      ref={containerRef}
      className={`split-pane ${isH ? "split-h" : "split-v"} ${className ?? ""}`}
      style={{
        display: "flex",
        flexDirection: isH ? "row" : "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div style={{ flex: `${localRatio} 1 0`, minHeight: 0, minWidth: 0, display: "flex" }}>
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isH ? "vertical" : "horizontal"}
        className={`split-handle ${dragging ? "dragging" : ""}`}
        onMouseDown={onMouseDown}
        style={{ cursor: isH ? "col-resize" : "row-resize" }}
      />
      <div style={{ flex: `${1 - localRatio} 1 0`, minHeight: 0, minWidth: 0, display: "flex" }}>
        {second}
      </div>
    </div>
  );
}
