'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, TrendingUp, DollarSign, Play, Pause, Gift, Wallet, ArrowRight, BarChart3, Disc, SkipBack, SkipForward, Volume2, VolumeX, Heart, Zap, User } from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import { formatEther } from 'viem';

// Components
import TradeModal from '../components/TradeModal';
import MobilePlayer from '../components/MobilePlayer'; // 모바일 전체화면 플레이어
import RentalModal from '../components/RentalModal'; // 렌탈 모달
import PlaylistSelectionModal from '../components/PlaylistSelectionModal'; // 플레이리스트 선택
import ShareButton from '../components/ui/ShareButton';

// Thirdweb
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther } from 'viem';

const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function PortfolioPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();

  // Data States
  const [assets, setAssets] = useState<any[]>([]); // 내가 지분을 가진 트랙들
  const [loading, setLoading] = useState(true);
  
  // User Data States (For Player Logic)
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set());
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  // Player States
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const toastShownRef = useRef(false);

  // Modal States
  const [trackToInvest, setTrackToInvest] = useState<any>(null);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<any>(null);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);

  // 1. 데이터 로딩 (내 자산 + 렌탈/좋아요 정보)
  useEffect(() => {
    const fetchData = async () => {
        if (!address) {
            setLoading(false);
            return;
        }
        setLoading(true);

        // A. 모든 트랙 가져오기 (지분 확인용)
        const { data: allTracks } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('is_minted', true);
        
        // B. 유저 정보 (렌탈, 좋아요 내역)
        const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
        
        if (profile) {
            const now = new Date().toISOString();
            // 렌탈 내역
            const { data: rentals } = await supabase.from('collections').select('track_id').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
            if (rentals) setRentedTrackIds(new Set(rentals.map((r: any) => r.track_id)));
            
            // 플레이리스트
            const { data: pls } = await supabase.from('playlists').select('*').eq('profile_id', profile.id);
            setMyPlaylists(pls || []);
        }

        // 좋아요 내역
        const { data: likes } = await supabase.from('likes').select('track_id').eq('wallet_address', address);
        if (likes) setLikedTrackIds(new Set(likes.map((l: any) => l.track_id)));

        // C. 내 자산 필터링은 각 AssetCard에서 잔고를 확인하거나, 
        // 여기서 미리 필터링 할 수 있지만, Contract Read Hook은 컴포넌트 내부에서 도는 게 좋으므로
        // 일단 전체 트랙을 넘기고 Card 내부에서 잔고가 0이면 숨기는 방식을 유지하거나
        // 여기서는 전체 트랙을 assets 상태로 넘깁니다.
        setAssets(allTracks || []);
        setLoading(false);
    };

    fetchData();
  }, [address]);

  // --- Player Logic (UserProfilePage와 동일) ---
  const isCurrentTrackRented = currentTrack ? rentedTrackIds.has(currentTrack.id) : false;

  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
        if (audio.src !== currentTrack.audio_url) {
            audio.src = currentTrack.audio_url;
            audio.load();
            setCurrentTime(0);
            toastShownRef.current = false;
            if (isPlaying) audio.play().catch(console.error);
        }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack) isPlaying ? audio.play().catch(console.error) : audio.pause();
  }, [isPlaying]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const time = e.currentTarget.currentTime;
    if (!isCurrentTrackRented && time >= 60) {
        e.currentTarget.pause();
        setIsPlaying(false);
        if (!toastShownRef.current) {
            toast("Preview ended. Invest or Collect to collect!", { icon: "🔒", id: "preview-end-toast" });
            toastShownRef.current = true;
        }
    } else {
        setCurrentTime(time);
        if (time < 59) toastShownRef.current = false;
    }
  };

  const playTrack = (track: any) => {
    if (currentTrack?.id === track.id) setIsPlaying(!isPlaying);
    else { setCurrentTrack(track); setIsPlaying(true); }
    // 모바일이면 전체화면 플레이어 오픈 (선택사항)
    if (window.innerWidth < 768) setMobilePlayerOpen(true);
  };

  const handleNext = () => {
    if (!currentTrack || assets.length === 0) return;
    const idx = assets.findIndex((t: any) => t.id === currentTrack.id);
    const nextIdx = isShuffle ? Math.floor(Math.random() * assets.length) : (idx + 1) % assets.length;
    setCurrentTrack(assets[nextIdx]); setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentTrack || assets.length === 0) return;
    const idx = assets.findIndex((t: any) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + assets.length) % assets.length;
    setCurrentTrack(assets[prevIdx]); setIsPlaying(true);
  };

  // --- Like & Collection Handlers ---
  const handleLike = async (track: any) => {
      if (!address) return toast.error("Connect Wallet first");
      // 렌탈했으면 좋아요 토글
      if (rentedTrackIds.has(track.id)) {
          const isLiked = likedTrackIds.has(track.id);
          const nextSet = new Set(likedTrackIds);
          if (isLiked) nextSet.delete(track.id); else nextSet.add(track.id);
          setLikedTrackIds(nextSet);
          
          if (isLiked) await supabase.from('likes').delete().match({ wallet_address: address, track_id: track.id });
          else await supabase.from('likes').insert({ wallet_address: address, track_id: track.id });
          return;
      }
      // 렌탈 안했으면 렌탈 유도
      setPendingRentalTrack(track);
      setIsRentalModalOpen(true);
  };

  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      setIsRentalModalOpen(false);
      setShowPlaylistModal(true);
  };

  const processCollect = async (playlistId: string | 'liked') => {
      if (!pendingRentalTrack || !address || !tempRentalTerms) return;
      const { months, price } = tempRentalTerms;
      const toastId = toast.loading("Processing...");
      setShowPlaylistModal(false);

      try {
          const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', {
              p_wallet_address: address, p_track_id: pendingRentalTrack.id, p_duration_months: months
          });

          if (rpcResult === 'OK') {
              toast.success("Collected with Points!", { id: toastId });
          } else if (rpcResult === 'INSUFFICIENT_PMLD') {
              if (price > 0) {
                  const tx = prepareContractCall({ contract: tokenContract, method: "transfer", params: ["0x0000000000000000000000000000000000000000", parseEther(price.toString())] });
                  await sendTransaction(tx);
              }
              await supabase.rpc('add_to_collection_using_mld_by_wallet', {
                  p_wallet_address: address, p_track_id: pendingRentalTrack.id, p_duration_months: months, p_amount_mld: price
              });
              toast.success("Collected with MLD!", { id: toastId });
          }
          if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: pendingRentalTrack.id });
          await supabase.from('likes').upsert({ wallet_address: address, track_id: pendingRentalTrack.id }, { onConflict: 'wallet_address, track_id' });
          
          setRentedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setLikedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setPendingRentalTrack(null);
      } catch (e: any) { toast.error(e.message, { id: toastId }); }
  };


  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (!isNaN(d)) setDuration(d); }}
        onEnded={() => { if(repeatMode === 'one') { if(audioRef.current){audioRef.current.currentTime=0; audioRef.current.play();} } else { handleNext(); } }}
        preload="auto"
        crossOrigin="anonymous"
      />

      <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <Link href="/market" className="text-zinc-500 hover:text-white text-xs font-bold mb-2 inline-flex items-center gap-1 transition">
                ← BACK TO MARKET
              </Link>
              <h1 className="text-4xl font-black tracking-tighter text-white">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 pr-2">PORTFOLIO</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Manage your music assets and claim dividends.</p>
            </div>
            <HeaderProfile/>
          </header>

          {/* Body */}
          {loading ? (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="animate-spin text-zinc-600 w-10 h-10"/>
            </div>
          ) : !address ? (
            <div className="text-center py-20 bg-zinc-900 rounded-3xl border border-zinc-800">
                <Wallet className="w-12 h-12 mx-auto text-zinc-600 mb-4"/>
                <h3 className="text-xl font-bold">Wallet Not Connected</h3>
                <p className="text-zinc-500 mb-6">Please connect your wallet to view your portfolio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-500 flex items-center gap-2">
                        <BarChart3 size={16}/> YOUR ASSETS
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assets.map((track) => (
                            <PortfolioCard 
                                key={track.id} 
                                track={track} 
                                address={address}
                                onPlay={(t: any) => playTrack(t)}
                                onPause={() => setIsPlaying(false)}
                                isCurrentTrack={currentTrack?.id === track.id}
                                isPlaying={isPlaying}
                                onInvest={() => setTrackToInvest(track)}
                            />
                        ))}
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* --------------------- Players & Modals --------------------- */}

      {/* 1. Mobile Player (Full Screen) */}
      {currentTrack && mobilePlayerOpen && (
          <MobilePlayer
              track={currentTrack}
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onNext={handleNext}
              onPrev={handlePrev}
              onClose={() => setMobilePlayerOpen(false)}
              repeatMode={repeatMode}
              onToggleRepeat={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              currentTime={currentTime}
              duration={duration}
              onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }}
              isLiked={likedTrackIds.has(currentTrack.id)}
              isRented={rentedTrackIds.has(currentTrack.id)}
              onToggleLike={() => handleLike(currentTrack)} 
              onInvest={() => setTrackToInvest(currentTrack)}
          />
      )}

      {/* 2. Mobile Mini Player (Bottom Bar) */}
      {currentTrack && !mobilePlayerOpen && (
          <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}>
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                      <Link href={`/u?wallet=${currentTrack.artist?.wallet_address}`} className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</Link>
                  </div>
              </div>
              <div className="flex items-center gap-3 pr-1">
                  <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                      {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
                  </button>
              </div>
          </div>
      )}

      {/* 3. Desktop Footer Player */}
      {currentTrack && (
        <FooterPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onNext={handleNext}
            onPrev={handlePrev}
            currentTime={currentTime}
            duration={duration}
            onSeek={(val) => { if (audioRef.current) audioRef.current.currentTime = val; }}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            volume={volume}
            onVolumeChange={(val) => { setVolume(val); setIsMuted(false); }}
            isLiked={likedTrackIds.has(currentTrack.id)}
            isRented={rentedTrackIds.has(currentTrack.id)}
            onToggleLike={() => handleLike(currentTrack)}
            onInvest={() => setTrackToInvest(currentTrack)}
        />
      )}

      {/* Modals */}
      {trackToInvest && <TradeModal isOpen={!!trackToInvest} onClose={() => setTrackToInvest(null)} track={trackToInvest} />}
      {isRentalModalOpen && <RentalModal isOpen={isRentalModalOpen} onClose={() => setIsRentalModalOpen(false)} onConfirm={handleRentalConfirm} isLoading={false} />}
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
    </div>
  );
}

// ----------------------------------------------------------------------
// [Sub Components] 
// ----------------------------------------------------------------------

// 1. Portfolio Card
function PortfolioCard({ track, address, onPlay, onPause, isCurrentTrack, isPlaying, onInvest }: any) {
    const tokenIdBigInt = BigInt(track.token_id || track.id);
    const { mutate: sendTransaction, isPending } = useSendTransaction();

    // 내 지분 조회
    const { data: balanceVal } = useReadContract({
        contract: stockContract,
        method: "sharesBalance",
        params: [tokenIdBigInt, address]
    });

    // 현재 가치 (Sell Price)
    const { data: sellPriceVal } = useReadContract({
        contract: stockContract,
        method: "getSellPrice",
        params: [tokenIdBigInt, balanceVal || BigInt(0)],
        queryOptions: { enabled: !!balanceVal && balanceVal > BigInt(0) }
    });

    // 배당금 조회
    const { data: rewardVal, refetch: refetchReward } = useReadContract({
        contract: stockContract,
        method: "getPendingReward",
        params: [tokenIdBigInt, address]
    });

    const myBalance = balanceVal ? Number(balanceVal) : 0;
    const sellValue = sellPriceVal ? Number(formatEther(sellPriceVal)) : 0;
    const pendingReward = rewardVal ? Number(formatEther(rewardVal)) : 0;

    const handleClaim = (e: React.MouseEvent) => {
        e.stopPropagation();
        const transaction = prepareContractCall({
            contract: stockContract,
            method: "claimRewards",
            params: [tokenIdBigInt]
        });
        sendTransaction(transaction, {
            onSuccess: () => { toast.success("Dividends Claimed!"); refetchReward(); },
            onError: () => toast.error("Claim Failed")
        });
    };

    if (myBalance === 0) return null;

    return (
        <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden transition-all hover:shadow-xl group flex flex-col">
            <div className="relative h-40 overflow-hidden bg-black">
                <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-700"/>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"/>
                <button 
                    onClick={() => (isCurrentTrack && isPlaying) ? onPause() : onPlay(track)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300"
                >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition shadow-lg">
                        {(isCurrentTrack && isPlaying) ? (
                            <Pause size={20} className="text-black fill-current"/>
                        ) : (
                            <Play size={20} className="text-black fill-current ml-1"/>
                        )}
                    </div>
                </button>
                <div className="absolute top-3 left-3">
                    <span className="bg-black/60 backdrop-blur border border-white/10 text-white text-[10px] px-2 py-1 rounded-full font-bold">
                        {myBalance} Shares
                    </span>
                </div>

                {/* ✅ [추가됨] 오른쪽 상단: 공유 버튼 */}
                {/* z-20을 줘서 재생 버튼보다 위에 오게 해야 클릭이 됩니다 */}
                <div className="absolute top-3 right-3 z-20">
                    <ShareButton 
                        assetId={track.id.toString()}
                        trackData={{
                            title: track.title,
                            artist: track.artist?.username,
                            coverUrl: track.cover_image_url || ""
                        }} 
                        className="w-8 h-8 bg-black/40 hover:bg-white/20 backdrop-blur-md border border-white/10 hover:border-white/50 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-300 hover:scale-110 shadow-lg"
                        size={16}
                    />
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                    <h4 className="font-bold text-lg text-white truncate">{track.title}</h4>
                    <p className="text-xs text-zinc-500">{track.artist?.username}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 font-bold mb-1">VALUE</p>
                        <p className="text-sm font-mono font-bold text-white">{sellValue.toFixed(4)}</p>
                    </div>
                    <div className={`p-2 rounded-lg border ${pendingReward > 0 ? 'bg-green-900/20 border-green-900/50' : 'bg-zinc-950 border-zinc-800'}`}>
                        <p className={`text-[10px] font-bold mb-1 ${pendingReward > 0 ? 'text-green-500' : 'text-zinc-500'}`}>REWARD</p>
                        <div className="flex justify-between items-center">
                            <p className={`text-sm font-mono font-bold ${pendingReward > 0 ? 'text-green-400' : 'text-zinc-600'}`}>{pendingReward.toFixed(4)}</p>
                            {pendingReward > 0 && (
                                <button onClick={handleClaim} disabled={isPending} className="bg-green-500 hover:bg-green-400 text-black p-1 rounded transition shadow-lg">
                                    {isPending ? <Loader2 size={12} className="animate-spin"/> : <Gift size={12}/>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-auto pt-4 border-t border-zinc-800 flex gap-2">
                    <button onClick={() => onPlay(track)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-2">
                        {(isCurrentTrack && isPlaying) ? <Pause size={14}/> : <Play size={14}/>} Play
                    </button>
                    <button onClick={onInvest} className="flex-1 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-lg transition flex items-center justify-center gap-2">
                        <TrendingUp size={14}/> Invest
                    </button>
                </div>
            </div>
        </div>
    );
}

// 2. Footer Player (Desktop)
interface FooterPlayerProps {
    track: any;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onNext: () => void;
    onPrev: () => void;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    isMuted: boolean;
    onToggleMute: () => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    isLiked: boolean;
    isRented: boolean;
    onToggleLike: () => void;
    onInvest?: () => void;
}

function FooterPlayer({
    track, isPlaying, onTogglePlay, onNext, onPrev,
    currentTime, duration, onSeek,
    isMuted, onToggleMute, volume, onVolumeChange,
    isLiked, isRented, onToggleLike, onInvest
}: FooterPlayerProps) {
    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
            <div className="flex items-center gap-4 w-1/3">
                <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                    {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700" /></div>}
                </div>
                <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate text-white">{track.title}</div>
                    <div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{track.artist?.username}</div>
                </div>
                <button onClick={onToggleLike} className={`ml-2 hover:scale-110 transition ${isLiked ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}>
                    <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                </button>
            </div>

            <div className="flex flex-col items-center gap-2 w-1/3">
                <div className="flex items-center gap-6">
                    <button className="text-zinc-400 hover:text-white transition" onClick={onPrev}><SkipBack size={20} /></button>
                    <button onClick={onTogglePlay} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                        {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                    </button>
                    <button className="text-zinc-400 hover:text-white transition" onClick={onNext}><SkipForward size={20} /></button>
                </div>
                <div className="w-full max-w-sm flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - rect.left) / rect.width) * duration); }}>
                        {!isRented && duration > 60 && <div className="absolute top-0 left-0 h-full bg-purple-500/20 z-0" style={{ width: `${Math.min((60/duration)*100, 100)}%` }} />}
                        <div className="h-full bg-white rounded-full relative z-10 group-hover:bg-green-500 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono w-8 ${!isRented ? 'text-purple-400' : 'text-zinc-500'}`}>{!isRented ? '1:00' : formatTime(duration)}</span>
                </div>
            </div>

            <div className="w-1/3 flex justify-end items-center gap-4">
                {onInvest && (
                    <button onClick={onInvest} className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5">
                        <Zap size={14} fill="currentColor"/> Invest
                    </button>
                )}
                <div className="w-px h-6 bg-zinc-800 mx-1"></div>
                <button onClick={onToggleMute} className="text-zinc-500 hover:text-white">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onVolumeChange(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)); }}>
                    <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }}></div>
                </div>
            </div>
        </div>
    );
}