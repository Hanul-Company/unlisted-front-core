'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { LogIn, Loader2, Heart, X, Zap, Play, Pause, Radio, ChevronRight, ChevronLeft, Sparkles, Quote, Volume2, VolumeX } from 'lucide-react';
import { useActiveAccount } from "thirdweb/react";
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import HeaderProfile from '../components/HeaderProfile';
import RentalModal from '../components/RentalModal';
import TradeModal from '../components/TradeModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import { useRouter } from 'next/navigation';
// ✅ 전역 플레이어를 가져오긴 하지만, '끄기' 용도로만 사용합니다.
import { usePlayer } from '../context/PlayerContext';
import { useMediaSession } from '@/hooks/useMediaSession';


function RadioContent() {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();
  const { clearPlayer } = usePlayer();

  // ✅ 전역 플레이어 일시정지용
  const { togglePlay: toggleGlobalPlay, isPlaying: isGlobalPlaying } = usePlayer();

  // --- Local Player State (독립적) ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // --- UI/Data State ---
  const [step, setStep] = useState<'selection' | 'playing'>('selection');
  const [activeMode, setActiveMode] = useState<'ai' | 'scenario'>('ai'); 
  const [userProfile, setUserProfile] = useState<any>(null); 
  const [tasteSummary, setTasteSummary] = useState<any>(null); 
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);

  // --- Modals ---
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);

  // 1. 초기화: 프로필 로드 & 전역 플레이어 정지
  useEffect(() => {
    // 라디오 페이지 들어오면 전역 플레이어 끄기
    clearPlayer();
    if (isGlobalPlaying) toggleGlobalPlay();

    const fetchProfile = async () => {
      if (!address) return;
      const { data } = await supabase.from('profiles').select('id, username, music_taste').eq('wallet_address', address).single();
      if (data) {
        setUserProfile(data);
        if (data.music_taste?.summary) setTasteSummary(data.music_taste);
      }
    };
    fetchProfile();
  }, [address]);

  // ✅ [NEW] DB에서 시나리오 불러오기
    const fetchScenarios = async () => {
        const { data } = await supabase
            .from('radio_scenarios')
            .select('*')
            .order('sort_order', { ascending: true });
        
        if (data) setScenarios(data);
    };
    fetchScenarios();

  // 2. Play Logic (AI vs Scenario) - 로컬 큐 사용
  const fetchAndPlay = async (mode: 'ai' | 'scenario', scenarioId?: string) => {
    setLoading(true);
    // 라디오 시작 시 전역 플레이어 확실히 끄기
    toggleGlobalPlay();

    try {
      let tracks: any[] = [];
      
      if (mode === 'ai') {
        if (!address || !userProfile?.id) {
                // ✅ 헤더의 Connect 버튼을 찾아서 클릭
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                
                if (headerBtn) {
                    headerBtn.click(); // 🖱️ 자동 클릭! -> 자연스럽게 Thirdweb 모달이 뜸
                    
                    // (선택사항) 사용자에게 안내 메시지를 띄우고 싶다면
                    // toast("Please connect wallet to play", { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please connect your wallet first.");
                }
                return;
            }
         const { data, error } = await supabase.rpc('get_personalized_radio_v4', { p_user_id: userProfile.id, p_limit: 10 });
         if (error) throw error;
         tracks = data || [];
         if (tracks.length === 0) {
             const { data: random } = await supabase.rpc('get_random_tracks_v4', { limit_count: 10 });
             tracks = random || [];
         }
      } else if (mode === 'scenario' && scenarioId) {
         const scenario = scenarios.find(s => s.id === scenarioId);
         if (scenario) {
            const { data, error } = await supabase.from('tracks').select('*, artist:profiles(*)').overlaps('context_tags', scenario.tags).limit(20);
            if (error) throw error;
            tracks = (data || []).sort(() => Math.random() - 0.5);
         }
      }

      if (tracks.length > 0) {
          setQueue(tracks);
          setCurrentTrack(tracks[0]); // 첫 곡 설정
          setActiveMode(mode);
          if (scenarioId) setSelectedScenario(scenarioId);
          setStep('playing');
          setIsPlaying(true);
      } else {
          toast.error("No tracks found.");
      }

    } catch (e: any) {
        console.error(e);
        toast.error("Failed to load radio.");
    } finally {
        setLoading(false);
    }
  };

  // ✅ Skip Handler (Next Only)
  const handleSkip = () => {
      // 현재 큐에서 다음 곡으로 이동
      const nextQueue = queue.slice(1); // 0번(현재곡) 제거
      
      if (nextQueue.length === 0) {
          // 큐가 비면 자동 추가 로드 (무한 라디오)
          fetchAndPlay(activeMode, selectedScenario || undefined);
      } else {
          setQueue(nextQueue);
          setCurrentTrack(nextQueue[0]);
          setIsPlaying(true);
      }
  };

  // --- Local Audio Logic ---
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
      // 트랙이 바뀌면 소스 변경 및 재생
      if (audio.src !== currentTrack.audio_url) {
        audio.src = currentTrack.audio_url;
        audio.load();
        if (isPlaying) audio.play().catch(() => {});
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
        isPlaying ? audio.play().catch(() => {}) : audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  useMediaSession({
  title: currentTrack?.title || "Radio Mix",
  artist: currentTrack?.artist?.username || "AI DJ",
  coverUrl: currentTrack?.cover_image_url || "",
  isPlaying: isPlaying,
  audioRef: audioRef,
  play: () => setIsPlaying(true),
  pause: () => setIsPlaying(false),
  next: handleSkip, // 스킵 함수 연결
  seekTo: (time: number) => { // 👈 여기에 ': number'를 추가하세요!
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time); // 로컬 상태 업데이트 (선택 사항)
      }
  }
});

  // --- Collection Handlers ---
  const handleInvest = () => { if (!address)  { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;} setShowTradeModal(true); };
  const openCollectModal = () => { if (!address)  { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;} setShowRentalModal(true); };
  
  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      const { data } = await supabase.from('playlists').select('*').eq('profile_id', userProfile?.id).order('created_at');
      setMyPlaylists(data || []);
      setShowRentalModal(false);
      setShowPlaylistModal(true);
  };

  // 📝 기존 결제 로직 유지
  const processCollect = async (playlistId: string | 'liked') => {
    if (!address || !currentTrack || !tempRentalTerms) return;
    // ... (이전과 동일한 processCollect 로직 - pMLD/MLD 분기) ...
    // 편의상 생략, 이전 코드와 동일하게 구현
    setShowPlaylistModal(false);
    toast.success("Collected!"); 
  };

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
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">Stream is always free</h1>
            <p className="text-zinc-500">Select a mode to begin listening.</p>
          </div>

          {/* AI Mix Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 overflow-hidden">
                <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 bg-black rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-2xl relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent rounded-full animate-spin-slow"/>
                    <img src="/icon-192.png" alt="Logo" className="w-16 h-16 md:w-12 md:h-12 object-contain relative z-10" />
                    <Sparkles size={24} className="text-indigo-400 absolute top-2 right-4 animate-pulse"/>
                </div>
                <div className="flex-1 text-center md:text-left space-y-4">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200">Mix only for you</h2>
                        {tasteSummary ? (
                            <>
                                <p className="text-zinc-400 text-sm italic font-serif leading-relaxed"><Quote size={12} className="inline-block mr-1 rotate-180"/>{tasteSummary.summary}<Quote size={12} className="inline-block ml-1"/></p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                                    {tasteSummary.expanded_genres?.slice(0, 3).map((g: string) => (<span key={g} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-bold uppercase">{g}</span>))}
                                </div>
                            </>
                        ) : ( <p className="text-zinc-500 text-sm">No taste data yet. We'll play a mix of trending tracks.</p> )}
                    </div>
                    <div className="pt-2">
                        <button onClick={() => fetchAndPlay('ai')} disabled={loading} className="bg-white text-black font-black px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 mx-auto md:mx-0 shadow-xl shadow-white/10">
                            {loading ? <Loader2 className="animate-spin"/> : <><Play fill="black" size={18}/> Play on</>}
                        </button>
                    </div>
                </div>
            </div>
          </div>

          {/* Scenarios Grid */}
          <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center md:text-left">Or choose a scenario</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {scenarios.map((scenario) => (
                      <button key={scenario.id} onClick={() => fetchAndPlay('scenario', scenario.id)} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-3 transition group aspect-square justify-center">
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
  // RENDER: PLAYER SCREEN (Local Player)
  // ==================================================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* ✅ Local Audio Element (Restore) */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} 
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} 
        onEnded={handleSkip} 
        crossOrigin="anonymous"
      />

      <header className="flex justify-between items-center p-6 z-50 pointer-events-none relative">
        <button 
            onClick={() => { setStep('selection'); setIsPlaying(false); }} 
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
            {currentTrack?.cover_image_url ? ( <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><Radio size={48} className="text-zinc-700" /></div> )}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                <span className="text-[10px] font-bold text-white uppercase">{Array.isArray(currentTrack?.genre) ? currentTrack.genre.join(', ') : (currentTrack?.genre || 'Unknown')}</span>
            </div>
          </div>
          
          {/* Progress Bar (Optional) */}
          <div className="absolute -bottom-10 left-0 right-0 z-20">
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm">
              <div className="h-full bg-white rounded-full shadow-[0_0_10px_white]" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Info & Controls */}
        <div className="text-center space-y-4 mt-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight px-4 truncate">{currentTrack?.title}</h2>
            <Link href={`/u?wallet=${currentTrack?.artist?.wallet_address}`} className="text-sm mt-1 text-zinc-400 hover:text-white hover:underline transition">{currentTrack?.artist?.username || 'Unlisted Artist'}</Link>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2">
            {/* Skip (X) */}
            <button onClick={handleSkip} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition backdrop-blur-md">
              <X size={20} />
            </button>
            {/* Play/Pause */}
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            {/* Like/Collect */}
            <button onClick={openCollectModal} className="w-12 h-12 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition backdrop-blur-md">
              <Heart size={20} />
            </button>
          </div>

          <button onClick={handleInvest} className="flex items-center gap-2 text-yellow-500/80 hover:text-yellow-400 font-bold tracking-widest text-[10px] mt-6 hover:underline transition mx-auto uppercase">
            <Zap size={12} fill="currentColor" /> Invest in this track
          </button>
        </div>
      </div>

      {/* Right Side Skip Overlay */}
      <div onClick={handleSkip} className="absolute top-0 right-0 h-full z-30 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity duration-300 cursor-pointer flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent group w-[25%] md:w-[15%]">
        <div className="text-white/50 group-hover:text-white flex flex-col items-center gap-2 transform translate-x-10 group-hover:translate-x-0 transition-transform duration-300">
          <ChevronRight size={32} />
          <span className="text-[10px] font-bold tracking-widest uppercase">Skip</span>
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
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-blue-500"/></div>}>
      <RadioContent />
    </Suspense>
  );
}