'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, Zap, ListMusic, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
  isRented?: boolean; // ✅ 렌탈 여부 추가
  onToggleLike?: () => void;
  onInvest?: () => void;
}

export default function MobilePlayer({ 
    track, isPlaying, onPlayPause, onNext, onPrev, onClose,
    repeatMode, onToggleRepeat, isShuffle, onToggleShuffle,
    currentTime, duration, onSeek,
    isLiked, isRented, onToggleLike, onInvest
}: MobilePlayerProps) {

  const PREVIEW_LIMIT = 60; // 1분 미리듣기 제한
  const toastShownRef = useRef(false);

  // [로직] 렌탈 안 했을 때 1분 제한 체크
  useEffect(() => {
    if (!isRented && currentTime >= PREVIEW_LIMIT) {
      if (!toastShownRef.current) {
        toast("Preview ended. Rent to listen full track!", { 
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

  // [UI 계산] 미리듣기 구간 너비
  const previewWidthPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min((PREVIEW_LIMIT / duration) * 100, 100);
  }, [duration]);

  // [UI 포맷] 시간 표시
  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // [핸들러] Seek바 조작 시 제한
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      // 렌탈 안 했는데 60초 넘어가면 차단
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
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
        >
            {/* 1. Header */}
            <header className="flex justify-between items-center p-6 z-50">
                <button 
                    onClick={onClose} 
                    className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
                >
                    <ChevronDown size={24}/>
                </button>
                
                <div className="bg-cyan-500/10 px-3 py-1 rounded-full text-[10px] font-bold text-cyan-500 border border-cyan-500/20 flex items-center gap-1">
                     <ListMusic size={10}/> NOW PLAYING
                </div>
                
                <div className="w-10" />
            </header>

            {/* 2. Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 relative">
                
                {/* Album Art & Progress Bar Group */}
                <div className="relative group w-full max-w-[320px]">
                    {/* 앨범 아트 */}
                    <div className={`w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                        {track.cover_image_url ? (
                            <img src={track.cover_image_url} className="w-full h-full object-cover"/>
                        ) : (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700">No Image</div>
                        )}
                        
                        {/* ✅ [추가] Preview Mode 배지 (렌탈 안 했을 때) */}
                        {!isRented && (
                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-lg">
                                <Lock size={10} className="text-zinc-400"/> Preview
                            </div>
                        )}
                    </div>

                    {/* Progress Bar (Detached Style) */}
                    <div className="absolute -bottom-12 left-0 right-0 z-20">
                        {/* 시간 표시 */}
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1">
                            <span>{formatTime(currentTime)}</span>
                            {/* 렌탈 여부에 따라 전체 시간 텍스트 색상 변경 */}
                            <span className={!isRented ? "text-purple-400" : ""}>
                                {!isRented ? "1:00" : formatTime(duration)}
                            </span>
                        </div>
                        
                        {/* 실제 바 (Visual + Interactive) */}
                        <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm relative group/seek">
                             
                             {/* ✅ [추가] 미리듣기 제한 구간 표시 (보라색 배경) */}
                             {!isRented && (
                                <div 
                                    className="absolute top-0 left-0 h-full bg-purple-500/20 z-0"
                                    style={{ width: `${previewWidthPercent}%` }}
                                />
                             )}

                             {/* 재생 진행 바 */}
                            <div
                                className="h-full bg-white rounded-full relative shadow-[0_0_10px_white] z-10"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            >
                                {/* 드래그 핸들 */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform"/>
                            </div>

                            {/* 실제 클릭/드래그 Input */}
                            <input 
                                type="range" 
                                min={0} max={duration || 100} 
                                value={currentTime}
                                onChange={handleSeekChange} // 수정된 핸들러 사용
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                            />
                        </div>
                    </div>
                </div>

                {/* Title & Info */}
                <div className="text-center space-y-2 mt-8 w-full px-8">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight truncate text-white">
                        {track.title}
                    </h2>
                    <p className="text-zinc-400 text-sm font-medium truncate">
                        {track.artist_name}
                    </p>
                </div>

                {/* Controls */}
                <div className="w-full max-w-sm">
                    {/* Main Controller Row */}
                    <div className="flex items-center justify-between px-2 mb-8">
                        <button onClick={onToggleShuffle} className={`p-2 transition ${isShuffle ? 'text-green-500' : 'text-zinc-600'}`}>
                            <Shuffle size={20}/>
                        </button>

                        <button onClick={onPrev} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md">
                            <SkipBack size={24}/>
                        </button>

                        <button 
                            onClick={onPlayPause} 
                            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                        >
                            {isPlaying ? <Pause size={32} fill="black"/> : <Play size={32} fill="black" className="ml-1"/>}
                        </button>

                        <button onClick={onNext} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition backdrop-blur-md">
                            <SkipForward size={24}/>
                        </button>

                        <button onClick={onToggleRepeat} className={`p-2 transition ${repeatMode !== 'off' ? 'text-green-500' : 'text-zinc-600'}`}>
                            {repeatMode === 'one' ? <Repeat1 size={20}/> : <Repeat size={20}/>}
                        </button>
                    </div>

                    {/* Bottom Actions Row (Like & Invest) */}
                    <div className="flex justify-center items-center gap-6">
                         {/* Like Button (여기서 좋아요 누르면 -> MarketPage에서 렌탈 모달 띄우는 로직으로 연결됨) */}
                         <button 
                            onClick={onToggleLike}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition backdrop-blur-md ${
                                isLiked 
                                ? 'bg-pink-500/10 border-pink-500/50 text-pink-500' 
                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-white'
                            }`}
                        >
                            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                            <span className="text-xs font-bold">{isLiked ? 'Liked' : 'Like'}</span>
                        </button>

                        {onInvest && (
                            <button 
                                onClick={onInvest}
                                className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 font-bold tracking-widest text-xs uppercase hover:underline transition"
                            >
                                <Zap size={14} fill="currentColor" />
                                <span>Invest</span>
                            </button>
                        )}
                    </div>
                    
                    {/* 렌탈 안 했을 때 안내 메시지 (옵션) */}
                    {!isRented && (
                        <p className="text-center text-[10px] text-zinc-600 mt-6 animate-pulse">
                            Preview Mode • Like or Rent to listen full track
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    </AnimatePresence>
  );
}