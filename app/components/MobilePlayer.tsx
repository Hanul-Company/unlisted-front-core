'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Mic2, CheckCircle, ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, Zap, ListMusic, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ShareButton from './ui/ShareButton';
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
  isLiked?: boolean;     // 렌탈(Collect) 유효 기간 내이면 true (부모에서 계산해서 넘겨줌)
  isRented?: boolean;    // 프리뷰 제한 해제용 (보통 isLiked와 같음)
  isOwner?: boolean;     // 창작자 본인 여부
  
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
  // ✅ [NEW] 가사 보기 상태
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);

  // 프리뷰 제한 로직 (Owner거나 Rented면 제한 없음)
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
        // 1) [ ... ] 통째로 제거 (줄 중간/여러개도 제거)
        .replace(/\[[^\]]*?\]/g, "")
        // 2) 공백/탭 정리 (선택)
        .replace(/[ \t]+\n/g, "\n")
        // 3) 너무 많은 빈 줄 줄이기 (선택)
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
            <header className="flex justify-between items-center p-6 z-50 h-20 shrink-0 relative">
                <button onClick={onClose} className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition">
                    <ChevronDown size={24}/>
                </button>
                
                {/* Center Badges */}
                <div className="flex items-center gap-2">
                    <div className="bg-cyan-500/10 px-3 py-1 rounded-full text-[10px] font-bold text-cyan-500 border border-cyan-500/20 flex items-center gap-1">
                        <ListMusic size={10}/> NOW PLAYING
                    </div>
                    
                    {/* ✅ [수정] Lyrics Text Button */}
                    <button 
                        onClick={() => setShowLyrics(!showLyrics)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition border flex items-center gap-1 ${
                            showLyrics 
                            ? 'bg-white text-black border-white' 
                            : 'bg-black/20 text-zinc-400 border-white/5 hover:text-white hover:border-white/20'
                        }`}
                    >
                        Lyrics
                    </button>
                </div>

                <div className="w-10 h-10 flex items-center justify-center">
                    <ShareButton assetId={track.id.toString()} trackData={{ title: track.title, artist: track.artist?.username, coverUrl: track.cover_image_url || "" }} className="bg-black/5 backdrop-blur-md border border-white/15"/>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 w-full h-full pb-10 relative z-10">
                <div className="flex flex-col items-center w-full max-w-sm">
                    
                    {/* ✅ Album Art OR Lyrics Container */}
                    <div className="relative group w-full aspect-square mb-8">
                        
                        {/* 1. Lyrics View */}
                        {showLyrics ? (
                            <div className="w-full h-full bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden relative z-20 animate-in fade-in zoom-in duration-300">
                                {/* ✅ [핵심] absolute inset-0 + overflow-y-auto 로 스크롤 영역 확보 
                                    pb-20: 하단 프로그레스 바에 가려지지 않게 여백 추가
                                */}
                                <div className="absolute inset-0 overflow-y-auto p-6 pb-20 text-center custom-scrollbar">
                                    {track.lyrics ? (
                                        <p className="text-lg md:text-xl font-medium leading-relaxed text-zinc-200 whitespace-pre-wrap">
                                            {sanitizeLyrics(track.lyrics)}
                                        </p>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3 opacity-70">
                                            <Mic2 size={32} strokeWidth={1.5} />
                                            <p className="text-sm font-medium">No lyrics available for this track.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* 2. Album Art View */
                            <div className={`w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                                {track.cover_image_url ? ( <img src={track.cover_image_url} className="w-full h-full object-cover"/> ) : ( <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700">No Image</div> )}
                                
                                {!isRented && !isOwner && (
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-lg">
                                        <Lock size={10} className="text-zinc-400"/> Preview
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Progress Bar (Visible in both views) */}
                        <div className="absolute -bottom-10 left-0 right-0 z-30">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1">
                                <span>{formatTime(currentTime)}</span>
                                <span className={!isRented && !isOwner ? "text-purple-400" : ""}>
                                    {!isRented && !isOwner ? "1:00" : formatTime(duration)}
                                </span>
                            </div>
                            
                            <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm relative group/seek">
                                 {!isRented && !isOwner && (
                                    <div className="absolute top-0 left-0 h-full bg-purple-500/20 z-0" style={{ width: `${previewWidthPercent}%` }} />
                                 )}
                                <div className="h-full bg-white rounded-full relative shadow-[0_0_10px_white] z-10" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform"/>
                                </div>
                                <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeekChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30" />
                            </div>
                        </div>
                    </div>

                    {/* Title & Info */}
                    <div className="text-center space-y-1 mb-8 w-full mt-6">
                        <h2 className="text-2xl font-black tracking-tight truncate text-white">{track.title}</h2>
                        
                        {/* ✅ [수정] 아티스트 클릭 시 플레이어 닫기 (onClose 추가) */}
                        <Link 
                            href={`/u?wallet=${track.artist?.wallet_address}`} 
                            onClick={onClose} // 👈 이 부분 추가!
                            className="text-sm font-medium text-zinc-400 hover:text-white hover:underline transition"
                        >
                            {track.artist?.username}
                        </Link>
                    </div>

                    {/* Controls */}
                    <div className="w-full">
                        <div className="flex items-center justify-between px-2 mb-8">
                            <button onClick={onToggleShuffle} className={`p-2 transition ${isShuffle ? 'text-blue-500' : 'text-zinc-600'}`}><Shuffle size={20}/></button>
                            <button onClick={onPrev} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md"><SkipBack size={24}/></button>
                            <button onClick={onPlayPause} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                {isPlaying ? <Pause size={28} fill="black"/> : <Play size={28} fill="black" className="ml-1"/>}
                            </button>
                            <button onClick={onNext} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md"><SkipForward size={24}/></button>
                            <button onClick={onToggleRepeat} className={`p-2 transition ${repeatMode !== 'off' ? 'text-blue-500' : 'text-zinc-600'}`}>
                                {repeatMode === 'one' ? <Repeat1 size={20}/> : <Repeat size={20}/>}
                            </button>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-center items-center gap-4">
                                {!isOwner && (
                                    <button onClick={onToggleLike} className={`flex items-center gap-2 px-6 py-3 rounded-full border transition backdrop-blur-md ${isLiked ? 'bg-pink-500/10 border-pink-500/50 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white'}`}>
                                        <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                                        <span className="text-sm font-bold">{isLiked ? 'Liked' : 'Like'}</span>
                                    </button>
                                )}
                                {onInvest && (
                                    <button onClick={onInvest} className="flex items-center gap-2 text-black bg-white hover:bg-zinc-200 px-6 py-3 rounded-full font-bold tracking-wide text-sm transition shadow-lg">
                                        <Zap size={16} fill="black" /> <span>Invest</span>
                                    </button>
                                )}
                        </div>

                        {/* Messages */}
                        {isOwner && ( <p className="text-center text-[10px] text-cyan-600 mt-4 font-bold flex items-center justify-center gap-1"><CheckCircle size={12}/> You are the creator of this track</p> )}
                        {!isRented && !isOwner && ( <p className="text-center text-[10px] text-zinc-600 mt-4 animate-pulse">Preview Mode • Like to listen full track</p> )}
                    </div>
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
}