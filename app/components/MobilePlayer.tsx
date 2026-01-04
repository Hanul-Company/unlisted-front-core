'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, Zap, ListMusic, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ShareButton from './ui/ShareButton';

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
  isLiked?: boolean;
  isRented?: boolean;
  onToggleLike?: () => void;
  onInvest?: () => void;
}

export default function MobilePlayer({ 
    track, isPlaying, onPlayPause, onNext, onPrev, onClose,
    repeatMode, onToggleRepeat, isShuffle, onToggleShuffle,
    currentTime, duration, onSeek,
    isLiked, isRented, onToggleLike, onInvest
}: MobilePlayerProps) {

  const PREVIEW_LIMIT = 60;
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!isRented && currentTime >= PREVIEW_LIMIT) {
      if (!toastShownRef.current) {
        toast("Preview ended. Collect to listen full track!", { 
            icon: "🔒",
            id: "preview-end-toast",
            style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
        toastShownRef.current = true;
      }
    } else if (currentTime < PREVIEW_LIMIT - 1) {
      toastShownRef.current = false;
    }
  }, [currentTime, isRented]);

  const previewWidthPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min((PREVIEW_LIMIT / duration) * 100, 100);
  }, [duration]);

  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (!isRented && val > PREVIEW_LIMIT) {
          toast.error("Preview limited to 1 minute");
          onSeek(PREVIEW_LIMIT);
      } else {
          onSeek(val);
      }
  };

  return (
    <AnimatePresence>
        <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            // ✅ [복구] 너비 제한 제거 (전체 화면 꽉 차게)
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
        >
            {/* 1. Header (상단 고정) */}
            <header className="flex justify-between items-center p-6 z-50 h-20 shrink-0">
                <button 
                    onClick={onClose} 
                    className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
                >
                    <ChevronDown size={24}/>
                </button>
                
                <div className="bg-cyan-500/10 px-3 py-1 rounded-full text-[10px] font-bold text-cyan-500 border border-cyan-500/20 flex items-center gap-1">
                     <ListMusic size={10}/> NOW PLAYING
                </div>
                
                <div className="w-10 h-10 flex items-center justify-center">
                    <ShareButton 
                        assetId={track.id.toString()}
                        trackData={{
                            title: track.title,
                            artist: track.artist_name,
                            coverUrl: track.cover_image_url || ""
                        }}
                        className="bg-black/20 backdrop-blur-md border border-white/5"
                    />
                </div>
            </header>

            {/* 2. Main Content Wrapper (가운데 정렬의 핵심) */}
            {/* flex-1: 남은 공간 다 차지
               justify-center: 내용물(앨범+텍스트+컨트롤)을 수직 중앙에 배치
               items-center: 수평 중앙
            */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 w-full h-full pb-10">
                
                {/* Content Cluster */}
                <div className="flex flex-col items-center w-full max-w-sm">
                    
                    {/* Album Art Area */}
                    <div className="relative group w-full aspect-square mb-8">
                        {/* Cover Image */}
                        <div className={`w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                            {track.cover_image_url ? (
                                <img src={track.cover_image_url} className="w-full h-full object-cover"/>
                            ) : (
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700">No Image</div>
                            )}
                            
                            {!isRented && (
                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-lg">
                                    <Lock size={10} className="text-zinc-400"/> Preview
                                </div>
                            )}
                        </div>

                        {/* Progress Bar (Attached to Album Art) */}
                        <div className="absolute -bottom-10 left-0 right-0 z-20">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1">
                                <span>{formatTime(currentTime)}</span>
                                <span className={!isRented ? "text-purple-400" : ""}>
                                    {!isRented ? "1:00" : formatTime(duration)}
                                </span>
                            </div>
                            
                            <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm relative group/seek">
                                 {!isRented && (
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-purple-500/20 z-0"
                                        style={{ width: `${previewWidthPercent}%` }}
                                    />
                                 )}
                                <div
                                    className="h-full bg-white rounded-full relative shadow-[0_0_10px_white] z-10"
                                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform"/>
                                </div>
                                <input 
                                    type="range" 
                                    min={0} max={duration || 100} 
                                    value={currentTime}
                                    onChange={handleSeekChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Title & Info */}
                    <div className="text-center space-y-1 mb-8 w-full mt-6">
                        <h2 className="text-2xl font-black tracking-tight truncate text-white">
                            {track.title}
                        </h2>
                        <p className="text-zinc-400 text-sm font-medium truncate">
                            {track.artist_name}
                        </p>
                    </div>

                    {/* Controls */}
                    {/* ✅ [핵심] mt-auto 제거. 이제 바로 위에 붙어서 중앙 정렬됨 */}
                    <div className="w-full">
                        {/* Buttons Row */}
                        <div className="flex items-center justify-between px-2 mb-8">
                            <button onClick={onToggleShuffle} className={`p-2 transition ${isShuffle ? 'text-green-500' : 'text-zinc-600'}`}>
                                <Shuffle size={20}/>
                            </button>

                            <button onClick={onPrev} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md">
                                <SkipBack size={24}/>
                            </button>

                            <button 
                                onClick={onPlayPause} 
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                {isPlaying ? <Pause size={28} fill="black"/> : <Play size={28} fill="black" className="ml-1"/>}
                            </button>

                            <button onClick={onNext} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md">
                                <SkipForward size={24}/>
                            </button>

                            <button onClick={onToggleRepeat} className={`p-2 transition ${repeatMode !== 'off' ? 'text-green-500' : 'text-zinc-600'}`}>
                                {repeatMode === 'one' ? <Repeat1 size={20}/> : <Repeat size={20}/>}
                            </button>
                        </div>

                        {/* Actions (Like/Invest) */}
                        <div className="flex justify-center items-center gap-4">
                             <button 
                                onClick={onToggleLike}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full border transition backdrop-blur-md ${
                                    isLiked 
                                    ? 'bg-pink-500/10 border-pink-500/50 text-pink-500' 
                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white'
                                }`}
                            >
                                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                                <span className="text-sm font-bold">{isLiked ? 'Liked' : 'Like'}</span>
                            </button>

                            {onInvest && (
                                <button 
                                    onClick={onInvest}
                                    className="flex items-center gap-2 text-black bg-white hover:bg-zinc-200 px-6 py-3 rounded-full font-bold tracking-wide text-sm transition shadow-lg"
                                >
                                    <Zap size={16} fill="black" />
                                    <span>Invest</span>
                                </button>
                            )}
                        </div>
                        
                        {!isRented && (
                            <p className="text-center text-[10px] text-zinc-600 mt-4 animate-pulse">
                                Preview Mode • Collect to listen full track
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
}