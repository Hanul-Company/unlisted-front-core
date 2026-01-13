"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
// ✅ Link 컴포넌트 추가 (프로필 이동용)
import { Link } from '@/lib/i18n'; 
import { Play, Pause, Heart, TrendingUp, Share2, CheckCircle2, Home, Trophy, Zap, Disc } from 'lucide-react';
import HeaderProfile from '../HeaderProfile'; 
import { useActiveAccount, useReadContract } from "thirdweb/react"; 
import { getContract } from "thirdweb";
import { formatEther } from 'viem';
import toast from 'react-hot-toast';

import RentalModal from '../../components/RentalModal';
import TradeModal from '../../components/TradeModal';

import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '@/app/constants';

const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const ipContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

// ✅ 아티스트 프로필 타입 정의
interface ArtistProfile {
  username: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
}

// ✅ TradeModal에 넘겨줄 Track 타입
type Track = {
  id: number;
  title: string;
  // artist_name 필드는 이제 artist.username으로 대체되지만, 호환성을 위해 유지하거나 optional로 처리
  artist_name: string; 
  artist?: ArtistProfile | null; // ✅ 핵심 변경: 객체 타입 추가
  audio_url: string;
  cover_image_url: string | null;
  is_minted: boolean;
  token_id: number | null;
  melody_hash: string | null;
  uploader_address: string | null;
  created_at: string;
};

// ✅ Props 타입 수정
interface MusicCardProps {
  data: {
    id: string;
    title: string;
    // ✅ 문자열(구버전) 또는 객체(신버전) 모두 허용 (마이그레이션 과도기 대응)
    artist: string | ArtistProfile | null; 
    albumArt: string;
    audioUrl: string;
    price?: string; 
    roi?: string;
    duration?: number;
  };
}

const MusicPreviewCard = ({ data }: MusicCardProps) => {
  const router = useRouter();
  const account = useActiveAccount(); 
  const isLoggedIn = !!account;
  
  const tokenIdBigInt = BigInt(data.id);

  // --- 1. Real-time Contract Reads ---
  const { data: stockInfo } = useReadContract({
      contract: stockContract,
      method: "stocks",
      params: [tokenIdBigInt]
  });

  const { data: buyPriceVal } = useReadContract({
      contract: stockContract,
      method: "getBuyPrice",
      params: [tokenIdBigInt, BigInt(1)]
  });

  const { data: investorShareVal } = useReadContract({ 
      contract: ipContract, 
      method: "getInvestorShare", 
      params: [tokenIdBigInt] 
  });

  // --- 2. Parsing Data ---
  const jackpotBalance = stockInfo ? Number(formatEther(stockInfo[2])) : 0;
  const priceVal = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
  const investorSharePercent = investorShareVal ? Number(investorShareVal) / 100 : 0;
  
  const totalShares = stockInfo ? Number(stockInfo[0]) : 0;
  const isFirstInvestor = totalShares === 0;

  // ✅ 아티스트 정보 추출 (문자열 vs 객체 처리)
  const artistName = typeof data.artist === 'string' ? data.artist : (data.artist?.username || "Unknown Artist");
  const artistWallet = typeof data.artist === 'object' ? data.artist?.wallet_address : null;

  // --- Player States ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // --- Modals State ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [isRentalLoading, setIsRentalLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✅ TradeModal용 데이터 변환 (Artist 객체 포함)
  const trackForModal: Track = useMemo(() => ({
    id: Number(data.id),
    title: data.title,
    artist_name: artistName, // 호환성 유지
    // ✅ 객체 형태의 artist 정보 전달
    artist: typeof data.artist === 'object' ? data.artist : { username: artistName, wallet_address: null, avatar_url: null },
    audio_url: data.audioUrl,
    cover_image_url: data.albumArt,
    is_minted: true,
    token_id: Number(data.id),
    melody_hash: null,
    uploader_address: artistWallet || null, // 지갑 주소가 있으면 넣어줌
    created_at: new Date().toISOString(),
  }), [data, artistName, artistWallet]);

  // 로그인 완료 시 Auth 모달만 닫고 페이지 유지
  useEffect(() => {
    if (isLoggedIn && showAuthModal) {
      setShowAuthModal(false);
      toast.success("Welcome back!", { icon: '🎉', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
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
      if (current >= 60) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        return;
      }
      setProgress((current / 60) * 100);
    }
  };

  const handleActionClick = (actionType: 'like' | 'invest') => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
    } else {
      if (actionType === 'like') setShowRentalModal(true);
      else setShowTradeModal(true);
    }
  };

  const handleRentalConfirm = async (months: number, price: number) => {
    setIsRentalLoading(true);
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Rented for ${months} months!`, { icon: "🎧" });
        setShowRentalModal(false);
    } catch (error) {
        toast.error("Rental failed.");
    } finally {
        setIsRentalLoading(false);
    }
  };

  const goToMarket = () => router.push('/market'); 

  return (
    <>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden w-full max-w-md">
        
        {/* 상단 네비게이션 */}
        <div className="absolute top-4 left-4 z-20">
            <button onClick={goToMarket} className="bg-black/20 hover:bg-white/20 backdrop-blur border border-white/10 rounded-full p-2 text-white/70 hover:text-white transition-all flex items-center gap-1 pr-3">
                <Home size={16} /> <span className="text-[10px] font-bold">Market</span>
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
            
            <button onClick={togglePlay} className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 hover:bg-white/30 hover:scale-110 transition-all">
                {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} className="ml-1" />}
              </div>
            </button>

            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
                 <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
                    <TrendingUp size={10} className={investorSharePercent >= 30 ? "text-red-500" : "text-green-500"}/> 
                    {investorSharePercent}% Yield
                 </div>
            </div>
          </div>
        </div>

        {/* 곡 정보 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1 truncate">{data.title}</h1>
          
          {/* ✅ 아티스트 이름 클릭 시 프로필로 이동 */}
          {artistWallet ? (
             <Link 
                href={`/u?wallet=${artistWallet}`}
                className="text-white/60 text-sm font-medium hover:text-white hover:underline transition-colors inline-block"
             >
                {artistName}
             </Link>
          ) : (
             <p className="text-white/60 text-sm font-medium">{artistName}</p>
          )}
        </div>

        {/* 플레이어 바 */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>PREVIEW</span>
            <span>01:00</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative transition-all duration-300 ease-linear" style={{ width: `${progress}%` }}/>
          </div>
          <audio ref={audioRef} src={data.audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)}/>
        </div>

        {/* 투자 정보 패널 */}
        <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5 space-y-3">
            {isFirstInvestor ? (
                <div className="text-center py-2 animate-pulse">
                     <p className="text-yellow-400 font-bold flex items-center justify-center gap-2">
                        <Trophy size={16}/> Be the first investor!
                     </p>
                     <p className="text-[10px] text-zinc-400">Start the jackpot pool now.</p>
                </div>
            ) : (
                <div className="flex justify-between items-center">
                    <div className="text-left">
                        <p className="text-[10px] text-zinc-500 font-bold mb-0.5 flex items-center gap-1"><Trophy size={10} className="text-yellow-500"/> JACKPOT POOL</p>
                        <p className="text-lg font-black text-yellow-500">{jackpotBalance.toFixed(2)} <span className="text-xs font-normal text-white">MLD</span></p>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-bold mb-0.5">CURRENT PRICE</p>
                        <p className="text-lg font-bold text-white">{priceVal.toFixed(2)} <span className="text-xs font-normal text-zinc-400">MLD</span></p>
                    </div>
                </div>
            )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex gap-3">
          <button onClick={() => handleActionClick('like')} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-semibold active:scale-95">
            <Heart size={20} className={isLoggedIn ? "text-pink-500" : "text-white"} fill={isLoggedIn ? "currentColor" : "none"} />
          </button>
          
          <button onClick={() => handleActionClick('invest')} className="flex-[3] flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-900/40 transition-all font-bold text-lg active:scale-95">
            <Zap size={20} fill="currentColor"/>
            <span>{isFirstInvestor ? "Start Investing" : "Invest Now"}</span>
          </button>
        </div>
      </div>

      {/* --- Modals --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden p-6 text-white animate-in slide-in-from-bottom duration-300 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4"><Share2 size={24} className="text-blue-400"/></div>
              <h3 className="text-xl font-bold mb-2">Join now</h3>
              <p className="text-zinc-400 text-sm">Sign in now, enjoy free streaming<br/>and become share-holder.</p>
            </div>
            <div className="flex justify-center mb-4 scale-110"><HeaderProfile /></div>
            <button onClick={() => setShowAuthModal(false)} className="w-full py-3 text-zinc-500 text-sm hover:text-zinc-300 mt-2">Next time!</button>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setShowAuthModal(false)} />
        </div>
      )}

      <RentalModal isOpen={showRentalModal} onClose={() => setShowRentalModal(false)} onConfirm={handleRentalConfirm} isLoading={isRentalLoading} />
      <TradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} track={trackForModal} />
    </>
  );
};

export default MusicPreviewCard;