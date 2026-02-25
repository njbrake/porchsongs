import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SavedModel } from '@/types';

interface ModelRowProps {
  model: SavedModel;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
}

export default function ModelRow({ model, isActive, onActivate, onRemove }: ModelRowProps) {
  return (
    <div className={cn(
      'flex items-center border rounded-md overflow-hidden transition-colors',
      isActive ? 'border-primary bg-selected-bg' : 'border-border hover:bg-panel'
    )}>
      <button
        className="flex-1 flex items-center justify-between bg-transparent border-0 px-3 py-2 cursor-pointer text-left text-sm text-foreground transition-colors"
        onClick={onActivate}
      >
        <span className="text-muted-foreground">{model.model}</span>
        {isActive && <Badge variant="active">Active</Badge>}
      </button>
      <button
        className="bg-transparent border-0 border-l border-border px-2.5 py-2 text-lg text-muted-foreground cursor-pointer leading-none hover:text-danger hover:bg-error-bg transition-colors"
        onClick={onRemove}
        aria-label={`Remove ${model.model}`}
      >
        &times;
      </button>
    </div>
  );
}
