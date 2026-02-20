"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/lib/i18n'; 
import { Play, Pause, Heart, CheckCircle2, Home, PlusCircle, Sparkles, Disc, Headphones } from 'lucide-react';
import HeaderProfile from '../HeaderProfile'; 
import { useActiveAccount } from "thirdweb/react"; 
import toast from 'react-hot-toast';

import RentalModal from '../../components/RentalModal';

// ✅ 아티스트 프로필 타입 정의
interface ArtistProfile {
  username: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
}

// ✅ TradeModal에 넘겨줄 Track 타입 (호환성)
type Track = {
  id: number;
  title: string;
  artist_name: string; 
  artist?: ArtistProfile | null;
  audio_url: string;
  cover_image_url: string | null;
  is_minted: boolean;
  token_id: number | null;
  melody_hash: string | null;
  uploader_address: string | null;
  created_at: string;
};

// ✅ Props 타입
interface MusicCardProps {
  data: {
    id: string;
    title: string;
    artist: string | ArtistProfile | null; 
    albumArt: string;
    audioUrl: string;
    duration?: number;
  };
}

const MusicPreviewCard = ({ data }: MusicCardProps) => {
  const router = useRouter();
  const account = useActiveAccount(); 
  const isLoggedIn = !!account;
  
  // ✅ 아티스트 정보 추출
  const artistName = typeof data.artist === 'string' ? data.artist : (data.artist?.username || "Unknown Artist");
  const artistWallet = typeof data.artist === 'object' ? data.artist?.wallet_address : null;

  // --- Player States ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // --- Modals State ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [isRentalLoading, setIsRentalLoading] = useState(false);
  
  // 로그인 후 이동할 목적지 저장
  const [pendingAction, setPendingAction] = useState<'create' | 'radio' | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 로그인 완료 시 처리
  useEffect(() => {
    if (isLoggedIn && showAuthModal) {
      setShowAuthModal(false);
      toast.success("Welcome back!", { icon: '🎉' });
      
      // 로그인 전 요청했던 액션 실행
      if (pendingAction === 'create') {
        router.push('/create');
      } else if (pendingAction === 'radio') {
        router.push('/radio');
      }
      setPendingAction(null);
    }
  }, [isLoggedIn, showAuthModal, pendingAction, router]);

  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      // ✅ 미리듣기 1분(60초)으로 연장
      if (current >= 60) { 
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        return;
      }
      // ✅ 60초 기준 프로그래스 바 계산
      setProgress((current / 60) * 100);
    }
  };

  // ✅ Collect (Heart) 핸들러
  const handleCollect = () => {
    if (!isLoggedIn) {
      setPendingAction(null); 
      setShowAuthModal(true);
    } else {
      setShowRentalModal(true);
    }
  };

  // ✅ Create 핸들러
  const handleCreate = () => {
    if (!isLoggedIn) {
      setPendingAction('create');
      setShowAuthModal(true);
    } else {
      router.push('/create');
    }
  };

  // ✅ Radio (Stream more) 핸들러
  const handleStreamMore = () => {
    if (!isLoggedIn) {
      setPendingAction('radio');
      setShowAuthModal(true);
    } else {
      router.push('/radio');
    }
  };

  const handleRentalConfirm = async (months: number, price: number) => {
    setIsRentalLoading(true);
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Added to collection!`, { icon: "💖" });
        setShowRentalModal(false);
    } catch (error) {
        toast.error("Failed to collect.");
    } finally {
        setIsRentalLoading(false);
    }
  };

  const goToMarket = () => router.push('/market'); 

  return (
    <>
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl text-white relative overflow-hidden w-full max-w-sm flex flex-col">
        
        {/* 상단 네비게이션 */}
        <div className="flex justify-between items-center mb-6 relative z-10">
            <button onClick={goToMarket} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-full px-3 py-1.5 text-zinc-400 hover:text-white transition-all flex items-center gap-1.5">
                <Home size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Market</span>
            </button>
            {isLoggedIn && (
              <div className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-green-500/20">
                <CheckCircle2 size={10} /> Live
              </div>
            )}
        </div>

        {/* 앨범 아트 & 플레이어 */}
        <div className="relative mb-6 group mx-auto w-full max-w-[280px]">
          <div className="aspect-square rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.3)] relative bg-black border-4 border-white/5">
            
            {/* ✅ 스케일(확대)과 회전(스핀) 분리 적용 */}
            <div className={`absolute inset-0 transition-transform duration-700 ease-out ${isPlaying ? 'scale-110' : 'scale-100'}`}>
                <img 
                  src={data.albumArt} 
                  alt={data.title} 
                  className="w-full h-full object-cover animate-[spin_5s_linear_infinite]"
                  // 재생 중이면 돌고, 정지하면 멈춤 (자연스럽게)
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                />
            </div>

            {/* 중앙 구멍 (LP판 느낌) */}
            <div className="absolute inset-0 m-auto w-4 h-4 bg-zinc-900 rounded-full border border-zinc-700 z-10"/>
            
            <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all z-20">
              <div className={`w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 transition-transform duration-200 ${isPlaying ? 'scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100' : 'scale-100'}`}>
                {isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} className="ml-1" />}
              </div>
            </button>
          </div>
        </div>

        {/* 곡 정보 */}
        <div className="text-center mb-6 space-y-1">
          <h1 className="text-xl font-bold truncate px-4">{data.title}</h1>
          <div>
            {artistWallet ? (
              <Link href={`/u?wallet=${artistWallet}`} className="text-zinc-400 text-xs hover:text-white transition-colors">
                  {artistName}
              </Link>
            ) : (
              <p className="text-zinc-400 text-xs">{artistName}</p>
            )}
          </div>
        </div>

        {/* 진행 바 */}
        <div className="mb-8 px-2">
          <div className="flex justify-between text-[10px] text-zinc-500 mb-2 font-mono">
            <span>PREVIEW</span>
            {/* ✅ 1분으로 표시 업데이트 */}
            <span>01:00</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full relative transition-all duration-300 ease-linear" style={{ width: `${progress}%` }}/>
          </div>
          <audio ref={audioRef} src={data.audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)}/>
        </div>

        {/* 액션 버튼들 (Collect & Create) */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <button 
            onClick={handleCollect} 
            className="col-span-1 flex items-center justify-center py-4 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 transition-all active:scale-95 group"
            title="Collect this track"
          >
            <Heart size={20} className={`transition-colors ${isLoggedIn ? "text-pink-500 group-hover:scale-110" : "text-zinc-400 group-hover:text-white"}`} fill={isLoggedIn ? "currentColor" : "none"} />
          </button>
          
          <button 
            onClick={handleCreate} 
            className="col-span-3 flex items-center justify-center gap-2 py-4 rounded-2xl bg-white text-black hover:bg-zinc-200 transition-all font-bold text-sm active:scale-95 shadow-lg shadow-white/5"
          >
            <PlusCircle size={18} />
            <span>Create Your Song</span>
          </button>
        </div>

        {/* Stream More (Bottom CTA) */}
        <div className="pt-4 border-t border-white/5 text-center">
            <button onClick={handleStreamMore} className="group flex flex-col items-center justify-center gap-1 w-full p-2 hover:bg-white/5 rounded-xl transition-colors">
                <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest group-hover:text-zinc-400">or Tell me what you like</span>
                <span className="text-indigo-400 text-xs font-bold flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
                    <Headphones size={12} /> Stream Free AI Tracks for you <Headphones size={12} />
                </span>
            </button>
        </div>
      </div>

      {/* --- Auth Modal --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#18181b] border border-zinc-800 rounded-[32px] w-full max-w-sm overflow-hidden p-8 text-white relative shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            <div className="text-center mb-8">
              <div className="mx-auto w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center mb-5 ring-4 ring-black">
                {pendingAction === 'create' ? <Disc size={28} className="text-white"/> : <Sparkles size={28} className="text-indigo-400"/>}
              </div>
              <h3 className="text-2xl font-black mb-2">
                {pendingAction === 'create' ? 'Start Creating' : 'Discover More'}
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {pendingAction === 'create' 
                  ? "Sign up to upload your tracks, set royalties, and build your fanbase." 
                  : "Connect your wallet to analyze your music taste and stream full tracks."}
              </p>
            </div>

            <div className="flex justify-center mb-6 [&_button]:!w-full [&_button]:!py-4 [&_button]:!rounded-xl [&_button]:!font-bold">
                <HeaderProfile />
            </div>

            <button onClick={() => setShowAuthModal(false)} className="w-full py-3 text-zinc-600 text-xs font-bold hover:text-zinc-400 transition uppercase tracking-wider">
                Cancel
            </button>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setShowAuthModal(false)} />
        </div>
      )}

      <RentalModal isOpen={showRentalModal} onClose={() => setShowRentalModal(false)} onConfirm={handleRentalConfirm} isLoading={isRentalLoading} />
    </>
  );
};

export default MusicPreviewCard;