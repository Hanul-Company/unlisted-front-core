"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Heart, TrendingUp, Share2, CheckCircle2, Home } from 'lucide-react';
import HeaderProfile from '../HeaderProfile'; 
import { useActiveAccount } from "thirdweb/react"; 
import toast from 'react-hot-toast';

// ✅ 실제 모달 컴포넌트 Import (경로가 맞는지 확인해주세요)
import RentalModal from '../RentalModal';
import TradeModal from '../TradeModal';

// TradeModal 등에서 사용하는 Track 타입 정의 (MarketPage 참고)
type Track = {
  id: number;
  title: string;
  artist_name: string;
  audio_url: string;
  cover_image_url: string | null;
  is_minted: boolean;
  token_id: number | null;
  melody_hash: string | null;
  uploader_address: string | null;
  created_at: string;
};

interface MusicCardProps {
  data: {
    id: string;
    title: string;
    artist: string;
    albumArt: string;
    audioUrl: string;
    price: string;
    roi: string;
    duration: number;
  };
}

const MusicPreviewCard = ({ data }: MusicCardProps) => {
  const router = useRouter();
  const account = useActiveAccount(); 
  const isLoggedIn = !!account;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // --- 모달 상태 관리 ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // ✅ 실제 컴포넌트용 상태
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [isRentalLoading, setIsRentalLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✅ [Data Mapping] MusicPreviewCard의 데이터를 TradeModal이 원하는 Track 타입으로 변환
  const trackForModal: Track = useMemo(() => ({
    id: Number(data.id), // ID 형변환
    title: data.title,
    artist_name: data.artist,
    audio_url: data.audioUrl,
    cover_image_url: data.albumArt,
    is_minted: true, // 투자 가능 상태로 가정
    token_id: Number(data.id),
    melody_hash: null,
    uploader_address: null, // 필요시 DB에서 가져온 값을 넣어야 함
    created_at: new Date().toISOString(),
  }), [data]);

  // 로그인 완료 시 Auth 모달만 닫고 페이지 유지
  useEffect(() => {
    if (isLoggedIn && showAuthModal) {
      setShowAuthModal(false);
      toast.success("Welcome back!", {
        icon: '🎉',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    }
  }, [isLoggedIn, showAuthModal]);

  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      if (current >= 60) { // 1분 미리듣기 제한
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        return;
      }
      setProgress((current / 60) * 100);
    }
  };

  // --- 버튼 클릭 핸들러 ---
  const handleActionClick = (actionType: 'like' | 'invest') => {
    if (!isLoggedIn) {
      // 1. 비로그인 -> 로그인 모달
      setShowAuthModal(true);
    } else {
      // 2. 로그인 상태 -> 각 기능 모달 오픈
      if (actionType === 'like') {
        setShowRentalModal(true);
      } else {
        setShowTradeModal(true);
      }
    }
  };

  // ✅ [Handler] 렌탈 모달 확인 버튼 (MarketPage 참고하여 단순화)
  const handleRentalConfirm = async (months: number, price: number) => {
    setIsRentalLoading(true);
    try {
        // [심플 버전] 복잡한 DB 로직(Playlist 등)은 생략하고, 
        // 외부 유입 유저에게는 단순히 "렌탈 성공 -> 앱 사용 유도" 흐름으로 제공
        
        // 여기에 실제 렌탈 처리 로직(RPC 호출 등)이 필요하면 MarketPage의 processCollect를 참고해 추가 가능
        // 현재는 UI 연동 확인용으로 타임아웃만 둡니다.
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast.success(`Rented for ${months} months!`, { icon: "🎧" });
        setShowRentalModal(false);
        
    } catch (error) {
        toast.error("Rental failed.");
        console.error(error);
    } finally {
        setIsRentalLoading(false);
    }
  };

  const goToMarket = () => {
    router.push('/market'); 
  };

  return (
    <>
      {/* --- 메인 카드 UI --- */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden w-full max-w-md">
        
        {/* 상단 네비게이션 */}
        <div className="absolute top-4 left-4 z-20">
            <button 
                onClick={goToMarket}
                className="bg-black/20 hover:bg-white/20 backdrop-blur border border-white/10 rounded-full p-2 text-white/70 hover:text-white transition-all flex items-center gap-1 pr-3"
            >
                <Home size={16} />
                <span className="text-[10px] font-bold">Market</span>
            </button>
        </div>

        {/* 로그인 상태 배지 */}
        {isLoggedIn && (
          <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/30">
            <CheckCircle2 size={10} /> Connected
          </div>
        )}

        {/* 앨범 아트 */}
        <div className="relative mb-6 group mt-8">
          <div className="aspect-square rounded-2xl overflow-hidden shadow-lg relative bg-black/50">
            <img 
              src={data.albumArt} 
              alt={data.title} 
              className={`w-full h-full object-cover transform transition-transform duration-700 ${isPlaying ? 'scale-105' : 'group-hover:scale-105'}`}
            />
            <button 
              onClick={togglePlay}
              className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 hover:bg-white/30 hover:scale-110 transition-all">
                {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} className="ml-1" />}
              </div>
            </button>
          </div>
        </div>

        {/* 곡 정보 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1 truncate">{data.title}</h1>
          <p className="text-white/60 text-sm font-medium">{data.artist}</p>
        </div>

        {/* 플레이어 바 */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>PREVIEW</span>
            <span>01:00</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative transition-all duration-300 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <audio 
            ref={audioRef} 
            src={data.audioUrl} 
            onTimeUpdate={handleTimeUpdate} 
            onEnded={() => setIsPlaying(false)}
          />
        </div>

        {/* 투자 정보 */}
        <div className="flex justify-between items-center bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
          <div className="text-left">
            <p className="text-xs text-white/50 mb-0.5">APY(%)</p>
            <p className="text-lg font-bold text-green-400">{data.roi}</p>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <div className="text-right">
            <p className="text-xs text-white/50 mb-0.5">Price(MLD)</p>
            <p className="text-lg font-bold">{data.price}</p>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex gap-3">
          <button 
            onClick={() => handleActionClick('like')}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-semibold active:scale-95"
          >
            <Heart size={20} className={isLoggedIn ? "text-pink-500" : "text-white"} fill={isLoggedIn ? "currentColor" : "none"} />
          </button>
          
          <button 
            onClick={() => handleActionClick('invest')}
            className="flex-[3] flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-900/40 transition-all font-bold text-lg active:scale-95"
          >
            <TrendingUp size={20} />
            <span>{isLoggedIn ? "Invest Now" : "Invest and Earn"}</span>
          </button>
        </div>
      </div>


      {/* --- 1. 로그인 유도 모달 (Auth) --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden p-6 text-white animate-in slide-in-from-bottom duration-300 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                 <Share2 size={24} className="text-blue-400"/>
              </div>
              <h3 className="text-xl font-bold mb-2">Join now</h3>
              <p className="text-zinc-400 text-sm">Sign in now, enjoy free streaming<br/>and become share-holder.</p>
            </div>
            <div className="flex justify-center mb-4 scale-110">
                <HeaderProfile />
            </div>
            <button onClick={() => setShowAuthModal(false)} className="w-full py-3 text-zinc-500 text-sm hover:text-zinc-300 mt-2">Next time!</button>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setShowAuthModal(false)} />
        </div>
      )}

      {/* --- 2. Rental Modal (실제 컴포넌트 연동) --- */}
      <RentalModal
        isOpen={showRentalModal}
        onClose={() => setShowRentalModal(false)}
        onConfirm={handleRentalConfirm}
        isLoading={isRentalLoading}
      />

      {/* --- 3. Trade Modal (실제 컴포넌트 연동) --- */}
      <TradeModal
        isOpen={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        track={trackForModal} // 변환된 트랙 데이터 전달
      />

    </>
  );
};

export default MusicPreviewCard;