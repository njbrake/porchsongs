import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface PromptField {
  key: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: PromptField[];
  confirmLabel?: string;
  onConfirm: (values: Record<string, string>) => void;
}

export default function PromptDialog({
  open,
  onOpenChange,
  title,
  fields,
  confirmLabel = 'OK',
  onConfirm,
}: PromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const f of fields) {
        initial[f.key] = f.defaultValue ?? '';
      }
      setValues(initial);
    }
  }, [open, fields]);

  const handleSubmit = () => {
    onConfirm(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`prompt-${f.key}`}>{f.label}</Label>
                <Input
                  id={`prompt-${f.key}`}
                  value={values[f.key] ?? ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  autoFocus={f === fields[0]}
                />
              </div>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
