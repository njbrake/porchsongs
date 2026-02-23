import { useRef, useEffect, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A `<pre>` that auto-scrolls to the bottom as content grows,
 * but only while the user is already scrolled near the bottom.
 */
export default function StreamingPre({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) {
  const ref = useRef<HTMLPreElement>(null);
  const wasAtBottom = useRef(true);

  // Before React updates the DOM, snapshot whether we're at the bottom
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const threshold = 30; // px tolerance
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  });

  // After content changes, scroll to bottom if we were there
  useEffect(() => {
    const el = ref.current;
    if (el && wasAtBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [children]);

  return (
    <pre ref={ref} className={cn('whitespace-pre-wrap break-words', className)} {...props}>
      {children}
    </pre>
  );
}
