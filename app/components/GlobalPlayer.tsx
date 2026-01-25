'use client';

import React, { useState, useEffect } from 'react';
import { usePlayer, Track } from '../context/PlayerContext';
import { supabase } from '@/utils/supabase';
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { 
  ChevronUp, ChevronDown, Disc, Heart, Pause, Play, Repeat, Repeat1, Shuffle, 
  SkipBack, SkipForward, Volume2, VolumeX, Zap, Minimize2, Maximize2, X 
} from 'lucide-react';

import MobilePlayer from './MobilePlayer';
import RentalModal from './RentalModal';
import TradeModal from './TradeModal';
import { useMediaSession } from '@/hooks/useMediaSession';

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function GlobalPlayer() {
  const { 
      currentTrack, isPlaying, togglePlay, next, prev, seek, 
      currentTime, duration, isShuffle, toggleShuffle, repeatMode, toggleRepeat,
      volume, setVolume, isMuted, toggleMute, audioRef
  } = usePlayer();

  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();

  // UI States
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false); // 풀 플레이어 열림 여부
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  
  // ✅ [상태 분리] 최소화 모드 (모바일: 동그라미 / PC: 우측 하단 플로팅 바)
  const [isMinimized, setIsMinimized] = useState(false);

  // Data States
  const [rentedTracksMap, setRentedTracksMap] = useState<Map<number, string>>(new Map());

  // ... (기존 데이터 페칭 및 헬퍼 로직 동일) ...
  const fetchUserData = async () => {
      if (!address) { setRentedTracksMap(new Map()); return; }
      
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
      if (profile) {
          const now = new Date().toISOString();
          const { data: collectionData } = await supabase
              .from('collections')
              .select('track_id, expires_at')
              .eq('profile_id', profile.id)
              .or(`expires_at.gt.${now},expires_at.is.null`);
          
          const newMap = new Map<number, string>();
          collectionData?.forEach((item: any) => {
              const dateStr = item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "Lifetime";
              newMap.set(item.track_id, dateStr);
          });
          setRentedTracksMap(newMap);
      }
  };

  useEffect(() => { fetchUserData(); }, [address, currentTrack]);

  useMediaSession({
    title: currentTrack?.title || "Unlisted",
    artist: currentTrack?.artist?.username || "Artist",
    coverUrl: currentTrack?.cover_image_url || "/images/default_cover.jpg",
    isPlaying: isPlaying,
    audioRef: audioRef,
    play: togglePlay,
    pause: togglePlay,
    next: next,
    prev: prev,
    seekTo: (time) => { if (audioRef.current) audioRef.current.currentTime = time; }
  });

  const isRented = rentedTracksMap.has(currentTrack?.id || 0);
  const isOwner = address && currentTrack?.uploader_address && (address.toLowerCase() === currentTrack.uploader_address.toLowerCase());
  const expiryDate = currentTrack ? rentedTracksMap.get(currentTrack.id) : null;

  const isRestricted = !isOwner && !isRented;
  const PREVIEW_LIMIT = 60; 
  const limitPercent = (duration && duration > PREVIEW_LIMIT && isRestricted) ? (PREVIEW_LIMIT / duration) * 100 : 100;

  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    if (!isRestricted) return; 

    if (currentTime >= PREVIEW_LIMIT) {
        if(isPlaying) togglePlay(); 
        if (audioRef.current) audioRef.current.currentTime = 0; 
        toast('Preview ended. Collect to listen full track!', { icon: '🔒' });
        setShowRentalModal(true);
    }
  }, [currentTime, isPlaying, isRestricted, currentTrack]);

  const handleOpenExtend = () => setShowRentalModal(true);
  
  const handleExtendConfirm = async (months: number, price: number) => {
    if (!currentTrack || !address) return;
    const toastId = toast.loading("Processing...");
    try {
        const { data: pmldRes } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', { p_wallet_address: address, p_track_id: currentTrack.id, p_duration_months: months });
        if (pmldRes === 'OK') { toast.success(`Collected with pMLD`, { id: toastId }); setShowRentalModal(false); await fetchUserData(); return; }
        if (pmldRes !== 'INSUFFICIENT_PMLD') throw new Error(String(pmldRes));
        
        if (price > 0) {
            const transaction = prepareContractCall({ contract: melodyTokenContract, method: "transfer", params: [currentTrack.uploader_address || "0x0000000000000000000000000000000000000000", parseEther(price.toString())] });
            await sendTransaction(transaction);
        }
        const { data: mldRes } = await supabase.rpc('add_to_collection_using_mld_by_wallet', { p_wallet_address: address, p_track_id: currentTrack.id, p_duration_months: months, p_amount_mld: price });
        if (mldRes !== 'OK') throw new Error(String(mldRes));
        
        toast.success(`Collected with MLD`, { id: toastId });
        setShowRentalModal(false);
        await fetchUserData();
    } catch (e: any) { console.error(e); toast.error(`Failed: ${e?.message || e}`, { id: toastId }); }
  };

  const handleInvest = () => setTrackToInvest(currentTrack);

  // Common Seek Logic
  const handleSeekCommon = (percent: number) => {
      if (!duration) return;
      let targetTime = percent * duration;
      if (isRestricted && targetTime > PREVIEW_LIMIT) { targetTime = PREVIEW_LIMIT; toast('Free preview is limited to 1 minute.', { icon: '🔒' }); }
      seek(targetTime);
  };

  const handleDesktopSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      handleSeekCommon(percent);
  };

  const handleMobileSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      handleSeekCommon(percent);
  };

  const formatTime = (time: number) => {
      if(isNaN(time)) return "0:00";
      const min = Math.floor(time / 60);
      const sec = Math.floor(time % 60);
      return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (!currentTrack) return null;

  return (
    <>
      {/* =======================================================
          1. Desktop UI (Footer & Floating)
         ======================================================= */}
      {/* 1-A. Desktop Minimized (Floating) */}
      {isMinimized && (
        <div className="hidden md:flex fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 zoom-in duration-300">
           <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-full p-1.5 pr-4 shadow-2xl hover:scale-105 transition-all group">
              <div onClick={() => setIsMinimized(false)} className="w-10 h-10 rounded-full overflow-hidden border border-zinc-600 cursor-pointer relative">
                 <img src={currentTrack.cover_image_url || "/images/default_cover.jpg"} className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}/>
                 <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Maximize2 size={16} className="text-white"/>
                 </div>
              </div>
              <div className="flex flex-col cursor-pointer" onClick={() => setIsMinimized(false)}>
                  <span className="text-xs font-bold text-white max-w-[100px] truncate">{currentTrack.title}</span>
                  <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">{currentTrack.artist?.username}</span>
              </div>
              <div className="h-4 w-px bg-zinc-700 mx-2"/>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-blue-400 transition">
                  {isPlaying ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
              </button>
           </div>
        </div>
      )}

      {/* 1-B. Desktop Full Footer (PC Only) */}
      {!mobilePlayerOpen && !isMinimized && (
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-[9999] shadow-2xl transition-transform duration-300">
          {/* Left */}
          <div className="flex items-center gap-4 w-1/3">
             <button onClick={() => setMobilePlayerOpen(true)} className="ml-2 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition"><ChevronUp size={20}/></button>
             <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative group">
                 {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700"/></div>}
                 <div onClick={() => setIsMinimized(true)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                    <Minimize2 size={20} className="text-white"/>
                 </div>
             </div>
             <div className="overflow-hidden">
                 <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                 <Link href={`/u?wallet=${currentTrack.artist?.wallet_address}`} className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist?.username}</Link>
             </div>
             {!isOwner && (
                 <button onClick={handleOpenExtend} className={`ml-2 hover:scale-110 transition ${isRented ? "text-pink-500" : "text-zinc-500 hover:text-white"}`}>
                     <Heart size={20} fill={isRented ? "currentColor" : "none"}/>
                 </button>
             )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="flex items-center gap-6">
                  <button onClick={toggleShuffle} className={`text-zinc-400 hover:text-white transition ${isShuffle ? 'text-blue-500' : ''}`}><Shuffle size={16}/></button>
                  <button onClick={prev} className="text-zinc-400 hover:text-white transition"><SkipBack size={20}/></button>
                  <button onClick={togglePlay} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                      {isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}
                  </button>
                  <button onClick={next} className="text-zinc-400 hover:text-white transition"><SkipForward size={20}/></button>
                  <button onClick={toggleRepeat} className={`text-zinc-400 hover:text-white transition ${repeatMode !== 'off' ? 'text-blue-500' : ''}`}>
                      {repeatMode === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}
                  </button>
              </div>
              <div className="w-full max-w-sm flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden relative cursor-pointer group" onClick={handleDesktopSeek}>
                      {isRestricted && duration && duration > PREVIEW_LIMIT && (
                        <>
                            <div className="absolute top-0 left-0 h-full bg-zinc-700" style={{ width: `${limitPercent}%` }} />
                            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${limitPercent}%` }} />
                        </>
                      )}
                      <div className="h-full bg-blue-500 rounded-full relative z-20 group-hover:bg-blue-400 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
              </div>
          </div>

          {/* Right */}
          <div className="w-1/3 flex justify-end items-center gap-4">
              {currentTrack.is_minted && (
                  <button onClick={handleInvest} className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-blue-500 hover:text-black transition flex items-center gap-1.5">
                      <Zap size={14} fill="currentColor"/> Invest
                  </button>
              )}
              <div className="w-px h-6 bg-zinc-800 mx-1"/>
              <button onClick={toggleMute} className="text-zinc-500 hover:text-white">{isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
              <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setVolume((e.clientX - rect.left) / rect.width); }}>
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }}/>
              </div>
              <button onClick={() => setIsMinimized(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition ml-2" title="Minimize Player">
                  <Minimize2 size={20}/>
              </button>
          </div>
      </div>
      )}

      {/* =======================================================
          2. Mobile UI (Footer vs Mini vs Full)
         ======================================================= */}
      
      {/* 2-A. Mobile Mini Player (Floating Circle) */}
      {/* 조건: 모바일 + Full 닫힘 + Minimized 상태 */}
      {!mobilePlayerOpen && isMinimized && (
          <div 
            className="md:hidden fixed bottom-24 right-4 z-[90] animate-in zoom-in slide-in-from-bottom-4 duration-300"
            // 동그라미 클릭 시 풀 플레이어로 확장 (state 리셋)
            onClick={() => { setMobilePlayerOpen(true); setIsMinimized(false); }}
          >
             <div className={`
                relative w-14 h-14 rounded-full overflow-hidden 
                border-2 border-zinc-800 shadow-2xl shadow-black/50 bg-black 
                ${isPlaying ? 'animate-spin-slow' : ''}
                active:scale-95 transition-transform cursor-pointer
             `}>
                 {/* 앨범 아트만 표시 (No Text, No Buttons) */}
                 {currentTrack.cover_image_url ? (
                    <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" alt="Mini Player"/>
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Disc className="text-zinc-600" size={24} />
                    </div>
                 )}
                 {isPlaying && ( <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 pointer-events-none" /> )}
             </div>
          </div>
      )}

      {/* 2-B. Mobile Footer Player (Standard Bar) */}
      {/* 조건: 모바일 + Full 닫힘 + Minimized 아님 */}
      {!mobilePlayerOpen && !isMinimized && (
          <div 
            className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between shadow-2xl z-[90]" 
            // 바 자체 클릭 시 풀 플레이어 오픈
            onClick={() => setMobilePlayerOpen(true)}
          >
             {/* Progress Bar (Top) */}
             <div className="absolute top-[-2px] left-0 right-0 h-1 bg-zinc-900 cursor-pointer group" onClick={handleMobileSeek}>
                 <div className="absolute -top-2 bottom-0 left-0 right-0 bg-transparent" />
                 {isRestricted && duration && duration > PREVIEW_LIMIT && (
                    <>
                        <div className="absolute top-0 left-0 h-full bg-zinc-700" style={{ width: `${limitPercent}%` }} />
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${limitPercent}%` }} />
                    </>
                 )}
                 <div className="h-full bg-blue-500 relative transition-all duration-100 ease-linear z-20" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
             </div>

             {/* Info */}
             <div className="flex items-center gap-3 overflow-hidden">
                 <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                     {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <Disc className="text-zinc-500 m-auto"/>}
                 </div>
                 <div className="flex-1 min-w-0">
                     <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                     <div className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</div>
                 </div>
             </div>
             
             {/* Controls (Play & Minimize) */}
             <div className="flex items-center gap-3">
                 <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                     {isPlaying ? <Pause size={16} fill="black"/> : <Play size={16} fill="black" className="ml-0.5"/>}
                 </button>
                 {/* 🔻 [NEW] 최소화 버튼 (동그라미 모드로 전환) */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} 
                    className="p-2 text-zinc-500 hover:text-white"
                 >
                    <ChevronDown size={20}/>
                 </button>
             </div>
          </div>
      )}

      {/* 2-C. Mobile Full Player (Modal) */}
      {mobilePlayerOpen && (
          <MobilePlayer 
              track={currentTrack}
              isPlaying={isPlaying}
              onPlayPause={togglePlay}
              onNext={next}
              onPrev={prev}
              onClose={() => setMobilePlayerOpen(false)}
              repeatMode={repeatMode}
              onToggleRepeat={toggleRepeat}
              isShuffle={isShuffle}
              onToggleShuffle={toggleShuffle}
              currentTime={currentTime}
              duration={duration}
              onSeek={seek}
              isLiked={isRented}
              isRented={isRented}
              isOwner={!!isOwner}
              onToggleLike={handleOpenExtend}
              onInvest={currentTrack.is_minted ? handleInvest : undefined}
          />
      )}

      {/* Global Modals */}
      {showRentalModal && <RentalModal isOpen={showRentalModal} onClose={() => setShowRentalModal(false)} onConfirm={handleExtendConfirm} isExtension={isRented} currentExpiryDate={expiryDate} targetTitle={currentTrack.title} />}
      {trackToInvest && <TradeModal isOpen={!!trackToInvest} onClose={() => setTrackToInvest(null)} track={{ ...trackToInvest, token_id: trackToInvest.token_id ?? null }} />}
    </>
  );
}