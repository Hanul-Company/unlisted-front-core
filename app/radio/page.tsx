'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Heart, X, Zap, Play, Pause, Radio, ChevronRight, Volume2, VolumeX, ChevronLeft, Sparkles, BrainCircuit, Quote } from 'lucide-react';
import { useActiveAccount } from "thirdweb/react";
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { MUSIC_SCENARIOS } from '../constants'; // 장르/무드 상수 삭제, 시나리오만 유지
import HeaderProfile from '../components/HeaderProfile';
import RentalModal from '../components/RentalModal';
import TradeModal from '../components/TradeModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import { useRouter } from 'next/navigation';
import { useMediaSession } from '@/hooks/useMediaSession';

function RadioContent() {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement>(null);
  
  // --- Global State ---
  const [step, setStep] = useState<'selection' | 'playing'>('selection');
  const [activeMode, setActiveMode] = useState<'ai' | 'scenario'>('ai'); // 현재 재생 모드
  
  // --- Data State ---
  const [userProfile, setUserProfile] = useState<any>(null); // 프로필 정보 (ID, Taste)
  const [tasteSummary, setTasteSummary] = useState<any>(null); // 취향 분석 결과
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  // --- Player State ---
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  // --- Modals ---
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);

  // 1. Fetch User Profile & Taste on Mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, music_taste')
        .eq('wallet_address', address)
        .single();

      if (data) {
        setUserProfile(data);
        if (data.music_taste && data.music_taste.summary) {
            setTasteSummary(data.music_taste);
        }
      }
    };
    fetchProfile();
  }, [address]);


  // 2. Play Logic (AI vs Scenario)
  const fetchTracks = async (mode: 'ai' | 'scenario', scenarioId?: string) => {
    setLoading(true);
    try {
      let tracks: any[] = [];
      
      if (mode === 'ai') {
         // [Option A] AI Personalized Radio
         if (!userProfile?.id) {
             toast.error("Please log in to play personalized radio.");
             return;
         }

         // RPC 호출: get_personalized_radio
         const { data, error } = await supabase.rpc('get_personalized_radio', {
             p_user_id: userProfile.id,
             p_limit: 10
         });
         
         if (error) throw error;
         tracks = data || [];
         
         if (tracks.length === 0) {
             toast("Not enough data for AI yet. Playing random mix!", { icon: '🎲' });
             const { data: random } = await supabase.rpc('get_random_tracks_v3', { limit_count: 5 });
             tracks = random || [];
         }

      } else if (mode === 'scenario' && scenarioId) {
         // [Option B] Scenario Radio
         const scenario = MUSIC_SCENARIOS.find(s => s.id === scenarioId);
         if (scenario) {
            const { data, error } = await supabase
                .from('tracks')
                .select('*, artist:profiles(*)')
                .overlaps('context_tags', scenario.tags)
                .limit(10);
            
            if (error) throw error;
            tracks = data || [];
            // Shuffle
            tracks = tracks.sort(() => Math.random() - 0.5);
         }
      }

      if (tracks.length > 0) {
          setQueue(tracks);
          setCurrentTrack(tracks[0]);
          setActiveMode(mode);
          if (scenarioId) setSelectedScenario(scenarioId);
          setStep('playing');
          setIsPlaying(true);
      } else {
          toast.error("No tracks found for this selection.");
      }

    } catch (e: any) {
        // ✅ 에러 내용을 자세히 뜯어보기
        console.error("🔥 Radio Fetch Error Details:", {
            message: e.message,
            details: e.details,
            hint: e.hint,
            code: e.code
        });
        toast.error(`Radio Error: ${e.message || "Unknown error"}`);
    } finally {
        setLoading(false);
    }
  };

  // --- Audio Handlers ---
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
      if (audio.src !== currentTrack.audio_url) {
        audio.src = currentTrack.audio_url;
        audio.load();
        if (isPlaying) audio.play().catch(() => {});
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    isPlaying ? audio.play().catch(() => {}) : audio.pause();
  }, [isPlaying]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  
  const handleSkip = () => {
      const nextQueue = queue.slice(1);
      if (nextQueue.length === 0) {
          // 큐가 비면 현재 모드에 맞춰 추가 로드
          fetchTracks(activeMode, activeMode === 'scenario' ? selectedScenario! : undefined);
      } else {
          setQueue(nextQueue);
          setCurrentTrack(nextQueue[0]);
          setIsPlaying(true);
      }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // --- Investment & Collection Handlers (Simplified for brevity) ---
  const handleInvest = () => { if (!address) return toast.error("Connect Wallet"); setShowTradeModal(true); };
  const openCollectModal = async () => { if (!address) return toast.error("Connect Wallet"); setShowRentalModal(true); };
  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      // Fetch playlists...
      const { data } = await supabase.from('playlists').select('*').eq('profile_id', userProfile?.id).order('created_at');
      setMyPlaylists(data || []);
      setShowRentalModal(false);
      setShowPlaylistModal(true);
  };
  const processCollect = async (playlistId: string | 'liked') => {
    if (!address) return toast.error("Wallet not connected.");

    setShowPlaylistModal(false);

    if (!tempRentalTerms) return toast.error("Error: Missing collection terms.");
    const { months, price } = tempRentalTerms;

    const toastId = toast.loading("Processing payment...");

    try {
      const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', {
        p_wallet_address: address,
        p_track_id: currentTrack.id,
        p_duration_months: months
      });

      if (rpcResult === 'OK') {
        if (playlistId !== 'liked') {
          await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: currentTrack.id });
        }
        await supabase.from('likes').upsert({ wallet_address: address, track_id: currentTrack.id }, { onConflict: 'wallet_address, track_id' });
        toast.success("Collected using pMLD!", { id: toastId });
        setTempRentalTerms(null);
        return;
      }

      if (rpcResult === 'INSUFFICIENT_PMLD') {
        toast.loading(`Insufficient pMLD. Requesting ${price} MLD...`, { id: toastId });

        const { data: mldRpcResult } = await supabase.rpc('add_to_collection_using_mld_by_wallet', {
            p_wallet_address: address,
            p_track_id: currentTrack.id,
            p_duration_months: months,
            p_amount_mld: price
        });

        if (mldRpcResult === 'OK') {
            if (playlistId !== 'liked') {
                 await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: currentTrack.id });
            }
            await supabase.from('likes').upsert({ wallet_address: address, track_id: currentTrack.id }, { onConflict: 'wallet_address, track_id' });
            toast.success("Payment complete via MLD!", { id: toastId });
        } else {
            toast.error("MLD Payment failed: " + mldRpcResult, { id: toastId });
        }
        setTempRentalTerms(null);
      } else {
        toast.error(`Error: ${rpcResult}`, { id: toastId });
      }

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "An error occurred", { id: toastId });
    }
  };


  // ✅ [수정] 라디오 전용 Media Session 설정
  // 라디오는 '이전 곡'이 없으므로 prev는 생략합니다.
  useMediaSession({
    title: currentTrack?.title || "Loading...",
    artist: currentTrack?.artist?.username || 'unlisted Artist',
    coverUrl: currentTrack?.cover_image_url || "/images/default_cover.jpg",
    isPlaying: isPlaying,
    
    audioRef: audioRef,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    next: handleSkip, // 라디오에서는 Skip이 Next 역할
    // prev: handlePrev, // ❌ 라디오는 뒤로가기 없음 (생략하면 잠금화면 버튼 비활성화)
    seekTo: (time) => {
        if(audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }
  });

  // ==================================================================================
  // RENDER: SELECTION SCREEN
  // ==================================================================================
  if (step === 'selection') {
    return (
      <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col relative overflow-hidden pt-24">
        {/* Header */}
        <Link href="/market" className="absolute top-6 left-6 text-zinc-500 hover:text-white transition flex items-center gap-2 z-50 text-sm font-bold">
          <ChevronLeft size={18} /> Exit
        </Link>
        <div className="absolute top-6 right-6 z-50"><HeaderProfile/></div>

        <div className="max-w-4xl w-full mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">
              Stream is always free
            </h1>
            <p className="text-zinc-500">Select a mode to begin listening.</p>
          </div>

          {/* 1. AI Personalized Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 overflow-hidden">
                
                {/* Visual Graphic */}
                <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 bg-black rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-2xl relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent rounded-full animate-spin-slow"/>
                    <img 
                        src="/icon-192.png" 
                        alt="Logo" 
                        className="w-16 h-16 md:w-12 md:h-12 object-contain relative z-10" 
                    />
                    <Sparkles size={24} className="text-indigo-400 absolute top-2 right-4 animate-pulse"/>
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left space-y-4">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200">
                            Mix only for you
                        </h2>
                        {tasteSummary ? (
                            <>
                                <p className="text-zinc-400 text-sm italic font-serif leading-relaxed">
                                    <Quote size={12} className="inline-block mr-1 rotate-180"/>
                                    {tasteSummary.summary}
                                    <Quote size={12} className="inline-block ml-1"/>
                                </p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                                    {tasteSummary.expanded_genres?.slice(0, 3).map((g: string) => (
                                        <span key={g} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-bold uppercase">{g}</span>
                                    ))}
                                    {tasteSummary.expanded_moods?.slice(0, 2).map((m: string) => (
                                        <span key={m} className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 font-bold uppercase">{m}</span>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-zinc-500 text-sm">
                                No taste data yet. We'll play a mix of trending tracks to get to know you.
                            </p>
                        )}
                    </div>

                    <div className="pt-2">
                        {tasteSummary ? (
                            <button 
                                onClick={() => fetchTracks('ai')}
                                disabled={loading}
                                className="bg-white text-black font-black px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 mx-auto md:mx-0 shadow-xl shadow-white/10"
                            >
                                {loading ? <Loader2 className="animate-spin"/> : <><Play fill="black" size={18}/> Play on</>}
                            </button>
                        ) : (
                             <div className="flex gap-3 justify-center md:justify-start">
                                <button onClick={() => fetchTracks('ai')} disabled={loading} className="bg-white text-black font-bold px-6 py-3 rounded-full hover:bg-zinc-200 transition text-sm">
                                    {loading ? <Loader2 className="animate-spin"/> : "Play Random Mix"}
                                </button>
                                <Link href="/settings" className="px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-white transition text-sm font-bold">
                                    Setup Profile
                                </Link>
                             </div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          {/* 2. Scenarios Grid (수정됨) */}
          <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center md:text-left">
                  Or choose a scenario
              </label>
              
              {/* ✅ [수정] Grid Layout 적용: 모바일 2열, 태블릿 3열, PC 6열 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {MUSIC_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => fetchTracks('scenario', scenario.id)}
                        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-3 transition group aspect-square justify-center"
                      >
                          <span className="text-4xl group-hover:scale-110 transition transform duration-300">{scenario.emoji}</span>
                          <span className="text-xs font-bold text-zinc-400 group-hover:text-white text-center">{scenario.title}</span>
                      </button>
                  ))}
              </div>
          </div>

        </div>
      </div>
    );
  }

  // ==================================================================================
  // RENDER: PLAYER SCREEN (Existing UI)
  // ==================================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleSkip} crossOrigin="anonymous"/>

      <header className="flex justify-between items-center p-6 z-50 pointer-events-none relative">
        <button
          onClick={() => { setStep('selection'); setIsPlaying(false); audioRef.current?.pause(); }}
          className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition pointer-events-auto"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="bg-red-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-red-500 animate-pulse border border-red-500/30 flex items-center gap-1">
             <Radio size={10}/> {activeMode === 'ai' ? 'AI MIX' : 'SCENARIO'}
          </div>
          <HeaderProfile />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 z-10 relative">
        {/* Cover Art */}
        <div className="relative group">
          <div className={`w-64 h-64 md:w-80 md:h-80 aspect-square rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 relative z-10 ${isPlaying ? 'scale-100' : 'scale-95 opacity-80'} transition-all duration-700`}>
            {currentTrack?.cover_image_url ? (
              <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Radio size={48} className="text-zinc-700" /></div>
            )}
            
          {/* Genre Badge on Cover */}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[10px] font-bold text-white uppercase">
                    {/* ✅ 배열이면 join으로 합치고, 아니면 그대로 출력 */}
                    {Array.isArray(currentTrack?.genre) 
                        ? currentTrack.genre.join(', ') 
                        : (currentTrack?.genre || 'Unknown')}
                </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="absolute -bottom-10 left-0 right-0 z-20">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 px-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm">
              <div className="h-full bg-white rounded-full shadow-[0_0_10px_white]" style={{ width: `${(currentTime / duration) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Info & Controls */}
        <div className="text-center space-y-4 mt-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight px-4 truncate">{currentTrack?.title}</h2>
            <Link 
                href={`/u?wallet=${currentTrack.artist?.wallet_address}`} 
                className="text-sm mt-1 text-zinc-400 hover:text-white hover:underline transition"
                >
                {currentTrack.artist?.username|| 'unlisted Artist'}
            </Link>
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
            <Zap size={12} fill="currentColor" /> Invest in this track
          </button>
        </div>
      </div>

      {/* ✅ [수정됨] Right Side Skip Overlay (모바일 25%, PC 15% 영역 클릭 시 스킵) */}
      <div 
        onClick={handleSkip} 
        className="absolute top-0 right-0 h-full z-30 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity duration-300 cursor-pointer flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent group w-[25%] md:w-[15%]"
      >
        <div className="text-white/50 group-hover:text-white flex flex-col items-center gap-2 transform translate-x-10 group-hover:translate-x-0 transition-transform duration-300">
          <ChevronRight size={32} />
          {/* 모바일에서는 텍스트 없이 화살표만 나오게 하거나, 그대로 둬도 무방합니다 */}
          <span className="text-[10px] font-bold tracking-widest uppercase">Skip</span>
        </div>
      </div>

      {/* Hover Volume Control */}
      <div className="hidden md:block absolute top-0 left-0 w-[20%] h-full z-40" onMouseEnter={() => setShowVolume(true)} onMouseMove={() => setShowVolume(true)} onMouseLeave={() => setShowVolume(false)}>
        <div className={`absolute left-6 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/10 flex flex-col items-center gap-4 transition-all duration-500 ${showVolume ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
          <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="text-zinc-400 hover:text-white transition">
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="h-32 w-1 bg-zinc-700 rounded-full relative cursor-pointer group overflow-hidden">
            <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }} className="absolute inset-0 w-32 h-1 origin-bottom-left -rotate-90 translate-y-32 cursor-pointer opacity-0 z-10" />
            <div className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all group-hover:bg-cyan-400" style={{ height: `${(isMuted ? 0 : volume) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <RentalModal isOpen={showRentalModal} onClose={() => setShowRentalModal(false)} onConfirm={handleRentalConfirm} isLoading={false} />
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
      {currentTrack && <TradeModal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} track={{ id: currentTrack.id, title: currentTrack.title, token_id: currentTrack.token_id || currentTrack.id, artist_name: currentTrack.artist?.username || 'unlisted Artist' }} />}
    </div>
  );
}

export default function RadioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-green-500"/></div>}>
      <RadioContent />
    </Suspense>
  );
}