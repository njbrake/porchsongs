import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Card = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-card border border-border rounded-md shadow-sm',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-4 py-2.5 bg-panel text-xs text-muted-foreground uppercase tracking-wide font-semibold',
      className
    )}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('p-4', className)}
    {...props}
  />
));
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardContent };
