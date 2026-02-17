import { useState } from 'react';
import api from '../api';

export default function WorkshopPanel({ songId, lineIndex, originalLyrics, rewrittenLyrics, llmSettings, onApply, onClose }) {
  const [instruction, setInstruction] = useState('');
  const [alternatives, setAlternatives] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

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
      setAlternatives([{ text: 'Error: ' + err.message, reasoning: '' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (selected === null || !alternatives) return;

    const newText = alternatives[selected].text;
    try {
      const res = await api.applyEdit({
        song_id: songId,
        line_index: lineIndex,
        new_line_text: newText,
      });
      onApply(res.rewritten_lyrics);
    } catch (err) {
      alert('Failed to apply edit: ' + err.message);
    }
  };

  // Extract current/original lines for display
  const origLines = originalLyrics.split('\n');
  const rewriteLines = rewrittenLyrics.split('\n');
  const originalLine = origLines[lineIndex] || '';
  const currentLine = rewriteLines[lineIndex] || '';

  return (
    <div className="workshop-panel">
      <div className="workshop-header">
        <h3>Line Workshop</h3>
        <button className="modal-close" onClick={onClose}>&times;</button>
      </div>
      <div className="workshop-body">
        <div className="workshop-lines">
          <div className="workshop-line-label">Original line:</div>
          <div className="workshop-line-text">{result?.original_line || originalLine}</div>
          <div className="workshop-line-label">Current line:</div>
          <div className="workshop-line-text">{result?.current_line || currentLine}</div>
        </div>
        <div className="workshop-instruction-row">
          <input
            type="text"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder='Optional: "make it reference snowboarding"'
            onKeyDown={e => e.key === 'Enter' && handleGetAlternatives()}
          />
          <button className="btn primary" onClick={handleGetAlternatives} disabled={loading}>
            {loading ? 'Loading...' : 'Get Alternatives'}
          </button>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Getting alternatives...</span>
          </div>
        )}

        {alternatives && (
          <div className="workshop-alternatives">
            {alternatives.map((alt, i) => (
              <div
                key={i}
                className={`workshop-alt-item ${selected === i ? 'selected' : ''}`}
                onClick={() => setSelected(i)}
              >
                <div className="workshop-alt-text">{i + 1}. {alt.text}</div>
                {alt.reasoning && <div className="workshop-alt-reason">{alt.reasoning}</div>}
              </div>
            ))}
          </div>
        )}

        {alternatives && selected !== null && (
          <button className="btn secondary" onClick={handleApply}>Apply Selected</button>
        )}
      </div>
    </div>
  );
}
