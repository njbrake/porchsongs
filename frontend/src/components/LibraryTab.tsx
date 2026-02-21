import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type DragEvent } from 'react';
import { toast } from 'sonner';
import api from '@/api';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import PromptDialog, { type PromptField } from '@/components/ui/prompt-dialog';
import { cn } from '@/lib/utils';
import useAutoFontSize from '@/hooks/useAutoFontSize';
import type { Song, SongRevision } from '@/types';

/**
 * Split lyrics into two balanced columns at the best section boundary.
 */
const MIN_LINES_FOR_SPLIT = 20;

function splitContentForColumns(text: string): { left: string; right: string } | null {
  const lines = text.split('\n');
  if (lines.length < MIN_LINES_FOR_SPLIT) return null;

  const boundaries: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === '' || /^\[.+\]$/.test(trimmed)) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) return null;

  const mid = lines.length / 2;
  let bestIdx = boundaries[0]!;
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

  const isSectionHeader = /^\[.+\]$/.test(lines[bestIdx]!.trim());
  const splitAt = isSectionHeader ? bestIdx : bestIdx + 1;

  return {
    left: lines.slice(0, splitAt).join('\n').replace(/\n+$/, ''),
    right: lines.slice(splitAt).join('\n').replace(/^\n+/, ''),
  };
}

const PRE_BASE_CLASS = 'font-mono text-xs sm:text-code leading-snug whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal sm:overflow-x-auto text-foreground';

const FOLDER_PILL_CLASS = 'bg-card border border-border rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all text-muted-foreground font-medium hover:border-primary hover:text-foreground whitespace-nowrap';
const FOLDER_PILL_ACTIVE = 'bg-primary text-white border-primary';

function PerformanceSheet({ song, onSongUpdated }: { song: Song; onSongUpdated: (song: Song) => void }) {
  const text = song.rewritten_content;
  const columns = useMemo(() => splitContentForColumns(text), [text]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [autoOneCol, setAutoOneCol] = useState(false);
  const [userOverride, setUserOverride] = useState<number | null>(null);
  const [localFontSize, setLocalFontSize] = useState<number | null>(song.font_size);

  useLayoutEffect(() => {
    setAutoOneCol(false);
    setUserOverride(null);
  }, [text]);

  useEffect(() => {
    setLocalFontSize(song.font_size);
  }, [song.font_size]);

  const canSplit = columns !== null;
  const showTwoCol = canSplit && (userOverride === 2 || (userOverride === null && !autoOneCol));

  useLayoutEffect(() => {
    if (columns && !autoOneCol && userOverride === null && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 40;
      if (cardRef.current.scrollHeight > available * 1.5) {
        setAutoOneCol(true);
      }
    }
  }, [columns, autoOneCol, userOverride]);

  const autoFontSize = useAutoFontSize(cardRef, text, { columnOverhead: showTwoCol ? 33 : 0 });
  const effectiveSize = localFontSize ?? autoFontSize;
  const fontStyle = effectiveSize !== undefined ? { fontSize: `${effectiveSize}px` } : undefined;
  const isAuto = localFontSize === null;
  const sliderValue = effectiveSize ?? 16;

  const persistFontSize = useCallback((value: number | null) => {
    const sendValue = value === null ? 0 : value;
    api.updateSong(song.id, { font_size: sendValue } as Partial<Song>).then(updated => {
      onSongUpdated(updated);
    }).catch(() => {});
  }, [song.id, onSongUpdated]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFontSize(Number(e.target.value));
  };

  const handleSliderCommit = () => {
    persistFontSize(localFontSize);
  };

  const handleResetToAuto = () => {
    setLocalFontSize(null);
    persistFontSize(null);
  };

  const controls = (
    <div className="flex items-center justify-end gap-2 mb-2 sm:mb-0 sm:absolute sm:top-2 sm:right-2 sm:z-10 sm:opacity-60 sm:hover:opacity-100 sm:transition-opacity">
      <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {isAuto ? 'Auto' : `${Math.round(sliderValue)}px`}
        </span>
        <input
          type="range"
          min={10}
          max={28}
          step={1}
          value={Math.round(sliderValue)}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          className="w-20 h-1 accent-primary cursor-pointer"
          title="Text size"
        />
        {!isAuto && (
          <button
            onClick={handleResetToAuto}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
            title="Reset to auto size"
          >
            &times;
          </button>
        )}
      </div>
      {canSplit && (
        <Button
          variant="secondary"
          size="sm"
          className="hidden xl:inline-flex"
          onClick={() => setUserOverride(showTwoCol ? 1 : 2)}
        >
          {showTwoCol ? '1 Column' : '2 Columns'}
        </Button>
      )}
    </div>
  );

  return (
    <div className="relative">
      {controls}
      <Card
        ref={cardRef}
        className={cn('p-4 sm:p-6', showTwoCol && 'xl:grid xl:grid-cols-2 xl:gap-6')}
      >
        {showTwoCol ? (
          <>
            <pre className={cn(PRE_BASE_CLASS, 'min-w-0 xl:border-r xl:border-border xl:pr-8')} style={fontStyle}>{columns!.left}</pre>
            <pre className={cn(PRE_BASE_CLASS, 'min-w-0')} style={fontStyle}>{columns!.right}</pre>
          </>
        ) : (
          <pre className={PRE_BASE_CLASS} style={fontStyle}>{text}</pre>
        )}
      </Card>
    </div>
  );
}

function EditableTitle({ song, onSaved }: { song: Song; onSaved: (song: Song) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(song.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed === (song.title || '')) return;
    try {
      const updated = await api.updateSong(song.id, { title: trimmed || null } as Partial<Song>);
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

interface SongMenuProps {
  song: Song;
  onDelete: (id: number) => void;
  onRename: (song: Song) => void;
  onEdit: (song: Song) => void;
  onReopen: (song: Song) => void;
  folders: string[];
  onMoveToFolder: (song: Song, folder: string) => void;
  onMoveToNewFolder: (song: Song) => void;
}

function SongMenu({ song, onDelete, onRename, onEdit, onReopen, folders, onMoveToFolder, onMoveToNewFolder }: SongMenuProps) {
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
        <DropdownMenuItem onClick={() => onMoveToNewFolder(song)}>
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

type SortKey = 'date' | 'title' | 'artist' | 'status';
type SortDir = 'asc' | 'desc';

type DialogState =
  | { kind: 'none' }
  | { kind: 'delete'; songId: number }
  | { kind: 'bulkDelete'; count: number }
  | { kind: 'rename'; song: Song }
  | { kind: 'newFolder'; song?: Song };

interface LibraryTabProps {
  onLoadSong: (song: Song) => void;
  initialSongId: number | null;
  onInitialSongConsumed: () => void;
}

export default function LibraryTab({ onLoadSong, initialSongId, onInitialSongConsumed }: LibraryTabProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [revisions, setRevisions] = useState<SongRevision[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [draggingSongId, setDraggingSongId] = useState<number | null>(null);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dialogState, setDialogState] = useState<DialogState>({ kind: 'none' });

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

  const sortedSongs = useMemo(() => {
    const sorted = [...filteredSongs].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'artist':
          cmp = (a.artist || '').localeCompare(b.artist || '');
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
        default:
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredSongs, sortKey, sortDir]);

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

  const pushSongUrl = useCallback((songId: number | null) => {
    const target = songId ? `/library/${songId}` : '/library';
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  const handleView = (song: Song) => {
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

  const handleReopen = async (song: Song) => {
    try {
      await api.updateSongStatus(song.id, { status: 'draft' });
      const updated = { ...song, status: 'draft' as const };
      setSongs(prev => prev.map(s => s.id === song.id ? updated : s));
      onLoadSong(updated);
    } catch (err) {
      toast.error('Failed to reopen: ' + (err as Error).message);
    }
  };

  const handleDeleteRequest = (id: number) => {
    setDialogState({ kind: 'delete', songId: id });
  };

  const handleDeleteConfirmed = async (id: number) => {
    try {
      await api.deleteSong(id);
      setSongs(prev => prev.filter(s => s.id !== id));
      if (viewingSong?.id === id) {
        setViewingSong(null);
        pushSongUrl(null);
      }
    } catch (err) {
      toast.error('Failed to delete: ' + (err as Error).message);
    }
  };

  const handleSongUpdated = (updated: Song) => {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (viewingSong?.id === updated.id) setViewingSong(updated);
  };

  const handleRenameRequest = (song: Song) => {
    setDialogState({ kind: 'rename', song });
  };

  const handleRenameConfirmed = async (song: Song, values: Record<string, string>) => {
    try {
      const updates: Record<string, string | null> = {};
      const newTitle = (values.title ?? '').trim();
      const newArtist = (values.artist ?? '').trim();
      if (newTitle !== (song.title || '')) updates.title = newTitle || null;
      if (newArtist !== (song.artist || '')) updates.artist = newArtist || null;
      if (Object.keys(updates).length === 0) return;
      const updated = await api.updateSong(song.id, updates as Partial<Song>);
      handleSongUpdated(updated);
    } catch (err) {
      toast.error('Failed to rename: ' + (err as Error).message);
    }
  };

  const handleMoveToFolder = async (song: Song, folderName: string) => {
    try {
      const updated = await api.updateSong(song.id, { folder: folderName } as Partial<Song>);
      handleSongUpdated(updated);
    } catch (err) {
      toast.error('Failed to move song: ' + (err as Error).message);
    }
  };

  const handleMoveToNewFolder = (song: Song) => {
    setDialogState({ kind: 'newFolder', song });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, songId: number) => {
    e.dataTransfer.setData('text/plain', String(songId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSongId(songId);
  };

  const handleDragEnd = () => {
    setDraggingSongId(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e: DragEvent, folderKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderKey);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: DragEvent, folderName: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    const songId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!songId) return;
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    await handleMoveToFolder(song, folderName);
  };

  const handleCreateFolder = () => {
    setDialogState({ kind: 'newFolder', song: draggingSongId ? songs.find(s => s.id === draggingSongId) : undefined });
  };

  const handleNewFolderConfirmed = (values: Record<string, string>, song?: Song) => {
    const trimmed = (values.name ?? '').trim();
    if (!trimmed) return;
    if (song) {
      handleMoveToFolder(song, trimmed);
    } else {
      setLocalFolders(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    }
    setActiveFolder(trimmed);
  };

  const toggleSelect = (songId: number) => {
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

  const handleBulkDeleteRequest = () => {
    setDialogState({ kind: 'bulkDelete', count: selectedIds.size });
  };

  const handleBulkDeleteConfirmed = async () => {
    try {
      await Promise.all([...selectedIds].map(id => api.deleteSong(id)));
      setSongs(prev => prev.filter(s => !selectedIds.has(s.id)));
      if (viewingSong && selectedIds.has(viewingSong.id)) {
        setViewingSong(null);
        pushSongUrl(null);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to delete some songs: ' + (err as Error).message);
    }
  };

  const handleBulkMoveToFolder = async (folderName: string) => {
    try {
      const results = await Promise.all(
        [...selectedIds].map(id => api.updateSong(id, { folder: folderName } as Partial<Song>))
      );
      setSongs(prev => prev.map(s => {
        const updated = results.find(r => r.id === s.id);
        return updated || s;
      }));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to move some songs: ' + (err as Error).message);
    }
  };

  const handleDownloadPdf = (song: Song) => {
    toast.promise(
      api.downloadSongPdf(song.id, song.title, song.artist),
      {
        loading: 'Generating PDF...',
        success: 'PDF downloaded',
        error: 'Failed to download PDF',
      }
    );
  };

  // Rename dialog fields
  const renameFields: PromptField[] = useMemo(() => {
    if (dialogState.kind !== 'rename') return [];
    return [
      { key: 'title', label: 'Song title', defaultValue: dialogState.song.title || '', placeholder: 'Song title' },
      { key: 'artist', label: 'Artist', defaultValue: dialogState.song.artist || '', placeholder: 'Artist' },
    ];
  }, [dialogState]);

  const newFolderFields: PromptField[] = useMemo(() => [
    { key: 'name', label: 'Folder name', placeholder: 'Enter folder name' },
  ], []);

  // --- Performance View (single song) ---
  if (viewingSong) {
    const song = viewingSong;
    return (
      <div className="mx-auto max-w-none w-full sm:w-[calc(100vw-4rem)] sm:ml-[calc(-50vw+50%)] px-0 sm:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-3 gap-3">
          <Button variant="secondary" onClick={handleBack}>&larr; All Songs</Button>
          <div className="flex gap-2 justify-end flex-wrap">
            <Button variant="secondary" onClick={() => handleDownloadPdf(song)}>Download PDF</Button>
            {song.status === 'completed' ? (
              <Button variant="secondary" onClick={() => handleReopen(song)}>Reopen for Editing</Button>
            ) : (
              <Button variant="secondary" onClick={() => onLoadSong(song)}>Edit in Rewrite</Button>
            )}
            <Button variant="danger" onClick={() => handleDeleteRequest(song.id)}>Delete</Button>
          </div>
        </div>

        <div className="text-center mb-3">
          <h2 className="text-xl font-bold text-foreground">{song.title || 'Untitled'}</h2>
          {song.artist && <div className="text-sm text-muted-foreground mt-0.5">{song.artist}</div>}
        </div>

        <PerformanceSheet song={song} onSongUpdated={handleSongUpdated} />

        <Button variant="secondary" className="mt-6" onClick={handleShowDetails}>
          {showDetails ? 'Hide Details' : 'Show Original & History'}
        </Button>

        {showDetails && (
          <div className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>Original</CardHeader>
              <pre className="p-3 sm:p-4 font-mono text-xs sm:text-code leading-relaxed whitespace-pre-wrap break-words overflow-x-auto max-h-[600px] overflow-y-auto">{song.original_content}</pre>
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
                  <div key={rev.id} className="text-xs py-1 text-muted-foreground border-b border-border last:border-b-0">
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

        <ConfirmDialog
          open={dialogState.kind === 'delete'}
          onOpenChange={(open) => { if (!open) setDialogState({ kind: 'none' }); }}
          title="Delete Song"
          description="Are you sure you want to delete this song? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (dialogState.kind === 'delete') handleDeleteConfirmed(dialogState.songId);
          }}
        />
      </div>
    );
  }

  // --- Loading ---
  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Spinner />
        <span className="text-sm">Loading songs...</span>
      </div>
    );
  }

  // --- Song List ---
  if (songs.length === 0) {
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
        <div className="flex gap-2">
          <Input
            placeholder="Search songs by title or artist..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-card flex-1"
          />
          <Select
            className="w-auto py-2 px-2 text-xs"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="date">Date</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="status">Status</option>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortDir === 'asc' ? '\u2191' : '\u2193'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center overflow-x-auto">
          {hasFolders && (
            <button
              className={cn(
                FOLDER_PILL_CLASS,
                activeFolder === null && FOLDER_PILL_ACTIVE
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
                FOLDER_PILL_CLASS,
                activeFolder === f && FOLDER_PILL_ACTIVE,
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
                FOLDER_PILL_CLASS,
                activeFolder === '__unfiled__' && FOLDER_PILL_ACTIVE,
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
            onDragOver={(e: DragEvent<HTMLButtonElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault();
              const songId = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (!songId) return;
              const song = songs.find(s => s.id === songId);
              if (song) setDialogState({ kind: 'newFolder', song });
            }}
            title="Create new folder"
            aria-label="Create new folder"
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
          <Button variant="danger" size="sm" onClick={handleBulkDeleteRequest}>Delete Selected</Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sortedSongs.map(song => {
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
              draggable={!selectMode || undefined}
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
                    onDelete={handleDeleteRequest}
                    onRename={handleRenameRequest}
                    onEdit={onLoadSong}
                    onReopen={handleReopen}
                    folders={folders}
                    onMoveToFolder={handleMoveToFolder}
                    onMoveToNewFolder={handleMoveToNewFolder}
                  />
                </div>
              </div>
            </Card>
          );
        })}
        {sortedSongs.length === 0 && songs.length > 0 && (
          <div className="text-center py-16 px-8 text-muted-foreground">
            {activeFolder && !searchQuery ? (
              <p>No songs in this folder yet. Use the &hellip; menu on a song to move it here, or drag songs onto the folder tab.</p>
            ) : (
              <p>No songs match your search.</p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialogState.kind === 'delete'}
        onOpenChange={(open) => { if (!open) setDialogState({ kind: 'none' }); }}
        title="Delete Song"
        description="Are you sure you want to delete this song? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (dialogState.kind === 'delete') handleDeleteConfirmed(dialogState.songId);
        }}
      />

      <ConfirmDialog
        open={dialogState.kind === 'bulkDelete'}
        onOpenChange={(open) => { if (!open) setDialogState({ kind: 'none' }); }}
        title="Delete Songs"
        description={dialogState.kind === 'bulkDelete' ? `Are you sure you want to delete ${dialogState.count} selected song${dialogState.count > 1 ? 's' : ''}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDeleteConfirmed}
      />

      <PromptDialog
        open={dialogState.kind === 'rename'}
        onOpenChange={(open) => { if (!open) setDialogState({ kind: 'none' }); }}
        title="Rename Song"
        fields={renameFields}
        confirmLabel="Save"
        onConfirm={(values) => {
          if (dialogState.kind === 'rename') handleRenameConfirmed(dialogState.song, values);
        }}
      />

      <PromptDialog
        open={dialogState.kind === 'newFolder'}
        onOpenChange={(open) => { if (!open) setDialogState({ kind: 'none' }); }}
        title="New Folder"
        fields={newFolderFields}
        confirmLabel="Create"
        onConfirm={(values) => {
          handleNewFolderConfirmed(values, dialogState.kind === 'newFolder' ? dialogState.song : undefined);
        }}
      />
    </div>
  );
}
