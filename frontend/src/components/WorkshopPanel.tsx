import { useState } from 'react';
import api from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LlmSettings, WorkshopResult } from '@/types';

interface WorkshopPanelProps {
  songId: number;
  lineIndex: number;
  originalLyrics: string;
  rewrittenLyrics: string;
  llmSettings: LlmSettings;
  onApply: (lyrics: string) => void;
  onClose: () => void;
}

export default function WorkshopPanel({ songId, lineIndex, originalLyrics, rewrittenLyrics, llmSettings, onApply, onClose }: WorkshopPanelProps) {
  const [instruction, setInstruction] = useState('');
  const [alternatives, setAlternatives] = useState<{ text: string; reasoning: string }[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkshopResult | null>(null);

  const handleGetAlternatives = async () => {
    setLoading(true);
    setAlternatives(null);
    setSelected(null);

    try {
      const res = await api.workshopLine({
        song_id: songId,
        line_index: lineIndex,
        instruction: instruction.trim() || null,
        ...llmSettings,
      });
      setResult(res);
      setAlternatives(res.alternatives);
    } catch (err) {
      setAlternatives([{ text: 'Error: ' + (err as Error).message, reasoning: '' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (selected === null || !alternatives) return;

    const newText = alternatives[selected]!.text;
    try {
      const res = await api.applyEdit({
        song_id: songId,
        line_index: lineIndex,
        new_line_text: newText,
      });
      onApply(res.rewritten_lyrics);
    } catch (err) {
      alert('Failed to apply edit: ' + (err as Error).message);
    }
  };

  const origLines = originalLyrics.split('\n');
  const rewriteLines = rewrittenLyrics.split('\n');
  const originalLine = origLines[lineIndex] || '';
  const currentLine = rewriteLines[lineIndex] || '';

  return (
    <Card className="mt-4 border-2 border-primary overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2.5 bg-primary-light border-b border-border">
        <h3 className="text-sm text-primary uppercase tracking-wide font-semibold m-0">Line Workshop</h3>
        <button
          className="bg-transparent border-0 text-xl cursor-pointer text-muted-foreground leading-none hover:text-foreground"
          onClick={onClose}
        >
          &times;
        </button>
      </div>
      <CardContent>
        <div className="mb-4">
          <div className="text-xs text-muted-foreground font-semibold mb-0.5">Original line:</div>
          <div className="font-[family-name:var(--font-mono)] text-sm p-2 bg-panel rounded">{result?.original_line || originalLine}</div>
          <div className="text-xs text-muted-foreground font-semibold mb-0.5 mt-2">Current line:</div>
          <div className="font-[family-name:var(--font-mono)] text-sm p-2 bg-panel rounded">{result?.current_line || currentLine}</div>
        </div>
        <div className="flex gap-3 mb-4">
          <Input
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder='Optional: "make it reference snowboarding"'
            onKeyDown={e => e.key === 'Enter' && handleGetAlternatives()}
            className="flex-1"
          />
          <Button onClick={handleGetAlternatives} disabled={loading}>
            {loading ? 'Loading...' : 'Get Alternatives'}
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-4 justify-center py-6 text-muted-foreground">
            <div className="size-6 border-3 border-border border-t-primary rounded-full animate-spin" />
            <span>Getting alternatives...</span>
          </div>
        )}

        {alternatives && (
          <div className="mb-4">
            {alternatives.map((alt, i) => (
              <div
                key={i}
                className={cn(
                  'p-3 border border-border rounded-md mb-2 cursor-pointer transition-colors hover:border-primary hover:bg-selected-bg',
                  selected === i && 'border-primary bg-primary-light'
                )}
                onClick={() => setSelected(i)}
              >
                <div className="font-[family-name:var(--font-mono)] text-sm">{i + 1}. {alt.text}</div>
                {alt.reasoning && <div className="text-xs text-muted-foreground mt-1 italic">{alt.reasoning}</div>}
              </div>
            ))}
          </div>
        )}

        {alternatives && selected !== null && (
          <Button variant="secondary" onClick={handleApply}>Apply Selected</Button>
        )}
      </CardContent>
    </Card>
  );
}
