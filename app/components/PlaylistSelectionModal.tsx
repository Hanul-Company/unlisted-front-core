'use client';

import React from 'react';
import { X, Heart, ListMusic } from 'lucide-react';

interface PlaylistSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: any[]; // 플레이리스트 데이터 배열
  onSelect: (playlistId: string | 'liked') => void; // 선택 시 실행될 함수 (processCollect)
}

export default function PlaylistSelectionModal({
  isOpen,
  onClose,
  playlists,
  onSelect
}: PlaylistSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-white">Add to Playlist</h3>
          <button onClick={onClose} aria-label="Close">
            <X size={20} className="text-zinc-500 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-2 space-y-1">
          {/* 1. Liked Songs (기본) */}
          <button 
            onClick={() => onSelect('liked')} 
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

          {/* 2. User Playlists */}
          {playlists.map((p) => (
            <button 
              key={p.id} 
              onClick={() => onSelect(p.id)} 
              className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                <ListMusic size={20} className="text-zinc-400" />
              </div>
              <div className="font-bold text-sm text-white">{p.name}</div>
            </button>
          ))}

          {playlists.length === 0 && (
            <div className="p-4 text-center text-zinc-500 text-xs">
              No custom playlists found.
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}