'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Link } from "@/lib/i18n"; 
import { supabase } from '@/utils/supabase';
import { 
  Play, Pause, Heart, Clock, CheckCircle2, 
  Copy, Share2, Disc, User, Loader2, Zap, Music, ArrowLeft,
  Shuffle, SkipBack, SkipForward, Repeat, Repeat1, Volume2, VolumeX, Check 
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
import MobilePlayer from '../../components/MobilePlayer';
import HeaderProfile from '../../components/HeaderProfile'; 
import PlaylistSelectionModal from '../../components/PlaylistSelectionModal';

// Constants
const BASE_PRICE = 10;
const PLATFORM_TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000"; 

const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

type Track = {
  id: number;
  title: string;
  artist_name: string;
  cover_image_url: string | null;
  audio_url: string;
  duration: number;
  is_owned?: boolean;
  token_id?: number | null;
  is_minted?: boolean;
  uploader_address?: string;
  expires_at?: string | null;
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
};

type PlaylistInfo = {
  id: number;
  name: string;
  creator_name: string;
  creator_wallet: string;
  creator_avatar: string | null;
  created_at: string;
  fork_count: number;
};

export default function PublicPlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.id as string;
  
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Data State
  const [info, setInfo] = useState<PlaylistInfo | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Modal State
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [rentalTarget, setRentalTarget] = useState<{ type: 'single' | 'batch', track?: Track } | null>(null);
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  // ✅ [New] 방금 포크했는지 여부 (버튼 상태 변경용)
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

  // --- Audio Handlers ---
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
        if (audio.src !== currentTrack.audio_url) {
            audio.src = currentTrack.audio_url;
            audio.load();
            setCurrentTime(0);
            if (isPlaying) audio.play().catch(() => {});
        }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack) { isPlaying ? audio.play().catch(() => {}) : audio.pause(); }
  }, [isPlaying]);

  const handleNext = () => {
      if (tracks.length === 0) return;
      let nextIdx = 0;
      const currIdx = tracks.findIndex(t => t.id === currentTrack?.id);
      if (isShuffle) nextIdx = Math.floor(Math.random() * tracks.length);
      else nextIdx = (currIdx + 1) % tracks.length;
      setCurrentTrack(tracks[nextIdx]);
      setIsPlaying(true);
  };

  const handlePrev = () => {
      if (tracks.length === 0) return;
      const currIdx = tracks.findIndex(t => t.id === currentTrack?.id);
      const prevIdx = (currIdx - 1 + tracks.length) % tracks.length;
      setCurrentTrack(tracks[prevIdx]);
      setIsPlaying(true);
  };

  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const openRentalModal = (type: 'single' | 'batch', track?: Track) => {
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

  const processCollect = async (targetPlaylistId: string | 'liked' | 'FORK_NEW', overrideTerms?: { months: number, price: number }) => {
      const terms = overrideTerms || tempRentalTerms;
      if (!rentalTarget || !terms || !address) return;
      const { months, price } = terms;

      setShowPlaylistModal(false);
      const toastId = toast.loading("Processing payment...");

      if (price > 0) {
          try {
            const recipient = rentalTarget.type === 'single' 
                ? (rentalTarget.track?.uploader_address || PLATFORM_TREASURY_ADDRESS)
                : PLATFORM_TREASURY_ADDRESS;

            const transaction = prepareContractCall({
                contract: tokenContract,
                method: "transfer",
                params: [recipient, parseEther(price.toString())]
            });
            await sendTransaction(transaction);
          } catch(e) {
              console.error(e);
              toast.error("Transaction Failed", { id: toastId });
              return;
          }
      }

      try {
            if (rentalTarget.type === 'batch') {
              // 🚨 [수정됨] 새로 만든 수익 공유 RPC 호출
              const { data, error } = await supabase.rpc('collect_playlist_with_reward', {
                  p_playlist_id: parseInt(playlistId), // string -> number 변환 필요
                  p_wallet_address: address,
                  p_amount: price
              });
              
              if (error) throw error;
              
              // RPC에서 'SUCCESS'를 반환하도록 짰으므로 확인 (선택사항)
              if (data !== 'SUCCESS' && data !== null) {
                 // 커스텀 에러 처리 필요시 작성
              }

              toast.success("Playlist Forked & Reward Sent!", { id: toastId });
              
              // ✅ [Updated] 포크 성공 시 완료 상태로 변경
            setIsJustForked(true);

          } else {
              const { error: rentError } = await supabase.rpc('rent_track_via_wallet', {
                  p_wallet_address: address,
                  p_track_id: rentalTarget.track!.id,
                  p_months: months,
                  p_price: price
              });
              if(rentError) throw rentError;

              if (targetPlaylistId !== 'liked' && targetPlaylistId !== 'FORK_NEW') {
                  await supabase.from('playlist_items').insert({
                      playlist_id: parseInt(targetPlaylistId),
                      track_id: rentalTarget.track!.id
                  });
              }
              
              await supabase.from('likes').upsert({ wallet_address: address, track_id: rentalTarget.track!.id }, { onConflict: 'wallet_address, track_id' });
              toast.success("Track Collected!", { id: toastId });
          }

          setRentalTarget(null);
          setTempRentalTerms(null);
          fetchPlaylistData(); 

      } catch(e: any) {
          console.error(e);
          toast.error("DB Error: " + e.message, { id: toastId });
      }
  };

  const coverImages = tracks.slice(0, 4).map(t => t.cover_image_url).filter(Boolean);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-green-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <audio ref={audioRef} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={handleNext} />

      <div className="relative min-h-[350px] bg-gradient-to-b from-zinc-800 to-black p-6 md:p-10 flex flex-col justify-between">
        
        {/* ✅ [Updated] Z-Index Fix: relative z-[100]으로 sticky header(z-40)보다 높게 설정 */}
        <div className="flex justify-between items-start z-[100] mb-8 relative">
            <button onClick={() => router.back()} className="bg-black/30 backdrop-blur px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition flex items-center gap-2 text-white border border-white/5">
                <ArrowLeft size={16}/> Back
            </button>
            <HeaderProfile />
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 z-10 relative">
            <div className="w-48 h-48 md:w-60 md:h-60 bg-zinc-900 shadow-2xl shadow-black/50 rounded-lg overflow-hidden grid grid-cols-2 flex-shrink-0">
                {coverImages.length > 0 ? (
                    coverImages.length === 1 ? (
                        <img src={coverImages[0] as string} className="col-span-2 row-span-2 w-full h-full object-cover"/>
                    ) : (
                        [0, 1, 2, 3].map(i => (
                            <div key={i} className="w-full h-full bg-zinc-800 overflow-hidden border border-black/10">
                                {coverImages[i] ? <img src={coverImages[i] as string} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music size={20} className="text-zinc-600"/></div>}
                            </div>
                        ))
                    )
                ) : (
                    <div className="col-span-2 row-span-2 flex items-center justify-center bg-zinc-800"><Disc size={48} className="text-zinc-600"/></div>
                )}
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Public Playlist</span>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{info?.name}</h1>
                
                <div className="flex items-center justify-center md:justify-start gap-3 text-sm font-medium text-zinc-300">
                    {/* ✅ [수정됨] div를 Link로 변경하고 href 연결 */}
                    <Link 
                        href={info?.creator_wallet ? `/u?wallet=${info.creator_wallet}` : '#'}
                        className="flex items-center gap-2 bg-zinc-900/50 pr-3 rounded-full hover:bg-zinc-800 transition cursor-pointer"
                    >
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
                onClick={() => { if(tracks.length > 0) { setCurrentTrack(tracks[0]); setIsPlaying(true); } }}
                className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg shadow-green-500/20"
            >
                {isPlaying ? <Pause fill="black" size={24}/> : <Play fill="black" size={24} className="ml-1"/>}
            </button>
            <button onClick={handleShare} className="text-zinc-400 hover:text-white p-2"><Share2 size={24}/></button>
        </div>

        {/* ✅ [Updated] Button Logic: 방금 포크했으면 'Saved', 이미 다 소유중이면 'Fork', 아니면 'Collect' */}
        <button 
            onClick={() => !isJustForked && openRentalModal('batch')}
            disabled={isJustForked} // 방금 포크했으면 비활성화
            className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition shadow-lg 
                ${isJustForked 
                    ? 'bg-zinc-800 text-green-500 border border-green-500/30' // 방금 완료 상태
                    : isAllOwned 
                        ? 'bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700' // 이미 소유중 (Fork 가능)
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105 shadow-blue-900/50' // 구매 필요
                }`}
        >
            {isJustForked ? <Check size={18}/> : (isAllOwned ? <Copy size={18}/> : <Zap size={18} fill="currentColor"/>)}
            
            <div className="flex flex-col items-start leading-none">
                <span>
                    {isJustForked 
                        ? "Saved in Library" 
                        : (isAllOwned ? "Fork to Library" : `Collect All (${unownedTracks.length})`)
                    }
                </span>
                {!isAllOwned && !isJustForked && <span className="text-[10px] opacity-80 mt-0.5">{unownedTracks.length * BASE_PRICE} MLD Total</span>}
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
                    <th className="font-normal p-3 w-20 text-right"><Clock size={16} className="inline"/></th>
                </tr>
            </thead>
            <tbody>
                {tracks.map((track, idx) => (
                    <tr 
                        key={track.id} 
                        className={`group hover:bg-white/5 rounded-lg transition cursor-pointer ${currentTrack?.id === track.id ? 'bg-white/5' : ''}`}
                        onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}
                    >
                        <td className="p-3 w-12 text-center text-zinc-500 text-sm">
                            <span className={`group-hover:hidden ${currentTrack?.id === track.id ? 'hidden' : 'block'}`}>{idx + 1}</span>
                            <Play size={14} className={`hidden group-hover:inline-block text-white ${currentTrack?.id === track.id ? '!inline-block text-green-500' : ''}`} fill="currentColor"/>
                        </td>
                        <td className="p-3">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-zinc-800 rounded-md overflow-hidden flex-shrink-0 relative">
                                    {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <Disc className="p-3 text-zinc-600"/>}
                                    {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full animate-ping"/></div>}
                                </div>
                                <div>
                                    <div className={`font-bold text-sm md:text-base ${currentTrack?.id === track.id ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
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
                            {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        
        {tracks.length === 0 && !loading && (
            <div className="text-center py-20 text-zinc-500">This playlist is empty.</div>
        )}
      </div>

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
            isLiked={true} 
            isRented={currentTrack.is_owned} 
            onToggleLike={() => {}} 
            onInvest={currentTrack.is_minted ? () => setTrackToInvest(currentTrack) : undefined}
        />
      )}

      {currentTrack && !mobilePlayerOpen && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}>
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                    {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <Disc size={20} className="text-zinc-500 m-auto"/>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                    <div className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</div>
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                {isPlaying ? <Pause size={16} fill="black"/> : <Play size={16} fill="black" className="ml-0.5"/>}
            </button>
        </div>
      )}

      {currentTrack && (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
            <div className="flex items-center gap-4 w-1/3">
                <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 relative">
                    {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <Disc size={24} className="text-zinc-700 m-auto"/>}
                </div>
                <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                    <div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist?.username}</div>
                </div>
                <button className="ml-2 text-pink-500 hover:scale-110 transition"><Heart size={20} fill="currentColor" /></button>
            </div>
            <div className="flex flex-col items-center gap-2 w-1/3">
                <div className="flex items-center gap-6">
                    <button onClick={() => setIsShuffle(!isShuffle)} className={`text-zinc-400 hover:text-white transition ${isShuffle ? 'text-green-500' : ''}`}><Shuffle size={16}/></button>
                    <button onClick={handlePrev} className="text-zinc-400 hover:text-white transition"><SkipBack size={20}/></button>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg">{isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}</button>
                    <button onClick={handleNext} className="text-zinc-400 hover:text-white transition"><SkipForward size={20}/></button>
                    <button onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} className={`text-zinc-400 hover:text-white transition ${repeatMode !== 'off' ? 'text-green-500' : ''}`}>{repeatMode === 'one' ? <Repeat1 size={16}/> : <Repeat size={16}/>}</button>
                </div>
                <div className="w-full max-w-sm flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => { if(audioRef.current) { const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; } }}><div className="h-full bg-white rounded-full relative z-10" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }}/></div>
                    <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
                </div>
            </div>
            <div className="w-1/3 flex justify-end items-center gap-4">
                <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-white">{isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
                <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setVolume(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)); setIsMuted(false); }}><div className="h-full bg-zinc-500 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }}/></div>
            </div>
        </div>
      )}

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
                id: trackToInvest.id,
                title: trackToInvest.title,
                token_id: trackToInvest.token_id ?? null,
                artist_name: trackToInvest.artist_name
            }}
        />
      )}
    </div>
  );
}