'use client';

import React, { useMemo, useState } from 'react';
import { X, Heart, ListMusic, Plus, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface PlaylistSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;

  playlists: { id: string; name: string }[];

  // 선택 시 실행 (여기서 collect + playlist_items upsert 처리)
  onSelect: (playlistId: string | 'liked') => void;

  // ✅ 추가: 모달 내부에서 커스텀 플레이리스트 생성
  // 생성 성공 시 playlistId 리턴
  onCreatePlaylist?: (name: string) => Promise<string | null>;
}

export default function PlaylistSelectionModal({
  isOpen,
  onClose,
  playlists,
  onSelect,
  onCreatePlaylist,
}: PlaylistSelectionModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = !!onCreatePlaylist;

  const sortedPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => a.name.localeCompare(b.name));
  }, [playlists]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!onCreatePlaylist) return;
    const name = newName.trim();
    if (!name) return toast.error('Enter playlist name');

    setCreating(true);
    try {
      const newId = await onCreatePlaylist(name);
      if (!newId) return;

      // ✅ 만들자마자 그 플레이리스트로 선택(추가)까지
      await onSelect(newId);

      setNewName('');
      setIsCreating(false);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-white">Add to Playlist</h3>

          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={() => setIsCreating((v) => !v)}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300"
                aria-label="Create playlist"
                title="Create playlist"
              >
                <Plus size={18} />
              </button>
            )}
            <button onClick={onClose} aria-label="Close">
              <X size={20} className="text-zinc-500 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Create playlist inline */}
        {canCreate && isCreating && (
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                  }
                }}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-3 py-2 rounded-lg bg-white text-black font-bold disabled:opacity-50"
              >
                {creating ? '...' : <Check size={16} />}
              </button>
            </div>
            <div className="text-[11px] text-zinc-500 mt-2">
              Create and add the track immediately.
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-2 space-y-1">
          {/* Liked Songs */}
          <button
            onClick={async () => {
              await onSelect('liked');
              onClose();
            }}
            className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left group"
          >
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-500 rounded flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">Liked Songs</div>
              <div className="text-xs text-zinc-500">Default Collection</div>
            </div>
          </button>

          <div className="h-px bg-zinc-800 my-2 mx-2" />

          {/* Custom playlists */}
          {sortedPlaylists.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                await onSelect(p.id);
                onClose();
              }}
              className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                <ListMusic size={20} className="text-zinc-400" />
              </div>
              <div className="font-bold text-sm text-white">{p.name}</div>
            </button>
          ))}

          {sortedPlaylists.length === 0 && (
            <div className="p-4 text-center text-zinc-500 text-xs">
              No custom playlists found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
