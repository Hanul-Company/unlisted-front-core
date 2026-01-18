'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Mic2, CheckCircle, ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, Zap, ListMusic, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ShareButton from './ui/ShareButton'; // ShareButton 내부 로직 활용
import { Link } from "@/lib/i18n";

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
  
  // 상태값
  isLiked?: boolean;     
  isRented?: boolean;    
  isOwner?: boolean;     
  
  // 핸들러
  onToggleLike?: () => void;
  onInvest?: () => void;
}

export default function MobilePlayer({ 
    track, isPlaying, onPlayPause, onNext, onPrev, onClose,
    repeatMode, onToggleRepeat, isShuffle, onToggleShuffle,
    currentTime, duration, onSeek,
    isLiked, isRented, isOwner, 
    onToggleLike, onInvest
}: MobilePlayerProps) {

  const PREVIEW_LIMIT = 60;
  const toastShownRef = useRef(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // 프리뷰 제한 로직
  useEffect(() => {
    if (!isRented && !isOwner && currentTime >= PREVIEW_LIMIT) { 
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
  }, [currentTime, isRented, isOwner]);

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
      if (!isRented && !isOwner && val > PREVIEW_LIMIT) { 
          toast.error("Preview limited to 1 minute");
          onSeek(PREVIEW_LIMIT);
      } else {
          onSeek(val);
      }
  };

    const sanitizeLyrics = (lyrics?: string | null) => {
    if (!lyrics) return "";
    return (
        lyrics
        .replace(/\[[^\]]*?\]/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
    };

return (
    <AnimatePresence>
        <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
        >
            {/* Background Blur */}
            <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
                <img src={track.cover_image_url || ''} className="w-full h-full object-cover blur-3xl scale-150" />
                <div className="absolute inset-0 bg-zinc-950/80" />
            </div>

            {/* Header */}
            <header className="flex justify-between items-center px-6 py-4 z-50 shrink-0 relative">
                <button onClick={onClose} className="w-8 h-8 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition">
                    <ChevronDown size={20}/>
                </button>
                
                {/* Center Badges */}
                <div className="flex items-center gap-2">
                    <div className="bg-cyan-500/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-cyan-500 border border-cyan-500/20 flex items-center gap-1">
                        <ListMusic size={9}/> PLAYING
                    </div>
                    
                    <button 
                        onClick={() => setShowLyrics(!showLyrics)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition border flex items-center gap-1 ${
                            showLyrics 
                            ? 'bg-white text-black border-white' 
                            : 'bg-black/20 text-zinc-400 border-white/5 hover:text-white hover:border-white/20'
                        }`}
                    >
                        Lyrics
                    </button>
                </div>

                {/* ✅ [수정] ShareButton 하나로 통합 (내부에 드롭다운 로직 포함됨) */}
                <div className="w-8 h-8 flex items-center justify-center">
                    <ShareButton 
                        assetId={track.id.toString()} 
                        trackData={{ 
                            title: track.title, 
                            artist: track.artist?.username, 
                            coverUrl: track.cover_image_url, 
                            audioUrl: track.audio_url || "" 
                        }} 
                        className="bg-black/5 backdrop-blur-md"
                        size={16} // 사이즈 줄임
                    />
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 w-full h-full pb-8 relative z-10">
                <div className="flex flex-col items-center w-full max-w-[320px]"> {/* max-w 줄여서 전체적으로 슬림하게 */}
                    
                    {/* ✅ [수정] Album Art Size (85% 느낌으로 조정) */}
                    <div className="relative group w-[85%] aspect-square mb-8 mx-auto">
                        
                        {/* 1. Lyrics View */}
                        {showLyrics ? (
                            <div className="w-full h-full bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden relative z-20 animate-in fade-in zoom-in duration-300">
                                <div className="absolute inset-0 overflow-y-auto p-5 pb-16 text-center custom-scrollbar">
                                    {track.lyrics ? (
                                        <p className="text-base font-medium leading-relaxed text-zinc-200 whitespace-pre-wrap">
                                            {sanitizeLyrics(track.lyrics)}
                                        </p>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 opacity-70">
                                            <Mic2 size={24} strokeWidth={1.5} />
                                            <p className="text-xs font-medium">No lyrics available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* 2. Album Art View */
                            <div className={`w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                                {track.cover_image_url ? ( <img src={track.cover_image_url} className="w-full h-full object-cover"/> ) : ( <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700">No Image</div> )}
                                
                                {!isRented && !isOwner && (
                                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[9px] font-bold text-white border border-white/10 flex items-center gap-1 shadow-lg">
                                        <Lock size={9} className="text-zinc-400"/> Preview
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title & Info */}
                    <div className="text-center space-y-1 mb-6 w-full px-2">
                        <h2 className="text-xl font-black tracking-tight truncate text-white">{track.title}</h2>
                        <Link 
                            href={`/u?wallet=${track.artist?.wallet_address}`} 
                            onClick={onClose} 
                            className="text-xs font-medium text-zinc-400 hover:text-white hover:underline transition"
                        >
                            {track.artist?.username}
                        </Link>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full mb-6">
                         <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm relative group/seek">
                             {!isRented && !isOwner && (
                                <div className="absolute top-0 left-0 h-full bg-purple-500/20 z-0" style={{ width: `${previewWidthPercent}%` }} />
                             )}
                            <div className="h-full bg-white rounded-full relative shadow-[0_0_8px_white] z-10" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform"/>
                            </div>
                            <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeekChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30" />
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-1.5 px-0.5">
                            <span>{formatTime(currentTime)}</span>
                            <span className={!isRented && !isOwner ? "text-purple-400" : ""}>
                                {!isRented && !isOwner ? "1:00" : formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* ✅ [수정] Controls (사이즈 축소) */}
                    <div className="w-full">
                        <div className="flex items-center justify-between px-4 mb-6">
                            <button onClick={onToggleShuffle} className={`p-1.5 transition ${isShuffle ? 'text-blue-500' : 'text-zinc-600'}`}><Shuffle size={16}/></button>
                            
                            <div className="flex items-center gap-4">
                                <button onClick={onPrev} className="w-10 h-10 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md active:scale-95"><SkipBack size={20}/></button>
                                <button onClick={onPlayPause} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-95">
                                    {isPlaying ? <Pause size={24} fill="black"/> : <Play size={24} fill="black" className="ml-1"/>}
                                </button>
                                <button onClick={onNext} className="w-10 h-10 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md active:scale-95"><SkipForward size={20}/></button>
                            </div>

                            <button onClick={onToggleRepeat} className={`p-1.5 transition ${repeatMode !== 'off' ? 'text-blue-500' : 'text-zinc-600'}`}>
                                {repeatMode === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}
                            </button>
                        </div>

                        {/* ✅ [수정] Action Buttons (사이즈 축소) */}
                        <div className="flex justify-center items-center gap-3">
                                {!isOwner && (
                                    <button onClick={onToggleLike} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full border transition backdrop-blur-md active:scale-95 ${isLiked ? 'bg-pink-500/10 border-pink-500/50 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.2)]' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white'}`}>
                                        <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
                                        <span className="text-xs font-bold">{isLiked ? 'Liked' : 'Like'}</span>
                                    </button>
                                )}
                                {onInvest && (
                                    <button onClick={onInvest} className="flex items-center gap-1.5 text-black bg-white hover:bg-zinc-200 px-5 py-2.5 rounded-full font-bold tracking-wide text-xs transition shadow-lg active:scale-95">
                                        <Zap size={14} fill="black" /> <span>Invest</span>
                                    </button>
                                )}
                        </div>

                        {/* Messages */}
                        {isOwner && ( <p className="text-center text-[9px] text-cyan-600 mt-4 font-bold flex items-center justify-center gap-1"><CheckCircle size={10}/> Creator Mode</p> )}
                        {!isRented && !isOwner && ( <p className="text-center text-[9px] text-zinc-600 mt-4 animate-pulse">Preview Mode</p> )}
                    </div>
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
}