import { useState } from 'react';

export default function ComparisonView({ original, rewritten, onRewrittenChange, onRewrittenBlur }) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="comparison-view-wrapper">
      <div className="panel">
        <h3>Your Version</h3>
        <textarea
          className="lyrics-display lyrics-editable"
          value={rewritten}
          onChange={e => onRewrittenChange(e.target.value)}
          onBlur={onRewrittenBlur}
        />
      </div>

      <button
        className="btn secondary toggle-original"
        onClick={() => setShowOriginal(prev => !prev)}
      >
        {showOriginal ? 'Hide Original' : 'Show Original'}
      </button>

      {showOriginal && (
        <div className="panel original-collapsed">
          <h3>Original</h3>
          <pre className="lyrics-display">{original}</pre>
        </div>
      )}
    </div>
  );
}
