import { useRef, useEffect, useCallback, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A `<pre>` that auto-scrolls to the bottom as content grows,
 * but only while the user is already scrolled near the bottom.
 */
export default function StreamingPre({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const isAtBottom = useRef(true);

  // Track scroll position via scroll events so we know whether
  // the user has manually scrolled away from the bottom.
  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const threshold = 30;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // When content changes, scroll to bottom if the user was there
  useEffect(() => {
    const el = ref.current;
    if (el && isAtBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [children]);

  return (
    <pre ref={ref} onScroll={handleScroll} className={cn('whitespace-pre-wrap break-words', className)} {...props}>
      {children}
    </pre>
  );
}
