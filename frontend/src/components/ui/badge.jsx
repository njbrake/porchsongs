import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-block text-[0.7rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
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

function Badge({ className, variant, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
