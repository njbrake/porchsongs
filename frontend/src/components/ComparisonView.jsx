import { useState } from 'react';
import { Card, CardHeader } from './ui/card';
import { Button } from './ui/button';

export default function ComparisonView({ original, rewritten, onRewrittenChange, onRewrittenBlur }) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <Card className="flex flex-col flex-1 overflow-hidden">
        <CardHeader>Your Version</CardHeader>
        <textarea
          className="flex-1 p-3 sm:p-4 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words overflow-y-auto w-full border-0 bg-transparent resize-none cursor-text focus:outline-none focus:bg-[#fdfcfa]"
          value={rewritten}
          onChange={e => onRewrittenChange(e.target.value)}
          onBlur={onRewrittenBlur}
        />
      </Card>

      <Button
        variant="secondary"
        size="sm"
        className="self-start mt-2"
        onClick={() => setShowOriginal(prev => !prev)}
      >
        {showOriginal ? 'Hide Original' : 'Show Original'}
      </Button>

      {showOriginal && (
        <Card className="mt-2 opacity-80">
          <CardHeader>Original</CardHeader>
          <pre className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-xs sm:text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words overflow-x-auto max-h-[600px] overflow-y-auto">{original}</pre>
        </Card>
      )}
    </div>
  );
}
