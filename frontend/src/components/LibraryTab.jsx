import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import api from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Select } from './ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';

/**
 * Split lyrics into two balanced columns at the best section boundary.
 */
const MIN_LINES_FOR_SPLIT = 20;

function splitLyricsForColumns(text) {
  const lines = text.split('\n');
  if (lines.length < MIN_LINES_FOR_SPLIT) return null;

  const boundaries = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || /^\[.+\]$/.test(trimmed)) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) return null;

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

  const minEdge = lines.length * 0.25;
  if (bestIdx < minEdge || bestIdx > lines.length - minEdge) return null;

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
  const [userOverride, setUserOverride] = useState(null);

  useLayoutEffect(() => {
    setAutoOneCol(false);
    setUserOverride(null);
  }, [text]);

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
    <Button
      variant="secondary"
      size="sm"
      className="absolute top-2 right-2 z-10 opacity-60 hover:opacity-100"
      onClick={() => setUserOverride(showTwoCol ? 1 : 2)}
    >
      {showTwoCol ? '1 Column' : '2 Columns'}
    </Button>
  ) : null;

  if (!showTwoCol) {
    return (
      <div className="relative">
        {toggle}
        <Card className="p-4 sm:p-6">
          <pre className="font-[family-name:var(--font-mono)] text-[0.75rem] sm:text-[0.82rem] leading-snug whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal sm:overflow-x-auto text-foreground">{text}</pre>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {toggle}
      <Card ref={containerRef} className="p-4 sm:p-6 xl:grid xl:grid-cols-2 xl:gap-6">
        <pre className="font-[family-name:var(--font-mono)] text-[0.75rem] sm:text-[0.82rem] leading-snug whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal sm:overflow-x-auto text-foreground min-w-0 xl:border-r xl:border-border xl:pr-8">{columns.left}</pre>
        <pre className="font-[family-name:var(--font-mono)] text-[0.75rem] sm:text-[0.82rem] leading-snug whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal sm:overflow-x-auto text-foreground min-w-0">{columns.right}</pre>
      </Card>
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
        className="text-inherit font-inherit border border-primary rounded-sm px-1 bg-background text-foreground outline-none"
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
      className="cursor-pointer border-b border-dashed border-muted-foreground hover:border-foreground"
      onClick={e => { e.stopPropagation(); setEditing(true); setValue(song.title || ''); }}
      title="Click to rename"
    >
      {song.title || 'Untitled'}
    </span>
  );
}

function SongMenu({ song, onDelete, onRename, onEdit, onReopen, folders, onMoveToFolder }) {
  const handleNewFolder = () => {
    const name = prompt('Move to new folder:');
    if (name && name.trim()) {
      onMoveToFolder(song, name.trim());
    }
  };

  const otherFolders = folders.filter(f => f !== song.folder);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="bg-transparent border border-border rounded-md cursor-pointer text-xl leading-none px-2.5 py-2 text-muted-foreground tracking-wider min-w-[2.75rem] min-h-[2.75rem] inline-flex items-center justify-center hover:bg-panel hover:text-foreground"
          onClick={e => e.stopPropagation()}
          aria-label="Song actions"
        >
          &hellip;
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => song.status === 'completed' ? onReopen(song) : onEdit(song)}>
          {song.status === 'completed' ? 'Reopen' : 'Edit'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRename(song)}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {song.folder && (
          <DropdownMenuLabel>In: {song.folder}</DropdownMenuLabel>
        )}
        {otherFolders.map(f => (
          <DropdownMenuItem key={f} onClick={() => onMoveToFolder(song, f)}>
            Move to {f}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={handleNewFolder}>
          Move to new folder&hellip;
        </DropdownMenuItem>
        {song.folder && (
          <DropdownMenuItem onClick={() => onMoveToFolder(song, '')}>
            Remove from folder
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger hover:!bg-danger-light" onClick={() => onDelete(song.id)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function LibraryTab({ onLoadSong, initialSongId, onInitialSongConsumed }) {
  const [songs, setSongs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [viewingSong, setViewingSong] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);
  const [draggingSongId, setDraggingSongId] = useState(null);
  const [localFolders, setLocalFolders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectMode = selectedIds.size > 0;

  useEffect(() => {
    api.listSongs().then(data => {
      setSongs(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const folders = useMemo(() => {
    const names = new Set(localFolders);
    for (const s of songs) {
      if (s.folder) names.add(s.folder);
    }
    return [...names].sort();
  }, [songs, localFolders]);

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
    await handleMoveToFolder(song, folderName);
  };

  const handleCreateFolder = () => {
    const name = prompt('New folder name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (draggingSongId) {
      const song = songs.find(s => s.id === draggingSongId);
      if (song) handleMoveToFolder(song, trimmed);
    } else {
      setLocalFolders(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    }
    setActiveFolder(trimmed);
  };

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
      <div className="mx-auto max-w-none w-full sm:w-[calc(100vw-4rem)] sm:ml-[calc(-50vw+50%)] px-0 sm:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-3 gap-3">
          <Button variant="secondary" onClick={handleBack}>&larr; All Songs</Button>
          <div className="flex gap-2 justify-end flex-wrap">
            <Button variant="secondary" onClick={() => api.downloadSongPdf(song.id, song.title, song.artist)}>Download PDF</Button>
            {song.status === 'completed' ? (
              <Button variant="secondary" onClick={() => handleReopen(song)}>Reopen for Editing</Button>
            ) : (
              <Button variant="secondary" onClick={() => onLoadSong(song)}>Edit in Rewrite</Button>
            )}
            <Button variant="danger" onClick={() => handleDelete(song.id)}>Delete</Button>
          </div>
        </div>

        <div className="text-center mb-3">
          <h2 className="text-xl font-bold text-foreground">{song.title || 'Untitled'}</h2>
          {song.artist && <div className="text-sm text-muted-foreground mt-0.5">{song.artist}</div>}
        </div>

        <PerformanceLyrics text={song.rewritten_lyrics} />

        <Button variant="secondary" className="mt-6" onClick={handleShowDetails}>
          {showDetails ? 'Hide Details' : 'Show Original & History'}
        </Button>

        {showDetails && (
          <div className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>Original</CardHeader>
              <pre className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-[0.75rem] sm:text-[0.82rem] leading-relaxed whitespace-pre-wrap break-words overflow-x-auto max-h-[600px] overflow-y-auto">{song.original_lyrics}</pre>
            </Card>

            {song.changes_summary && (
              <Card>
                <CardHeader className="text-sm font-semibold normal-case tracking-normal bg-card">Changes</CardHeader>
                <div className="p-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{song.changes_summary}</div>
              </Card>
            )}

            {revisions.length > 1 && (
              <div className="mt-4 border-t border-border pt-3">
                <h4 className="text-sm text-muted-foreground mb-2">Revision History ({revisions.length} versions)</h4>
                {revisions.map(rev => (
                  <div key={rev.id} className="text-xs py-1 text-muted-foreground border-b border-[#f0ebe3] last:border-b-0">
                    v{rev.version} &mdash; {rev.edit_type === 'line' ? 'Line edit' : rev.edit_type === 'chat' ? 'Chat edit' : 'Full rewrite'} &mdash; {rev.changes_summary || 'No summary'} &mdash; {new Date(rev.created_at).toLocaleString()}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4 text-xs text-muted-foreground pt-2">
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
      <div className="text-center py-16 px-8 text-muted-foreground">
        <p>No saved songs yet. Rewrite a song and save it!</p>
      </div>
    );
  }

  const hasUnfiled = songs.some(s => !s.folder);
  const hasFolders = folders.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Search songs by title or artist..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-card"
        />
        <div className="flex flex-wrap gap-1.5 items-center overflow-x-auto">
          {hasFolders && (
            <button
              className={cn(
                'bg-card border border-border rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all text-muted-foreground font-medium hover:border-primary hover:text-foreground whitespace-nowrap',
                activeFolder === null && 'bg-primary text-white border-primary'
              )}
              onClick={() => setActiveFolder(null)}
            >
              All
            </button>
          )}
          {folders.map(f => (
            <button
              key={f}
              className={cn(
                'bg-card border border-border rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all text-muted-foreground font-medium hover:border-primary hover:text-foreground whitespace-nowrap',
                activeFolder === f && 'bg-primary text-white border-primary',
                dragOverFolder === f && 'bg-primary-light border-primary text-primary shadow-[0_0_0_2px_var(--color-primary-light)]'
              )}
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
              className={cn(
                'bg-card border border-border rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all text-muted-foreground font-medium hover:border-primary hover:text-foreground whitespace-nowrap',
                activeFolder === '__unfiled__' && 'bg-primary text-white border-primary',
                dragOverFolder === '__unfiled__' && 'bg-primary-light border-primary text-primary shadow-[0_0_0_2px_var(--color-primary-light)]'
              )}
              onClick={() => setActiveFolder('__unfiled__')}
              onDragOver={(e) => handleFolderDragOver(e, '__unfiled__')}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, '')}
            >
              Unfiled
            </button>
          )}
          <button
            className="bg-card border border-dashed border-border rounded-full px-3 py-1.5 text-xs cursor-pointer font-semibold text-muted-foreground hover:border-primary hover:text-foreground whitespace-nowrap"
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2.5 bg-primary-light border border-primary rounded-md flex-wrap">
          <span className="text-sm font-semibold text-primary mr-1">{selectedIds.size} selected</span>
          <Button variant="secondary" size="sm" onClick={selectAll}>Select All</Button>
          <Button variant="secondary" size="sm" onClick={clearSelection}>Clear</Button>
          {folders.length > 0 && (
            <Select
              className="w-auto py-1.5 px-2 text-xs"
              value=""
              onChange={(e) => {
                if (e.target.value === '__remove__') handleBulkMoveToFolder('');
                else if (e.target.value) handleBulkMoveToFolder(e.target.value);
              }}
            >
              <option value="">Move to folder&hellip;</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__remove__">Remove from folder</option>
            </Select>
          )}
          <Button variant="danger" size="sm" onClick={handleBulkDelete}>Delete Selected</Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filteredSongs.map(song => {
          const date = new Date(song.created_at).toLocaleDateString();
          const artist = song.artist ? ` by ${song.artist}` : '';
          const isSelected = selectedIds.has(song.id);

          return (
            <Card
              key={song.id}
              className={cn(
                'cursor-pointer transition-colors',
                draggingSongId === song.id && 'opacity-40',
                isSelected && 'border-primary bg-selected-bg'
              )}
              onClick={() => selectMode ? toggleSelect(song.id) : handleView(song)}
              draggable={!selectMode ? 'true' : undefined}
              onDragStart={!selectMode ? (e) => handleDragStart(e, song.id) : undefined}
              onDragEnd={!selectMode ? handleDragEnd : undefined}
            >
              <div className="flex justify-between items-center p-4 hover:bg-panel transition-colors">
                <label
                  className="flex items-center pr-2 cursor-pointer shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleSelect(song.id)}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base mb-0.5 leading-snug">
                    <EditableTitle song={song} onSaved={handleSongUpdated} />
                    {artist}
                    <Badge
                      variant={song.status === 'completed' ? 'completed' : 'draft'}
                      className="ml-2"
                    >
                      {song.status === 'completed' ? 'Completed' : 'Draft'}
                    </Badge>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {date}
                    {song.llm_model ? ` \u00B7 ${song.llm_model}` : ''}
                    {song.current_version > 1 ? ` \u00B7 v${song.current_version}` : ''}
                    {song.folder ? ` \u00B7 ${song.folder}` : ''}
                  </span>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
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
            </Card>
          );
        })}
        {filteredSongs.length === 0 && loaded && songs.length > 0 && (
          <div className="text-center py-16 px-8 text-muted-foreground">
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
