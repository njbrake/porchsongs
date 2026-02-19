import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Checkbox = forwardRef(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      'size-4.5 cursor-pointer accent-primary',
      className
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
