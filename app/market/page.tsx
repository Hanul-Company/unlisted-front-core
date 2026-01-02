'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AlertTriangle, Radio, Radius, Book, PlayCircle, Play, Pause, TrendingUp, Loader2, UploadCloud, Music as MusicIcon, Trash2, ExternalLink, Coins, CheckCircle, User, Heart, Mic2, LayoutGrid, Disc, SkipForward, SkipBack, Volume2, Star, Zap, ArrowRight, Search, Menu } from 'lucide-react';
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
import HorizontalScroll from '../components/HorizontalScroll'; // 경로 확인
import InvestmentCard from '../components/InvestmentCard';
import { formatEther, parseEther } from 'viem';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const unlistedStockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
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
  mint_error?: string | null;          // ✅ 추가
  duplicate_of_track_id?: number | null; // ✅ 추가
};

type FeaturedPlaylist = {
  id: number;
  name: string;
  cover_image: string | null;
};

type Profile = { wallet_address: string; username: string; avatar_url: string | null; };
const PAGE_SIZE = 15;

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
                        {originalTrack.cover_image_url ? (
                            <img src={originalTrack.cover_image_url} className="w-full h-full object-cover"/>
                        ) : (
                            <MusicIcon size={20} className="text-zinc-500 m-auto top-1/2 left-1/2 absolute -translate-x-1/2 -translate-y-1/2"/>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-0.5">Original Registered Track</div>
                        <div className="font-bold text-white truncate">{originalTrack.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{originalTrack.artist_name}</div>
                    </div>
                    <button 
                        onClick={() => onPlay(originalTrack)}
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
                    >
                        <Play size={16} fill="black" className="ml-0.5"/>
                    </button>
                </div>

                <button onClick={onClose} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition">
                    Close
                </button>
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

  const [newTracks, setNewTracks] = useState<Track[]>([]);
  const [investTracks, setInvestTracks] = useState<Track[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [browseTracks, setBrowseTracks] = useState<Track[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const [loadingTop, setLoadingTop] = useState(true);
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<FeaturedPlaylist[]>([]);

  // Collect & Collection States
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set()); // 렌탈한 트랙 ID 관리

  // [New] Collection & Payment Logic States
  const [showPlaylistModal, setShowPlaylistModal] = useState(false); // 플레이리스트 선택 모달
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]); // 유저의 플레이리스트 목록
  const [userProfileId, setUserProfileId] = useState<string | null>(null); // 프로필 ID 캐싱
  
  // Collection Modal States
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<Track | null>(null);
  const [isRentalLoading, setIsRentalLoading] = useState(false);

  // Mobile UI States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off'|'all'|'one'>('all');
  const [isShuffle, setIsShuffle] = useState(false);

  // ✅ [New] Duplicate Logic States
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateOriginalTrack, setDuplicateOriginalTrack] = useState<Track | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const toastShownRef = useRef(false); // 오디오 태그용 토스트 중복 방지

// --- 1. Fetch User Data (Likes & Collections) ---
  useEffect(() => {
    const fetchUserData = async () => {
      if (!address) {
          setLikedTrackIds(new Set());
          setRentedTrackIds(new Set());
          return;
      }
      
      try {
        // 1) Likes 가져오기 (기존 동일)
        const { data: likeData } = await supabase
            .from('likes')
            .select('track_id')
            .eq('wallet_address', address);
        
        if (likeData) {
            setLikedTrackIds(new Set(likeData.map((item: any) => item.track_id)));
        }

        // 2) Collections (렌탈) 가져오기
        // 먼저 지갑 주소로 profile_id(UUID)를 찾습니다.
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', address)
            .single();

        if (profile) {
            // 현재 시간보다 만료일이 미래이거나, 만료일이 없는(영구 소장) 항목 조회
            const now = new Date().toISOString();
            const { data: collectionData } = await supabase
                .from('collections')
                .select('track_id')
                .eq('profile_id', profile.id)
                .or(`expires_at.gt.${now},expires_at.is.null`); // 만료 안 된 것 OR 영구 소장

            if (collectionData) {
                setRentedTrackIds(new Set(collectionData.map((item: any) => item.track_id)));
            }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    
    fetchUserData();
  }, [address]);

  // --- 2. Collect Handler (Modified Logic) ---
  const handleToggleLike = async (track: Track) => {
    if (!address) return toast.error("Please connect wallet first.");

    // [핵심 로직] 렌탈 여부 확인
    const isRented = rentedTrackIds.has(track.id);

    // 렌탈하지 않았다면 -> 렌탈 모달 오픈 (좋아요 실행 X)
    if (!isRented) {
        setPendingRentalTrack(track);
        setIsRentalModalOpen(true);
        return;
    }

    // 렌탈했다면 -> 좋아요 토글 실행
    const isLiked = likedTrackIds.has(track.id);
    const nextSet = new Set(likedTrackIds);
    if (isLiked) nextSet.delete(track.id);
    else nextSet.add(track.id);
    setLikedTrackIds(nextSet);

    try {
      if (isLiked) {
        const { error } = await supabase.from('likes').delete().match({ wallet_address: address, track_id: track.id });
        if(error) throw error;
      } else {
        const { error } = await supabase.from('likes').insert({ wallet_address: address, track_id: track.id });
        if(error) throw error;
        toast.success("Added to Liked Songs");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update Collect status.");
      setLikedTrackIds(likedTrackIds); 
    }
  };

/// ------------------------------------------------------------------
  // [Step 1] 렌탈 조건 선택 후 -> 프로필/플레이리스트 로드 -> 모달 전환
  // ------------------------------------------------------------------
  const handleRentalConfirm = async (months: number, price: number) => {
    // Market 페이지에서는 'pendingRentalTrack'이 렌탈 대상입니다.
    const targetTrack = pendingRentalTrack; 

    console.group("🚀 [Step 1] handleRentalConfirm Started");
    console.log("Input:", { months, price });
    console.log("Target Track:", targetTrack?.title);

    // 1. 렌탈 조건 임시 저장
    setTempRentalTerms({ months, price });

    if (!address) {
        toast.error("Wallet not connected.");
        return;
    }

    try {
        // 2. 프로필 조회
        console.log("🔎 Fetching Profile for address:", address);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('wallet_address', address)
            .single();

        if (profileError) {
            console.error("❌ Profile Fetch Error:", profileError);
            // 프로필 없으면 그냥 진행하지 않음 (가입 유도 필요할 수 있음)
            toast.error("Profile load failed: " + profileError.message);
            console.groupEnd();
            return;
        }

        if (profile) {
            console.log("✅ Profile Found:", profile);
            setUserProfileId(profile.id);

            // 3. 내 플레이리스트 조회
            const { data: playlists, error: playlistError } = await supabase
                .from('playlists')
                .select('*')
                .eq('profile_id', profile.id)
                .order('created_at', { ascending: false });

            if (playlistError) console.error("❌ Playlist Fetch Error:", playlistError);
            
            setMyPlaylists(playlists || []);
        }
    } catch (error) {
        console.error("🔥 Critical Error in handleRentalConfirm:", error);
    }

    console.groupEnd();
    
    // 4. 모달 전환 (렌탈 모달 닫기 -> 플레이리스트 선택 모달 열기)
    setIsRentalModalOpen(false); 
    setShowPlaylistModal(true); 
  };


  // ------------------------------------------------------------------
  // [Step 2] 최종 결제 프로세스 (pMLD 우선 차감 -> MLD 결제)
  // ------------------------------------------------------------------
  const processCollect = async (playlistId: string | 'liked') => {
    // Market 페이지용 변수 매핑
    const targetTrack = pendingRentalTrack; 

    if (!targetTrack) return toast.error("No track selected for rental.");
    if (!address) return toast.error("Wallet not connected.");
    if (!tempRentalTerms) return toast.error("Error: Missing Collection terms.");

    setShowPlaylistModal(false); // 모달 닫기
    
    const { months, price } = tempRentalTerms;
    const toastId = toast.loading("Processing payment...");

    try {
      // ---------------------------------------------------------
      // [1단계] pMLD (포인트) 결제 시도 (RPC 호출)
      // ---------------------------------------------------------
      console.log("Attempting pMLD Payment via RPC...");
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', {
        p_wallet_address: address,
        p_track_id: targetTrack.id,
        p_duration_months: months
      });

      if (rpcError) {
        console.error("❌ pMLD RPC Error:", rpcError);
        throw rpcError;
      }

      console.log("pMLD RPC Result:", rpcResult);

      // ✅ [성공 Case 1] 포인트로 결제 완료됨
      if (rpcResult === 'OK') {
        // 플레이리스트에 추가 (선택한 경우)
        if (playlistId !== 'liked') {
          await supabase.from('playlist_items').insert({ 
            playlist_id: parseInt(playlistId),
            track_id: targetTrack.id 
          });
        }
        // 좋아요 목록에도 자동 추가
        await supabase.from('likes').upsert({ wallet_address: address, track_id: targetTrack.id }, { onConflict: 'wallet_address, track_id' });

        toast.success("Collected using pMLD!", { id: toastId });
        
        // 상태 초기화
        setRentedTrackIds(prev => new Set(prev).add(targetTrack.id));
        setTempRentalTerms(null);
        setPendingRentalTrack(null);
        return;
      }

      // ---------------------------------------------------------
      // [2단계] MLD (토큰) 결제 시도 (포인트 부족 시)
      // ---------------------------------------------------------
      if (rpcResult === 'INSUFFICIENT_PMLD') {
        console.log("Insufficient pMLD. Switching to MLD Token...");
        toast.loading(`Insufficient pMLD. Requesting ${price} MLD...`, { id: toastId });

        // 수령인 찾기 (아티스트 지갑 or 업로더 or 플랫폼)
        let recipient = targetTrack.uploader_address || "0x0000000000000000000000000000000000000000"; 
        
        // 정확한 아티스트 지갑 조회를 위해 contributors 확인 (옵션)
        const { data: contributors } = await supabase
          .from('track_contributors')
          .select('wallet_address')
          .eq('track_id', targetTrack.id)
          .eq('role', 'Main Artist')
          .limit(1);

        if (contributors && contributors.length > 0) {
            recipient = contributors[0].wallet_address;
        }

        // 1. 블록체인 트랜잭션 (MLD 전송)
        // 🔥 여기가 Radio랑 다른 부분이었던 곳입니다. parseEther를 씁니다.
        const transaction = prepareContractCall({
          contract: melodyTokenContract, // MarketPage 상단에 정의된 contract 확인 필요
          method: "transfer",
          params: [recipient, parseEther(price.toString())] 
        });

        sendTransaction(transaction, {
          onSuccess: async () => {
            console.log("✅ Blockchain Transaction Confirmed.");
            toast.loading("Verifying rental...", { id: toastId });

            // 2. ✅ DB 동기화: MLD 결제용 RPC 함수 호출
            const { data: mldRpcResult, error: mldRpcError } = await supabase.rpc('add_to_collection_using_mld_by_wallet', {
               p_wallet_address: address,
               p_track_id: targetTrack.id,
               p_duration_months: months,
               p_amount_mld: price
            });

            if (mldRpcError) {
                console.error("❌ MLD DB Sync Error:", mldRpcError);
                toast.error("Transaction success but DB sync failed. Contact support.", { id: toastId });
                return;
            }

            if (mldRpcResult === 'OK') {
                // 플레이리스트 아이템 추가
                if (playlistId !== 'liked') {
                    await supabase.from('playlist_items').insert({ 
                        playlist_id: parseInt(playlistId),
                        track_id: targetTrack.id 
                    });
                }
                // 좋아요 추가
                await supabase.from('likes').upsert({ wallet_address: address, track_id: targetTrack.id }, { onConflict: 'wallet_address, track_id' });

                toast.success("Payment complete! Added to collection.", { id: toastId });
                
                // 상태 업데이트
                setRentedTrackIds(prev => new Set(prev).add(targetTrack.id));
                setTempRentalTerms(null);
                setPendingRentalTrack(null);
            } else {
                console.error("Unknown RPC Result:", mldRpcResult);
                toast.error(`Error: ${mldRpcResult}`, { id: toastId });
            }
          },
          onError: (err) => {
            console.error("❌ Transaction Failed:", err);
            toast.error("Payment transaction failed.", { id: toastId });
            setIsRentalLoading(false);
          }
        });
      } else {
        // 그 외 RPC 에러 (NO_WALLET, NO_TRACK_ID 등)
        toast.error(`Error: ${rpcResult}`, { id: toastId });
        setIsRentalLoading(false);
      }

    } catch (e: any) {
      console.error("🔥 Process Collect Error:", e);
      toast.error(e.message || "An error occurred", { id: toastId });
      setIsRentalLoading(false);
    }
  };

  // --- Initial Data Loading (기존 유지) ---
  useEffect(() => {
    const fetchTopData = async () => {
      setLoadingTop(true);
      const { data: newData } = await supabase.from('tracks').select('*').order('created_at', { ascending: false }).limit(15);
      setNewTracks(newData || []);
      const { data: allData } = await supabase.from('tracks').select('*').eq('is_minted', true).limit(20);
      setInvestTracks((allData || []).slice(0, 5));
      const { data: creatorData } = await supabase.from('profiles').select('*').limit(20);
      setCreators(creatorData || []);
      setLoadingTop(false);
    };
    fetchTopData();

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

  // --- Browse Data (기존 유지) ---
  useEffect(() => {
    setPage(0); setBrowseTracks([]); setHasMore(true);
    fetchBrowseData(0, searchQuery, true);
  }, [searchQuery]);

  const fetchBrowseData = async (pageIndex: number, query: string, isReset: boolean = false) => {
    setIsBrowseLoading(true);
    try {
      let queryBuilder = supabase.from('tracks').select('*').order('created_at', { ascending: false }).range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
      if (query) queryBuilder = queryBuilder.ilike('title', `%${query}%`);
      const { data, error } = await queryBuilder;
      if (!error && data) {
        if (data.length < PAGE_SIZE) setHasMore(false);
        setBrowseTracks(prev => isReset ? data : [...prev, ...data]);
      }
    } catch (e) { console.error(e); } finally { setIsBrowseLoading(false); }
  };

  const handleScroll = () => {
    if (mainRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50 && !isBrowseLoading && hasMore) {
            const nextPage = page + 1; setPage(nextPage); fetchBrowseData(nextPage, searchQuery);
        }
    }
  };

  const handleRegister = async (track: Track) => {
      // (기존 코드 유지)
      if (!address) return toast.error("Wallet connection required.");
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
        const transaction = prepareContractCall({
            contract: melodyIpContract,
            method: "registerMusic",
            params: [uniqueHash, payees, shares, BigInt(500), true, track.audio_url]
        });
        sendTransaction(transaction, {
            onSuccess: async () => {
                const { error } = await supabase.from('tracks').update({ is_minted: true, token_id: track.id }).eq('id', track.id);
                if (!error) {
                    toast.success("Registered!", { id: 'register-toast' });
                    setBrowseTracks(prev => prev.map(t => t.id === track.id ? { ...t, is_minted: true } : t));
                    setNewTracks(prev => prev.map(t => t.id === track.id ? { ...t, is_minted: true } : t));
                } else { toast.error("Database update failed.", { id: 'register-toast' }); }
                setProcessingTrackId(null);
            },
            onError: (err) => { console.error(err); toast.error("Transaction failed.", { id: 'register-toast' }); setProcessingTrackId(null); }
        });
      } catch (e) { console.error(e); toast.error("An error occurred.", { id: 'register-toast' }); setProcessingTrackId(null); }
  };

  const handleInvest = (track: Track) => {
    if (!address) return toast.error("Please connect your wallet.");
    setSelectedTrack(track);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this track?")) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (!error) { toast.success("Deleted."); setBrowseTracks(prev => prev.filter(t => t.id !== id)); setNewTracks(prev => prev.filter(t => t.id !== id)); }
    else toast.error(error.message);
  };

  // ✅ [New] 중복 확인 모달 오픈 핸들러
  const handleCheckDuplicate = async (originalTrackId: number) => {
      if (!originalTrackId) return;
      const toastId = toast.loading("Fetching original track info...");
      try {
          const { data, error } = await supabase.from('tracks').select('*').eq('id', originalTrackId).single();
          if (error || !data) throw new Error("Original track not found");
          setDuplicateOriginalTrack(data);
          setShowDuplicateModal(true);
          toast.dismiss(toastId);
      } catch (e) { toast.error("Failed to load info", { id: toastId }); }
  };

  // --- Audio Logic ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack) {
        if (audio.src !== currentTrack.audio_url) { 
            audio.src = currentTrack.audio_url; 
            setCurrentTime(0); 
            toastShownRef.current = false; // 트랙 바뀌면 토스트 플래그 리셋
        }
        if (isPlaying) { const p = audio.play(); if(p !== undefined) p.catch(console.error); }
        else audio.pause();
    } else audio.pause();
  }, [currentTrack, isPlaying]);

  const handleNext = () => {
    if (!currentTrack) return;
    const list = browseTracks.length > 0 ? browseTracks : newTracks;
    const idx = list.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1 && idx < list.length - 1) setCurrentTrack(list[idx + 1]);
  };

  const handlePrev = () => {
    if (!currentTrack) return;
    const list = browseTracks.length > 0 ? browseTracks : newTracks;
    const idx = list.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) setCurrentTrack(list[idx - 1]);
  };

  const formatTime = (time: number) => { if(isNaN(time)) return "0:00"; const min = Math.floor(time / 60); const sec = Math.floor(time % 60); return `${min}:${sec < 10 ? '0' : ''}${sec}`; };

  // 현재 트랙의 렌탈 여부 (플레이어용)
  const isCurrentTrackRented = currentTrack ? rentedTrackIds.has(currentTrack.id) : false;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
        <audio 
            ref={audioRef} 
            onTimeUpdate={(e) => {
                const time = e.currentTarget.currentTime;
                // 렌탈 여부에 따라 60초 제한 로직 적용
                if (!isCurrentTrackRented && time >= 60) {
                    e.currentTarget.pause();
                    setIsPlaying(false);
                    // 토스트 중복 방지
                    if (!toastShownRef.current) {
                        toast("Preview ended. Collect to listen full track!", { 
                            icon: "🔒",
                            id: "preview-end-toast", // ID 부여
                            style: { borderRadius: '10px', background: '#333', color: '#fff' }
                        });
                        toastShownRef.current = true;
                    }
                } else {
                    setCurrentTime(time);
                    if (time < 59) toastShownRef.current = false; // 뒤로감기 시 리셋
                }
            }} 
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} 
            onEnded={() => setIsPlaying(false)} 
            preload="auto" 
            crossOrigin="anonymous"
        />
      
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

{/* Sidebar (수정됨) */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 hidden md:flex flex-col p-6 h-screen sticky top-0">
         
         {/* Logo */}
         <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 cursor-pointer">
             unlisted
         </div>

         {/* ✅ [New] Main CTA Button: Start Stream (Radio) */}
         <Link href="/radio">
            <button className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold py-4 rounded-xl mb-8 flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-blue-900/20 group">
                <Radio size={20} className="group-hover:animate-pulse" fill="currentColor"/> 
                Start Stream
            </button>
         </Link>

         {/* Navigation */}
         <nav className="space-y-6 flex-1">
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Discover</h3>
                 {/* 현재 페이지 표시 (bg-zinc-800) */}
                 <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition">
                    <Disc size={18}/>
                    <span className="text-sm font-medium"> Explore</span>
                 </div>
                 {/* 기존 unlisted Player 삭제됨 (Start Stream으로 대체) */}
                 <Link href="/investing">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <TrendingUp size={18}/>
                        <span className="text-sm font-medium"> Charts</span>
                    </div>
                 </Link>
             </div>

             <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">My Studio</h3>
                <Link href="/library">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <PlayCircle size={18}/>
                        <span className="text-sm font-medium"> Playlists</span>
                    </div>
                </Link>
                <Link href="/portfolio">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <Book size={18}/>
                        <span className="text-sm font-medium"> Portfolio</span>
                    </div>
                </Link>
            </div>


             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3>
                <Link href="/studio">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <Coins size={18}/> 
                        <span className="text-sm font-medium"> Earnings</span>
                    </div>
                </Link>
                <Link href="/earn">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer transition">
                        <Zap size={18} className="text-yellow-500"/>
                        <span className="text-sm font-medium text-yellow-500">Free Faucet</span>
                    </div>
                </Link>
             </div>

            {/* ✅ [Moved] Upload Button (Bottom) */}
            <div className="pt-6 mt-auto border-t border-zinc-800">
                <Link href="/upload">
                    <button className="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition group">
                        <UploadCloud size={18} className="group-hover:text-cyan-400 transition-colors"/> 
                        <span className="text-sm">Upload & Earn</span>
                    </button>
                </Link>
            </div>
         </nav>
      </aside>

      <main ref={mainRef} onScroll={handleScroll} className="flex-1 flex flex-col overflow-y-auto pb-24 scroll-smooth relative">
        {/* Header (유지) */}
        <header className="flex justify-between items-center p-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-800">
          <div className="flex items-center gap-4">
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu/></button>
             <h1 className="text-xl font-bold">Explore</h1>
          </div>
          <div className="flex items-center gap-3">
                <TokenBalance address={address} />
             <HeaderProfile />
          </div>
        </header>

        {loadingTop ? (
            <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-cyan-500" size={32}/></div>
        ) : (
            <div className="pb-10 pt-4">
                {/* 1. Playlists for you */}
                <section className="mb-2">
                    <div className="px-6 mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white flex items-center gap-2">Playlists for you</h2></div>
                    <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2"> 
                    {featuredPlaylists.length === 0 ? ( <div className="text-zinc-500 text-sm">No playlists available yet.</div> ) : (
                        featuredPlaylists.map((pl) => (
                        // 🔻 [수정] href를 '/radio?playlist_id=' 에서 '/playlist/' 로 변경
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
                
                {/* 2. Fresh Drops (유지) */}
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
                                <p className="text-xs text-zinc-500 truncate">{t.artist_name}</p>
                            </div>
                        ))}
                    </HorizontalScroll>
                </section>

                {/* 3. Popular Creators (기존 유지) */}
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

                {/* 4. Top Investments (기존 유지) */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4 flex justify-between items-end">
                        <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-green-400" size={20}/> Top Investment</h2>
                        <Link href="/investing" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">View Chart <ArrowRight size={12}/></Link>
                    </div>
                        <HorizontalScroll className="gap-4 px-6 pb-4 snap-x pt-2 scrollbar-hide"> 
                            {investTracks.map((t) => (
                                <InvestmentCard 
                                    key={t.id} 
                                    track={t} 
                                    onPlay={(track) => { 
                                        setCurrentTrack(track); 
                                        setIsPlaying(true); 
                                        setMobilePlayerOpen(true); 
                                    }}
                                    onInvest={(track) => handleInvest(track)}
                                />
                            ))}
                            {/* 투자할 곡이 없을 때 빈 상태 처리 (옵션) */}
                            {investTracks.length === 0 && (
                                <div className="min-w-[240px] h-[260px] flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl text-zinc-500 text-xs">
                                    <p>No investment tracks yet.</p>
                                </div>
                            )}
                        </HorizontalScroll>
                </section>

                {/* 5. Browse All (유지) */}
                <section className="p-6 min-h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Disc className="text-zinc-400" size={20}/> Browse</h2>
                        {/* 검색창 유지 */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-zinc-500" size={14}/>
                            <input type="text" placeholder="Search..." className="w-64 bg-zinc-900 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500 border border-zinc-800" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {browseTracks.map((track) => {
                            const isOwner = address && track.uploader_address && address.toLowerCase() === track.uploader_address.toLowerCase();
                            const isProcessingThis = processingTrackId === track.id && (isPending);
                            // ✅ [수정] 중복 에러 확인
                            const isDuplicateError = track.mint_error && (track.mint_error === 'duplicate_melody_hash' || track.mint_error === 'duplicate_melody_hash_existing_minted');
                            
                            // ✅ [수정] 남의 트랙인데 에러 있으면 숨김
                            if (!isOwner && track.mint_error) return null;

                            return (
                                <div key={track.id} className={`group flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${currentTrack?.id === track.id ? 'bg-zinc-900 border-cyan-500/50' : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`} onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                {/* Track Info */}
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 relative">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <MusicIcon size={16} className="text-zinc-700"/>}
                                        {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"/></div>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{track.title}</div>
                                        <Link href={track.uploader_address ? `/u?wallet=${track.uploader_address}` : '#'} onClick={(e)=>e.stopPropagation()} className="text-xs text-zinc-500 hover:text-white hover:underline transition-colors">{track.artist_name || 'Unlisted Artist'}</Link>
                                    </div>
                                </div>
                                {/* Buttons */}
                                <div className="flex items-center gap-3">
                                    {track.is_minted ? (
                                        <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white hover:text-black transition">Invest</button>
                                    ) : (
                                        isOwner ? (
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button>
                                                {/* ✅ [수정] 중복 에러 시 Rejected 버튼 */}
                                                {isDuplicateError ? (
                                                    <button onClick={(e) => { e.stopPropagation(); if (track.duplicate_of_track_id) handleCheckDuplicate(track.duplicate_of_track_id); }} className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition flex items-center gap-1"><AlertTriangle size={12}/> Rejected</button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); handleRegister(track); }} className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-cyan-500 hover:text-white transition" disabled={isProcessingThis}>{isProcessingThis ? <Loader2 className="animate-spin" size={12}/> : 'Register'}</button>
                                                )}
                                            </div>
                                        ) : <span className="text-[10px] text-zinc-600 font-mono">PREPARING</span>
                                    )}
                                </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        )}
      </main>

        {/* ✅ Mobile Full Player */}
      {currentTrack && mobilePlayerOpen && ( <MobilePlayer track={currentTrack} isPlaying={isPlaying} onPlayPause={() => setIsPlaying(!isPlaying)} onNext={handleNext} onPrev={handlePrev} onClose={() => setMobilePlayerOpen(false)} repeatMode={repeatMode} onToggleRepeat={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')} isShuffle={isShuffle} onToggleShuffle={() => setIsShuffle(!isShuffle)} currentTime={currentTime} duration={duration} onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }} isLiked={likedTrackIds.has(currentTrack.id)} isRented={rentedTrackIds.has(currentTrack.id)} onToggleLike={() => handleToggleLike(currentTrack)} onInvest={currentTrack.is_minted ? () => handleInvest(currentTrack) : undefined} /> )}
      {/* 2. Mobile Mini Player (Bottom Bar) */}
      {currentTrack && !mobilePlayerOpen && ( <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}> <div className="flex items-center gap-3 overflow-hidden"> <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative"> {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />} </div> <div className="flex-1 min-w-0"> <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div> <div className="text-xs text-zinc-500 truncate">{currentTrack.artist_name}</div> </div> </div> <div className="flex items-center gap-3 pr-1"> <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black"> {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />} </button> </div> </div> )}
      {/* ✅ Desktop Footer Player */}
      {currentTrack && ( <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl"> <div className="flex items-center gap-4 w-1/3"> <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative"> {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700 animate-spin-slow"/></div>} </div> <div className="overflow-hidden"> <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div> <div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist_name || 'unlisted Artist'}</div> </div> <button onClick={() => handleToggleLike(currentTrack)} className={`ml-2 hover:scale-110 transition ${likedTrackIds.has(currentTrack.id) ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}> <Heart size={20} fill={likedTrackIds.has(currentTrack.id) ? "currentColor" : "none"} /> </button> </div> <div className="flex flex-col items-center gap-2 w-1/3"> <div className="flex items-center gap-6"> <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20}/></button> <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">{isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}</button> <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20}/></button> </div> <div className="w-full max-w-sm flex items-center gap-3"> <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span> <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => { if(!audioRef.current) return; const rect = e.currentTarget.getBoundingClientRect(); const clickX = e.clientX - rect.left; const width = rect.width; const newTime = (clickX / width) * duration; if (!isCurrentTrackRented && newTime > 60) { toast.error("Preview limited to 1 minute"); audioRef.current.currentTime = 60; } else { audioRef.current.currentTime = newTime; } }}> {!isCurrentTrackRented && duration > 60 && ( <div className="absolute top-0 left-0 h-full bg-purple-500/30 z-0" style={{ width: `${(60/duration)*100}%` }} /> )} <div className="h-full bg-white rounded-full relative z-10" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }}/> </div> <span className="text-[10px] text-zinc-500 font-mono w-8"> {!isCurrentTrackRented && duration > 60 ? "1:00" : formatTime(duration)} </span> </div> </div> <div className="w-1/3 flex justify-end items-center gap-4"> {currentTrack.is_minted && ( <button onClick={() => handleInvest(currentTrack)} className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5"> <Zap size={14} fill="currentColor"/> Invest </button> )} <div className="w-px h-6 bg-zinc-800 mx-1"></div> <Volume2 size={18} className="text-zinc-500"/> <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="w-2/3 h-full bg-zinc-500 rounded-full"></div></div> </div> </div> )}

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