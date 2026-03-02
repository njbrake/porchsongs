import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/api';
import { cn } from '@/lib/utils';

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

const STORAGE_KEY = STORAGE_KEYS.SPLIT_PERCENT;
const MD_BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= MD_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

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

  const isDesktop = useIsDesktop();
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

  // On mobile: full width, no inline style. On desktop: split widths.
  const leftStyle = isDesktop ? { width: `calc(${leftPercent}% - 6px)` } : undefined;
  const rightStyle = isDesktop ? { width: `calc(${100 - leftPercent}% - 6px)` } : undefined;

  return (
    <div ref={containerRef} className={cn('flex overflow-hidden', className)}>
      {/* Left column */}
      <div
        className={cn('w-full min-w-0 md:flex md:grow-0', columnClassName, mobilePane === 'left' ? 'flex' : 'hidden')}
        style={leftStyle}
      >
        {left}
      </div>

      {/* Drag handle (hidden on mobile) */}
      <div
        className="hidden md:flex justify-center w-3 cursor-col-resize select-none shrink-0 group touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize columns"
      >
        <div className="w-px bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
      </div>

      {/* Right column */}
      <div
        className={cn('w-full min-w-0 md:flex md:grow-0', columnClassName, mobilePane === 'right' ? 'flex' : 'hidden')}
        style={rightStyle}
      >
        {right}
      </div>
    </div>
  );
}
