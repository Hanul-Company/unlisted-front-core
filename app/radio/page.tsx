'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { ListMusic, Loader2, Heart, X, Zap, Play, Pause, Radio, ChevronRight, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
// 🔴 [수정] Wagmi 제거 -> Thirdweb Imports 추가
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction, useReadContract } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_SCENARIOS } from '../constants';
import HeaderProfile from '../components/HeaderProfile';
import RentalModal from '../components/RentalModal';

// 🔴 [수정] 컨트랙트 객체 정의 (컴포넌트 외부)
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

export default function RadioPage() {
  // 🔴 [수정] Wagmi useAccount -> Thirdweb useActiveAccount
  const account = useActiveAccount();
  const address = account?.address;

  const audioRef = useRef<HTMLAudioElement>(null);

  // [수정] 누락된 user 상태 추가
  const [user, setUser] = useState<any>(null);

  // States
  const [step, setStep] = useState<'onboarding' | 'playing'>('onboarding');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals & Temp
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  
  // 🔴 [수정 2] 대여 정보 임시 저장용 State 추가
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [pendingCollection, setPendingCollection] = useState<{ trackId: number, playlistId: string } | null>(null);
  
  // 🔴 [수정] 트랜잭션 전송 훅
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // 모달 열림 여부
  const [isRentalOpen, setIsRentalOpen] = useState(false);
  const [isRenting, setIsRenting] = useState(false);


  // 컴포넌트 안에서 사용
  const { refetch: refetchBalance } = useReadContract({
    contract: tokenContract,
    method: "balanceOf",
    params: [account?.address || "0x0000000000000000000000000000000000000000"]
  });

  // 🔴 [수정 4] 유저 로그인 상태 확인 (useEffect) 추가
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

// 1. 추천 로직 (fetchRecommendations)
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      let data: any[] | null = [];
      let error = null;

      // ✅ [수정] 시나리오가 선택되었다면 태그 기반 검색 우선
      if (selectedScenario) {
        const scenario = MUSIC_SCENARIOS.find(s => s.id === selectedScenario);
        if (scenario) {
          // context_tags 배열 중 하나라도 겹치는(overlaps) 곡 검색
          const { data: tagData, error: tagError } = await supabase
            .from('tracks')
            .select('*, artist:profiles(*)')
            .overlaps('context_tags', scenario.tags)
            .limit(10); // 넉넉히 가져옴
            
          data = tagData;
          error = tagError;
          
          // 데이터가 적으면 랜덤 섞기 (JS 레벨에서)
          if (data) {
             data = data.sort(() => Math.random() - 0.5);
          }
        }
      } else {
        // 기존 RPC 방식 (장르/무드)
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
            if (!hasMatching) toast("조건에 맞는 곡이 없어 랜덤 믹스를 재생합니다 🔀", { icon: '📡' });
        }
      } else {
        toast.error("재생할 곡이 없습니다. (조건을 변경해보세요)");
      }
    } catch (e) { 
        console.error(e); 
        toast.error("트랙 로딩 중 오류가 발생했습니다.");
    } finally { 
        setLoading(false); 
    }
  };

   // ✅ [추가] 시나리오 선택 시 자동 재생 트리거 (UX 향상)
  // 사용자가 시나리오 카드를 클릭하자마자 재생하고 싶다면 아래 useEffect 주석 해제
  
  useEffect(() => {
    if (selectedScenario) {
        fetchRecommendations();
    }
  }, [selectedScenario]);

  // 2. 오디오 컨트롤
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
    if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleVolumeInteraction = () => {
    setShowVolume(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
        setShowVolume(false);
    }, 3000); 
  };

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  
  const formatTime = (time: number) => {
    if(isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // 3. 액션 핸들러
  const handleSkip = () => {
    const nextQueue = queue.slice(1);
    if (nextQueue.length === 0) {
      toast("새로운 믹스를 가져옵니다...", { icon: '📡' });
      fetchRecommendations();
    } else {
      setQueue(nextQueue);
      setCurrentTrack(nextQueue[0]);
      setIsPlaying(true);
    }
  };

// 🔴 [수정] Invest Handler (Thirdweb 방식)
  const handleInvest = () => {
    if (!address) return toast.error("지갑 연결 필요");
    const targetTokenId = currentTrack.token_id || currentTrack.id;
    
    // 트랜잭션 준비
    const transaction = prepareContractCall({
        contract: stockContract,
        method: "buyShares",
        params: [BigInt(targetTokenId), BigInt(10 * 1e18)]
    });

    // 전송 및 결과 처리
    const toastId = toast.loading("투자 진행 중...");
    sendTransaction(transaction, {
        onSuccess: () => toast.success("투자 성공!", { id: toastId }),
        onError: (err) => {
            console.error(err);
            toast.error("투자 실패", { id: toastId });
        }
    });
  };

// 🔴 [수정 5] openCollectModal: user 체크 추가 및 로직 정리
  const openCollectModal = async () => {
    if (!address && !user) return toast.error("로그인 또는 지갑 연결이 필요합니다.");
    
    // 이미 있는지 체크
    const { data: existing } = await supabase.from('likes').select('*').match({ wallet_address: address, track_id: currentTrack.id }).maybeSingle();
    if (existing) return toast.success("이미 보관함에 있습니다.");
    
    // 내 플레이리스트 로딩
    const { data: playlists } = await supabase.from('playlists').select('*').eq('wallet_address', address);
    setMyPlaylists(playlists || []);
    setShowRentalModal(true);
  };

  const handleRentalConfirm = async (months: number, price: number) => {
    if (!address || !currentTrack) {
      toast.error('지갑 또는 트랙 정보가 없습니다.');
      return;
    }

    setIsRenting(true);

    try {
      // 1️⃣ pMLD로 먼저 결제 시도
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
        toast.error('pMLD 결제 중 오류가 발생했습니다.');
        return;
      }

      if (pmldResult === 'OK') {
        toast.success('pMLD로 대여 완료!');
        // 필요하면 여기서 HeaderProfile의 pMLD 잔고를 새로 읽도록 트리거
        setIsRentalOpen(false);
        return;
      }

      if (pmldResult !== 'INSUFFICIENT_PMLD') {
        toast.error(`예상치 못한 응답: ${pmldResult}`);
        return;
      }

      // 2️⃣ pMLD 부족 → MLD로 온체인 결제 진행
      // price: MLD 단위(예: 5 MLD), 이를 wei로 변환
      const amountWei = BigInt(Math.floor(price * 1e18));

      const tx = prepareContractCall({
        contract: tokenContract,
        method: 'transfer', // 실제 구현에 따라 transfer / purchase 함수 등으로 변경
        params: [
          '0x0000000000000000000000000000000000000000', // ❗여기에 렌탈 수익 받을 트레저리 주소 넣기
          amountWei,
        ],
      });

    await new Promise<void>((resolve, reject) => {
      sendTransaction(tx, {
        onSuccess: async () => {
          // 온체인 결제 성공 후 DB에 MLD 결제 로그 + 컬렉션/만료일 반영
          const { data: mldResult, error: mldError } = await supabase.rpc(
            'add_to_collection_using_mld_by_wallet',
            {
              p_wallet_address: address,
              p_track_id: currentTrack.id,
              p_amount_mld: price,        // 사람이 보는 단위 (예: 5)
              p_duration_months: months,  // 기본 1이면 생략 가능
            }
          );

          if (mldError) {
            console.error(mldError);
            toast.error('MLD 결제 후 컬렉션 등록/로그 기록 실패');
            reject(mldError);
            return;
          }

          if (mldResult === 'OK') {
            toast.success('MLD로 대여 완료!');
            // 필요하면 여기서 MLD 잔고 refetch
            setIsRentalOpen(false);
            resolve();
          } else {
            toast.error(`예상치 못한 응답: ${mldResult}`);
            reject(new Error(String(mldResult)));
          }
        },
        onError: (err) => {
          console.error(err);
          toast.error('MLD 결제 트랜잭션이 실패했습니다.');
          reject(err);
        },
      });
    });
  } finally {
    setIsRenting(false);
  }
};

 // 🔴 [수정] processCollect (Thirdweb 결제 로직 적용)
  const processCollect = async (playlistId: string | 'liked') => {
    setShowPlaylistModal(false);
    
    if (!tempRentalTerms) return toast.error("오류: 대여 조건이 없습니다.");
    const { months, price } = tempRentalTerms;
    const toastId = toast.loading("결제 처리 중...");

    try {
        // 1. pMLD 결제 시도
        const { data: rpcData, error } = await supabase.rpc('add_to_collection_using_p_mld', {
            p_track_id: currentTrack.id,
            p_duration_months: months
        });

        if (error) throw error;

        // pMLD 성공 시
        if (rpcData === 'PAID_WITH_PMLD') {
            if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: currentTrack.id });
            if (address) await supabase.from('likes').insert({ wallet_address: address, track_id: currentTrack.id });
            
            toast.success("수집 완료 (pMLD 차감)", { id: toastId });
            setTempRentalTerms(null);
            return;
        }

        // 2. pMLD 부족 -> MLD 결제 (Thirdweb)
        if (rpcData === 'INSUFFICIENT_PMLD') {
            if (!address) { toast.error("포인트 부족! 지갑을 연결하세요.", { id: toastId }); return; }
            toast.loading(`${price} MLD 결제 서명 요청...`, { id: toastId });
            
            const { data: contributors } = await supabase.from('track_contributors').select('wallet_address').eq('track_id', currentTrack.id).eq('role', 'Main Artist').limit(1);
            if(!contributors || contributors.length===0) throw new Error("작가 정보 없음");

            // 트랜잭션 준비
            const transaction = prepareContractCall({
                contract: tokenContract,
                method: "transfer",
                params: [contributors[0].wallet_address, BigInt(price * 1e18)]
            });

            // 전송 및 성공 후처리 (useEffect 대신 여기서 바로 처리)
            sendTransaction(transaction, {
                onSuccess: async () => {
                    toast.loading("블록체인 승인 완료! 저장 중...", { id: toastId });
                    
                    let expiresAt = null;
                    if (months !== 999) {
                        const date = new Date(); date.setMonth(date.getMonth() + months); expiresAt = date.toISOString();
                    }
                    
                    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).maybeSingle();
                    if(profile) {
                        await supabase.from('collections').upsert({ profile_id: profile.id, track_id: currentTrack.id, paid_with: 'MLD', expires_at: expiresAt });
                        if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: currentTrack.id });
                        await supabase.from('likes').insert({ wallet_address: address, track_id: currentTrack.id });
                        toast.success("MLD 결제 완료! 소장되었습니다.", { id: toastId });
                    } else {
                        toast.error("프로필을 찾을 수 없습니다.", { id: toastId });
                    }
                    setTempRentalTerms(null);
                },
                onError: (err) => {
                    console.error(err);
                    toast.error("결제 실패", { id: toastId });
                }
            });
        }
    } catch (e: any) { 
        toast.error(e.message, { id: toastId }); 
    }
  };

  if (step === 'onboarding') {
      return (
        // [수정] pt-24 추가 (위쪽 여백 확보하여 겹침 방지)
        <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col items-center justify-center relative overflow-hidden selection:bg-cyan-500/30 pt-24">
            
            {/* [수정] z-50 추가 (항상 위에 표시), 위치 미세 조정 */}
            <Link href="/market" className="absolute top-6 left-6 text-zinc-500 hover:text-white transition flex items-center gap-2 z-50 text-sm font-bold">
                <ChevronLeft size={18}/> Exit Radio
            </Link>

            <div className="max-w-2xl w-full text-center space-y-8">
                {/* [수정] 폰트 사이즈 반응형 적용 (모바일 3xl, PC 5xl) */}
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">
                    What is your flavor?
                </h1>
                
                <div className="space-y-8">
                    {/* ✅ [추가] 시나리오 선택 UI */}
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
                                        if(newValue) {
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

                    {/* 기존 장르/무드 선택 (시나리오 선택 시 비활성화 스타일 적용) */}
                    <div className={`space-y-6 transition-opacity duration-300 ${selectedScenario ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Genre</label>
                            <div className="flex flex-wrap justify-center gap-2">
                                {MUSIC_GENRES.map(g => (
                                    <button 
                                        key={g} 
                                        onClick={() => setSelectedGenre(g===selectedGenre?null:g)} 
                                        className={`px-4 py-2 rounded-full text-xs font-bold border transition ${selectedGenre===g ? 'bg-white text-black border-white shadow-lg shadow-white/20':'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'}`}
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
                                        onClick={() => setSelectedMood(m===selectedMood?null:m)} 
                                        className={`px-4 py-2 rounded-full text-xs font-bold border transition ${selectedMood===m ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/30':'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'}`}
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
                    {loading ? <Loader2 className="animate-spin"/> : "Start Listening ▶"}
                </button>
            </div>
        </div>
      );
  }
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleSkip} crossOrigin="anonymous"/>
      
      {/* Top Bar */}
      <header className="flex justify-between items-center p-6 z-50 pointer-events-none relative">
        <button onClick={() => setStep('onboarding')} className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition pointer-events-auto">
            <ChevronLeft size={20}/>
        </button>
        <div className="flex items-center gap-4 pointer-events-auto">
            <div className="bg-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-red-500 animate-pulse border border-red-500/30">ON AIR</div>
            <HeaderProfile />
        </div>
      </header>

      {/* Main Player Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 z-10 relative">
        
        {/* Album Art */}
        <div className="relative group">
            <div className={`w-64 h-64 md:w-80 md:h-80 aspect-square rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'} transition-all duration-700`}>
                {currentTrack?.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Radio size={48} className="text-zinc-700"/></div>}
            </div>
            
            {/* Progress Bar */}
            <div className="absolute -bottom-10 left-0 right-0 z-20">
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm">
                    <div className="h-full bg-white rounded-full transition-all duration-300 ease-linear shadow-[0_0_10px_white]" style={{ width: `${(currentTime/duration)*100}%` }}/>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="text-center space-y-4 mt-8">
            <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight px-4 truncate">{currentTrack?.title}</h2>
                <p className="text-zinc-400 text-sm mt-1">{currentTrack?.artist_name}</p>
                <div className="flex justify-center gap-2 mt-2">
                    {currentTrack?.genre && <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-500 uppercase tracking-wide">#{currentTrack.genre}</span>}
                </div>
            </div>

            <div className="flex items-center justify-center gap-6 pt-2">
                <button onClick={handleSkip} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition backdrop-blur-md"><X size={20}/></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">{isPlaying ? <Pause size={28} fill="black"/> : <Play size={28} fill="black" className="ml-1"/>}</button>
                <button onClick={openCollectModal} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition backdrop-blur-md"><Heart size={20}/></button>
            </div>
            
            <button onClick={handleInvest} className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 font-bold tracking-widest text-[10px] mt-6 hover:underline transition mx-auto uppercase">
                <Zap size={12} fill="currentColor"/> Invest
            </button>
        </div>
      </div>

      {/* Hover Skip */}
      <div onClick={handleSkip} className="absolute top-0 right-0 w-[15%] h-full z-30 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-pointer flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent group">
        <div className="text-white/50 group-hover:text-white flex flex-col items-center gap-2 transform translate-x-10 group-hover:translate-x-0 transition-transform duration-300"><ChevronRight size={32} /><span className="text-[10px] font-bold tracking-widest uppercase">Skip</span></div>
      </div>

      {/* Stealth Volume */}
      <div className="hidden md:block absolute top-0 left-0 w-[30%] h-full z-40" onMouseEnter={handleVolumeInteraction} onMouseMove={handleVolumeInteraction}>
        <div className={`absolute left-6 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10 flex flex-col items-center gap-4 transition-all duration-500 ${showVolume ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
            <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); handleVolumeInteraction(); }} className="text-zinc-400 hover:text-white transition">
                {isMuted || volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>
            <div className="h-32 w-1 bg-zinc-700 rounded-full relative cursor-pointer group overflow-hidden">
                <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); handleVolumeInteraction(); }} className="absolute inset-0 w-32 h-1 origin-bottom-left -rotate-90 translate-y-32 cursor-pointer opacity-0 z-10" />
                <div className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all group-hover:bg-cyan-400" style={{ height: `${(isMuted ? 0 : volume) * 100}%` }}/>
            </div>
        </div>
      </div>

      {/* Modals */}
      <RentalModal isOpen={showRentalModal} onClose={() => setShowRentalModal(false)} onConfirm={handleRentalConfirm} isLoading={false} />
      
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold">Add to Playlist</h3><button onClick={() => setShowPlaylistModal(false)}><X size={20} className="text-zinc-500 hover:text-white"/></button></div>
                <div className="p-2 space-y-1">
                    <button onClick={() => processCollect('liked')} className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left group"><div className="w-10 h-10 bg-indigo-500/20 text-indigo-500 rounded flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition"><Heart size={20} fill="currentColor"/></div><div><div className="font-bold text-sm">Liked Songs</div><div className="text-xs text-zinc-500">Default Collection</div></div></button>
                    <div className="h-px bg-zinc-800 my-2 mx-2"/>
                    {myPlaylists.map(p => (
                        <button key={p.id} onClick={() => processCollect(p.id)} className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 rounded-lg transition text-left"><div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center"><ListMusic size={20} className="text-zinc-400"/></div><div className="font-bold text-sm">{p.name}</div></button>
                    ))}
                    {myPlaylists.length === 0 && <div className="p-4 text-center text-zinc-500 text-xs">생성된 플레이리스트가 없습니다.</div>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}