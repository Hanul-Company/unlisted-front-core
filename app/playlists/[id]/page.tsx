'use client';

import React, { useState, useEffect } from 'react';
import { Link } from "@/lib/i18n"; 
import { supabase } from '@/utils/supabase';
import { 
  Play, Pause, Heart, Clock, CheckCircle2, 
  Copy, Share2, Disc, User, Loader2, Zap, Music, ArrowLeft,
  Check 
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { parseEther } from 'viem';

// Thirdweb
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '@/app/constants'; 

// Components
import RentalModal from '../../components/RentalModal';
import TradeModal from '../../components/TradeModal';
import HeaderProfile from '../../components/HeaderProfile'; 
import PlaylistSelectionModal from '../../components/PlaylistSelectionModal';

// ✅ [NEW] Global Player Hook
import { usePlayer, Track } from '../../context/PlayerContext';

// Constants
const BASE_PRICE = 10;
const PLATFORM_TREASURY_ADDRESS = "0xf25506Ae34e52604977e66522b6578a3B640acAd"; 

const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

type PlaylistInfo = {
  id: number;
  name: string;
  creator_name: string;
  creator_wallet: string;
  creator_avatar: string | null;
  created_at: string;
  fork_count: number;
};

// PlayerContext의 Track 타입에 추가적인 UI용 속성(is_owned)을 확장
type PlaylistTrack = Track & { is_owned?: boolean };

export default function PublicPlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.id as string;
  
  const account = useActiveAccount();
  const address = account?.address;
  const { mutateAsync: sendTransaction } = useSendTransaction();
  // ✅ [NEW] Use Global Player
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Data State
  const [info, setInfo] = useState<PlaylistInfo | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [rentalTarget, setRentalTarget] = useState<{ type: 'single' | 'batch', track?: PlaylistTrack } | null>(null);
  const [trackToInvest, setTrackToInvest] = useState<PlaylistTrack | null>(null);
  
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  // 상태
  const [isJustForked, setIsJustForked] = useState(false);

  const unownedTracks = tracks.filter(t => !t.is_owned);
  const isAllOwned = tracks.length > 0 && unownedTracks.length === 0;

  // --- Fetch Data ---
  useEffect(() => { if (playlistId) fetchPlaylistData(); }, [playlistId, address]);

  const fetchPlaylistData = async () => {
    setLoading(true);
    try {
      const { data: plData, error: plError } = await supabase
        .from('playlists')
        .select(`id, name, created_at, fork_count, profiles!inner (username, wallet_address, avatar_url)`)
        .eq('id', playlistId)
        .single();

      if (plError || !plData) { toast.error("Playlist not found"); router.push('/market'); return; }

      const creatorData = Array.isArray(plData.profiles) ? plData.profiles[0] : plData.profiles;
      setInfo({
        id: plData.id,
        name: plData.name,
        creator_name: creatorData?.username || 'Unknown Curator',
        creator_wallet: creatorData?.wallet_address,
        creator_avatar: creatorData?.avatar_url,
        created_at: plData.created_at,
        fork_count: plData.fork_count || 0
      });

      const { data: items } = await supabase.from('playlist_items').select('tracks(*)').eq('playlist_id', playlistId).order('added_at', { ascending: true });
      const rawTracks = items?.map((i: any) => i.tracks).filter(Boolean) || [];

      let myOwnedIds = new Set<number>();
      if (address) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
        if (profile) {
          const { data: collections } = await supabase.from('collections').select('track_id').eq('profile_id', profile.id).or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`);
          collections?.forEach((c: any) => myOwnedIds.add(c.track_id));
        }
      }

      setTracks(rawTracks.map((t: any) => ({ ...t, is_owned: myOwnedIds.has(t.id) })));

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const openRentalModal = (type: 'single' | 'batch', track?: PlaylistTrack) => {
      if (!address) return toast.error("Connect wallet first");
      if (info?.creator_wallet === address) return toast("This is your playlist!", { icon: "😅" });
      
      setRentalTarget({ type, track });
      setShowRentalModal(true);
  };

  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      setShowRentalModal(false);

      if (rentalTarget?.type === 'batch') {
          await processCollect('FORK_NEW', { months, price }); 
          return;
      }

      if (address) {
          const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
          if (profile) {
              const { data: pls } = await supabase.from('playlists').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false });
              setMyPlaylists(pls || []);
          }
      }
      setShowPlaylistModal(true);
  };

  const processCollect = async (
    targetPlaylistId: string | "liked" | "FORK_NEW",
    overrideTerms?: { months: number; price: number }
  ) => {
    const terms = overrideTerms || tempRentalTerms;
    if (!rentalTarget || !terms || !address) return;

    const { months, price } = terms;

    setShowPlaylistModal(false);
    const toastId = toast.loading("Checking balance & Processing...");

    try {
        // ---------------------------------------------------------
        // 1. 내 pMLD(포인트) 잔액 확인 (공통)
        // ---------------------------------------------------------
        const { data: balanceData } = await supabase
            .from('p_mld_balances')
            .select('balance')
            .eq('wallet_address', address)
            .single();
        
        const myBalance = balanceData?.balance || 0;
        const usePmld = myBalance >= price; // 포인트가 충분하면 True

        // ---------------------------------------------------------
        // [A] BATCH: Collect Playlist (Fork) - ✅ 여기를 수정했습니다!
        // ---------------------------------------------------------
        if (rentalTarget.type === "batch") {
            
            // 2-A. 포인트 부족 시 -> 지갑(MLD) 결제 진행
            if (!usePmld && price > 0) {
                toast.loading("Insufficient points. Please sign wallet transaction...", { id: toastId });
                try {
                    const tx = prepareContractCall({
                        contract: tokenContract,
                        method: "transfer",
                        // 배치는 플랫폼 트레저리(또는 큐레이터)로 전송. 
                        // 로직상 일단 플랫폼 주소로 보낸다고 가정 (DB에서 큐레이터에게 포인트 지급하므로)
                        params: [PLATFORM_TREASURY_ADDRESS, parseEther(price.toString())],
                    });
                    await sendTransaction(tx);
                } catch (txErr) {
                    console.error(txErr);
                    toast.error("Transaction cancelled", { id: toastId });
                    return; // 결제 실패 시 중단
                }
            }

            // 3-A. DB 통합 함수 호출 (결제 수단 플래그 전달)
            toast.loading("Finalizing collection...", { id: toastId });
            
            const { data: rpcRes, error: rpcErr } = await supabase.rpc(
                "collect_playlist_batch", // ✅ 방금 만든 통합 함수
                {
                    p_playlist_id: parseInt(playlistId),
                    p_wallet_address: address,
                    p_use_pmld: usePmld, // ✅ 포인트 사용 여부 전달 (True면 차감, False면 통과)
                    p_amount: price
                }
            );

            if (rpcErr) throw rpcErr;
            if (rpcRes === "INSUFFICIENT_PMLD") throw new Error("Insufficient Points (DB Check)");
            if (rpcRes !== "SUCCESS") throw new Error(String(rpcRes || "Unknown Error"));

            // 성공 처리
            toast.success(usePmld ? "Collected with pMLD!" : "Collected with MLD!", { id: toastId });
            setIsJustForked(true);
            setRentalTarget(null);
            setTempRentalTerms(null);
            await fetchPlaylistData();
            return;
        }

        // ---------------------------------------------------------
        // [B] SINGLE: Collect Track (기존 로직 유지하되 흐름 정리)
        // ---------------------------------------------------------
        const trackId = rentalTarget.track!.id;

        // 2-B. 포인트 부족 시 -> 지갑(MLD) 결제
        if (!usePmld && price > 0) {
            toast.loading("Insufficient points. Please sign wallet transaction...", { id: toastId });
            try {
                const recipient = rentalTarget.track?.uploader_address || PLATFORM_TREASURY_ADDRESS;
                const tx = prepareContractCall({
                    contract: tokenContract,
                    method: "transfer",
                    params: [recipient, parseEther(price.toString())],
                });
                await sendTransaction(tx);
            } catch (txErr) {
                toast.error("Transaction cancelled", { id: toastId });
                return;
            }
        }

        // 3-B. DB 처리 (단건은 기존 RPC 사용하거나, 단건용 통합 함수가 있다면 교체)
        // 여기서는 기존 로직대로 분기 호출하거나, `rent_track_via_wallet` 같은게 있다면 사용
        // (기존 코드의 로직을 그대로 살려서 pMLD/MLD 분기 처리)
        
        let rpcName = usePmld ? "add_to_collection_using_p_mld_by_wallet" : "add_to_collection_using_mld_by_wallet";
        let rpcParams: any = {
            p_wallet_address: address,
            p_track_id: trackId,
            p_duration_months: months,
        };
        if (!usePmld) rpcParams.p_amount_mld = price;

        const { data: singleRes, error: singleErr } = await supabase.rpc(rpcName, rpcParams);

        if (singleErr) throw singleErr;
        if (singleRes !== "OK") throw new Error(String(singleRes || "Failed"));

        // 플레이리스트 삽입 및 좋아요 처리
        if (targetPlaylistId !== "liked" && targetPlaylistId !== "FORK_NEW") {
            await supabase.from("playlist_items").insert({
                playlist_id: parseInt(targetPlaylistId),
                track_id: trackId,
            });
        }
        await supabase.from("likes").upsert({ wallet_address: address, track_id: trackId }, { onConflict: "wallet_address, track_id" });

        toast.success(usePmld ? "Collected with pMLD" : "Collected with MLD", { id: toastId });
        setRentalTarget(null);
        setTempRentalTerms(null);
        await fetchPlaylistData();

    } catch (e: any) {
        console.error(e);
        toast.error(`Failed: ${e?.message || "Unknown error"}`, { id: toastId });
    }
  };

  // ✅ [NEW] Play Helper (전체 목록을 큐로 설정)
  const handlePlay = (track: PlaylistTrack) => {
      // 큐에 넣을 때는 PlaylistTrack 타입에서 Track 타입으로 호환됨
      playTrack(track, tracks);
  };

  const coverImages = tracks.slice(0, 4).map(t => t.cover_image_url).filter(Boolean);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-green-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      
      {/* ⚠️ Local <audio> removed */}

      <div className="relative min-h-[350px] bg-gradient-to-b from-zinc-800 to-black p-6 md:p-10 flex flex-col justify-between">
        
        <div className="flex justify-between items-start z-[100] mb-8 relative">
            <button onClick={() => router.back()} className="bg-black/30 backdrop-blur px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition flex items-center gap-2 text-white border border-white/5">
                <ArrowLeft size={16}/> Back
            </button>
            <HeaderProfile />
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 z-10 relative">
            <div className="w-48 h-48 md:w-60 md:h-60 bg-zinc-900 shadow-2xl shadow-black/50 rounded-lg overflow-hidden grid grid-cols-2 flex-shrink-0">
                {coverImages.length > 0 ? (
                    coverImages.length === 1 ? ( <img src={coverImages[0] as string} className="col-span-2 row-span-2 w-full h-full object-cover"/> ) : (
                        [0, 1, 2, 3].map(i => (
                            <div key={i} className="w-full h-full bg-zinc-800 overflow-hidden border border-black/10">
                                {coverImages[i] ? <img src={coverImages[i] as string} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music size={20} className="text-zinc-600"/></div>}
                            </div>
                        ))
                    )
                ) : ( <div className="col-span-2 row-span-2 flex items-center justify-center bg-zinc-800"><Disc size={48} className="text-zinc-600"/></div> )}
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Public Playlist</span>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{info?.name}</h1>
                <div className="flex items-center justify-center md:justify-start gap-3 text-sm font-medium text-zinc-300">
                    <Link href={info?.creator_wallet ? `/u?wallet=${info.creator_wallet}` : '#'} className="flex items-center gap-2 bg-zinc-900/50 pr-3 rounded-full hover:bg-zinc-800 transition cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden">
                            {info?.creator_avatar ? <img src={info.creator_avatar} className="w-full h-full object-cover"/> : <User className="p-1.5"/>}
                        </div>
                        <span className="hover:text-white hover:underline">{info?.creator_name}</span>
                    </Link>
                    <span>•</span><span>{tracks.length} songs</span><span>•</span><span className="text-zinc-500">{info?.fork_count} forks</span>
                </div>
            </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 bg-black/95 backdrop-blur z-40 border-b border-zinc-900">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => { if(tracks.length > 0) handlePlay(tracks[0]); }}
                className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg shadow-green-500/20"
            >
                {/* Global Player State Check */}
                {isPlaying && currentTrack?.id === tracks[0]?.id ? <Pause fill="black" size={24}/> : <Play fill="black" size={24} className="ml-1"/>}
            </button>
            <button onClick={handleShare} className="text-zinc-400 hover:text-white p-2"><Share2 size={24}/></button>
        </div>

        <button 
            onClick={() => !isJustForked && openRentalModal('batch')}
            disabled={isJustForked} 
            className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition shadow-lg 
                ${isJustForked 
                    ? 'bg-zinc-800 text-green-500 border border-green-500/30' 
                    : isAllOwned 
                        ? 'bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 shadow-blue-900/50' 
                }`}
        >
            {isJustForked ? <Check size={18}/> : (isAllOwned ? <Copy size={18}/> : <Zap size={18} fill="currentColor"/>)}
            <div className="flex flex-col items-start leading-none">
                <span>
                    {isJustForked ? "Saved in Library" : (isAllOwned ? "Fork to Library" : `Collect All (${unownedTracks.length})`)}
                </span>
                {!isJustForked && (<span className="text-[10px] opacity-80 mt-0.5">Auto (pMLD → MLD)</span>)}
            </div>
        </button>
      </div>

      <div className="px-2 md:px-10 py-4">
        <table className="w-full text-left border-collapse">
            <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800 hidden md:table-header-group">
                <tr>
                    <th className="font-normal p-3 w-12 text-center">#</th>
                    <th className="font-normal p-3">Title</th>
                    <th className="font-normal p-3 w-40 text-center">Status</th>
                    {/* Duration은 PlayerContext에 없어서 Track 데이터 활용 */}
                    <th className="font-normal p-3 w-20 text-right"><Clock size={16} className="inline"/></th>
                </tr>
            </thead>
            <tbody>
                {tracks.map((track, idx) => {
                    const isThisTrackActive = currentTrack?.id === track.id;
                    const isThisTrackPlaying = isThisTrackActive && isPlaying;

                    return (
                        <tr 
                            key={track.id} 
                            className={`group hover:bg-white/5 rounded-lg transition cursor-pointer ${isThisTrackActive ? 'bg-white/5' : ''}`}
                            onClick={() => handlePlay(track)}
                        >
                            <td className="p-3 w-12 text-center text-zinc-500 text-sm">
                                <span className={`group-hover:hidden ${isThisTrackActive ? 'hidden' : 'block'}`}>{idx + 1}</span>
                                <button onClick={() => isThisTrackActive ? togglePlay() : handlePlay(track)} className={`hidden group-hover:inline-block ${isThisTrackActive ? '!inline-block' : ''}`}>
                                    {isThisTrackPlaying ? <Pause size={14} fill="currentColor" className="text-green-500"/> : <Play size={14} fill="currentColor" className={isThisTrackActive ? 'text-green-500' : 'text-white'}/>}
                                </button>
                            </td>
                            <td className="p-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-md overflow-hidden flex-shrink-0 relative">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <Disc className="p-3 text-zinc-600"/>}
                                        {isThisTrackPlaying && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full animate-ping"/></div>}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm md:text-base ${isThisTrackActive ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
                                        <div className="text-zinc-500 text-xs md:text-sm">{track.artist?.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    {track.is_owned ? (
                                        <span className="text-[10px] font-bold text-zinc-500 border border-zinc-700 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle2 size={10}/> OWNED</span>
                                    ) : (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); openRentalModal('single', track); }}
                                            className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-blue-400 hover:text-black transition"
                                        >
                                            <Zap size={10}/> {BASE_PRICE} MLD
                                        </button>
                                    )}
                                    {track.is_minted && (
                                        <button onClick={(e) => { e.stopPropagation(); setTrackToInvest(track); }} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-500 hover:text-yellow-400 transition"><Zap size={16}/></button>
                                    )}
                                </div>
                            </td>
                            <td className="p-3 text-right text-zinc-500 text-sm font-mono hidden md:table-cell">
                                {/* Track Duration은 DB에 없으면 임의 표시 (Global Player는 audio load 후 알 수 있음) */}
                                --:--
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        
        {tracks.length === 0 && !loading && (
            <div className="text-center py-20 text-zinc-500">This playlist is empty.</div>
        )}
      </div>

      {/* ⚠️ Local Player UI Removed (Handled by GlobalPlayer) */}

      {showRentalModal && rentalTarget && (
        <RentalModal
            isOpen={showRentalModal}
            onClose={() => setShowRentalModal(false)}
            onConfirm={handleRentalConfirm}
            targetTitle={rentalTarget.type === 'single' ? rentalTarget.track?.title : info?.name}
            trackCount={rentalTarget.type === 'single' ? 1 : unownedTracks.length}
            basePrice={BASE_PRICE}
        />
      )}

      <PlaylistSelectionModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        playlists={myPlaylists}
        onSelect={processCollect}
      />

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
    </div>
  );
}