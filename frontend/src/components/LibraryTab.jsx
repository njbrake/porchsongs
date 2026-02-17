import { useState, useEffect } from 'react';
import api from '../api';

export default function LibraryTab({ onLoadSong }) {
  const [songs, setSongs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [revisions, setRevisions] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.listSongs().then(data => {
      setSongs(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toggleExpand = async (songId) => {
    if (expanded === songId) {
      setExpanded(null);
      return;
    }
    setExpanded(songId);

    if (!revisions[songId]) {
      try {
        const revs = await api.getSongRevisions(songId);
        setRevisions(prev => ({ ...prev, [songId]: revs }));
      } catch {
        // ignore
      }
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this saved song?')) return;
    try {
      await api.deleteSong(id);
      setSongs(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

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
        const title = song.title || 'Untitled';
        const artist = song.artist ? ` by ${song.artist}` : '';
        const isOpen = expanded === song.id;
        const songRevisions = revisions[song.id] || [];

        return (
          <div key={song.id} className="library-card">
            <div className="library-card-header" onClick={() => toggleExpand(song.id)}>
              <div className="library-card-info">
                <h3>
                  {title}{artist}
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
                {song.status !== 'completed' && (
                  <button className="btn secondary" onClick={() => onLoadSong(song)}>
                    Continue Editing
                  </button>
                )}
                <button className="btn danger" onClick={() => handleDelete(song.id)}>
                  Delete
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="library-card-body open">
                <div className="comparison-panels">
                  <div className="panel">
                    <h3>Original</h3>
                    <pre className="lyrics-display">{song.original_lyrics}</pre>
                  </div>
                  <div className="panel">
                    <h3>Your Version</h3>
                    <pre className="lyrics-display">{song.rewritten_lyrics}</pre>
                  </div>
                </div>
                {song.changes_summary && (
                  <div className="changes-summary" style={{ marginTop: '1rem' }}>
                    <h3>Changes</h3>
                    <div>{song.changes_summary}</div>
                  </div>
                )}
                {songRevisions.length > 1 && (
                  <div className="revision-list">
                    <h4>Revision History ({songRevisions.length} versions)</h4>
                    {songRevisions.map(rev => (
                      <div key={rev.id} className="revision-item">
                        v{rev.version} &mdash; {rev.edit_type === 'line' ? 'Line edit' : rev.edit_type === 'chat' ? 'Chat edit' : 'Full rewrite'} &mdash; {rev.changes_summary || 'No summary'} &mdash; {new Date(rev.created_at).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
