'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChevronUp, Wand2, AlertTriangle, Radio, Radius, Book, PlayCircle, Play, Pause, TrendingUp, Loader2, UploadCloud, Music as MusicIcon, Trash2, ExternalLink, Coins, CheckCircle, User, Heart, Mic2, LayoutGrid, Disc, SkipForward, SkipBack, Volume2, Star, Zap, ArrowRight, Search, Menu, ListMusic } from 'lucide-react';
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { supabase } from '@/utils/supabase';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
import MobilePlayer from '../components/MobilePlayer'; 
import TradeModal from '../components/TradeModal';
import RentalModal from '../components/RentalModal'; 
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import TokenBalance from '../components/TokenBalance';
import HorizontalScroll from '../components/HorizontalScroll'; 
import InvestmentCard from '../components/InvestmentCard';
import { formatEther, parseEther } from 'viem';
import { useMediaSession } from '@/hooks/useMediaSession';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const melodyIpContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

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
  mint_error?: string | null;
  duplicate_of_track_id?: number | null;
  genre?: string[] | string | null; // 아까 배열로 바뀐 부분 대응
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
};

type FeaturedPlaylist = {
  id: number;
  name: string;
  cover_image: string | null;
};

type Profile = { wallet_address: string; username: string; avatar_url: string | null; };
type Playlist = { id: number; name: string; cover_image_url?: string; fork_count: number; created_at: string; };

// ✅ [New] 중복 확인 모달 컴포넌트
function DuplicateCheckModal({ isOpen, onClose, originalTrack, onPlay }: any) {
    if (!isOpen || !originalTrack) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl w-full max-w-md relative shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-2 mb-4 text-red-500">
                    <AlertTriangle size={24} />
                    <h3 className="text-xl font-bold text-white">Submission Rejected</h3>
                </div>
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                    This track was rejected because a melody with the same hash is already registered on the blockchain.
                </p>
                <div className="bg-black/50 rounded-xl p-4 border border-zinc-800 flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {originalTrack.cover_image_url ? ( <img src={originalTrack.cover_image_url} className="w-full h-full object-cover"/> ) : ( <MusicIcon size={20} className="text-zinc-500 m-auto top-1/2 left-1/2 absolute -translate-x-1/2 -translate-y-1/2"/> )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-0.5">Original Registered Track</div>
                        <div className="font-bold text-white truncate">{originalTrack.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{originalTrack.artist?.username}</div>
                    </div>
                    <button onClick={() => onPlay(originalTrack)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition">
                        <Play size={16} fill="black" className="ml-0.5"/>
                    </button>
                </div>
                <button onClick={onClose} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition">Close</button>
            </div>
        </div>
    );
}

export default function MarketPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // Player & Data States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Lists Data
  const [hotTracks, setHotTracks] = useState<Track[]>([]);          // ✅ 1. Hot Tracks
  const [hotPlaylists, setHotPlaylists] = useState<Playlist[]>([]); // ✅ 2. Hot Playlists
  const [newTracks, setNewTracks] = useState<Track[]>([]);
  const [investTracks, setInvestTracks] = useState<Track[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<FeaturedPlaylist[]>([]);

  // Search Data States (Browse Replacement)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTracks, setSearchTracks] = useState<Track[]>([]);
  const [searchCreators, setSearchCreators] = useState<Profile[]>([]);
  const [searchPlaylists, setSearchPlaylists] = useState<Playlist[]>([]);

  const [loadingTop, setLoadingTop] = useState(true);
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Collect & Collection States
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<Track | null>(null);
  const [isRentalLoading, setIsRentalLoading] = useState(false);

  // Mobile UI States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off'|'all'|'one'>('all');
  const [isShuffle, setIsShuffle] = useState(false);

  // Duplicate Logic States
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOriginalTrack, setDuplicateOriginalTrack] = useState<Track | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const toastShownRef = useRef(false);

  // --- 1. Fetch User Data ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (!address) { setLikedTrackIds(new Set()); setRentedTrackIds(new Set()); return; }
      try {
        const { data: likeData } = await supabase.from('likes').select('track_id').eq('wallet_address', address);
        if (likeData) setLikedTrackIds(new Set(likeData.map((item: any) => item.track_id)));
        
        const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
        if (profile) {
            const now = new Date().toISOString();
            const { data: collectionData } = await supabase.from('collections').select('track_id').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
            if (collectionData) setRentedTrackIds(new Set(collectionData.map((item: any) => item.track_id)));
        }
      } catch (error) { console.error("Error fetching user data:", error); }
    };
    fetchUserData();
  }, [address]);

  // --- 2. Fetch Market Data (Hot Tracks, Hot Playlists, etc.) ---
  useEffect(() => {
    const fetchTopData = async () => {
      setLoadingTop(true);
      
      // ✅ [1] Hot Tracks (RPC 호출)
      const { data: hotTrackData } = await supabase.rpc('get_most_collected_tracks', { limit_count: 15 });
      setHotTracks(hotTrackData || []);

      // ✅ [2] Hot Playlists (수정됨: 커버 이미지 Join 조회)
      // playlist_items -> tracks -> cover_image_url 순서로 조인
      const { data: hotPlData } = await supabase
        .from('playlists')
        .select(`
            id, 
            name, 
            fork_count, 
            created_at, 
            playlist_items (
                added_at,
                tracks (cover_image_url)
            ),
            profiles (
                username,
                wallet_address
            )
        `)
        .is('original_playlist_id', null) // ✅ [추가됨] 원본 ID가 비어있는 것(즉, 원본)만 조회
        .order('fork_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(15);

      // 데이터 포맷팅: 첫 번째 트랙의 이미지를 대표 커버로 사용
      const formattedHotPlaylists = hotPlData?.map((pl: any) => {
          // playlist_items는 배열로 들어옴. added_at 기준 정렬이 필요하면 여기서 sort.
          // 보통 DB에서 가져올 때 순서가 보장되지 않으므로, 가장 먼저 추가된(혹은 최신) 곡을 썸네일로 씀.
          // 여기서는 배열의 첫 번째 요소 사용.
          const firstItem = pl.playlist_items?.[0];
          const coverUrl = firstItem?.tracks?.cover_image_url || null;
          
          return {
              ...pl,
              cover_image_url: coverUrl
          };
      }) || [];
      
      setHotPlaylists(formattedHotPlaylists);

      // [3] Fresh Drops
      const { data: newData } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').order('created_at', { ascending: false }).limit(15);
      setNewTracks(newData || []);

      // [4] Invest Tracks
      const { data: allData } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('is_minted', true).limit(20);
      setInvestTracks((allData || []).slice(0, 5));

      // [5] Creators
      const { data: creatorData } = await supabase.from('profiles').select('*').limit(20);
      setCreators(creatorData || []);

      setLoadingTop(false);
    };
    fetchTopData();

    // Featured Playlists
    const fetchPlaylists = async () => {
      const { data, error } = await supabase.from('playlists').select(`id, name, playlist_items (added_at, tracks (cover_image_url))`).eq('is_featured', true).order('id', { ascending: false });
      if (error) return;
      const formatted: FeaturedPlaylist[] = data.map((pl: any) => {
        const firstItem = pl.playlist_items?.[0]; 
        const coverUrl = firstItem?.tracks?.cover_image_url || null; 
        return { id: pl.id, name: pl.name, cover_image: coverUrl };
      });
      setFeaturedPlaylists(formatted);
    };
    fetchPlaylists();
  }, []);

// ✅ [수정] Search Logic: 빈 값일 때 결과 초기화 및 검색 중단
  const handleSearch = async (query: string) => {
      setSearchQuery(query);
      
      // 검색어가 없으면 결과를 싹 비우고 함수 종료 (API 호출 안 함)
      if (!query.trim()) {
          setIsSearching(false);
          setSearchTracks([]);
          setSearchCreators([]);
          setSearchPlaylists([]);
          return;
      }

      setIsSearching(true);
      try {
          const [tracksRes, creatorsRes, playlistsRes] = await Promise.all([
              supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').ilike('title', `%${query}%`).limit(10),
              supabase.from('profiles').select('*').ilike('username', `%${query}%`).limit(10),
              supabase.from('playlists').select('*').ilike('name', `%${query}%`).limit(10)
          ]);

          setSearchTracks(tracksRes.data || []);
          setSearchCreators(creatorsRes.data || []);
          setSearchPlaylists(playlistsRes.data || []);

      } catch (e) {
          console.error(e);
      } finally {
          setIsSearching(false);
      }
  };

  // --- Handlers (ToggleLike, Rental, etc.) ---
  const handleToggleLike = async (track: Track) => {
    if (!address) return toast.error("Please connect wallet first.");
    const isRented = rentedTrackIds.has(track.id);
    if (!isRented) { setPendingRentalTrack(track); setIsRentalModalOpen(true); return; }

    const isLiked = likedTrackIds.has(track.id);
    const nextSet = new Set(likedTrackIds);
    if (isLiked) nextSet.delete(track.id); else nextSet.add(track.id);
    setLikedTrackIds(nextSet);

    try {
      if (isLiked) await supabase.from('likes').delete().match({ wallet_address: address, track_id: track.id });
      else { await supabase.from('likes').insert({ wallet_address: address, track_id: track.id }); toast.success("Added to Liked Songs"); }
    } catch (e) { console.error(e); toast.error("Failed to update status."); setLikedTrackIds(likedTrackIds); }
  };

  const handleRentalConfirm = async (months: number, price: number) => {
    setTempRentalTerms({ months, price });
    if (!address) { toast.error("Wallet not connected."); return; }
    try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
        if (profile) {
            const { data: playlists } = await supabase.from('playlists').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false });
            setMyPlaylists(playlists || []);
        }
    } catch (error) { console.error(error); }
    setIsRentalModalOpen(false); 
    setShowPlaylistModal(true); 
  };

  const processCollect = async (playlistId: string | 'liked') => {
    const targetTrack = pendingRentalTrack; 
    if (!targetTrack || !address || !tempRentalTerms) return;
    setShowPlaylistModal(false);
    const { months, price } = tempRentalTerms;
    const toastId = toast.loading("Processing payment...");

    try {
      const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', { p_wallet_address: address, p_track_id: targetTrack.id, p_duration_months: months });
      if (rpcResult === 'OK') {
        if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: targetTrack.id });
        await supabase.from('likes').upsert({ wallet_address: address, track_id: targetTrack.id }, { onConflict: 'wallet_address, track_id' });
        toast.success("Collected using pMLD!", { id: toastId });
        setRentedTrackIds(prev => new Set(prev).add(targetTrack.id));
        setTempRentalTerms(null); setPendingRentalTrack(null);
        return;
      }
      if (rpcResult === 'INSUFFICIENT_PMLD') {
        toast.loading(`Insufficient pMLD. Requesting ${price} MLD...`, { id: toastId });
        let recipient = targetTrack.uploader_address || "0x0000000000000000000000000000000000000000"; 
        const transaction = prepareContractCall({ contract: melodyTokenContract, method: "transfer", params: [recipient, parseEther(price.toString())] });
        sendTransaction(transaction, {
          onSuccess: async () => {
            const { data: mldRpcResult } = await supabase.rpc('add_to_collection_using_mld_by_wallet', { p_wallet_address: address, p_track_id: targetTrack.id, p_duration_months: months, p_amount_mld: price });
            if (mldRpcResult === 'OK') {
                if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: targetTrack.id });
                await supabase.from('likes').upsert({ wallet_address: address, track_id: targetTrack.id }, { onConflict: 'wallet_address, track_id' });
                toast.success("Payment complete!", { id: toastId });
                setRentedTrackIds(prev => new Set(prev).add(targetTrack.id));
                setTempRentalTerms(null); setPendingRentalTrack(null);
            } else { toast.error(`Error: ${mldRpcResult}`, { id: toastId }); }
          },
          onError: () => { toast.error("Payment failed.", { id: toastId }); setIsRentalLoading(false); }
        });
      } else { toast.error(`Error: ${rpcResult}`, { id: toastId }); setIsRentalLoading(false); }
    } catch (e: any) { toast.error(e.message, { id: toastId }); setIsRentalLoading(false); }
  };

  const handleRegister = async (track: Track) => {
      if (!address) return toast.error("Wallet required.");
      if (processingTrackId) return; 
      setProcessingTrackId(track.id);
      const uniqueHash = `${track.melody_hash || 'hash'}_${track.id}_${Date.now()}`;
      try {
        toast.loading("Signature required...", { id: 'register-toast' });
        const { data: contributors } = await supabase.from('track_contributors').select('*').eq('track_id', track.id);
        let payees: string[] = [address]; let shares: bigint[] = [BigInt(10000)];
        if (contributors && contributors.length > 0) {
            const valid = contributors.filter(c => c.wallet_address && c.wallet_address.startsWith('0x'));
            if (valid.length > 0) {
                payees = valid.map(c => c.wallet_address);
                const raw = valid.map(c => Math.round(Number(c.share_percentage) * 100));
                const sum = raw.reduce((a, b) => a + b, 0);
                if (raw.length > 0) raw[0] += (10000 - sum);
                shares = raw.map(s => BigInt(s));
            }
        }
        const transaction = prepareContractCall({ contract: melodyIpContract, method: "registerMusic", params: [uniqueHash, payees, shares, BigInt(500), true, track.audio_url] });
        sendTransaction(transaction, {
            onSuccess: async () => {
                await supabase.from('tracks').update({ is_minted: true, token_id: track.id }).eq('id', track.id);
                toast.success("Registered!", { id: 'register-toast' });
                // 리스트 업데이트
                const updateList = (list: Track[]) => list.map(t => t.id === track.id ? { ...t, is_minted: true } : t);
                setSearchTracks(updateList(searchTracks));
                setNewTracks(updateList(newTracks));
                setHotTracks(updateList(hotTracks));
                setProcessingTrackId(null);
            },
            onError: (err) => { console.error(err); toast.error("Transaction failed.", { id: 'register-toast' }); setProcessingTrackId(null); }
        });
      } catch (e) { console.error(e); toast.error("Error occurred.", { id: 'register-toast' }); setProcessingTrackId(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete track?")) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (!error) { 
        toast.success("Deleted."); 
        setSearchTracks(prev => prev.filter(t => t.id !== id));
        setNewTracks(prev => prev.filter(t => t.id !== id));
        setHotTracks(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleCheckDuplicate = async (originalTrackId: number) => {
      if (!originalTrackId) return;
      const toastId = toast.loading("Checking info...");
      try {
          const { data, error } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('id', originalTrackId).single();
          if (error || !data) throw new Error("Original track not found");
          setDuplicateOriginalTrack(data);
          setShowDuplicateModal(true);
          toast.dismiss(toastId);
      } catch (e) { toast.error("Failed to load info", { id: toastId }); }
  };

  const handleInvest = (track: Track) => { if (!address) return toast.error("Connect wallet."); setSelectedTrack(track); };

  // Audio & Helper
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack) {
        if (audio.src !== currentTrack.audio_url) { audio.src = currentTrack.audio_url; setCurrentTime(0); toastShownRef.current = false; }
        if (isPlaying) audio.play().catch(console.error); else audio.pause();
    } else audio.pause();
  }, [currentTrack, isPlaying]);

  

  const handleNext = () => { if (!currentTrack) return; const list = newTracks; const idx = list.findIndex(t => t.id === currentTrack.id); if (idx !== -1 && idx < list.length - 1) setCurrentTrack(list[idx + 1]); };
  const handlePrev = () => { if (!currentTrack) return; const list = newTracks; const idx = list.findIndex(t => t.id === currentTrack.id); if (idx > 0) setCurrentTrack(list[idx - 1]); };
  const formatTime = (time: number) => { if(isNaN(time)) return "0:00"; const min = Math.floor(time / 60); const sec = Math.floor(time % 60); return `${min}:${sec < 10 ? '0' : ''}${sec}`; };
  const isCurrentTrackRented = currentTrack ? rentedTrackIds.has(currentTrack.id) : false;

  // ✅ [적용] 딱 이 부분만 추가하면 됩니다!
  useMediaSession({
    title: currentTrack?.title || "No Title",
    artist: currentTrack?.artist?.username || "Unknown",
    coverUrl: currentTrack?.cover_image_url || "",
    isPlaying: isPlaying,
    //@ts-ignore
    audioRef: audioRef,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    next: handleNext, // 다음 곡 함수
    prev: handlePrev, // 이전 곡 함수
    seekTo: (time) => { // (선택사항) 탐색 기능
        if(audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }
  });

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <audio ref={audioRef} onTimeUpdate={(e) => {
          const time = e.currentTarget.currentTime;
          if (!isCurrentTrackRented && time >= 60) {
              e.currentTarget.pause(); setIsPlaying(false);
              if (!toastShownRef.current) { toast("Preview ended. Collect to listen full track!", { icon: "🔒", id: "preview-end-toast", style: { borderRadius: '10px', background: '#333', color: '#fff' } }); toastShownRef.current = true; }
          } else { setCurrentTime(time); if (time < 59) toastShownRef.current = false; }
      }} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => setIsPlaying(false)} preload="auto" crossOrigin="anonymous"/>
      
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 hidden md:flex flex-col p-6 h-screen sticky top-0">
         <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 cursor-pointer">unlisted</div>
         <Link href="/radio">
            <button className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold py-4 rounded-xl mb-8 flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-blue-900/20 group">
                <Radio size={20} className="group-hover:animate-pulse" fill="currentColor"/> Start Stream
            </button>
         </Link>
         <nav className="space-y-6 flex-1">
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Discover</h3>
                 <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition"><Disc size={18}/> <span className="text-sm font-medium">Explore</span></div>
                 <Link href="/investing"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition"><TrendingUp size={18}/> <span className="text-sm font-medium">Invest</span></div></Link>
             </div>
             <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">My Studio</h3>
                <Link href="/library"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition"><PlayCircle size={18}/> <span className="text-sm font-medium">Playlists</span></div></Link>
                <Link href="/portfolio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition"><Book size={18}/> <span className="text-sm font-medium">Portfolio</span></div></Link>
            </div>
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3>
                <Link href="/studio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition"><Coins size={18}/> <span className="text-sm font-medium">Earnings</span></div></Link>
                <Link href="/earn"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition"><Zap size={18} className="text-yellow-500"/> <span className="text-sm font-medium text-yellow-500">Free Faucet</span></div></Link>
             </div>
            <div className="pt-6 mt-auto border-t border-zinc-800">
                <Link href="/upload"><button className="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition group"><UploadCloud size={18} className="group-hover:text-cyan-400 transition-colors"/> <span className="text-sm">Upload & Earn</span></button></Link>
            </div>
            <div className="pt-4 border-t border-zinc-800">
                <Link href="/create"><button className="w-full rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2 text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-blue-900/30 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 hover:shadow-blue-900/50 transition-all duration-200 active:scale-[0.99] group"><Wand2 size={18} className="opacity-95 group-hover:opacity-100 transition-opacity" /><span>Create Track</span></button></Link>
            </div>
         </nav>
      </aside>

      <main ref={mainRef} className="flex-1 flex flex-col overflow-y-auto pb-24 scroll-smooth relative">
        <header className="flex justify-between items-center p-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-800">
          <div className="flex items-center gap-4">
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu/></button>
             <h1 className="text-xl font-bold">Explore</h1>
          </div>
          <div className="flex items-center gap-3"> <TokenBalance address={address} /> <HeaderProfile /> </div>
        </header>

        {loadingTop ? (
            <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-cyan-500" size={32}/></div>
        ) : (
            <div className="pb-10 pt-4">
                {/* 0. Playlists for you (수정됨: 패딩 이슈 해결) */}
                <section className="mb-2">
                    <div className="px-6 mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white flex items-center gap-2">Playlists from unlisted</h2></div>
                    {/* ✅ !px-6 scroll-pl-6 추가하여 모바일 패딩 강제 적용 */}
                    <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> 
                    {featuredPlaylists.length === 0 ? ( <div className="text-zinc-500 text-sm px-6">No playlists available yet.</div> ) : (
                        featuredPlaylists.map((pl) => (
                        <Link href={`/playlists/${pl.id}`} key={pl.id} className="flex-shrink-0 snap-start block">
                            <div className="relative overflow-hidden rounded-xl bg-zinc-800 group cursor-pointer border border-zinc-700 hover:border-white/20 min-w-[160px] w-[120px] h-[160px] md:w-[240px] md:h-[240px]">
                                {pl.cover_image ? ( <img src={pl.cover_image} alt={pl.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-700 to-zinc-900"><Disc size={32} className="text-zinc-600 md:w-16 md:h-16" /></div> )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3 pointer-events-none"><span className="text-white font-medium text-xs md:text-sm drop-shadow-md break-words line-clamp-2 text-left">{pl.name}</span></div>
                            </div>
                        </Link>
                        ))
                    )}
                    </HorizontalScroll>
                </section>

                {/* ✅ 1. Hot Tracks (New) */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Hot Tracks</h2></div>
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                        {hotTracks.map((t) => (
                            <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => { setCurrentTrack(t); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group-hover:border-white/20 transition">
                                    {t.cover_image_url ? <img src={t.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/> : <MusicIcon className="w-full h-full p-10 text-zinc-600"/>}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Play fill="white"/></div>
                                </div>
                                <h3 className="font-bold text-sm truncate">{t.title}</h3>
                                <p className="text-xs text-zinc-500 truncate">{t.artist?.username}</p>
                            </div>
                        ))}
                    </HorizontalScroll>
                </section>

                {/* ✅ 2. Hot Playlists (수정됨: 패딩 해결 & UI 변경) */}
                <section className="py-6 border-b border-zinc-800/50 bg-zinc-900/10">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"> Hot Playlists</h2></div>
                    {/* ✅ !px-6 scroll-pl-6 추가 */}
                    <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> 
                        {hotPlaylists.map((pl: any) => (
                            <div key={pl.id} className="flex-shrink-0 snap-start block min-w-[160px] w-[160px]">
                                {/* 1) Cover Image Area */}
                                <Link href={`/playlists/${pl.id}`}>
                                    <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group cursor-pointer hover:border-white/20 transition">
                                        {pl.cover_image_url ? (
                                            <img src={pl.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-800 to-zinc-900">
                                                <ListMusic size={32} className="text-zinc-600"/>
                                            </div>
                                        )}
                                        
                                        {/* ✅ UI 변경: 왼쪽 아래 하트 아이콘 + Fork 수 (그림자 포함) */}
                                        <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10">
                                            <div className="bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1 border border-white/10 shadow-md">
                                                <Heart size={10} className="text-white fill-white"/>
                                                <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md">
                                                    {pl.fork_count || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                {/* 2) Meta Data Area */}
                                <div>
                                    <Link href={`/playlists/${pl.id}`}>
                                        <h3 className="font-bold text-sm truncate hover:text-cyan-400 transition mb-0.5">
                                            {pl.name}
                                        </h3>
                                    </Link>
                                    
                                    {/* ✅ UI 변경: 아티스트 이름 + 유저 페이지 링크 */}
                                    <Link href={pl.owner_wallet ? `/u?wallet=${pl.owner_wallet}` : '#'} className="inline-block">
                                        <div className="text-xs text-zinc-500 truncate hover:text-white hover:underline transition flex items-center gap-1">
                                            {pl.owner_name}
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </HorizontalScroll>
                </section>
                
                {/* 3. Fresh Drops */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2">Fresh Drops</h2></div>
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                        {newTracks.map((t) => (
                            <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => { setCurrentTrack(t); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group-hover:border-white/20 transition">
                                    {t.cover_image_url ? <img src={t.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/> : <MusicIcon className="w-full h-full p-10 text-zinc-600"/>}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Play fill="white"/></div>
                                </div>
                                <h3 className="font-bold text-sm truncate">{t.title}</h3>
                                <p className="text-xs text-zinc-500 truncate">{t.artist?.username}</p>
                            </div>
                        ))}
                    </HorizontalScroll>
                </section>

                {/* 4. Popular Creators */}
                <section className="py-6 border-b border-zinc-800/50 bg-zinc-900/20">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2">Trending Artists</h2></div>
                    <HorizontalScroll className="gap-6 px-6 pb-2 snap-x pt-2"> 
                        {creators.map((c:any) => (
                            <Link href={`/u?wallet=${c.wallet_address}`} key={c.id}>
                                <div className="flex flex-col items-center gap-2 cursor-pointer group min-w-[80px]">
                                    <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 group-hover:border-cyan-500 transition">
                                        {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover"/> : <User className="w-full h-full p-5 text-zinc-500"/>}
                                    </div>
                                    <span className="text-xs font-bold truncate w-20 text-center">{c.username || 'User'}</span>
                                </div>
                            </Link>
                        ))}
                    </HorizontalScroll>
                </section>

                {/* 5. Top Investments */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4 flex justify-between items-end">
                        <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-green-400" size={20}/> Top Investment</h2>
                        <Link href="/investing" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">View Chart <ArrowRight size={12}/></Link>
                    </div>
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2 scrollbar-hide"> 
                        {investTracks.map((t) => ( <InvestmentCard key={t.id} track={t} onPlay={(track) => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }} onInvest={(track) => handleInvest(track)} /> ))}
                        {investTracks.length === 0 && ( <div className="min-w-[240px] h-[260px] flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl text-zinc-500 text-xs"><p>No investment tracks yet.</p></div> )}
                    </HorizontalScroll>
                </section>

                {/* ✅ 6. Search Section (수정됨: 가운데 정렬 & 타이틀 추가 & 빈 결과 처리) */}
                <section className="p-6 min-h-[600px] flex flex-col items-center pt-20">
                    <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                        
                        {/* Title Text */}
                        <div className="text-center space-y-2">
                             <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 tracking-tight pb-2 leading-tight">
                                What are you looking for?
                             </h2>
                             <p className="text-zinc-500">Discover tracks, artists, and playlists.</p>
                        </div>
                        
                        {/* Centered Big Search Bar */}
                        <div className="relative w-full max-w-2xl group">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition duration-500"/>
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition" size={22}/>
                            <input 
                                type="text" 
                                placeholder="e.g., Cozy bedroom pop for late night" 
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-5 pl-16 pr-6 text-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-800/50 transition relative z-10 shadow-2xl" 
                                value={searchQuery} 
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                            {isSearching && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 text-cyan-500 animate-spin z-20" size={22} />}
                        </div>
                    </div>

                    {/* Search Results Container */}
                    <div className="mt-16 w-full max-w-6xl space-y-12">
                        
                        {/* 결과가 없을 때 (검색어는 있는데 결과가 0개) */}
                        {searchQuery && !isSearching && searchTracks.length === 0 && searchCreators.length === 0 && searchPlaylists.length === 0 && (
                            <div className="text-center py-10 animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search size={24} className="text-zinc-600"/>
                                </div>
                                <p className="text-zinc-500">No results found for "<span className="text-white font-bold">{searchQuery}</span>"</p>
                            </div>
                        )}

                        {/* 검색어가 없을 때는 아무것도 안 보여줌 (기존에는 여기서 리스트가 떴음) */}
                        {!searchQuery && (
                            <div className="hidden"></div>
                        )}

                        {/* 1) Tracks Result */}
                        {searchTracks.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Tracks</h3>
                                <div className="space-y-2">
                                    {searchTracks.map((track) => {
                                        // ... (기존 트랙 렌더링 로직 유지: isOwner, Error 체크 등)
                                        const isOwner = address && track.uploader_address && address.toLowerCase() === track.uploader_address.toLowerCase();
                                        const isProcessingThis = processingTrackId === track.id && (isPending);
                                        const errorString = track.mint_error ? String(track.mint_error).trim() : '';
                                        const isDuplicateError = errorString.includes('duplicate_melody_hash') || !!track.duplicate_of_track_id;

                                        if (!isOwner && isDuplicateError) return null;

                                        return (
                                            <div key={track.id} className={`group flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${currentTrack?.id === track.id ? 'bg-zinc-900 border-cyan-500/50' : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`} onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 relative">
                                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <MusicIcon size={20} className="text-zinc-700"/>}
                                                        {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"/></div>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-base text-white">{track.title}</div>
                                                        <Link href={`/u?wallet=${track.artist?.wallet_address}`} className="text-xs text-zinc-500">{track.artist?.username || 'Unlisted Artist'}</Link>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {/* 버튼 로직 그대로 복사해서 사용하시면 됩니다 */}
                                                    {(() => {
                                                        if (isDuplicateError && isOwner) {
                                                            return <button className="text-red-500 text-xs border border-red-500/30 px-3 py-1 rounded bg-red-500/10">Rejected</button>;
                                                        }
                                                        if (track.is_minted) return <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white hover:text-black transition">Invest</button>;
                                                        if (isOwner) return <button onClick={(e) => { e.stopPropagation(); handleRegister(track); }} className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-cyan-500 hover:text-white transition" disabled={isProcessingThis}>{isProcessingThis ? <Loader2 className="animate-spin" size={12}/> : 'Register'}</button>;
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2) Creators Result (유지) */}
                        {searchCreators.length > 0 && (
                             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Creators</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {searchCreators.map(c => (
                                        <Link href={`/u?wallet=${c.wallet_address}`} key={c.wallet_address}>
                                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-zinc-800 transition cursor-pointer group hover:border-zinc-600">
                                                <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden shadow-lg">
                                                    {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover group-hover:scale-110 transition"/> : <User className="w-full h-full p-5 text-zinc-600"/>}
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-bold text-sm text-white truncate w-24 group-hover:text-cyan-400 transition">{c.username}</div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3) Playlists Result (유지) */}
                        {searchPlaylists.length > 0 && (
                             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Playlists</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {searchPlaylists.map(pl => (
                                        <Link href={`/playlists/${pl.id}`} key={pl.id}>
                                            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl hover:bg-zinc-800 transition cursor-pointer group hover:border-zinc-600">
                                                <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden mb-3 relative">
                                                    {pl.cover_image_url ? <img src={pl.cover_image_url} className="w-full h-full object-cover group-hover:scale-105 transition"/> : <div className="w-full h-full flex items-center justify-center"><ListMusic className="text-zinc-600"/></div>}
                                                </div>
                                                <div className="font-bold text-sm text-white truncate group-hover:text-cyan-400 transition">{pl.name}</div>
                                                <div className="text-[10px] text-zinc-500">Forks: {pl.fork_count || 0}</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        )}
      </main>

      {/* ✅ Mobile Full Player */}
      {currentTrack && mobilePlayerOpen && ( <MobilePlayer track={currentTrack} isPlaying={isPlaying} onPlayPause={() => setIsPlaying(!isPlaying)} onNext={handleNext} onPrev={handlePrev} onClose={() => setMobilePlayerOpen(false)} repeatMode={repeatMode} onToggleRepeat={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} isShuffle={isShuffle} onToggleShuffle={() => setIsShuffle(!isShuffle)} currentTime={currentTime} duration={duration} onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }} isLiked={likedTrackIds.has(currentTrack.id)} isRented={rentedTrackIds.has(currentTrack.id)} onToggleLike={() => handleToggleLike(currentTrack)} onInvest={currentTrack.is_minted ? () => handleInvest(currentTrack) : undefined} /> )}
      {/* 2. Mobile Mini Player (Bottom Bar) */}
      {currentTrack && !mobilePlayerOpen && ( <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}> <div className="flex items-center gap-3 overflow-hidden"> <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative"> {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />} </div> <div className="flex-1 min-w-0"> <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div> <Link href={`/u?wallet=${currentTrack.artist?.wallet_address}`} className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</Link> </div> </div> <div className="flex items-center gap-3 pr-1"> <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black"> {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />} </button> </div> </div> )}
      {/* ✅ Desktop Footer Player */}
      {currentTrack && (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
            {/* Left: Track Info */}
            <div className="flex items-center gap-4 w-1/3">
            <button
                onClick={() => setMobilePlayerOpen(true)}
                className="ml-2 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition"
                title="Open Full Player"
                aria-label="Open Full Player"
            >
                <ChevronUp size={20} />
            </button>
            <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                {currentTrack.cover_image_url ? (
                <img
                    src={currentTrack.cover_image_url}
                    alt={currentTrack.title || "cover"}
                    className="w-full h-full object-cover"
                />
                ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Disc size={24} className="text-zinc-700 animate-spin-slow" />
                </div>
                )}
            </div>

            <div className="overflow-hidden">
                <div className="text-sm font-bold truncate text-white">
                {currentTrack.title}
                </div>
                <Link
                href={`/u?wallet=${currentTrack.artist?.wallet_address}`}
                className="text-xs text-zinc-400 truncate hover:text-white hover:underline transition"
                >
                {currentTrack.artist?.username}
                </Link>
            </div>

            <button
                onClick={() => handleToggleLike(currentTrack)}
                className={`ml-2 hover:scale-110 transition ${
                likedTrackIds.has(currentTrack.id)
                    ? "text-pink-500"
                    : "text-zinc-500 hover:text-white"
                }`}
                aria-label="Like"
            >
                <Heart
                size={20}
                fill={likedTrackIds.has(currentTrack.id) ? "currentColor" : "none"}
                />
            </button>
            </div>

            {/* Center: Controls + Progress */}
            <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="flex items-center gap-6">
                <button
                className="text-zinc-400 hover:text-white transition"
                onClick={handlePrev}
                aria-label="Previous"
                >
                <SkipBack size={20} />
                </button>

                <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10"
                aria-label={isPlaying ? "Pause" : "Play"}
                >
                {isPlaying ? (
                    <Pause size={20} fill="black" />
                ) : (
                    <Play size={20} fill="black" className="ml-1" />
                )}
                </button>

                <button
                className="text-zinc-400 hover:text-white transition"
                onClick={handleNext}
                aria-label="Next"
                >
                <SkipForward size={20} />
                </button>
            </div>

            <div className="w-full max-w-sm flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">
                {formatTime(currentTime)}
                </span>

                <div
                className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer"
                onClick={(e) => {
                    if (!audioRef.current) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const width = rect.width;
                    const newTime = (clickX / width) * duration;

                    if (!isCurrentTrackRented && newTime > 60) {
                    toast.error("Preview limited to 1 minute");
                    audioRef.current.currentTime = 60;
                    } else {
                    audioRef.current.currentTime = newTime;
                    }
                }}
                >
                {!isCurrentTrackRented && duration > 60 && (
                    <div
                    className="absolute top-0 left-0 h-full bg-purple-500/30 z-0"
                    style={{ width: `${(60 / duration) * 100}%` }}
                    />
                )}

                <div
                    className="h-full bg-white rounded-full relative z-10"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                </div>

                <span className="text-[10px] text-zinc-500 font-mono w-8">
                {!isCurrentTrackRented && duration > 60 ? "1:00" : formatTime(duration)}
                </span>
            </div>
            </div>

            {/* Right: Actions */}
            <div className="w-1/3 flex justify-end items-center gap-4">
            {currentTrack.is_minted && (
                <button
                onClick={() => handleInvest(currentTrack)}
                className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5"
                >
                <Zap size={14} fill="currentColor" />
                Invest
                </button>
            )}

            <div className="w-px h-6 bg-zinc-800 mx-1" />

            <Volume2 size={18} className="text-zinc-500" />

            <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-zinc-500 rounded-full" />
            </div>
            </div>
        </div>
        )}
      {selectedTrack && ( <TradeModal isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} track={selectedTrack} /> )}
      {isRentalModalOpen && ( <RentalModal isOpen={isRentalModalOpen} onClose={() => { setIsRentalModalOpen(false); setPendingRentalTrack(null); }} onConfirm={handleRentalConfirm} isLoading={isRentalLoading} /> )}
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
      
      {/* ✅ [New] Duplicate Modal */}
      <DuplicateCheckModal 
          isOpen={showDuplicateModal} 
          onClose={() => setShowDuplicateModal(false)} 
          originalTrack={duplicateOriginalTrack} 
          onPlay={(track: Track) => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }} 
      />
    </div>
  );
}