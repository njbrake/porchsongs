import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-white hover:bg-primary-hover',
        secondary:
          'bg-primary-light text-primary hover:bg-[#e8cbb8]',
        danger:
          'bg-danger-light text-danger hover:bg-[#ecc]',
        'danger-outline':
          'bg-transparent text-danger border border-danger hover:bg-danger-light disabled:opacity-40',
        ghost:
          'bg-transparent hover:bg-panel',
        link:
          'bg-transparent text-muted-foreground hover:text-primary p-0 h-auto font-normal',
        'link-inline':
          'bg-transparent text-primary underline p-0 h-auto font-semibold inline',
        icon:
          'bg-transparent border-0 text-header-text opacity-80 hover:opacity-100 p-1.5 text-xl',
      },
      size: {
        default: 'px-5 py-2.5',
        sm: 'px-3 py-1.5 text-xs',
        lg: 'px-6 py-3 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
