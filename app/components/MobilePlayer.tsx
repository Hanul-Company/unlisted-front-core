'use client';

import React from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobilePlayerProps {
  track: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void; 
  repeatMode: 'off' | 'all' | 'one';
  onToggleRepeat: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export default function MobilePlayer({ 
    track, isPlaying, onPlayPause, onNext, onPrev, onClose,
    repeatMode, onToggleRepeat, isShuffle, onToggleShuffle,
    currentTime, duration, onSeek
}: MobilePlayerProps) {

  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <AnimatePresence>
        <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col md:hidden"
        >
            {/* 1. Header (Compact) */}
            <div className="flex justify-between items-center p-4">
                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                    <ChevronDown size={28}/>
                </button>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Now Playing</span>
                <div className="w-10"/> 
            </div>

            {/* 2. Album Art (Reduced Size for Mobile) */}
            <div className="flex-1 flex items-center justify-center p-4">
                {/* [수정] w-full -> w-64 (약 70% 수준으로 축소) */}
                <div className="w-64 h-64 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative">
                    {track.cover_image_url ? (
                        <img src={track.cover_image_url} className="w-full h-full object-cover"/>
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700">No Image</div>
                    )}
                </div>
            </div>

            {/* 3. Controls Area (Compact) */}
            <div className="p-6 pb-10 space-y-6 bg-gradient-to-t from-black to-zinc-900/50">
                
                {/* Title */}
                <div className="text-center">
                    <h2 className="text-2xl font-black text-white mb-1 truncate px-4">{track.title}</h2>
                    <p className="text-sm text-zinc-400 truncate">{track.artist_name}</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <input 
                        type="range" 
                        min={0} max={duration || 100} 
                        value={currentTime}
                        onChange={(e) => onSeek(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono px-1">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Buttons (Smaller) */}
                <div className="flex items-center justify-between px-2">
                    <button onClick={onToggleShuffle} className={`p-2 transition ${isShuffle ? 'text-green-500' : 'text-zinc-600'}`}>
                        <Shuffle size={20}/>
                    </button>

                    <button onClick={onPrev} className="p-2 text-zinc-200 hover:text-white transition">
                        <SkipBack size={28}/>
                    </button>

                    <button 
                        onClick={onPlayPause} 
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 transition"
                    >
                        {isPlaying ? <Pause size={28} fill="black"/> : <Play size={28} fill="black" className="ml-1"/>}
                    </button>

                    <button onClick={onNext} className="p-2 text-zinc-200 hover:text-white transition">
                        <SkipForward size={28}/>
                    </button>

                    <button onClick={onToggleRepeat} className={`p-2 transition ${repeatMode !== 'off' ? 'text-green-500' : 'text-zinc-600'}`}>
                        {repeatMode === 'one' ? <Repeat1 size={20}/> : <Repeat size={20}/>}
                    </button>
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
}