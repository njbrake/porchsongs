import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'border-3 border-border border-t-primary rounded-full animate-spin',
        size === 'sm' ? 'size-6' : 'size-8',
        className
      )}
      aria-hidden="true"
    />
  );
}
