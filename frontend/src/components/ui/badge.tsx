import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-block text-badge font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
  {
    variants: {
      variant: {
        draft: 'bg-warning-bg text-warning-text',
        completed: 'bg-success-bg text-success-text',
        active: 'bg-primary-light text-primary',
        default: 'bg-panel text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export type { BadgeProps };
