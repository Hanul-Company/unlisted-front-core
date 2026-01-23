'use client';

import React, { useState, useEffect, useRef} from 'react';
import { 
  Plus, Brain, Sparkles, X, PlayCircle, Book, Wand2, AlertTriangle, Radio, Play, TrendingUp, Loader2, UploadCloud, 
  Music as MusicIcon, Trash2, Coins, User, Disc, Zap, ArrowRight, Search, Menu, ListMusic, Heart 
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
// MobilePlayer 삭제 (Global 사용)
import TradeModal from '../components/TradeModal';
import RentalModal from '../components/RentalModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import TokenBalance from '../components/TokenBalance';
import HorizontalScroll from '../components/HorizontalScroll'; 
import InvestmentCard from '../components/InvestmentCard';
import MarketCarousel from '../components/MarketCarousel';
import { useRouter } from 'next/navigation';
import { extractSearchKeywords } from '@/app/actions/aiSearch'; // 👈 import 추가

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { parseEther } from 'viem';

// ✅ [NEW] Global Player Hook
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

  // ✅ [NEW] Global Player Hook
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  // Data States
  const [hotTracks, setHotTracks] = useState<Track[]>([]);
  const [hotPlaylists, setHotPlaylists] = useState<Playlist[]>([]);
  const [newTracks, setNewTracks] = useState<Track[]>([]);
  const [investTracks, setInvestTracks] = useState<Track[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<FeaturedPlaylist[]>([]);
  const [username, setUsername] = useState<string | null>(null); // 👈 추가

  // User States (Rentals)
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTracksExpiry, setRentedTracksExpiry] = useState<Map<number, string>>(new Map());

  // Search & UI States
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
  const [forYouTracks, setForYouTracks] = useState<Track[]>([]); // 👈 추가

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOriginalTrack, setDuplicateOriginalTrack] = useState<Track | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);

  const [isAiMode, setIsAiMode] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<string[]>([]); // GPT가 뽑은 키워드 보여주기용

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

  // ✅ [수정 1] 공통 데이터 가져오기 (로그인 여부 상관없음, 최초 1회만 실행)
  useEffect(() => {
    const fetchPublicData = async () => {
      setLoadingTop(true);
      
      // 1. Hot Tracks
      const { data: hotTrackData } = await supabase.rpc('get_most_collected_tracks', { limit_count: 15 });
      setHotTracks((hotTrackData as any) || []);

      // 2. Hot Playlists
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

      // 3. New Tracks
      const { data: newData } = await supabase.from('tracks')
        .select('*,artist:profiles (username,wallet_address,avatar_url)')
        .order('created_at', { ascending: false })
        .limit(15);
      setNewTracks(newData || []);

      // 4. Creators
      const { data: creatorData } = await supabase.from('profiles').select('*').limit(20);
      setCreators(creatorData || []);

      // 5. Featured Playlists
      const { data: featuredData } = await supabase.from('playlists')
        .select(`id, name, playlist_items (added_at, tracks (cover_image_url))`)
        .eq('is_featured', true)
        .order('id', { ascending: false });
        
      const formattedFeatured: FeaturedPlaylist[] = (featuredData || []).map((pl: any) => ({ 
          id: pl.id, 
          name: pl.name, 
          cover_image: pl.playlist_items?.[0]?.tracks?.cover_image_url || null 
      }));
      setFeaturedPlaylists(formattedFeatured);

      setLoadingTop(false);
    };

    fetchPublicData();
  }, []); // 의존성 없음 (최초 1회만)


  // ✅ [수정 2] 개인화 데이터 가져오기 (address가 바뀔 때만 실행)
  useEffect(() => {
    const fetchPersonalData = async () => {
      // 1. 로그아웃 상태이거나 address가 없으면 데이터를 비움 (섹션 숨김 처리됨)
      if (!address) {
          setForYouTracks([]);
          return;
      }

      // 2. 로그인 상태면 데이터 가져오기
      const { data: forYouData } = await supabase
        .rpc('get_tracks_for_you', { p_wallet_address: address })
        .select('*, artist:profiles(username,wallet_address,avatar_url)');
      
      setForYouTracks(forYouData || []);
    };

    fetchPersonalData();
  }, [address]); // address가 변경될 때(로그인/로그아웃)마다 실행됨

// ✅ [수정 1] 단순 입력 상태 업데이트
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
        setIsSearching(false);
        setSearchTracks([]); setSearchCreators([]); setSearchPlaylists([]);
        setAiKeywords([]);
    }
  };

  // ✅ [수정 2] 검색 로직 (범위 확대 & 매칭 보완)
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const delayTime = isAiMode ? 800 : 500; 

    const debounceFn = setTimeout(async () => {
        setIsSearching(true);
        setAiKeywords([]); 

        try {
            // 기본 쿼리: is_minted 된 트랙만
            let queryBuilder = supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('is_minted', true);

                if (isAiMode) {
                // 🤖 AI 모드
                const keywords = await extractSearchKeywords(searchQuery);
                setAiKeywords(keywords); 

                if (keywords.length > 0) {
                    // ✅ [수정됨] RPC 함수 호출 (복잡한 쿼리 URL 문제 해결!)
                    // RPC를 써도 .select()로 아티스트 정보를 조인해서 가져올 수 있습니다.
                    const { data } = await supabase
                        .rpc('search_tracks_by_keywords', { keywords: keywords })
                        .select('*, artist:profiles(username,wallet_address,avatar_url)') // 아티스트 정보 조인
                        .limit(20);
                    
                    setSearchTracks(data || []);
                    
                    // AI 모드는 여기서 끝 (다른 검색 비움)
                    setSearchCreators([]);
                    setSearchPlaylists([]);
                    setIsSearching(false);
                    return; // 여기서 useEffect 종료
                } else {
                    // 키워드 추출 실패 시 일반 검색으로 폴백
                    // (아래 일반 모드 로직을 타게 둠)
                    queryBuilder = queryBuilder.ilike('title', `%${searchQuery}%`);
                }
            } else {
                // 🔍 일반 모드 (기존 유지 + 태그 단순 검색 추가)
                queryBuilder = queryBuilder.or(`title.ilike.%${searchQuery}%,artist_name.ilike.%${searchQuery}%`);
                
                const [creatorsRes, playlistsRes] = await Promise.all([
                    supabase.from('profiles').select('*').ilike('username', `%${searchQuery}%`).limit(10),
                    supabase.from('playlists').select('*').ilike('name', `%${searchQuery}%`).limit(10)
                ]);
                setSearchCreators(creatorsRes.data || []);
                setSearchPlaylists(playlistsRes.data || []);
            }

            const { data: tracks } = await queryBuilder.limit(20);
            setSearchTracks(tracks || []);

            if (isAiMode) {
                setSearchCreators([]);
                setSearchPlaylists([]);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }, delayTime);

    return () => clearTimeout(debounceFn);
  }, [searchQuery, isAiMode]);
  // --- Handlers ---
  const handleCollectClick = async (track: Track) => {
    if (!address) { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;}
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
        await finalizeCollect(targetTrack, playlistId);
        toast.success("Collected using pMLD!", { id: toastId });
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

  const handleDelete = async (id: number) => {
    if (!confirm("Delete track?")) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (!error) { 
        toast.success("Deleted."); 
        setSearchTracks(prev => prev.filter(t => t.id !== id)); setNewTracks(prev => prev.filter(t => t.id !== id)); setHotTracks(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleCheckDuplicate = async (originalTrackId: number) => {
      if (!originalTrackId) return;
      const toastId = toast.loading("Checking info...");
      try {
          const { data, error } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('id', originalTrackId).single();
          if (error || !data) throw new Error("Original track not found");
          setDuplicateOriginalTrack(data); setShowDuplicateModal(true); toast.dismiss(toastId);
      } catch (e) { toast.error("Failed to load info", { id: toastId }); }
  };

  const handleInvest = (track: Track) => { 
    if (!address) { 
        const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
        if (headerBtn) {
            headerBtn.click(); 
        } else {
            toast.error("Please Join unlisted first.");
        }
        return;
    }
    setSelectedTrack(track);
  };

  // ✅ [NEW] Play Helper
  const handlePlay = (track: Track, queueList: Track[]) => {
      playTrack(track, queueList);
  };

  const handleRestricted = (path: string) => {
    // 1. 비로그인 상태 체크
    if (!address) {
        const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
        if (headerBtn) {
            headerBtn.click(); // 헤더의 로그인 버튼 강제 클릭
            // toast("Join unlisted now", { icon: '👆' });
        } else {
            toast.error("Please Join unlisted first.");
        }
        return; // 페이지 이동 중단
    }
    // 2. 로그인 상태면 정상 이동
    router.push(path);
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* ⚠️ Local <audio> tag removed (Global used) */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Sidebar (유지) */}
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 hidden md:flex flex-col p-6 h-screen sticky top-0">
        <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 cursor-pointer">unlisted</div>
        {/* 1. Start Stream (제외 대상: Link 유지) */}
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
                {/* <div onClick={() => handleRestricted('/portfolio')} className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                    <Book size={18}/> <span className="text-sm font-medium">Portfolio</span>
                </div>  */}
            </div>
            <div> 
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3> 
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
        <header className="flex justify-between items-center p-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800">
          <div className="flex items-center gap-4"> <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu/></button> <h1 className="text-xl font-bold">Explore</h1> </div>
          <div className="flex items-center gap-3"> <TokenBalance address={address} /> <HeaderProfile /> </div>
        </header>
        {loadingTop ? ( <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-cyan-500" size={32}/></div> ) : (
            <div className="pb-10 pt-4">
                <div className="px-6"> <MarketCarousel /> </div>

                {/* ✅ [NEW] Tracks For You Section */}
                {/* Only renders if user is logged in AND has recommended tracks */}
                {address && forYouTracks.length > 0 && (
                    <section className="py-6 border-b border-zinc-800/50"> 
                        <div className="px-6 mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                        Only for You, {username ? username : 'You'}
                    </h2>
                </div> 
                <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                    {forYouTracks.map((t) => ( 
                        <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => handlePlay(t, forYouTracks)}> 
                            {/* Track Card UI ... */}
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

                {/* 0. Playlists */}
                <section className="mb-2"> <div className="px-6 mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white flex items-center gap-2">Playlists from unlisted</h2></div> <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> {featuredPlaylists.length === 0 ? ( <div className="text-zinc-500 text-sm px-6">No playlists available yet.</div> ) : ( featuredPlaylists.map((pl) => ( <Link href={`/playlists/${pl.id}`} key={pl.id} className="flex-shrink-0 snap-start block"> <div className="relative overflow-hidden rounded-xl bg-zinc-800 group cursor-pointer border border-zinc-700 hover:border-white/20 min-w-[160px] w-[120px] h-[160px] md:w-[240px] md:h-[240px]"> {pl.cover_image ? ( <img src={pl.cover_image} alt={pl.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-700 to-zinc-900"><Disc size={32} className="text-zinc-600 md:w-16 md:h-16" /></div> )} <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3 pointer-events-none"><span className="text-white font-medium text-xs md:text-sm drop-shadow-md break-words line-clamp-2 text-left">{pl.name}</span></div> </div> </Link> )) )} </HorizontalScroll> </section>

                {/* 1. Hot Tracks */}
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

                {/* 2. Hot Playlists (유지) */}
                <section className="py-6 border-b border-zinc-800/50 bg-zinc-900/10"> <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"> Hot Playlists</h2></div> <HorizontalScroll className="gap-4 !px-6 scroll-pl-6 pb-4 snap-x pt-2"> {hotPlaylists.map((pl: any) => ( <div key={pl.id} className="flex-shrink-0 snap-start block min-w-[160px] w-[160px]"> <Link href={`/playlists/${pl.id}`}> <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group cursor-pointer hover:border-white/20 transition"> {pl.cover_image_url ? ( <img src={pl.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/> ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800 bg-gradient-to-br from-zinc-800 to-zinc-900"> <ListMusic size={32} className="text-zinc-600"/> </div> )} <div className="absolute bottom-2 left-2 flex items-center gap-1 z-10"> <div className="bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1 border border-white/10 shadow-md"> <Heart size={10} className="text-white fill-white"/> <span className="text-[10px] font-bold text-white shadow-black drop-shadow-md"> {pl.fork_count || 0} </span> </div> </div> </div> </Link> <div> <Link href={`/playlists/${pl.id}`}> <h3 className="font-bold text-sm truncate hover:text-cyan-400 transition mb-0.5"> {pl.name} </h3> </Link> <Link href={pl.owner_wallet ? `/u?wallet=${pl.owner_wallet}` : '#'} className="inline-block"> <div className="text-xs text-zinc-500 truncate hover:text-white hover:underline transition flex items-center gap-1"> {pl.owner_name} </div> </Link> </div> </div> ))} </HorizontalScroll> </section>

                {/* 3. Fresh Drops */}
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

                {/* 4. Popular Creators */}
                <section className="py-8 border-b border-zinc-800/50 bg-zinc-900/20"> {/* py-6 -> py-8로 살짝 여유 줌 */}
                    <div className="px-6 mb-5">
                        <h2 className="text-xl font-black flex items-center gap-2">Trending Artists</h2> {/* text-lg -> text-xl로 제목도 키움 */}
                    </div>
                    
                    <HorizontalScroll className="gap-6 px-6 pb-4 snap-x pt-2">
                        {creators.map((c: any) => (
                            <Link href={`/u?wallet=${c.wallet_address}`} key={c.id}>
                                {/* 1. 컨테이너 최소 너비 증가 (80px -> 110px) */}
                                <div className="flex flex-col items-center gap-3 cursor-pointer group min-w-[110px]">
                                    
                                    {/* 2. 이미지 크기 증가 (w-20 -> w-28) */}
                                    <div className="w-28 h-28 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 group-hover:border-cyan-500 transition shadow-lg">
                                        {c.avatar_url ? (
                                            <img src={c.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-full h-full p-6 text-zinc-500" /> 
                                        )}
                                    </div>
                                    
                                    {/* 3. 텍스트 너비 증가 (w-20 -> w-28) & 폰트 살짝 키움 */}
                                    <span className="text-sm font-bold truncate w-28 text-center text-zinc-300 group-hover:text-white transition">
                                        {c.username || 'User'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </HorizontalScroll>
                </section>
                {/* 5. Top Investments
                <section className="py-6 border-b border-zinc-800/50"> 
                    <div className="px-6 mb-4 flex justify-between items-end"> <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-blue-400" size={20}/> Top Investment</h2> <Link href="/investing" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">View Chart <ArrowRight size={12}/></Link> </div> 
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2 scrollbar-hide"> 
                        {investTracks.map((t) => ( 
                            <InvestmentCard key={t.id} track={t} onPlay={(track) => handlePlay(track, investTracks)} onInvest={(track) => handleInvest(track)} /> 
                        ))} 
                        {investTracks.length === 0 && ( <div className="min-w-[240px] h-[260px] flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl text-zinc-500 text-xs"><p>No investment tracks yet.</p></div> )} 
                    </HorizontalScroll> 
                </section> */}

                {/* 6. Search Section */}
                <section className={`p-6 flex flex-col items-center pt-20 transition-all duration-500 ease-in-out ${searchQuery ? 'min-h-[800px]' : 'min-h-[400px]'}`}>
                    {/* 1. 검색 헤더 및 입력창 영역 */}
                    <div className="flex flex-col items-center gap-6 w-full max-w-4xl relative z-10">
                        <div className="text-center space-y-2 mb-4">
                            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 tracking-tighter pb-2">
                                {isAiMode ? "Just tell me what you want." : "What are you looking for?"}
                            </h2>
                            <p className="text-zinc-400 font-medium">
                                {isAiMode 
                                    ? "unlisted AI will get you the perfect tracks." 
                                    : "Search tracks, artists, and playlists in unlisted."}
                            </p>
                        </div>
                        <div className={`relative w-full max-w-2xl transition-all duration-300 ${isAiMode ? 'scale-105' : 'scale-100'}`}>
                            {/* Glow Effect (AI Mode일 때 색상 변경) */}
                            <div className={`absolute -inset-1 rounded-3xl blur-xl opacity-40 transition duration-1000 ${isAiMode ? 'bg-gradient-to-r from-cyan-600 via-blue-500 to-indigo-500 animate-pulse' : 'bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-30'}`} />
                            
                            <div className="relative bg-zinc-900 border border-zinc-700 rounded-3xl flex items-center shadow-2xl overflow-hidden group focus-within:border-zinc-500 transition-colors">
                                {/* Icon */}
                                <div className="pl-6 pr-3 text-zinc-400">
                                    {isAiMode ? <Sparkles size={20} className="text-indigo-500 animate-pulse"/> : <Search size={20}/>}
                                </div>
                                {/* Input Field */}
                                <input
                                    type="text"
                                    placeholder={isAiMode ? "Rainy day moods..." : "Tracks, artists..."}
                                    // ✅ [수정됨] text-lg -> text-sm md:text-lg (모바일: 작게, PC: 크게)
                                    className="w-full bg-transparent border-none py-4 text-sm md:text-lg text-white placeholder:text-zinc-500 focus:ring-0 focus:outline-none"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                    onFocus={(e) => {
                                        setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                                    }}
                                />
                                {/* Right Actions */}
                                <div className="flex items-center pr-2 gap-2">
                                    {isSearching && <Loader2 className="animate-spin text-zinc-500" size={20} />}
                                    {/* ✨ AI Toggle Button */}
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

                        {/* AI Keywords Display (GPT가 찾은 키워드 보여주기) */}
                        {isAiMode && aiKeywords.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <span className="text-xs text-zinc-500 font-bold mr-1 self-center">Identified:</span>
                                {aiKeywords.map((k, i) => (
                                    <span key={i} className="px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                                        #{k}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 2. 검색 결과 영역 */}
                    <div className={`w-full max-w-6xl space-y-12 transition-all duration-500 ${searchQuery ? 'mt-16 opacity-100' : 'mt-0 h-0 opacity-0 overflow-hidden'}`}>
                        
                        {/* ✅ [수정 1] 검색 결과 없음 -> Create 유도 섹션 */}
                        {searchQuery && !isSearching && searchTracks.length === 0 && searchCreators.length === 0 && searchPlaylists.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in duration-300">
                                {/* 아이콘 박스 */}
                                <div className="w-20 h-20 bg-zinc-900/80 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 animate-pulse" />
                                    <Search size={32} className="text-zinc-500 relative z-10" />
                                </div>
                                
                                <h3 className="text-2xl font-bold text-white mb-2">
                                    No results found for "<span className="text-cyan-400 border-b border-cyan-400/30 pb-0.5">{searchQuery}</span>"
                                </h3>
                                <p className="text-zinc-500 mb-8 text-center max-w-md leading-relaxed">
                                    We couldn't find exactly what you're looking for.<br/>
                                    But you can be the first one to create this vibe.
                                </p>

                                {/* ✨ 근사한 Create 버튼 */}
                                <Link href="/create">
                                    <button className="group relative px-8 py-4 rounded-full bg-zinc-900 p-[1px] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full opacity-70 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative bg-black rounded-full px-6 py-3 flex items-center gap-3">
                                            <Wand2 size={20} className="text-white animate-pulse" />
                                            <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 to-white">
                                                Create "{searchQuery}"
                                            </span>
                                            <ArrowRight size={18} className="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all"/>
                                        </div>
                                    </button>
                                </Link>
                            </div>
                        )}

                        {/* ✅ [수정 2] Tracks Section (Invest -> Collect 변경) */}
                        {searchTracks.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider flex items-center gap-2">
                                    <MusicIcon size={14}/> Tracks
                                </h3>
                                <div className="space-y-2">
                                    {searchTracks.map((track) => {
                                        const isOwner = address && track.uploader_address && address.toLowerCase() === track.uploader_address.toLowerCase();
                                        const isProcessingThis = processingTrackId === track.id && isPending;
                                        const errorString = track.mint_error ? String(track.mint_error).trim() : '';
                                        const isDuplicateError = errorString.includes('duplicate_melody_hash') || !!track.duplicate_of_track_id;
                                        const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

                                        if (!isOwner && isDuplicateError) return null;

                                        return (
                                            <div
                                                key={track.id}
                                                className={`group flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${
                                                    isThisTrackPlaying 
                                                        ? 'bg-zinc-900/80 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                                                        : 'bg-transparent border-transparent hover:bg-zinc-900/50 hover:border-zinc-800'
                                                }`}
                                                onClick={() => handlePlay(track, searchTracks)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 relative group-hover:border-zinc-600 transition">
                                                        {track.cover_image_url ? ( <img src={track.cover_image_url} className="w-full h-full object-cover" /> ) : ( <MusicIcon size={20} className="text-zinc-700" /> )}
                                                        
                                                        {/* Playing Indicator Overlay */}
                                                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                            {isThisTrackPlaying ? (
                                                                <div className="flex gap-0.5 items-end h-4">
                                                                    <div className="w-1 bg-cyan-400 animate-[music-bar_0.6s_ease-in-out_infinite] h-full"/>
                                                                    <div className="w-1 bg-cyan-400 animate-[music-bar_0.8s_ease-in-out_infinite] h-2/3"/>
                                                                    <div className="w-1 bg-cyan-400 animate-[music-bar_1.0s_ease-in-out_infinite] h-1/2"/>
                                                                </div>
                                                            ) : (
                                                                <Play size={20} className="fill-white text-white"/>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-base transition ${isThisTrackPlaying ? 'text-cyan-400' : 'text-white group-hover:text-cyan-200'}`}>{track.title}</div>
                                                        <Link href={`/u?wallet=${track.artist?.wallet_address}`} className="text-xs text-zinc-500 hover:text-zinc-300 transition hover:underline"> {track.artist?.username || 'Unlisted Artist'} </Link>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        // 1. 중복 에러 & 소유자 -> Rejected
                                                        if (isDuplicateError && isOwner) {
                                                            return <span className="text-red-500 text-[10px] uppercase font-bold border border-red-500/20 px-2 py-1 rounded bg-red-500/10">Rejected</span>;
                                                        }
                                                        
                                                        // 2. 민팅 완료됨 -> Collect 버튼 (Rental Modal)
                                                        if (track.is_minted) {
                                                            return (
                                                                <button 
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        handleCollectClick(track); // ✅ Invest -> Collect 변경 완료
                                                                    }} 
                                                                    className="flex items-center gap-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-full text-xs font-bold hover:bg-white hover:text-black hover:border-white transition group/btn"
                                                                >
                                                                    <Plus size={14} className="text-zinc-500 group-hover/btn:text-black transition-colors"/>
                                                                    Collect
                                                                </button>
                                                            );
                                                        }
                                                        
                                                        // 3. 소유자지만 아직 민팅 안됨 -> Register 버튼
                                                        if (isOwner) {
                                                            return (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleRegister(track); }} 
                                                                    className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-4 py-2 rounded-full text-xs font-bold hover:bg-cyan-500 hover:text-white transition shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                                                                    disabled={isProcessingThis}
                                                                >
                                                                    {isProcessingThis ? <Loader2 className="animate-spin" size={12} /> : 'Register'}
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Creators Section (AI 모드 아닐때만 표시) */}
                        {!isAiMode && searchCreators.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Creators</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {searchCreators.map((c) => (
                                        <Link href={`/u?wallet=${c.wallet_address}`} key={c.wallet_address}>
                                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center gap-3 hover:bg-zinc-800 transition cursor-pointer group hover:border-zinc-600">
                                                <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden shadow-lg">
                                                    {c.avatar_url ? ( <img src={c.avatar_url} className="w-full h-full object-cover group-hover:scale-110 transition" /> ) : ( <User className="w-full h-full p-5 text-zinc-600" /> )}
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

                        {/* Playlists Section (AI 모드 아닐때만 표시) */}
                        {!isAiMode && searchPlaylists.length > 0 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 px-2 tracking-wider">Playlists</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {searchPlaylists.map((pl) => (
                                        <Link href={`/playlists/${pl.id}`} key={pl.id}>
                                            <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl hover:bg-zinc-800 transition cursor-pointer group hover:border-zinc-600">
                                                <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden mb-3 relative">
                                                    {pl.cover_image_url ? ( <img src={pl.cover_image_url} className="w-full h-full object-cover group-hover:scale-105 transition" /> ) : ( <div className="w-full h-full flex items-center justify-center"><ListMusic className="text-zinc-600" /></div> )}
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
      {/* ⚠️ All Player UI Removed (Handled by GlobalPlayer) */}
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