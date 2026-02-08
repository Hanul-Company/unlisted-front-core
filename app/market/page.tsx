'use client';

import React, { useState, useEffect, useRef} from 'react';
import { 
  Hammer, Plus, Brain, Sparkles, X, PlayCircle, Book, Wand2, AlertTriangle, Radio, Play, TrendingUp, Loader2, UploadCloud, 
  Music as MusicIcon, Trash2, Coins, User, Disc, Zap, ArrowRight, Search, Menu, ListMusic, Heart 
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
import TradeModal from '../components/TradeModal';
import RentalModal from '../components/RentalModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import TokenBalance from '../components/TokenBalance';
import HorizontalScroll from '../components/HorizontalScroll'; 
// import InvestmentCard from '../components/InvestmentCard'; // 사용 안함 주석 처리
import MarketCarousel from '../components/MarketCarousel';
import { useRouter } from 'next/navigation';
import { extractSearchKeywords } from '@/app/actions/aiSearch';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { parseEther } from 'viem';

// Global Player Hook
import { usePlayer, Track } from '../context/PlayerContext';

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const melodyIpContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

type FeaturedPlaylist = { id: number; name: string; cover_image: string | null; };
type Profile = { wallet_address: string; username: string; avatar_url: string | null; };
type Playlist = { id: number; name: string; cover_image_url?: string; fork_count: number; created_at: string; owner_wallet?: string; owner_name?: string; };

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
  const router = useRouter();
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // Global Player Hook
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  // Data States
  const [hotTracks, setHotTracks] = useState<Track[]>([]);
  const [hotPlaylists, setHotPlaylists] = useState<Playlist[]>([]);
  const [newTracks, setNewTracks] = useState<Track[]>([]);
  // const [investTracks, setInvestTracks] = useState<Track[]>([]); // 미사용
  const [creators, setCreators] = useState<Profile[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<FeaturedPlaylist[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  // User States (Rentals)
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTracksExpiry, setRentedTracksExpiry] = useState<Map<number, string>>(new Map());

  // Search & UI States
  const [isSearchOpen, setIsSearchOpen] = useState(false); // ✅ [NEW] 검색 모달 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTracks, setSearchTracks] = useState<Track[]>([]);
  const [searchCreators, setSearchCreators] = useState<Profile[]>([]);
  const [searchPlaylists, setSearchPlaylists] = useState<Playlist[]>([]);
  
  const [loadingTop, setLoadingTop] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Modals & Processing
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<Track | null>(null);
  const [isRentalLoading, setIsRentalLoading] = useState(false);
  const [forYouTracks, setForYouTracks] = useState<Track[]>([]);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOriginalTrack, setDuplicateOriginalTrack] = useState<Track | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // ✅ [NEW] 검색 인풋 포커스용

  const [isAiMode, setIsAiMode] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);

  // --- 1. Fetch User Data ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (!address) { setRentedTrackIds(new Set()); return; }
      try {
        const { data: profile } = await supabase.from('profiles').select('id, username').eq('wallet_address', address).single();
        if (profile) {
            setUsername(profile.username);
            const now = new Date().toISOString();
            const { data: collectionData } = await supabase.from('collections').select('track_id, expires_at').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
            if (collectionData) {
                setRentedTrackIds(new Set(collectionData.map((item: any) => item.track_id)));
                const expiryMap = new Map<number, string>();
                collectionData.forEach((item: any) => {
                    const dateStr = item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "Lifetime";
                    expiryMap.set(item.track_id, dateStr);
                });
                setRentedTracksExpiry(expiryMap);
            }
        }
      } catch (error) { console.error("Error fetching user data:", error); }
    };
    fetchUserData();
  }, [address]);

  // --- 2. Fetch Market Data ---
  useEffect(() => {
    const fetchPublicData = async () => {
      setLoadingTop(true);
      
      const { data: hotTrackData } = await supabase.rpc('get_most_collected_tracks', { limit_count: 15 });
      setHotTracks((hotTrackData as any) || []);

      const { data: hotPlData } = await supabase.from('playlists')
        .select(`id, name, fork_count, created_at, playlist_items (added_at, tracks (cover_image_url)), profiles (username, wallet_address)`)
        .is('original_playlist_id', null)
        .order('fork_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(15);
      
      const formattedHotPlaylists = hotPlData?.map((pl: any) => ({
          id: pl.id, name: pl.name, fork_count: pl.fork_count, created_at: pl.created_at,
          cover_image_url: pl.playlist_items?.[0]?.tracks?.cover_image_url || null,
          owner_name: pl.profiles?.username, owner_wallet: pl.profiles?.wallet_address
      })) || [];
      setHotPlaylists(formattedHotPlaylists);

      const { data: newData } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').order('created_at', { ascending: false }).limit(15);
      setNewTracks(newData || []);

      const { data: creatorData } = await supabase.from('profiles').select('*').limit(20);
      setCreators(creatorData || []);

      const { data: featuredData } = await supabase.from('playlists').select(`id, name, playlist_items (added_at, tracks (cover_image_url))`).eq('is_featured', true).order('id', { ascending: false });
      const formattedFeatured: FeaturedPlaylist[] = (featuredData || []).map((pl: any) => ({ id: pl.id, name: pl.name, cover_image: pl.playlist_items?.[0]?.tracks?.cover_image_url || null }));
      setFeaturedPlaylists(formattedFeatured);

      setLoadingTop(false);
    };
    fetchPublicData();
  }, []);

  useEffect(() => {
    const fetchPersonalData = async () => {
      if (!address) { setForYouTracks([]); return; }
      const { data: forYouData } = await supabase.rpc('get_tracks_for_you', { p_wallet_address: address }).select('*, artist:profiles(username,wallet_address,avatar_url)');
      setForYouTracks(forYouData || []);
    };
    fetchPersonalData();
  }, [address]);

  // ✅ [NEW] Search Modal Open Handler
  const openSearch = () => {
      setIsSearchOpen(true);
      // 약간의 지연 후 input 포커스 (애니메이션 고려)
      setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
      }, 300);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
        setIsSearching(false);
        setSearchTracks([]); setSearchCreators([]); setSearchPlaylists([]);
        setAiKeywords([]);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const delayTime = isAiMode ? 800 : 500; 
    const debounceFn = setTimeout(async () => {
        setIsSearching(true);
        setAiKeywords([]); 
        try {
            let queryBuilder = supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('is_minted', true);
                if (isAiMode) {
                const keywords = await extractSearchKeywords(searchQuery);
                setAiKeywords(keywords); 
                if (keywords.length > 0) {
                    const { data } = await supabase.rpc('search_tracks_by_keywords', { keywords: keywords }).select('*, artist:profiles(username,wallet_address,avatar_url)').limit(20);
                    setSearchTracks(data || []);
                    setSearchCreators([]); setSearchPlaylists([]); setIsSearching(false);
                    return; 
                } else {
                    queryBuilder = queryBuilder.ilike('title', `%${searchQuery}%`);
                }
            } else {
                queryBuilder = queryBuilder.or(`title.ilike.%${searchQuery}%,artist_name.ilike.%${searchQuery}%`);
                const [creatorsRes, playlistsRes] = await Promise.all([
                    supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).limit(10),
                    supabase.from('playlists').select('*').ilike('name', `%${searchQuery}%`).limit(10)
                ]);
                setSearchCreators(creatorsRes.data || []); setSearchPlaylists(playlistsRes.data || []);
            }
            const { data: tracks } = await queryBuilder.limit(20);
            setSearchTracks(tracks || []);
            if (isAiMode) { setSearchCreators([]); setSearchPlaylists([]); }
        } catch (e) { console.error(e); } finally { setIsSearching(false); }
    }, delayTime);
    return () => clearTimeout(debounceFn);
  }, [searchQuery, isAiMode]);

  // --- Collect & Rental Handlers ---
  const handleCollectClick = async (track: Track) => {
    if (!address) { 
        const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
        if (headerBtn) { headerBtn.click(); } else { toast.error("Please Join unlisted first."); }
        return;
    }
    setPendingRentalTrack(track); setIsRentalModalOpen(true);
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
    setIsRentalModalOpen(false); setShowPlaylistModal(true); 
  };

  const processCollect = async (playlistId: string | 'liked') => {
    const targetTrack = pendingRentalTrack; 
    if (!targetTrack || !address || !tempRentalTerms) return;
    setShowPlaylistModal(false);
    const { months, price } = tempRentalTerms;
    const toastId = toast.loading("Processing payment...");
    setIsRentalLoading(true);

    try {
      const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', { p_wallet_address: address, p_track_id: targetTrack.id, p_duration_months: months });
      if (rpcResult === 'OK') {
        await finalizeCollect(targetTrack, playlistId); toast.success("Collected using pMLD!", { id: toastId });
      } else if (rpcResult === 'INSUFFICIENT_PMLD') {
        toast.loading(`Insufficient pMLD. Requesting ${price} MLD...`, { id: toastId });
        let recipient = targetTrack.uploader_address || "0x0000000000000000000000000000000000000000"; 
        const transaction = prepareContractCall({ contract: melodyTokenContract, method: "transfer", params: [recipient, parseEther(price.toString())] });
        sendTransaction(transaction, {
          onSuccess: async () => {
            const { data: mldRpcResult } = await supabase.rpc('add_to_collection_using_mld_by_wallet', { p_wallet_address: address, p_track_id: targetTrack.id, p_duration_months: months, p_amount_mld: price });
            if (mldRpcResult === 'OK') { await finalizeCollect(targetTrack, playlistId); toast.success("Payment complete!", { id: toastId }); } 
            else { toast.error(`Error: ${mldRpcResult}`, { id: toastId }); }
            setIsRentalLoading(false);
          },
          onError: () => { toast.error("Payment failed.", { id: toastId }); setIsRentalLoading(false); }
        });
      } else { toast.error(`Error: ${rpcResult}`, { id: toastId }); setIsRentalLoading(false); }
    } catch (e: any) { toast.error(e.message, { id: toastId }); setIsRentalLoading(false); }
  };

  const finalizeCollect = async (track: Track, playlistId: string | 'liked') => {
      if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: track.id });
      await supabase.from('likes').upsert({ wallet_address: address, track_id: track.id }, { onConflict: 'wallet_address, track_id' });
      setRentedTrackIds(prev => new Set(prev).add(track.id));
      setTempRentalTerms(null); setPendingRentalTrack(null); setIsRentalLoading(false);
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
                const updateList = (list: Track[]) => list.map(t => t.id === track.id ? { ...t, is_minted: true } : t);
                setSearchTracks(updateList(searchTracks)); setNewTracks(updateList(newTracks)); setHotTracks(updateList(hotTracks)); setProcessingTrackId(null);
            },
            onError: (err) => { console.error(err); toast.error("Transaction failed.", { id: 'register-toast' }); setProcessingTrackId(null); }
        });
      } catch (e) { console.error(e); toast.error("Error occurred.", { id: 'register-toast' }); setProcessingTrackId(null); }
  };

  const handlePlay = (track: Track, queueList: Track[]) => {
      playTrack(track, queueList);
  };

  const handleRestricted = (path: string) => {
    if (!address) {
        const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
        if (headerBtn) { headerBtn.click(); } else { toast.error("Please Join unlisted first."); }
        return; 
    }
    router.push(path);
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
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
                <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition">
                    <Disc size={18}/> <span className="text-sm font-medium">Explore</span>
                </div> 
                <Link href="/investing">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <TrendingUp size={18}/> <span className="text-sm font-medium">Invest (Beta)</span>
                    </div>
                </Link> 
            </div>
            <div> 
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">My Studio</h3> 
                <div onClick={() => handleRestricted('/library')} className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                    <PlayCircle size={18}/> <span className="text-sm font-medium">Playlists</span>
                </div>
            </div>
            <div> 
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3> 
                <div onClick={() => handleRestricted('/factory')} className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                    <Hammer size={18}/> <span className="text-sm font-medium">Mining Pool</span>
                </div> 
                <div onClick={() => handleRestricted('/studio')} className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                    <Coins size={18}/> <span className="text-sm font-medium">Earnings</span>
                </div>
            </div>
            <div className="pt-6 mt-auto border-t border-zinc-800"> 
                <button onClick={() => handleRestricted('/upload')} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition group">
                    <UploadCloud size={18} className="group-hover:text-cyan-400 transition-colors"/> <span className="text-sm">Upload & Earn</span>
                </button> 
            </div>
            <div className="pt-4 border-t border-zinc-800"> 
                <button onClick={() => handleRestricted('/create')} className="w-full rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2 text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-blue-900/30 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 hover:shadow-blue-900/50 transition-all duration-200 active:scale-[0.99] group">
                    <Wand2 size={18} className="opacity-95 group-hover:opacity-100 transition-opacity" /><span>Create Track</span>
                </button> 
            </div>
        </nav>
    </aside>
      <main ref={mainRef} className="flex-1 flex flex-col overflow-y-auto pb-24 scroll-smooth relative">
        <header className="sticky top-0 z-50 flex items-center py-6 px-6 border-b bg-zinc-950/80 backdrop-blur-md border-zinc-800 relative">
          
          {/* ✅ [Left] Menu & Title */}
          <div className="flex items-center gap-4 z-10"> 
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white hover:text-zinc-300 transition">
                <Menu/>
            </button> 
            <h1 className="text-xl font-bold">Explore</h1> 
          </div>

          {/* ✅ [Center] Search (Desktop) - ABSOLUTE POSITIONED */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full justify-center pointer-events-none z-0">
             <div 
                onClick={openSearch}
                className="pointer-events-auto flex items-center gap-3 w-full max-w-2xl px-5 py-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-sm cursor-text hover:border-zinc-600 transition group shadow-sm bg-opacity-95 backdrop-blur-sm"
            >
                <Search size={18} className="group-hover:text-zinc-300 transition"/>
                <span className="font-medium">Search music...</span>
                <span className="ml-auto text-xs border border-zinc-700 rounded px-1.5 py-0.5 bg-zinc-800 text-zinc-500">/</span>
            </div>
          </div>

          {/* ✅ [Right] Search (Mobile) + Balance + Profile */}
          <div className="flex items-center justify-end gap-3 md:gap-4 ml-auto z-10"> 
             <button 
                onClick={openSearch}
                className="md:hidden p-2 text-zinc-400 hover:text-white transition"
            >
                <Search size={24} />
            </button> 
            <div className="hidden sm:block"><TokenBalance address={address} /></div>
            <HeaderProfile /> 
          </div>

        </header>

        {loadingTop ? ( <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-cyan-500" size={32}/></div> ) : (
            <div className="pb-10 pt-4">
                <div className="px-6"> <MarketCarousel /> </div>

                {/* Tracks For You Section */}
                {address && forYouTracks.length > 0 && (
                    <section className="py-6 border-b border-zinc-800/50"> 
                        <div className="px-6 mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"> Only for You, {username ? username : 'You'} </h2>
                        </div> 
                        <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                            {forYouTracks.map((t) => ( 
                                <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => handlePlay(t, forYouTracks)}> 
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
                )}

                {/* Playlists */}
                <section className="mb-2"> <div className="px-6 mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white flex items-center gap-2">Playlists from unlisted</h2></div> <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> {featuredPlaylists.length === 0 ? ( <div className="text-zinc-500 text-sm px-6">No playlists available yet.</div> ) : ( featuredPlaylists.map((pl) => ( <Link href={`/playlists/${pl.id}`} key={pl.id} className="flex-shrink-0 snap-start block"> <div className="relative overflow-hidden rounded-xl bg-zinc-800 group cursor-pointer border border-zinc-700 hover:border-white/20 min-w-[160px] w-[120px] h-[160px] md:w-[240px] md:h-[240px]"> {pl.cover_image ? ( <img src={pl.cover_image} alt={pl.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-700 to-zinc-900"><Disc size={32} className="text-zinc-600 md:w-16 md:h-16" /></div> )} <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3 pointer-events-none"><span className="text-white font-medium text-xs md:text-sm drop-shadow-md break-words line-clamp-2 text-left">{pl.name}</span></div> </div> </Link> )) )} </HorizontalScroll> </section>

                {/* Hot Tracks */}
                <section className="py-6 border-b border-zinc-800/50"> 
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Hot Tracks</h2></div> 
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                        {hotTracks.map((t) => ( 
                            <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => handlePlay(t, hotTracks)}> 
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

                {/* Hot Playlists */}
                <section className="py-6 border-b border-zinc-800/50 bg-zinc-900/10"> <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"> Hot Playlists</h2></div> <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> {hotPlaylists.map((pl: any) => ( <div key={pl.id} className="flex-shrink-0 snap-start block min-w-[160px] w-[160px]"> <Link href={`/playlists/${pl.id}`}> <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group cursor-pointer hover:border-white/20 transition"> {pl.cover_image_url ? ( <img src={pl.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/> ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-800 to-zinc-900"> <ListMusic size={32} className="text-zinc-600"/> </div> )} <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10"> <div className="bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1 border border-white/10 shadow-md"> <Heart size={10} className="text-white fill-white"/> <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md"> {pl.fork_count || 0} </span> </div> </div> </div> </Link> <div> <Link href={`/playlists/${pl.id}`}> <h3 className="font-bold text-sm truncate hover:text-cyan-400 transition mb-0.5"> {pl.name} </h3> </Link> <Link href={pl.owner_wallet ? `/u?wallet=${pl.owner_wallet}` : '#'} className="inline-block"> <div className="text-xs text-zinc-500 truncate hover:text-white hover:underline transition flex items-center gap-1"> {pl.owner_name} </div> </Link> </div> </div> ))} </HorizontalScroll> </section>

                {/* Fresh Drops */}
                <section className="py-6 border-b border-zinc-800/50"> 
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2">Fresh Drops</h2></div> 
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                        {newTracks.map((t) => ( 
                            <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => handlePlay(t, newTracks)}> 
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

                {/* Creators */}
                <section className="py-8 border-b border-zinc-800/50 bg-zinc-900/20"> 
                    <div className="px-6 mb-5"><h2 className="text-xl font-black flex items-center gap-2">Trending Artists</h2></div>
                    <HorizontalScroll className="gap-6 px-6 pb-4 snap-x pt-2">
                        {creators.map((c: any) => (
                            <Link href={`/u?wallet=${c.wallet_address}`} key={c.id}>
                                <div className="flex flex-col items-center gap-3 cursor-pointer group min-w-[110px]">
                                    <div className="w-28 h-28 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 group-hover:border-cyan-500 transition shadow-lg">
                                        {c.avatar_url ? ( <img src={c.avatar_url} className="w-full h-full object-cover" /> ) : ( <User className="w-full h-full p-6 text-zinc-500" /> )}
                                    </div>
                                    <span className="text-sm font-bold truncate w-28 text-center text-zinc-300 group-hover:text-white transition"> {c.username || 'User'} </span>
                                </div>
                            </Link>
                        ))}
                    </HorizontalScroll>
                </section>
            </div>
        )}
      </main>

      {/* ✅ [NEW] Search Modal (Bottom Sheet for Mobile, Full Overlay for PC) */}
      {isSearchOpen && (
        <div className="fixed z-[100] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 inset-x-0 bottom-0 h-[92vh] rounded-t-3xl animate-in slide-in-from-bottom duration-300 md:inset-0 md:h-full md:rounded-none md:animate-in md:fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Search className="text-cyan-400" size={24}/> Search
                </h2>
                <button onClick={() => setIsSearchOpen(false)} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition">
                    <X size={20}/>
                </button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="w-full max-w-4xl mx-auto space-y-8">
                    
                    {/* Input Area */}
                    <div className="flex flex-col items-center gap-6">
                        <div className="text-center space-y-2 mb-2">
                            <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 tracking-tighter">
                                {isAiMode ? "Let unlisted AI get your flavor." : "Find your vibe in unlisted."}
                            </h2>
                        </div>
                        
                        <div className={`relative w-full max-w-2xl transition-all duration-300 ${isAiMode ? 'scale-105' : 'scale-100'}`}>
                            <div className={`absolute -inset-1 rounded-3xl blur-xl opacity-40 transition duration-1000 ${isAiMode ? 'bg-gradient-to-r from-cyan-600 via-blue-500 to-indigo-500 animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-30'}`} />
                            <div className="relative bg-zinc-950 border border-zinc-700 rounded-3xl flex items-center shadow-2xl overflow-hidden group focus-within:border-zinc-500 transition-colors">
                                <div className="pl-6 pr-3 text-zinc-400">
                                    {isAiMode ? <Sparkles size={20} className="text-indigo-500 animate-pulse"/> : <Search size={20}/>}
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={isAiMode ? "Rainy day moods..." : "Tracks, artists..."}
                                    className="w-full bg-transparent border-none py-4 text-sm md:text-lg text-white placeholder:text-zinc-500 focus:ring-0 focus:outline-none"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                />
                                <div className="flex items-center pr-2 gap-2">
                                    {isSearching && <Loader2 className="animate-spin text-zinc-500" size={20} />}
                                    <button 
                                        onClick={() => setIsAiMode(!isAiMode)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 border m-1 ${
                                            isAiMode 
                                            ? 'bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-600 text-white border-transparent shadow-[0_0_18px_rgba(59,130,246,0.6)]' 
                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                                        }`}
                                    >
                                        <Brain size={18} className={isAiMode ? "animate-spin-slow" : ""}/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* AI Keywords Display */}
                        {isAiMode && aiKeywords.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <span className="text-xs text-zinc-500 font-bold mr-1 self-center">Identified:</span>
                                {aiKeywords.map((k, i) => (
                                    <span key={i} className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold">#{k}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Results Area */}
                    <div className="space-y-12">
                        {/* Empty State */}
                        {searchQuery && !isSearching && searchTracks.length === 0 && searchCreators.length === 0 && searchPlaylists.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
                                    <Search size={28} className="text-zinc-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
                                <p className="text-zinc-500 mb-6 text-center text-sm">We couldn't find exactly what you're looking for.</p>
                                <Link href="/create" onClick={() => setIsSearchOpen(false)}>
                                    <button className="px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-zinc-200 transition">Create "{searchQuery}"</button>
                                </Link>
                            </div>
                        )}

                        {/* Tracks Result */}
                        {searchTracks.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider flex items-center gap-2"><MusicIcon size={14}/> Tracks</h3>
                                <div className="space-y-2">
                                    {searchTracks.map((track) => {
                                        const isOwner = address && track.uploader_address && address.toLowerCase() === track.uploader_address.toLowerCase();
                                        const isProcessingThis = processingTrackId === track.id && isPending;
                                        const errorString = track.mint_error ? String(track.mint_error).trim() : '';
                                        const isDuplicateError = errorString.includes('duplicate_melody_hash') || !!track.duplicate_of_track_id;
                                        const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

                                        if (!isOwner && isDuplicateError) return null;

                                        return (
                                            <div key={track.id} className={`group flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${isThisTrackPlaying ? 'bg-zinc-800 border-cyan-500/50' : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'}`} onClick={() => handlePlay(track, searchTracks)}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 relative group-hover:border-zinc-600 transition">
                                                        {track.cover_image_url ? ( <img src={track.cover_image_url} className="w-full h-full object-cover" /> ) : ( <MusicIcon size={20} className="text-zinc-700" /> )}
                                                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                            {isThisTrackPlaying ? <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"/> : <Play size={20} className="fill-white text-white"/>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-base transition ${isThisTrackPlaying ? 'text-cyan-400' : 'text-white'}`}>{track.title}</div>
                                                        <span className="text-xs text-zinc-500">{track.artist?.username || 'Unlisted Artist'}</span>
                                                    </div>
                                                </div>
                                                {track.is_minted && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleCollectClick(track); }} className="flex items-center gap-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-full text-xs font-bold hover:bg-white hover:text-black hover:border-white transition">
                                                        <Plus size={14}/> Collect
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Creators Result */}
                        {!isAiMode && searchCreators.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Creators</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {searchCreators.map((c) => (
                                        <Link href={`/u?wallet=${c.wallet_address}`} key={c.wallet_address} onClick={() => setIsSearchOpen(false)}>
                                            <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-zinc-700 transition">
                                                <div className="w-16 h-16 rounded-full bg-zinc-900 overflow-hidden shadow-lg">
                                                    {c.avatar_url ? ( <img src={c.avatar_url} className="w-full h-full object-cover" /> ) : ( <User className="w-full h-full p-4 text-zinc-600" /> )}
                                                </div>
                                                <div className="text-center font-bold text-sm text-white truncate w-24">{c.username}</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Playlists Result */}
                        {!isAiMode && searchPlaylists.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Playlists</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {searchPlaylists.map((pl) => (
                                        <Link href={`/playlists/${pl.id}`} key={pl.id} onClick={() => setIsSearchOpen(false)}>
                                            <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl hover:bg-zinc-700 transition">
                                                <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden mb-3">
                                                    {pl.cover_image_url ? ( <img src={pl.cover_image_url} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full flex items-center justify-center"><ListMusic className="text-zinc-600" /></div> )}
                                                </div>
                                                <div className="font-bold text-sm text-white truncate">{pl.name}</div>
                                                <div className="text-[10px] text-zinc-500">Forks: {pl.fork_count || 0}</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {selectedTrack && ( <TradeModal isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} track={{...selectedTrack, token_id: selectedTrack.token_id ?? null}} /> )}
      
      {isRentalModalOpen && ( 
          <RentalModal 
              isOpen={isRentalModalOpen} 
              onClose={() => { setIsRentalModalOpen(false); setPendingRentalTrack(null); }} 
              onConfirm={handleRentalConfirm} 
              isLoading={isRentalLoading}
              isExtension={pendingRentalTrack ? rentedTrackIds.has(pendingRentalTrack.id) : false}
              currentExpiryDate={pendingRentalTrack ? rentedTracksExpiry.get(pendingRentalTrack.id) : null}
              targetTitle={pendingRentalTrack?.title}
          /> 
      )}
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
      <DuplicateCheckModal isOpen={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} originalTrack={duplicateOriginalTrack} onPlay={(track: Track) => handlePlay(track, [track])} />
    </div>
  );
}