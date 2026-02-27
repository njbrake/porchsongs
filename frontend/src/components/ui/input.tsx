import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-2 text-sm text-foreground font-ui transition-colors placeholder:text-muted-foreground focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
