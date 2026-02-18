import { useState } from 'react';

export default function ComparisonView({ original, rewritten, title, artist, onTitleChange, onArtistChange, onBlur }) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div>
      <div className="song-meta-header">
        <input
          className="song-title-input"
          type="text"
          value={title || ''}
          onChange={e => onTitleChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Song title"
        />
        <input
          className="song-artist-input"
          type="text"
          value={artist || ''}
          onChange={e => onArtistChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Artist"
        />
      </div>

      <div className="panel">
        <h3>Your Version</h3>
        <pre className="lyrics-display">{rewritten}</pre>
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
