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
// ✅ [추가] URL 파라미터 읽기 위한 훅 import
import { useSearchParams, useRouter } from 'next/navigation';

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

  // ✅ [추가] 쿼리 파라미터 훅 사용
  const searchParams = useSearchParams();
  const targetPlaylistId = searchParams.get('playlist_id');
  // 👇 [추가] 라우터 훅 선언
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement>(null);

  const [user, setUser] = useState<any>(null);

  const [step, setStep] = useState<'onboarding' | 'playing'>('onboarding');

  // 👇 [수정] genMode에 'playlist' 타입을 추가 (로직상 필요)
  const [genMode, setGenMode] = useState<'genre' | 'mood' | 'scenario' | 'playlist'>('genre');
  
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

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

  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);

  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [pendingCollection, setPendingCollection] = useState<{ trackId: number, playlistId: string } | null>(null);

  const { mutate: sendTransaction, isPending } = useSendTransaction();

  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [isRenting, setIsRenting] = useState(false);

  const { refetch: refetchBalance } = useReadContract({
    contract: tokenContract,
    method: "balanceOf",
    params: [account?.address || "0x0000000000000000000000000000000000000000"]
  });

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

  // ✅ [추가] playlist_id가 있으면 로딩하는 useEffect
  useEffect(() => {
    if (targetPlaylistId) {
      loadTargetPlaylist(targetPlaylistId);
    }
  }, [targetPlaylistId]);

  // ✅ [추가] 플레이리스트 트랙 로딩 및 재생 함수
  const loadTargetPlaylist = async (playlistId: string) => {
    setLoading(true);
    try {
      // 1. 플레이리스트 이름 가져오기
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

      // 2. 트랙 가져오기 (playlist_items 조인)
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

      // 데이터 가공
      const formattedTracks = items?.map((item: any) => item.tracks).filter(Boolean) || [];

      if (formattedTracks.length > 0) {
        setQueue(formattedTracks);
        setCurrentTrack(formattedTracks[0]);
        
        // 플레이어 모드로 전환
        setGenMode('playlist'); 
        setSelectedGenre(plInfo.name); // 편의상 selectedGenre에 플레이리스트 이름을 저장해 둡니다 (UI 표시는 없지만 로직 유지용)
        setStep('playing');
        
        setTimeout(() => {
          setIsPlaying(true);
          // audioRef는 렌더링 후 연결되므로 약간의 딜레이가 안전할 수 있음
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
      // 플레이리스트 모드가 아닐 때만 자동 추천
      if (genMode !== 'playlist') {
        toast("Fetching a new mix...", { icon: '📡' });
        fetchRecommendations();
      } else {
        // 플레이리스트 끝남 (반복 or 정지)
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

  const openCollectModal = async () => {
    if (!address && !user) return toast.error("Please log in or connect your wallet.");

    const { data: existing } = await supabase
      .from('likes')
      .select('*')
      .match({ wallet_address: address, track_id: currentTrack.id })
      .maybeSingle();

    if (existing) return toast.success("Already in your library.");

    const { data: playlists } = await supabase.from('playlists').select('*').eq('wallet_address', address);
    setMyPlaylists(playlists || []);
    setShowPlaylistModal(true); // 수정: RentalModal 대신 PlaylistModal을 띄우는 것 같음 (기존 코드 흐름상)
  };

  const handleRentalConfirm = async (months: number, price: number) => {
     // ... (기존 로직 유지) ...
     // 원래 코드에 handleRentalConfirm 내부 구현이 없었거나, 
     // 생략되어 있었다면 이 부분은 기존 파일의 내용을 그대로 쓰셔야 합니다.
     // 여기서는 편의상 텍스트로 주신 코드에 있는 handleRentalConfirm을 그대로 둡니다.
    if (!address || !currentTrack) {
      toast.error('Missing wallet or track info.');
      return;
    }
    // ... (중략: 기존 코드와 동일) ... 
    // *주의: 텍스트로 주신 코드에 이 부분이 포함되어 있었으므로 아래에 전체 포함시킵니다.
    
    setIsRenting(true);

    try {
      const { data: pmldResult, error: pmldError } = await supabase.rpc(
        'add_to_collection_using_p_mld_by_wallet',
        {
          p_wallet_address: address,
          p_track_id: currentTrack.id,
          p_duration_months: months,
        }
      );

      if (pmldError) {
        console.error(pmldError);
        toast.error('An error occurred during pMLD payment.');
        return;
      }

      if (pmldResult === 'OK') {
        toast.success('Rented with pMLD!');
        setIsRentalOpen(false);
        return;
      }

      if (pmldResult !== 'INSUFFICIENT_PMLD') {
        toast.error(`Unexpected response: ${pmldResult}`);
        return;
      }

      const amountWei = BigInt(Math.floor(price * 1e18));

      const tx = prepareContractCall({
        contract: tokenContract,
        method: 'transfer',
        params: [
          '0x0000000000000000000000000000000000000000', 
          amountWei,
        ],
      });

      await new Promise<void>((resolve, reject) => {
        sendTransaction(tx, {
          onSuccess: async () => {
            const { data: mldResult, error: mldError } = await supabase.rpc(
              'add_to_collection_using_mld_by_wallet',
              {
                p_wallet_address: address,
                p_track_id: currentTrack.id,
                p_amount_mld: price,
                p_duration_months: months,
              }
            );

            if (mldError) {
              console.error(mldError);
              toast.error('Post-payment logging failed.');
              reject(mldError);
              return;
            }

            if (mldResult === 'OK') {
              toast.success('Rented with MLD!');
              setIsRentalOpen(false);
              resolve();
            } else {
              toast.error(`Unexpected response: ${mldResult}`);
              reject(new Error(String(mldResult)));
            }
          },
          onError: (err) => {
            console.error(err);
            toast.error('MLD payment transaction failed.');
            reject(err);
          },
        });
      });
    } finally {
      setIsRenting(false);
    }
  };

  const processCollect = async (playlistId: string | 'liked') => {
    setShowPlaylistModal(false);

    // 주의: tempRentalTerms가 설정되는 로직이 이 파일의 openCollectModal에는 없습니다.
    // 기존 파일 로직을 그대로 두었으나, 정상 작동하려면 어딘가에서 setTempRentalTerms가 호출되어야 합니다.
    // 일단 기존 코드를 존중하여 그대로 둡니다.
    if (!tempRentalTerms) return toast.error("Error: Missing rental terms.");
    const { months, price } = tempRentalTerms;
    const toastId = toast.loading("Processing payment...");

    try {
      const { data: rpcData, error } = await supabase.rpc('add_to_collection_using_p_mld', {
        p_track_id: currentTrack.id,
        p_duration_months: months
      });

      if (error) throw error;

      if (rpcData === 'PAID_WITH_PMLD') {
        if (playlistId !== 'liked') {
          await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: currentTrack.id });
        }
        if (address) {
          await supabase.from('likes').insert({ wallet_address: address, track_id: currentTrack.id });
        }

        toast.success("Collected (pMLD deducted).", { id: toastId });
        setTempRentalTerms(null);
        return;
      }

      if (rpcData === 'INSUFFICIENT_PMLD') {
        if (!address) {
          toast.error("Insufficient points. Please connect your wallet.", { id: toastId });
          return;
        }

        toast.loading(`Requesting signature for ${price} MLD...`, { id: toastId });

        const { data: contributors } = await supabase
          .from('track_contributors')
          .select('wallet_address')
          .eq('track_id', currentTrack.id)
          .eq('role', 'Main Artist')
          .limit(1);

        if (!contributors || contributors.length === 0) throw new Error("Artist info not found.");

        const transaction = prepareContractCall({
          contract: tokenContract,
          method: "transfer",
          params: [contributors[0].wallet_address, BigInt(price * 1e18)]
        });

        sendTransaction(transaction, {
          onSuccess: async () => {
            toast.loading("On-chain confirmed. Saving...", { id: toastId });

            let expiresAt = null;
            if (months !== 999) {
              const date = new Date();
              date.setMonth(date.getMonth() + months);
              expiresAt = date.toISOString();
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('wallet_address', address)
              .maybeSingle();

            if (profile) {
              await supabase.from('collections').upsert({
                profile_id: profile.id,
                track_id: currentTrack.id,
                paid_with: 'MLD',
                expires_at: expiresAt
              });

              if (playlistId !== 'liked') {
                await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: currentTrack.id });
              }

              await supabase.from('likes').insert({ wallet_address: address, track_id: currentTrack.id });

              toast.success("Payment complete! Added to your library.", { id: toastId });
            } else {
              toast.error("Profile not found.", { id: toastId });
            }

            setTempRentalTerms(null);
          },
          onError: (err) => {
            console.error(err);
            toast.error("Payment failed.", { id: toastId });
          }
        });
      }
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  // ✅ [추가] 플레이리스트 모드로 진입 중이라면, Onboarding 화면(What is your flavor)을 가리고 로딩을 보여줍니다.
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
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center gap-2">
                <span className="w-10 h-px bg-blue-500/50"></span>
                RECOMMENDED SCENARIOS
                <span className="w-10 h-px bg-blue-500/50"></span>
              </label>

              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide justify-start md:justify-center px-4 snap-x">
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
                      flex-shrink-0 px-5 py-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 min-w-[100px] snap-center
                      ${selectedScenario === scenario.id
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
            // ✅ [수정] 플레이리스트 모드일 땐 Market으로 나가고, 아니면 선택 화면으로 이동
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
          {/* 재생 모드 표시 (옵션) */}
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
              {/* 장르 표시 */}
              {currentTrack?.genre && (
                <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500 uppercase tracking-wide">
                  #{currentTrack.genre}
                </span>
              )}
              {/* 플레이리스트 재생 중일 때 표시 */}
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

      <RentalModal
        isOpen={showRentalModal}
        onClose={() => setShowRentalModal(false)}
        onConfirm={handleRentalConfirm}
        isLoading={false}
      />

      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold">Add to Playlist</h3>
              <button onClick={() => setShowPlaylistModal(false)}>
                <X size={20} className="text-zinc-500 hover:text-white" />
              </button>
            </div>

            <div className="p-2 space-y-1">
              <button onClick={() => processCollect('liked')} className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left group">
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-500 rounded flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition">
                  <Heart size={20} fill="currentColor" />
                </div>
                <div>
                  <div className="font-bold text-sm">Liked Songs</div>
                  <div className="text-xs text-zinc-500\">Default Collection</div>
                </div>
              </button>

              <div className="h-px bg-zinc-800 my-2 mx-2" />

              {myPlaylists.map(p => (
                <button key={p.id} onClick={() => processCollect(p.id)} className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left">
                  <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                    <ListMusic size={20} className="text-zinc-400" />
                  </div>
                  <div className="font-bold text-sm">{p.name}</div>
                </button>
              ))}

              {myPlaylists.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-xs">No playlists yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. 새로 'RadioPage'를 만들어서 Suspense로 감싸줍니다.
export default function RadioPage() {
  return (
    // fallback에는 로딩 중에 보여줄 간단한 UI를 넣습니다.
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