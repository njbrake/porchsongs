import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface ResizableColumnsProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial left column percentage (0-100). Default 50. */
  defaultLeftPercent?: number;
  /** Minimum left column percentage. Default 25. */
  minLeftPercent?: number;
  /** Maximum left column percentage. Default 75. */
  maxLeftPercent?: number;
  /** CSS class for the outer container */
  className?: string;
  /** CSS class applied to each column wrapper */
  columnClassName?: string;
  /** Which pane to show on mobile ('left' | 'right') */
  mobilePane?: 'left' | 'right';
}

const STORAGE_KEY = 'porchsongs_split_pct';

export default function ResizableColumns({
  left,
  right,
  defaultLeftPercent = 50,
  minLeftPercent = 25,
  maxLeftPercent = 75,
  className = '',
  columnClassName = '',
  mobilePane = 'left',
}: ResizableColumnsProps) {
  const [leftPercent, setLeftPercent] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const val = parseFloat(stored);
      if (Number.isFinite(val) && val >= minLeftPercent && val <= maxLeftPercent) return val;
    }
    return defaultLeftPercent;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(maxLeftPercent, Math.max(minLeftPercent, (x / rect.width) * 100));
    setLeftPercent(pct);
  }, [minLeftPercent, maxLeftPercent]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(leftPercent));
  }, [leftPercent]);

  // Double-click to reset
  const onDoubleClick = useCallback(() => {
    setLeftPercent(defaultLeftPercent);
  }, [defaultLeftPercent]);

  return (
    <div ref={containerRef} className={`flex ${className}`}>
      {/* Left column */}
      <div
        className={`${columnClassName} ${mobilePane === 'left' ? 'flex' : 'hidden'} md:flex`}
        style={{ width: `calc(${leftPercent}% - 4px)` }}
      >
        {left}
      </div>

      {/* Drag handle — hidden on mobile */}
      <div
        className="hidden md:flex items-center justify-center w-2 cursor-col-resize select-none shrink-0 group"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns"
      >
        <div className="w-px h-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
      </div>

      {/* Right column */}
      <div
        className={`${columnClassName} ${mobilePane === 'right' ? 'flex' : 'hidden'} md:flex`}
        style={{ width: `calc(${100 - leftPercent}% - 4px)` }}
      >
        {right}
      </div>
    </div>
  );
}
