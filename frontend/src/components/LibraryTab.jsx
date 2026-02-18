import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../api';

/**
 * Split lyrics into two balanced columns at the best section boundary.
 * Returns null (don't split) if fewer than MIN_LINES lines.
 * A "section boundary" is a blank line or a line matching [Verse], [Chorus], etc.
 */
const MIN_LINES_FOR_SPLIT = 20;

function splitLyricsForColumns(text) {
  const lines = text.split('\n');
  if (lines.length < MIN_LINES_FOR_SPLIT) return null;

  // Find all section boundary indices — blank lines or [Section] headers
  const boundaries = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || /^\[.+\]$/.test(trimmed)) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) return null;

  // Find the boundary closest to the midpoint (by line count)
  const mid = lines.length / 2;
  let bestIdx = boundaries[0];
  let bestDist = Math.abs(bestIdx - mid);
  for (const idx of boundaries) {
    const dist = Math.abs(idx - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  }

  // Don't split if the best point is too close to either edge (< 25% of lines)
  const minEdge = lines.length * 0.25;
  if (bestIdx < minEdge || bestIdx > lines.length - minEdge) return null;

  // Split: if the boundary is a blank line, it becomes the end of col 1.
  // If it's a section header, it starts col 2.
  const isSectionHeader = /^\[.+\]$/.test(lines[bestIdx].trim());
  const splitAt = isSectionHeader ? bestIdx : bestIdx + 1;

  return {
    left: lines.slice(0, splitAt).join('\n').replace(/\n+$/, ''),
    right: lines.slice(splitAt).join('\n').replace(/^\n+/, ''),
  };
}

function PerformanceLyrics({ text }) {
  const columns = useMemo(() => splitLyricsForColumns(text), [text]);

  if (!columns) {
    return (
      <div className="performance-lyrics">
        <pre className="performance-lyrics-text">{text}</pre>
      </div>
    );
  }

  return (
    <div className="performance-lyrics performance-lyrics--two-col">
      <pre className="performance-lyrics-text">{columns.left}</pre>
      <pre className="performance-lyrics-text">{columns.right}</pre>
    </div>
  );
}

function EditableTitle({ song, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(song.title || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed === (song.title || '')) return;
    try {
      const updated = await api.updateSong(song.id, { title: trimmed || null });
      onSaved(updated);
    } catch {
      setValue(song.title || '');
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-edit-title"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setValue(song.title || ''); setEditing(false); }
        }}
        onClick={e => e.stopPropagation()}
        placeholder="Untitled"
      />
    );
  }

  return (
    <span
      className="editable-title"
      onClick={e => { e.stopPropagation(); setEditing(true); setValue(song.title || ''); }}
      title="Click to rename"
    >
      {song.title || 'Untitled'}
    </span>
  );
}

export default function LibraryTab({ onLoadSong, initialSongId, onInitialSongConsumed }) {
  const [songs, setSongs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [viewingSong, setViewingSong] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [revisions, setRevisions] = useState([]);

  useEffect(() => {
    api.listSongs().then(data => {
      setSongs(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Open song from URL on initial load or popstate
  useEffect(() => {
    if (initialSongId != null && loaded) {
      const song = songs.find(s => s.id === initialSongId);
      if (song) {
        setViewingSong(song);
        setShowDetails(false);
        setRevisions([]);
      }
      onInitialSongConsumed?.();
    }
  }, [initialSongId, loaded, songs, onInitialSongConsumed]);

  const pushSongUrl = useCallback((songId) => {
    const target = songId ? `/library/${songId}` : '/library';
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  const handleView = (song) => {
    setViewingSong(song);
    setShowDetails(false);
    setRevisions([]);
    pushSongUrl(song.id);
  };

  const handleBack = () => {
    setViewingSong(null);
    pushSongUrl(null);
  };

  const handleShowDetails = async () => {
    setShowDetails(prev => !prev);
    if (!showDetails && viewingSong && revisions.length === 0) {
      try {
        const revs = await api.getSongRevisions(viewingSong.id);
        setRevisions(revs);
      } catch {
        // ignore
      }
    }
  };

  const handleReopen = async (song) => {
    try {
      await api.updateSongStatus(song.id, { status: 'draft' });
      const updated = { ...song, status: 'draft' };
      setSongs(prev => prev.map(s => s.id === song.id ? updated : s));
      onLoadSong(updated);
    } catch (err) {
      alert('Failed to reopen: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this saved song?')) return;
    try {
      await api.deleteSong(id);
      setSongs(prev => prev.filter(s => s.id !== id));
      if (viewingSong?.id === id) {
        setViewingSong(null);
        pushSongUrl(null);
      }
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleSongUpdated = (updated) => {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (viewingSong?.id === updated.id) setViewingSong(updated);
  };

  // --- Performance View (single song) ---
  if (viewingSong) {
    const song = viewingSong;
    return (
      <div className="library-performance">
        <div className="performance-nav">
          <button className="btn secondary" onClick={handleBack}>&larr; All Songs</button>
          <div className="performance-nav-actions">
            <button className="btn secondary" onClick={() => api.downloadSongPdf(song.id, song.title, song.artist)}>Download PDF</button>
            {song.status === 'completed' ? (
              <button className="btn secondary" onClick={() => handleReopen(song)}>Reopen for Editing</button>
            ) : (
              <button className="btn secondary" onClick={() => onLoadSong(song)}>Edit in Rewrite</button>
            )}
            <button className="btn danger" onClick={() => handleDelete(song.id)}>Delete</button>
          </div>
        </div>

        <div className="performance-header">
          <h2 className="performance-title">{song.title || 'Untitled'}</h2>
          {song.artist && <div className="performance-artist">{song.artist}</div>}
        </div>

        <PerformanceLyrics text={song.rewritten_lyrics} />

        <button className="btn secondary performance-details-toggle" onClick={handleShowDetails}>
          {showDetails ? 'Hide Details' : 'Show Original & History'}
        </button>

        {showDetails && (
          <div className="performance-details">
            <div className="panel">
              <h3>Original</h3>
              <pre className="lyrics-display">{song.original_lyrics}</pre>
            </div>

            {song.changes_summary && (
              <div className="changes-summary">
                <h3>Changes</h3>
                <div className="changes-display">{song.changes_summary}</div>
              </div>
            )}

            {revisions.length > 1 && (
              <div className="revision-list">
                <h4>Revision History ({revisions.length} versions)</h4>
                {revisions.map(rev => (
                  <div key={rev.id} className="revision-item">
                    v{rev.version} &mdash; {rev.edit_type === 'line' ? 'Line edit' : rev.edit_type === 'chat' ? 'Chat edit' : 'Full rewrite'} &mdash; {rev.changes_summary || 'No summary'} &mdash; {new Date(rev.created_at).toLocaleString()}
                  </div>
                ))}
              </div>
            )}

            <div className="performance-meta">
              {song.llm_model && <span>Model: {song.llm_model}</span>}
              {song.current_version > 1 && <span>Version {song.current_version}</span>}
              <span>{new Date(song.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Song List ---
  if (loaded && songs.length === 0) {
    return (
      <div className="empty-state">
        <p>No saved songs yet. Rewrite a song and save it!</p>
      </div>
    );
  }

  return (
    <div className="library-list">
      {songs.map(song => {
        const date = new Date(song.created_at).toLocaleDateString();
        const artist = song.artist ? ` by ${song.artist}` : '';

        return (
          <div key={song.id} className="library-card" onClick={() => handleView(song)}>
            <div className="library-card-header">
              <div className="library-card-info">
                <h3>
                  <EditableTitle song={song} onSaved={handleSongUpdated} />
                  {artist}
                  <span className={`status-badge ${song.status}`}>
                    {song.status === 'completed' ? 'Completed' : 'Draft'}
                  </span>
                </h3>
                <span className="meta">
                  {date}
                  {song.llm_model ? ` \u00B7 ${song.llm_model}` : ''}
                  {song.current_version > 1 ? ` \u00B7 v${song.current_version}` : ''}
                </span>
              </div>
              <div className="library-card-actions" onClick={e => e.stopPropagation()}>
                {song.status === 'completed' ? (
                  <button className="btn secondary" onClick={() => handleReopen(song)}>
                    Reopen
                  </button>
                ) : (
                  <button className="btn secondary" onClick={() => onLoadSong(song)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
