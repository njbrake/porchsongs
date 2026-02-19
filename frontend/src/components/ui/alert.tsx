import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'rounded-md px-4 py-3 text-sm flex gap-2',
  {
    variants: {
      variant: {
        warning:
          'bg-warning-bg border border-warning-border text-warning-text flex-col',
        error:
          'bg-error-bg border border-error-border text-error-text justify-between items-center',
      },
    },
    defaultVariants: {
      variant: 'warning',
    },
  }
);

interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
export type { AlertProps };
