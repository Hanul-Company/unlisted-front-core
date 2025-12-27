'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { ListMusic, Loader2, Heart, X, Zap, Play, Pause, Radio, ChevronRight, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_SCENARIOS } from '../constants';
import HeaderProfile from '../components/HeaderProfile';
import RentalModal from '../components/RentalModal';
import { useSearchParams, useRouter } from 'next/navigation';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';

const stockContract = getContract({
  client,
  chain,
  address: UNLISTED_STOCK_ADDRESS,
  abi: UNLISTED_STOCK_ABI as any
});

const tokenContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any
});

function RadioContent() {
  const account = useActiveAccount();
  const address = account?.address;

  // URL 파라미터 및 라우터
  const searchParams = useSearchParams();
  const targetPlaylistId = searchParams.get('playlist_id');
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [user, setUser] = useState<any>(null);
  // ✅ [추가] 프로필 ID 저장용 State (재조회 방지)
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [step, setStep] = useState<'onboarding' | 'playing'>('onboarding');

  // GenMode
  const [genMode, setGenMode] = useState<'genre' | 'mood' | 'scenario' | 'playlist'>('genre');
  
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  // Player State
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals & Flows
  // ✅ [수정] 변수명 통일 (isRentalOpen 삭제)
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  // Rental Logic Data
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);

  const { mutate: sendTransaction } = useSendTransaction();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Playlist Loading
  useEffect(() => {
    if (targetPlaylistId) {
      loadTargetPlaylist(targetPlaylistId);
    }
  }, [targetPlaylistId]);

  const loadTargetPlaylist = async (playlistId: string) => {
    setLoading(true);
    try {
      const { data: plInfo, error: plError } = await supabase
        .from('playlists')
        .select('name')
        .eq('id', playlistId)
        .single();
        
      if (plError || !plInfo) {
        toast.error("Playlist not found");
        setLoading(false);
        return;
      }

      const { data: items, error } = await supabase
        .from('playlist_items')
        .select(`
          tracks (
            id, title, artist_name, audio_url, cover_image_url, genre, moods, duration, uploader_address, token_id
          )
        `)
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: true });

      if (error) throw error;

      const formattedTracks = items?.map((item: any) => item.tracks).filter(Boolean) || [];

      if (formattedTracks.length > 0) {
        setQueue(formattedTracks);
        setCurrentTrack(formattedTracks[0]);
        
        setGenMode('playlist'); 
        setSelectedGenre(plInfo.name);
        setStep('playing');
        
        setTimeout(() => {
          setIsPlaying(true);
        }, 500);
      } else {
        toast.error("This playlist is empty.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load playlist.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      let data: any[] | null = [];
      let error = null;

      if (selectedScenario) {
        const scenario = MUSIC_SCENARIOS.find(s => s.id === selectedScenario);
        if (scenario) {
          const { data: tagData, error: tagError } = await supabase
            .from('tracks')
            .select('*, artist:profiles(*)')
            .overlaps('context_tags', scenario.tags)
            .limit(10);
          data = tagData;
          error = tagError;
          if (data) data = data.sort(() => Math.random() - 0.5);
        }
      } else {
        const res = await supabase.rpc('get_random_tracks_v3', {
          user_wallet: address,
          filter_genre: selectedGenre,
          filter_mood: selectedMood,
          limit_count: 5
        });
        data = res.data;
        error = res.error;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        setQueue(data);
        setCurrentTrack(data[0]);
        setStep('playing');
        setIsPlaying(true);

        if (!selectedScenario && selectedGenre) {
          const hasMatching = data.some((t: any) => t.genre === selectedGenre);
          if (!hasMatching) toast("No exact match found — playing a random mix.", { icon: '📡' });
        }
      } else {
        toast.error("No tracks available. Try changing your filters.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while loading tracks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedScenario) {
      fetchRecommendations();
    }
  }, [selectedScenario]);

  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
      if (audio.src !== currentTrack.audio_url) {
        audio.src = currentTrack.audio_url;
        audio.load();
        setCurrentTime(0);
        if (isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) playPromise.catch(console.error);
        }
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      if (audio.paused) audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleVolumeInteraction = () => {
    setShowVolume(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 3000);
  };

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleSkip = () => {
    const nextQueue = queue.slice(1);
    if (nextQueue.length === 0) {
      if (genMode !== 'playlist') {
        toast("Fetching a new mix...", { icon: '📡' });
        fetchRecommendations();
      } else {
        setIsPlaying(false);
      }
    } else {
      setQueue(nextQueue);
      setCurrentTrack(nextQueue[0]);
      setIsPlaying(true);
    }
  };

  const handleInvest = () => {
    if (!address) return toast.error("Wallet connection required.");
    const targetTokenId = currentTrack.token_id || currentTrack.id;

    const transaction = prepareContractCall({
      contract: stockContract,
      method: "buyShares",
      params: [BigInt(targetTokenId), BigInt(10 * 1e18)]
    });

    const toastId = toast.loading("Processing investment...");
    sendTransaction(transaction, {
      onSuccess: () => toast.success("Investment successful!", { id: toastId }),
      onError: (err) => {
        console.error(err);
        toast.error("Investment failed.", { id: toastId });
      }
    });
  };

  // ✅ [수정] 하트 클릭 시 -> 렌탈 모달(기간 선택)을 먼저 염
  const openCollectModal = async () => {
    if (!address && !user) return toast.error("Please log in or connect your wallet.");

    const { data: existing } = await supabase
      .from('likes')
      .select('*')
      .match({ wallet_address: address, track_id: currentTrack.id })
      .maybeSingle();

    if (existing) return toast.success("Already in your library.");

    // 바로 PlaylistModal로 가지 않고 RentalModal을 엽니다.
    setShowRentalModal(true);
  };

// 🔍 [디버깅용] 렌탈 확인 (로그 강화)
  const handleRentalConfirm = async (months: number, price: number) => {
    console.group("🚀 [Step 1] handleRentalConfirm Started");
    console.log("Input:", { months, price });
    console.log("Current Address:", address);

    setTempRentalTerms({ months, price });

    if (address) {
      try {
        console.log("🔎 Fetching Profile for address:", address);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('wallet_address', address)
          .single();

        if (profileError) {
            console.error("❌ Profile Fetch Error:", profileError);
            toast.error("Profile load failed: " + profileError.message);
            console.groupEnd();
            return;
        }

        if (profile) {
          console.log("✅ Profile Found:", profile);
          
          // 🔥 State 저장 확인 로그
          console.log("💾 Setting userProfileId state to:", profile.id);
          setUserProfileId(profile.id); 

          const { data: playlists, error: playlistError } = await supabase
            .from('playlists')
            .select('*')
            .eq('profile_id', profile.id)
            .order('created_at', { ascending: false });
          
          if (playlistError) console.error("❌ Playlist Fetch Error:", playlistError);
          console.log("✅ Playlists loaded:", playlists?.length);

          setMyPlaylists(playlists || []);
        } else {
            console.warn("⚠️ No profile returned for this address.");
        }
      } catch (error) {
        console.error("🔥 Critical Error in handleRentalConfirm:", error);
      }
    } else {
        console.warn("⚠️ No wallet address connected.");
    }
    
    console.groupEnd();
    setShowRentalModal(false);
    setShowPlaylistModal(true);
  };

// ✅ [최종 수정] _by_wallet 함수들을 사용하는 완벽한 결제 로직
  const processCollect = async (playlistId: string | 'liked') => {
    // 1. 지갑 주소 및 렌탈 조건 확인
    const walletAddress = address; // Thirdweb에서 가져온 주소
    if (!walletAddress) return toast.error("Wallet not connected.");
    
    setShowPlaylistModal(false);

    if (!tempRentalTerms) return toast.error("Error: Missing rental terms.");
    const { months, price } = tempRentalTerms; // months가 999면 무제한
    
    const toastId = toast.loading("Processing payment...");

    try {
      // ---------------------------------------------------------
      // [1단계] pMLD (포인트) 결제 시도
      // ---------------------------------------------------------
      console.log("Attempting pMLD Payment via RPC...");
      
      // ✅ 새로 만든 _by_wallet 함수 호출
      const { data: rpcResult, error: rpcError } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', {
        p_wallet_address: walletAddress,
        p_track_id: currentTrack.id,
        p_duration_months: months
      });

      if (rpcError) {
        console.error("❌ pMLD RPC Error:", rpcError);
        throw rpcError;
      }

      console.log("pMLD RPC Result:", rpcResult);

      // ✅ [성공 Case] 포인트로 결제 완료됨
      if (rpcResult === 'OK') {
        // 플레이리스트 아이템 추가
        if (playlistId !== 'liked') {
          await supabase.from('playlist_items').insert({ 
            playlist_id: parseInt(playlistId),
            track_id: currentTrack.id 
          });
        }
        // 좋아요 추가
        await supabase.from('likes').insert({ wallet_address: walletAddress, track_id: currentTrack.id });

        toast.success("Collected using pMLD!", { id: toastId });
        setTempRentalTerms(null);
        return;
      }

      // ---------------------------------------------------------
      // [2단계] MLD (토큰) 결제 시도 (포인트 부족 시)
      // ---------------------------------------------------------
      if (rpcResult === 'INSUFFICIENT_PMLD') {
        console.log("Insufficient pMLD. Switching to MLD Token...");
        toast.loading(`Insufficient pMLD. Requesting ${price} MLD...`, { id: toastId });

        // 아티스트 지갑 찾기
        const { data: contributors } = await supabase
          .from('track_contributors')
          .select('wallet_address')
          .eq('track_id', currentTrack.id)
          .eq('role', 'Main Artist')
          .limit(1);

        if (!contributors || contributors.length === 0) throw new Error("Artist wallet not found.");

        // 1. 블록체인 트랜잭션 (MLD 전송)
        const transaction = prepareContractCall({
          contract: tokenContract,
          method: "transfer",
          params: [contributors[0].wallet_address, BigInt(price * 1e18)]
        });

        sendTransaction(transaction, {
          onSuccess: async () => {
            console.log("✅ Blockchain Transaction Confirmed.");
            toast.loading("Verifying rental...", { id: toastId });

            // 2. ✅ DB 처리: 새로 만든 MLD용 RPC 함수 호출
            // (이 함수가 collections 테이블 insert와 로그 기록을 다 해줍니다)
            const { data: mldRpcResult, error: mldRpcError } = await supabase.rpc('add_to_collection_using_mld_by_wallet', {
               p_wallet_address: walletAddress,
               p_track_id: currentTrack.id,
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
                        track_id: currentTrack.id 
                    });
                }
                // 좋아요 추가
                await supabase.from('likes').insert({ wallet_address: walletAddress, track_id: currentTrack.id });

                toast.success("Payment complete! Added to playlist.", { id: toastId });
                setTempRentalTerms(null);
            } else {
                console.error("Unknown RPC Result:", mldRpcResult);
                toast.error(`Error: ${mldRpcResult}`, { id: toastId });
            }
          },
          onError: (err) => {
            console.error("❌ Transaction Failed:", err);
            toast.error("Payment transaction failed.", { id: toastId });
          }
        });
      } else {
        // 그 외 에러 (NO_WALLET, NO_TRACK_ID 등)
        toast.error(`Error: ${rpcResult}`, { id: toastId });
      }

    } catch (e: any) {
      console.error("🔥 Process Collect Error:", e);
      toast.error(e.message || "An error occurred", { id: toastId });
    }
  };

  if (targetPlaylistId && step === 'onboarding') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-green-500" size={48} />
        <p className="text-zinc-400 font-bold animate-pulse">Loading Playlist...</p>
      </div>
    );
  }

  if (step === 'onboarding') {
    return (
      <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col items-center justify-center relative overflow-hidden selection:bg-cyan-500/30 pt-24">
        <Link
          href="/market"
          className="absolute top-6 left-6 text-zinc-500 hover:text-white transition flex items-center gap-2 z-50 text-sm font-bold"
        >
          <ChevronLeft size={18} /> Exit Radio
        </Link>

        <div className="max-w-2xl w-full text-center space-y-8">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">
            What is your flavor?
          </h1>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center gap-2">
                <span className="w-10 h-px bg-blue-500/50"></span>
                RECOMMENDED SCENARIOS
                <span className="w-10 h-px bg-blue-500/50"></span>
              </label>

              {/* 시나리오 리스트 영역 */}
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide justify-start md:justify-center px-4 snap-x pt-1">
                {MUSIC_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      const newValue = selectedScenario === scenario.id ? null : scenario.id;
                      setSelectedScenario(newValue);
                      if (newValue) {
                        setSelectedGenre(null);
                        setSelectedMood(null);
                      }
                    }}
                    className={`
                      flex-shrink-0 px-5 py-4 rounded-2xl border transition-all duration-300 
                      flex flex-col items-center gap-2 min-w-[100px] snap-center origin-top
                      ${
                        selectedScenario === scenario.id
                          ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)] scale-105'
                          : 'bg-zinc-900/80 border-white/5 text-zinc-400 hover:bg-zinc-800 hover:border-white/20 hover:text-white'
                      }
                    `}
                  >
                    <span className="text-3xl filter drop-shadow-md">{scenario.emoji}</span>
                    <span className="text-xs font-bold whitespace-nowrap">{scenario.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 opacity-50">
              <div className="h-px bg-zinc-800 w-full max-w-[100px]"></div>
              <span className="text-[10px] text-zinc-600 font-bold uppercase">OR CUSTOMIZE</span>
              <div className="h-px bg-zinc-800 w-full max-w-[100px]"></div>
            </div>

            <div className={`space-y-6 transition-opacity duration-300 ${selectedScenario ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Genre</label>
                <div className="flex flex-wrap justify-center gap-2">
                  {MUSIC_GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => setSelectedGenre(g === selectedGenre ? null : g)}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
                        selectedGenre === g
                          ? 'bg-white text-black border-white shadow-lg shadow-white/20'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Mood</label>
                <div className="flex flex-wrap justify-center gap-2">
                  {MUSIC_MOODS.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedMood(m === selectedMood ? null : m)}
                      className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
                        selectedMood === m
                          ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/30'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-bold px-10 py-3 rounded-full hover:scale-105 transition shadow-xl shadow-blue-900/50 disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Start Listening"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleSkip}
        crossOrigin="anonymous"
      />

      <header className="flex justify-between items-center p-6 z-50 pointer-events-none relative">
        <button
          onClick={() => {
            if (targetPlaylistId) {
              router.push('/market');
            } else {
              setStep('onboarding'); 
              setIsPlaying(false); 
              audioRef.current?.pause();
            }
          }}
          className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition pointer-events-auto"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="bg-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-red-500 animate-pulse border border-red-500/30 flex items-center gap-1">
             {genMode === 'playlist' ? <ListMusic size={10}/> : <Radio size={10}/>}
             {genMode === 'playlist' ? 'PLAYLIST' : 'ON AIR'}
          </div>
          <HeaderProfile />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 z-10 relative">
        <div className="relative group">
          <div className={`w-64 h-64 md:w-80 md:h-80 aspect-square rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'} transition-all duration-700`}>
            {currentTrack?.cover_image_url ? (
              <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <Radio size={48} className="text-zinc-700" />
              </div>
            )}
          </div>

          <div className="absolute -bottom-10 left-0 right-0 z-20">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-white rounded-full transition-all duration-300 ease-linear shadow-[0_0_10px_white]"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-center space-y-4 mt-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight px-4 truncate">{currentTrack?.title}</h2>
            <p className="text-zinc-400 text-sm mt-1">{currentTrack?.artist_name}</p>
            <div className="flex justify-center gap-2 mt-2">
              {currentTrack?.genre && (
                <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500 uppercase tracking-wide">
                  #{currentTrack.genre}
                </span>
              )}
              {genMode === 'playlist' && selectedGenre && (
                <span className="text-[10px] bg-green-900/30 border border-green-800/50 px-2 py-0.5 rounded text-green-500 uppercase tracking-wide flex items-center gap-1">
                  <ListMusic size={8}/> {selectedGenre}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2">
            <button onClick={handleSkip} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition backdrop-blur-md">
              <X size={20} />
            </button>

            <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>

            <button onClick={openCollectModal} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition backdrop-blur-md">
              <Heart size={20} />
            </button>
          </div>

          <button onClick={handleInvest} className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 font-bold tracking-widest text-[10px] mt-6 hover:underline transition mx-auto uppercase">
            <Zap size={12} fill="currentColor" /> Invest
          </button>
        </div>
      </div>

      <div onClick={handleSkip} className="absolute top-0 right-0 w-[15%] h-full z-30 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-pointer flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent group">
        <div className="text-white/50 group-hover:text-white flex flex-col items-center gap-2 transform translate-x-10 group-hover:translate-x-0 transition-transform duration-300">
          <ChevronRight size={32} />
          <span className="text-[10px] font-bold tracking-widest uppercase">Skip</span>
        </div>
      </div>

      <div className="hidden md:block absolute top-0 left-0 w-[30%] h-full z-40" onMouseEnter={handleVolumeInteraction} onMouseMove={handleVolumeInteraction}>
        <div className={`absolute left-6 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10 flex flex-col items-center gap-4 transition-all duration-500 ${showVolume ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); handleVolumeInteraction(); }}
            className="text-zinc-400 hover:text-white transition"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <div className="h-32 w-1 bg-zinc-700 rounded-full relative cursor-pointer group overflow-hidden">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); handleVolumeInteraction(); }}
              className="absolute inset-0 w-32 h-1 origin-bottom-left -rotate-90 translate-y-32 cursor-pointer opacity-0 z-10"
            />
            <div className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all group-hover:bg-cyan-400" style={{ height: `${(isMuted ? 0 : volume) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* ✅ [수정] Rental Modal */}
      <RentalModal
        isOpen={showRentalModal}
        onClose={() => setShowRentalModal(false)}
        onConfirm={handleRentalConfirm}
        isLoading={false}
      />

      {/* ✅ [수정] PlaylistSelectionModal 컴포넌트로 대체 */}
      <PlaylistSelectionModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        playlists={myPlaylists}
        onSelect={processCollect} // 여기서 processCollect 함수를 전달
      />
    </div>
  );
}

export default function RadioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-green-500 mb-2" size={48} />
        <p className="text-zinc-500 font-bold animate-pulse">Initializing Radio...</p>
      </div>
    }>
      <RadioContent />
    </Suspense>
  );
}