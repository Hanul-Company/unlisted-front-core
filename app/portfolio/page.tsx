'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, TrendingUp, Play, Pause, Gift, Wallet, BarChart3, Disc, Zap } from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import { formatEther, parseEther } from 'viem';

// Components
import TradeModal from '../components/TradeModal';
import RentalModal from '../components/RentalModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import ShareButton from '../components/ui/ShareButton';

// Thirdweb
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';

// ✅ [NEW] Global Player Hook
import { usePlayer, Track } from '../context/PlayerContext';

const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function PortfolioPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();

  // ✅ [NEW] Use Global Player
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Data States
  const [assets, setAssets] = useState<Track[]>([]); // 내가 지분을 가진 트랙들 (타입 변경)
  const [loading, setLoading] = useState(true);
  
  // User Data States (Rentals/Likes) - UI 표시용
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTracksExpiry, setRentedTracksExpiry] = useState<Map<number, string>>(new Map());

  // Modal States
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<Track | null>(null);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  // 1. 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
        if (!address) { setLoading(false); return; }
        setLoading(true);

        // A. 모든 트랙 가져오기
        const { data: allTracks } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('is_minted', true);
        
        // B. 유저 정보 (렌탈, 좋아요)
        const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
        if (profile) {
            const now = new Date().toISOString();
            const { data: rentals } = await supabase.from('collections').select('track_id, expires_at').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
            if (rentals) {
                setRentedTrackIds(new Set(rentals.map((r: any) => r.track_id)));
                const expiryMap = new Map<number, string>();
                rentals.forEach((item: any) => {
                    const dateStr = item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "Lifetime";
                    expiryMap.set(item.track_id, dateStr);
                });
                setRentedTracksExpiry(expiryMap);
            }
            
            const { data: pls } = await supabase.from('playlists').select('*').eq('profile_id', profile.id);
            setMyPlaylists(pls || []);
        }

        const { data: likes } = await supabase.from('likes').select('track_id').eq('wallet_address', address);
        if (likes) setLikedTrackIds(new Set(likes.map((l: any) => l.track_id)));

        // C. 자산 설정
        setAssets(allTracks || []);
        setLoading(false);
    };
    fetchData();
  }, [address]);

  // --- Handlers ---
  
  // ✅ [NEW] Play Helper
  const handlePlay = (track: Track) => {
      // 만약 현재 재생 중인 곡을 클릭하면 일시정지/재생 토글
      if (currentTrack?.id === track.id) {
          togglePlay();
      } else {
          // 다른 곡이면 전체 자산 목록을 큐로 설정하고 재생
          playTrack(track, assets);
      }
  };

  const handleLike = async (track: any) => {
      if (!address)  { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;}
      // Global Player 로직과 통일: 항상 모달 띄우기 (연장 유도)
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
          const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', { p_wallet_address: address, p_track_id: pendingRentalTrack.id, p_duration_months: months });

          if (rpcResult === 'OK') {
              toast.success("Collected with Points!", { id: toastId });
          } else if (rpcResult === 'INSUFFICIENT_PMLD') {
              if (price > 0) {
                  const tx = prepareContractCall({ contract: tokenContract, method: "transfer", params: ["0x0000000000000000000000000000000000000000", parseEther(price.toString())] });
                  await sendTransaction(tx);
              }
              await supabase.rpc('add_to_collection_using_mld_by_wallet', { p_wallet_address: address, p_track_id: pendingRentalTrack.id, p_duration_months: months, p_amount_mld: price });
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
      
      {/* ⚠️ Local <audio> removed */}

      <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <Link href="/market" className="text-zinc-500 hover:text-white text-xs font-bold mb-2 inline-flex items-center gap-1 transition">← BACK TO MARKET</Link>
              <h1 className="text-4xl font-black tracking-tighter text-white">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-500 pr-2">PORTFOLIO</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Manage your music assets and claim dividends.</p>
            </div>
            <HeaderProfile/>
          </header>

          {/* Body */}
          {loading ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-600 w-10 h-10"/></div>
          ) : !address ? (
            <div className="text-center py-20 bg-zinc-900 rounded-3xl border border-zinc-800">
                <Wallet className="w-12 h-12 mx-auto text-zinc-600 mb-4"/>
                <h3 className="text-xl font-bold">Wallet Not Connected</h3>
                <p className="text-zinc-500 mb-6">Please connect your wallet to view your portfolio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-500 flex items-center gap-2"><BarChart3 size={16}/> YOUR ASSETS</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assets.map((track) => (
                            <PortfolioCard 
                                key={track.id} 
                                track={track} 
                                address={address}
                                // ✅ Global Player 연결
                                onPlay={(t: Track) => handlePlay(t)}
                                // isCurrentTrack과 isPlaying 상태를 전역 상태에서 가져옴
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

      {/* ⚠️ Local Player UI Removed (Handled by GlobalPlayer) */}

      {/* Modals */}
      {trackToInvest && (
          <TradeModal 
              isOpen={!!trackToInvest} 
              onClose={() => setTrackToInvest(null)} 
              // 타입 호환성 확보
              track={{...trackToInvest, token_id: trackToInvest.token_id ?? null}} 
          />
      )}
      
      {isRentalModalOpen && (
          <RentalModal 
              isOpen={isRentalModalOpen} 
              onClose={() => setIsRentalModalOpen(false)} 
              onConfirm={handleRentalConfirm} 
              isLoading={false}
              isExtension={pendingRentalTrack ? rentedTrackIds.has(pendingRentalTrack.id) : false}
              currentExpiryDate={pendingRentalTrack ? rentedTracksExpiry.get(pendingRentalTrack.id) : null}
              targetTitle={pendingRentalTrack?.title}
          />
      )}
      
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
    </div>
  );
}

// ----------------------------------------------------------------------
// [Sub Components] 
// ----------------------------------------------------------------------

// 1. Portfolio Card
function PortfolioCard({ track, address, onPlay, isCurrentTrack, isPlaying, onInvest }: any) {
    const tokenIdBigInt = BigInt(track.token_id || track.id);
    const { mutate: sendTransaction, isPending } = useSendTransaction();

    // Contract Reads
    const { data: balanceVal } = useReadContract({ contract: stockContract, method: "sharesBalance", params: [tokenIdBigInt, address] });
    const { data: sellPriceVal } = useReadContract({ contract: stockContract, method: "getSellPrice", params: [tokenIdBigInt, balanceVal || BigInt(0)], queryOptions: { enabled: !!balanceVal && balanceVal > BigInt(0) } });
    const { data: rewardVal, refetch: refetchReward } = useReadContract({ contract: stockContract, method: "getPendingReward", params: [tokenIdBigInt, address] });

    const myBalance = balanceVal ? Number(balanceVal) : 0;
    const sellValue = sellPriceVal ? Number(formatEther(sellPriceVal)) : 0;
    const pendingReward = rewardVal ? Number(formatEther(rewardVal)) : 0;

    const handleClaim = (e: React.MouseEvent) => {
        e.stopPropagation();
        const transaction = prepareContractCall({ contract: stockContract, method: "claimRewards", params: [tokenIdBigInt] });
        sendTransaction(transaction, { onSuccess: () => { toast.success("Dividends Claimed!"); refetchReward(); }, onError: () => toast.error("Claim Failed") });
    };

    if (myBalance === 0) return null;

    return (
        <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden transition-all hover:shadow-xl group flex flex-col">
            <div className="relative h-40 overflow-hidden bg-black">
                <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-700"/>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"/>
                <button 
                    onClick={() => onPlay(track)} // 여기서 onPlay 호출 -> handlePlay(상위) -> playTrack(전역)
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300"
                >
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition shadow-lg">
                        {(isCurrentTrack && isPlaying) ? <Pause size={20} className="text-black fill-current"/> : <Play size={20} className="text-black fill-current ml-1"/>}
                    </div>
                </button>
                <div className="absolute top-3 left-3">
                    <span className="bg-black/60 backdrop-blur border border-white/10 text-white text-[10px] px-2 py-1 rounded-full font-bold">
                        {myBalance} Shares
                    </span>
                </div>
                <div className="absolute top-3 right-3 z-20">
                    <ShareButton 
                        assetId={track.id.toString()}
                        trackData={{ title: track.title, artist: track.artist?.username, coverUrl: track.cover_image_url || "", audioUrl: track.audio_url || "" }} 
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
                    <div className={`p-2 rounded-lg border ${pendingReward > 0 ? 'bg-blue-900/20 border-blue-900/50' : 'bg-zinc-950 border-zinc-800'}`}>
                        <p className={`text-[10px] font-bold mb-1 ${pendingReward > 0 ? 'text-blue-500' : 'text-zinc-500'}`}>REWARD</p>
                        <div className="flex justify-between items-center">
                            <p className={`text-sm font-mono font-bold ${pendingReward > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>{pendingReward.toFixed(4)}</p>
                            {pendingReward > 0 && (
                                <button onClick={handleClaim} disabled={isPending} className="bg-blue-500 hover:bg-blue-400 text-black p-1 rounded transition shadow-lg">
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