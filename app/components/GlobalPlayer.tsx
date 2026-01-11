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
import { ChevronUp, Disc, Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, Zap } from 'lucide-react';

// 컴포넌트 임포트 (경로는 프로젝트 구조에 맞게)
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
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);

  // Data States (Global Check)
  const [rentedTracksMap, setRentedTracksMap] = useState<Map<number, string>>(new Map());

  // 1. 유저 렌탈 정보 동기화 (전역)
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

  useEffect(() => {
      fetchUserData();
      // 트랙이 바뀔 때마다 혹시 갱신되었을 수 있으니 체크 (선택사항)
  }, [address, currentTrack]);

  // 2. Helper Logic
  if (!currentTrack) return null;

  // Library Page와 동일한 로직 적용
  const isRented = rentedTracksMap.has(currentTrack.id);
  // Owner 체크: uploader_address 비교
  const isOwner = address && currentTrack.uploader_address && (address.toLowerCase() === currentTrack.uploader_address.toLowerCase());
  const expiryDate = rentedTracksMap.get(currentTrack.id);

  // 3. Handlers
  const handleOpenExtend = () => setShowRentalModal(true);
  
    const handleExtendConfirm = async (months: number, price: number) => {
    if (!currentTrack || !address) return;

    const toastId = toast.loading("Processing...");

    try {
        // ✅ 1) pMLD 우선 시도 (온체인 결제 없이 DB에서 포인트 차감 + 컬렉션 처리)
        const { data: pmldRes, error: pmldErr } = await supabase.rpc(
        'add_to_collection_using_p_mld_by_wallet',
        {
            p_wallet_address: address,
            p_track_id: currentTrack.id,
            p_duration_months: months,
        }
        );

        if (pmldErr) {
        console.error("pMLD RPC error:", pmldErr);
        // pMLD RPC 자체 오류면 바로 실패 처리(원하면 MLD fallback으로 바꿔도 됨)
        throw new Error(pmldErr.message);
        }

        if (pmldRes === 'OK') {
        toast.success(
            `${months === 999 ? 'Collected' : 'Collected'} with pMLD`,
            { id: toastId }
        );
        setShowRentalModal(false);
        await fetchUserData();
        return;
        }

        // ✅ 2) pMLD 부족이면 MLD로 fallback
        if (pmldRes !== 'INSUFFICIENT_PMLD') {
        // 그 외 리턴코드: NO_WALLET / NO_TRACK_ID 등
        throw new Error(String(pmldRes || "PMLD_FAILED"));
        }

        // ✅ 3) MLD 결제: 먼저 온체인 transfer
        if (price > 0) {
        const recipient =
            currentTrack.uploader_address || "0x0000000000000000000000000000000000000000";

        const transaction = prepareContractCall({
            contract: melodyTokenContract,
            method: "transfer",
            params: [recipient, parseEther(price.toString())],
        });

        await sendTransaction(transaction);
        }

        // ✅ 4) 그 다음 DB 반영 (MLD)
        const { data: mldRes, error: mldErr } = await supabase.rpc(
        'add_to_collection_using_mld_by_wallet',
        {
            p_wallet_address: address,
            p_track_id: currentTrack.id,
            p_duration_months: months,
            p_amount_mld: price,
        }
        );

        if (mldErr) {
        console.error("MLD RPC error:", mldErr);
        throw new Error(mldErr.message);
        }

        if (mldRes !== 'OK') {
        throw new Error(String(mldRes || "MLD_FAILED"));
        }

        toast.success(
        `${months === 999 ? 'Collected' : 'Collected'} with MLD`,
        { id: toastId }
        );

        setShowRentalModal(false);
        await fetchUserData();
    } catch (e: any) {
        console.error(e);
        toast.error(`Failed: ${e?.message || e}`, { id: toastId });
    }
    };

    // ✅ [2] 미디어 세션 연결 (잠금화면 제어)
  useMediaSession({
    title: currentTrack?.title || "Unknown Title",
    artist: currentTrack?.artist?.username || "Unlisted Artist",
    coverUrl: currentTrack?.cover_image_url || "/images/default_cover.jpg",
    isPlaying: isPlaying,
    audioRef: audioRef,
    play: togglePlay,     // 재생 함수
    pause: togglePlay,    // 일시정지 함수 (togglePlay가 상태에 따라 알아서 처리)
    next: next,       // 다음 곡
    prev: prev,       // 이전 곡
    seekTo: (time) => {   // 탐색(Seek)
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    }
  });

  const handleInvest = () => setTrackToInvest(currentTrack);

  const formatTime = (time: number) => {
      if(isNaN(time)) return "0:00";
      const min = Math.floor(time / 60);
      const sec = Math.floor(time % 60);
      return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <>
      {/* =======================
          1. Desktop Footer Player (Library 디자인)
         ======================= */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-[9999] shadow-2xl">
          {/* Left */}
          <div className="flex items-center gap-4 w-1/3">
             <button onClick={() => setMobilePlayerOpen(true)} className="ml-2 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition"><ChevronUp size={20}/></button>
             <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                 {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700"/></div>}
             </div>
             <div className="overflow-hidden">
                 <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                 <Link href={`/u?wallet=${currentTrack.artist?.wallet_address}`} className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist?.username}</Link>
             </div>
             
             {/* Like Button (Owner 아닐때만) */}
             {!isOwner && (
                 <button onClick={handleOpenExtend} className={`ml-2 hover:scale-110 transition ${isRented ? "text-pink-500" : "text-zinc-500 hover:text-white"}`}>
                     <Heart size={20} fill={isRented ? "currentColor" : "none"}/>
                 </button>
             )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-2 w-1/3">
              <div className="flex items-center gap-6">
                  <button onClick={toggleShuffle} className={`text-zinc-400 hover:text-white transition ${isShuffle ? 'text-green-500' : ''}`}><Shuffle size={16}/></button>
                  <button onClick={prev} className="text-zinc-400 hover:text-white transition"><SkipBack size={20}/></button>
                  <button onClick={togglePlay} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                      {isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}
                  </button>
                  <button onClick={next} className="text-zinc-400 hover:text-white transition"><SkipForward size={20}/></button>
                  <button onClick={toggleRepeat} className={`text-zinc-400 hover:text-white transition ${repeatMode !== 'off' ? 'text-green-500' : ''}`}>
                      {repeatMode === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}
                  </button>
              </div>
              <div className="w-full max-w-sm flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - rect.left) / rect.width) * duration); }}>
                      <div className="h-full bg-white rounded-full relative z-10 group-hover:bg-green-500 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
              </div>
          </div>

          {/* Right */}
          <div className="w-1/3 flex justify-end items-center gap-4">
              {currentTrack.is_minted && (
                  <button onClick={handleInvest} className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5">
                      <Zap size={14} fill="currentColor"/> Invest
                  </button>
              )}
              <div className="w-px h-6 bg-zinc-800 mx-1"/>
              <button onClick={toggleMute} className="text-zinc-500 hover:text-white">{isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
              <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setVolume((e.clientX - rect.left) / rect.width); }}>
                  <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }}/>
              </div>
          </div>
      </div>

      {/* =======================
          2. Mobile Mini Player
         ======================= */}
      {!mobilePlayerOpen && (
          <div className="md:hidden fixed bottom-20 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-[90]" onClick={() => setMobilePlayerOpen(true)}>
             <div className="flex items-center gap-3 overflow-hidden">
                 <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                     {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <Disc className="text-zinc-500 m-auto"/>}
                 </div>
                 <div className="flex-1 min-w-0">
                     <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                     <div className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</div>
                 </div>
             </div>
             <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                 {isPlaying ? <Pause size={16} fill="black"/> : <Play size={16} fill="black" className="ml-0.5"/>}
             </button>
          </div>
      )}

      {/* =======================
          3. Mobile Full Modal
         ======================= */}
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
              
              // Context + Local State 값 전달
              isLiked={isRented}
              isRented={isRented}
              isOwner={!!isOwner}
              
              onToggleLike={handleOpenExtend}
              onInvest={currentTrack.is_minted ? handleInvest : undefined}
          />
      )}

      {/* =======================
          4. Global Modals
         ======================= */}
      {showRentalModal && (
          <RentalModal 
              isOpen={showRentalModal}
              onClose={() => setShowRentalModal(false)}
              onConfirm={handleExtendConfirm}
              isExtension={isRented}
              currentExpiryDate={expiryDate} // 만료일 표시
              targetTitle={currentTrack.title}
          />
      )}
      
      {trackToInvest && (
          <TradeModal 
              isOpen={!!trackToInvest}
              onClose={() => setTrackToInvest(null)}
              track={{
                  ...trackToInvest,
                  token_id: trackToInvest.token_id ?? null
              }}
          />
      )}
    </>
  );
}