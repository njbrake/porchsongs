import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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
  const containerRef = useRef(null);
  const [autoOneCol, setAutoOneCol] = useState(false);
  // null = auto, 1 = force one column, 2 = force two columns
  const [userOverride, setUserOverride] = useState(null);

  // Reset auto-detection and user override when text changes
  useLayoutEffect(() => {
    setAutoOneCol(false);
    setUserOverride(null);
  }, [text]);

  // Measure two-col layout before paint; only fall back to one column when
  // two columns would require heavy scrolling (> 1.5x the visible area),
  // since a little overflow is fine — the problem is when you have to scroll
  // a lot and then scroll back up to read the second column.
  useLayoutEffect(() => {
    if (columns && !autoOneCol && userOverride === null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 40;
      if (containerRef.current.scrollHeight > available * 1.5) {
        setAutoOneCol(true);
      }
    }
  });

  const canSplit = columns !== null;
  const showTwoCol = canSplit && (userOverride === 2 || (userOverride === null && !autoOneCol));

  const toggle = canSplit ? (
    <button
      className="btn secondary column-toggle"
      onClick={() => setUserOverride(showTwoCol ? 1 : 2)}
    >
      {showTwoCol ? '1 Column' : '2 Columns'}
    </button>
  ) : null;

  if (!showTwoCol) {
    return (
      <div className="performance-lyrics-wrapper">
        {toggle}
        <div className="performance-lyrics">
          <pre className="performance-lyrics-text">{text}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-lyrics-wrapper">
      {toggle}
      <div ref={containerRef} className="performance-lyrics performance-lyrics--two-col">
        <pre className="performance-lyrics-text">{columns.left}</pre>
        <pre className="performance-lyrics-text">{columns.right}</pre>
      </div>
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

function SongMenu({ song, onDelete, onRename, onEdit, onReopen, folders, onMoveToFolder }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMove = (folderName) => {
    setOpen(false);
    onMoveToFolder(song, folderName);
  };

  const handleNewFolder = () => {
    setOpen(false);
    const name = prompt('Move to new folder:');
    if (name && name.trim()) {
      onMoveToFolder(song, name.trim());
    }
  };

  const otherFolders = folders.filter(f => f !== song.folder);

  return (
    <div className="song-menu" ref={menuRef}>
      <button
        className="song-menu-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
        aria-label="Song actions"
      >
        &hellip;
      </button>
      {open && (
        <div className="song-menu-dropdown">
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); song.status === 'completed' ? onReopen(song) : onEdit(song); }}>
            {song.status === 'completed' ? 'Reopen' : 'Edit'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(song); }}>
            Rename
          </button>
          <div className="song-menu-divider" />
          {song.folder && (
            <div className="song-menu-folder-label">In: {song.folder}</div>
          )}
          {otherFolders.map(f => (
            <button key={f} onClick={(e) => { e.stopPropagation(); handleMove(f); }}>
              Move to {f}
            </button>
          ))}
          <button onClick={(e) => { e.stopPropagation(); handleNewFolder(); }}>
            Move to new folder&hellip;
          </button>
          {song.folder && (
            <button onClick={(e) => { e.stopPropagation(); handleMove(''); }}>
              Remove from folder
            </button>
          )}
          <div className="song-menu-divider" />
          <button className="song-menu-danger" onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(song.id); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function LibraryTab({ onLoadSong, initialSongId, onInitialSongConsumed }) {
  const [songs, setSongs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [viewingSong, setViewingSong] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState(null); // null = "All"
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [draggingSongId, setDraggingSongId] = useState(null);
  const [localFolders, setLocalFolders] = useState([]); // user-created empty folders
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectMode = selectedIds.size > 0;

  useEffect(() => {
    api.listSongs().then(data => {
      setSongs(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Derive folder list from loaded songs + locally created names
  const folders = useMemo(() => {
    const names = new Set(localFolders);
    for (const s of songs) {
      if (s.folder) names.add(s.folder);
    }
    return [...names].sort();
  }, [songs, localFolders]);

  // Filter songs client-side by search + folder
  const filteredSongs = useMemo(() => {
    let result = songs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q)
      );
    }
    if (activeFolder === '__unfiled__') {
      result = result.filter(s => !s.folder);
    } else if (activeFolder) {
      result = result.filter(s => s.folder === activeFolder);
    }
    return result;
  }, [songs, searchQuery, activeFolder]);

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

  const handleRename = async (song) => {
    const newTitle = prompt('Song title:', song.title || '');
    if (newTitle === null) return;
    const newArtist = prompt('Artist:', song.artist || '');
    if (newArtist === null) return;
    try {
      const updates = {};
      if (newTitle.trim() !== (song.title || '')) updates.title = newTitle.trim() || null;
      if (newArtist.trim() !== (song.artist || '')) updates.artist = newArtist.trim() || null;
      if (Object.keys(updates).length === 0) return;
      const updated = await api.updateSong(song.id, updates);
      handleSongUpdated(updated);
    } catch (err) {
      alert('Failed to rename: ' + err.message);
    }
  };

  const handleMoveToFolder = async (song, folderName) => {
    try {
      const updated = await api.updateSong(song.id, { folder: folderName });
      handleSongUpdated(updated);
    } catch (err) {
      alert('Failed to move song: ' + err.message);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, songId) => {
    e.dataTransfer.setData('text/plain', String(songId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSongId(songId);
  };

  const handleDragEnd = () => {
    setDraggingSongId(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e, folderKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderKey);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e, folderName) => {
    e.preventDefault();
    setDragOverFolder(null);
    const songId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!songId) return;
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    // folderName '' means "unfiled" (remove from folder)
    await handleMoveToFolder(song, folderName);
  };

  const handleCreateFolder = () => {
    const name = prompt('New folder name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    // If a song is being dragged, move it to the new folder
    if (draggingSongId) {
      const song = songs.find(s => s.id === draggingSongId);
      if (song) handleMoveToFolder(song, trimmed);
    } else {
      // Persist locally so the chip shows up even with no songs in it yet
      setLocalFolders(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    }
    setActiveFolder(trimmed);
  };

  // Selection helpers
  const toggleSelect = (songId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredSongs.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected song${count > 1 ? 's' : ''}?`)) return;
    try {
      await Promise.all([...selectedIds].map(id => api.deleteSong(id)));
      setSongs(prev => prev.filter(s => !selectedIds.has(s.id)));
      if (viewingSong && selectedIds.has(viewingSong.id)) {
        setViewingSong(null);
        pushSongUrl(null);
      }
      setSelectedIds(new Set());
    } catch (err) {
      alert('Failed to delete some songs: ' + err.message);
    }
  };

  const handleBulkMoveToFolder = async (folderName) => {
    try {
      const results = await Promise.all(
        [...selectedIds].map(id => api.updateSong(id, { folder: folderName }))
      );
      setSongs(prev => prev.map(s => {
        const updated = results.find(r => r.id === s.id);
        return updated || s;
      }));
      setSelectedIds(new Set());
    } catch (err) {
      alert('Failed to move some songs: ' + err.message);
    }
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

  const hasUnfiled = songs.some(s => !s.folder);
  const hasFolders = folders.length > 0;

  return (
    <div className="library-container">
      <div className="library-toolbar">
        <input
          type="text"
          className="library-search"
          placeholder="Search songs by title or artist..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="folder-bar">
          {hasFolders && (
            <button
              className={`folder-chip${activeFolder === null ? ' active' : ''}`}
              onClick={() => setActiveFolder(null)}
            >
              All
            </button>
          )}
          {folders.map(f => (
            <button
              key={f}
              className={`folder-chip${activeFolder === f ? ' active' : ''}${dragOverFolder === f ? ' drag-over' : ''}`}
              onClick={() => setActiveFolder(f)}
              onDragOver={(e) => handleFolderDragOver(e, f)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, f)}
            >
              {f}
            </button>
          ))}
          {hasFolders && hasUnfiled && (
            <button
              className={`folder-chip${activeFolder === '__unfiled__' ? ' active' : ''}${dragOverFolder === '__unfiled__' ? ' drag-over' : ''}`}
              onClick={() => setActiveFolder('__unfiled__')}
              onDragOver={(e) => handleFolderDragOver(e, '__unfiled__')}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, '')}
            >
              Unfiled
            </button>
          )}
          <button
            className="folder-chip folder-chip-add"
            onClick={handleCreateFolder}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              e.preventDefault();
              const songId = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (!songId) return;
              const name = prompt('New folder name:');
              if (!name || !name.trim()) return;
              const song = songs.find(s => s.id === songId);
              if (song) handleMoveToFolder(song, name.trim());
            }}
            title="Create new folder"
          >
            + New Folder
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <button className="btn secondary" onClick={selectAll}>Select All</button>
          <button className="btn secondary" onClick={clearSelection}>Clear</button>
          {folders.length > 0 && (
            <select
              className="bulk-folder-select"
              value=""
              onChange={(e) => {
                if (e.target.value === '__remove__') handleBulkMoveToFolder('');
                else if (e.target.value) handleBulkMoveToFolder(e.target.value);
              }}
            >
              <option value="">Move to folder&hellip;</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__remove__">Remove from folder</option>
            </select>
          )}
          <button className="btn danger" onClick={handleBulkDelete}>Delete Selected</button>
        </div>
      )}

      <div className="library-list">
        {filteredSongs.map(song => {
          const date = new Date(song.created_at).toLocaleDateString();
          const artist = song.artist ? ` by ${song.artist}` : '';
          const isSelected = selectedIds.has(song.id);

          return (
            <div
              key={song.id}
              className={`library-card${draggingSongId === song.id ? ' dragging' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => selectMode ? toggleSelect(song.id) : handleView(song)}
              draggable={!selectMode ? 'true' : undefined}
              onDragStart={!selectMode ? (e) => handleDragStart(e, song.id) : undefined}
              onDragEnd={!selectMode ? handleDragEnd : undefined}
            >
              <div className="library-card-header">
                <label
                  className="library-card-checkbox"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(song.id)}
                  />
                </label>
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
                    {song.folder ? ` \u00B7 ${song.folder}` : ''}
                  </span>
                </div>
                <div className="library-card-actions" onClick={e => e.stopPropagation()}>
                  <SongMenu
                    song={song}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onEdit={onLoadSong}
                    onReopen={handleReopen}
                    folders={folders}
                    onMoveToFolder={handleMoveToFolder}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {filteredSongs.length === 0 && loaded && songs.length > 0 && (
          <div className="empty-state">
            {activeFolder && !searchQuery ? (
              <p>No songs in this folder yet. Use the &hellip; menu on a song to move it here, or drag songs onto the folder tab.</p>
            ) : (
              <p>No songs match your search.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
