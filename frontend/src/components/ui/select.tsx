import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-2 text-sm text-foreground font-ui transition-colors focus:outline-none focus:border-primary disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Select.displayName = 'Select';

export { Select };
