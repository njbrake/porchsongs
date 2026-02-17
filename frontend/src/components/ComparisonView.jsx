function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every(t => /^[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add\d+|\d+|\/[A-G][#b]?)*$/.test(t));
}

function LyricsDisplay({ text, id, onLineClick, selectedLine }) {
  const lines = text.split('\n');
  const origLines = text.split('\n');

  return (
    <pre className="lyrics-display">
      {lines.map((line, i) => {
        const chord = isChordLine(line);
        const classes = [
          chord ? 'line-chord' : '',
          selectedLine === i ? 'line-selected' : '',
          !chord && onLineClick && line.trim() ? 'line-clickable' : '',
        ].filter(Boolean).join(' ');

        return (
          <span
            key={i}
            className={classes}
            data-line={i}
            onClick={() => {
              if (!chord && onLineClick && line.trim()) {
                onLineClick(i);
              }
            }}
          >
            {line}
          </span>
        );
      }).reduce((acc, el, i) => {
        if (i > 0) acc.push('\n');
        acc.push(el);
        return acc;
      }, [])}
    </pre>
  );
}

function HighlightedLyricsDisplay({ original, rewritten, onLineClick, selectedLine }) {
  const origLines = original.split('\n');
  const rewriteLines = rewritten.split('\n');

  return (
    <div className="comparison-panels">
      <div className="panel">
        <h3>Original</h3>
        <pre className="lyrics-display">
          {origLines.map((line, i) => {
            const chord = isChordLine(line);
            const changed = !chord && i < rewriteLines.length && line !== rewriteLines[i] && !isChordLine(rewriteLines[i] || '');
            return (
              <span
                key={i}
                className={`${chord ? 'line-chord' : ''} ${changed ? 'line-changed' : ''}`}
                data-line={i}
              >
                {line}
              </span>
            );
          }).reduce((acc, el, i) => {
            if (i > 0) acc.push('\n');
            acc.push(el);
            return acc;
          }, [])}
        </pre>
      </div>
      <div className="panel">
        <h3>Your Version</h3>
        <pre className="lyrics-display">
          {rewriteLines.map((line, i) => {
            const chord = isChordLine(line);
            const changed = !chord && i < origLines.length && line !== origLines[i] && !isChordLine(origLines[i] || '');
            const clickable = !chord && line.trim() && onLineClick;
            return (
              <span
                key={i}
                className={[
                  chord ? 'line-chord' : '',
                  changed ? 'line-changed' : '',
                  selectedLine === i ? 'line-selected' : '',
                  clickable ? 'line-clickable' : '',
                ].filter(Boolean).join(' ')}
                data-line={i}
                onClick={() => clickable && onLineClick(i)}
              >
                {line}
              </span>
            );
          }).reduce((acc, el, i) => {
            if (i > 0) acc.push('\n');
            acc.push(el);
            return acc;
          }, [])}
        </pre>
      </div>
    </div>
  );
}

export default function ComparisonView({ original, rewritten, onLineClick, selectedLine }) {
  return (
    <HighlightedLyricsDisplay
      original={original}
      rewritten={rewritten}
      onLineClick={onLineClick}
      selectedLine={selectedLine}
    />
  );
}
