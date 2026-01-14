'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { generateSunoPrompt } from '@/app/actions/generate-suno-prompt';
import { useActiveAccount } from "thirdweb/react";
import HeaderProfile from '../components/HeaderProfile';
import MobilePlayer from '../components/MobilePlayer'; 
import { Link } from "../../lib/i18n";
import { useAudioCheck } from '@/hooks/useAudioCheck';

import {
  Loader2, Mic2, Disc, UploadCloud, Play, Pause, Trash2,
  Clock, RefreshCw, AlertCircle, Wand2, Menu, Quote,
  ChevronDown, ChevronUp, Globe, Sparkles, Layers,
  SkipBack, SkipForward, Volume2, VolumeX, Minimize2, Maximize2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from "@/lib/i18n";
import { SunoTrackItem } from '../components/SunoTrackItem'; // 별도 파일로 뺐다면

// --- Types ---
type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

type SunoTrackResult = {
  id: string;
  dom_title: string;
  target_title: string;
  audio_cdn_url: string;
  cover_cdn_url: string;
  created_at: string;
  lyrics_from_api?: string; // ✅ [추가] 타입 정의에 lyrics_from_api 추가
};

type SunoJob = {
  id: number;
  user_wallet: string;
  ref_track: string;
  ref_artist: string;
  target_title: string;
  lyrics?: string;
  etc_info?: string;
  gpt_prompt?: string;
  status: JobStatus;
  genres: string[] | null;
  moods: string[] | null;
  tags: string[] | null;
  result_data: {
    job_id?: number;
    wallet?: string;
    tracks?: SunoTrackResult[];
    prompt_used?: string;
  } | null;
  error_message?: string;
  created_at: string;
};

// --- Language Dictionary ---
const DICT = {
  en: {
    welcome: "Let's create masterpiece.",
    badge: "Beta v.0.5",
    engine: "Multi-Model Aggregator Engine",
    essential: "Essential Info",
    ref_song_title: "Reference song",
    ref_song_ph: "e.g. Sunday morning",
    ref_song_artist: "by",
    ref_artist_ph: "Maroon5",
    target_voice: "Target Voice (Artist)",
    target_voice_ph: "e.g. Tyla (Vocal Style)",
    title: "Song Title",
    title_ph: "New Song Title",
    optional: "Optional Details",
    lyrics: "Lyrics",
    lyrics_ph: "Paste lyrics or leave empty for AI generation.",
    vibe: "Extra Vibe / Requirements",
    vibe_ph: "e.g. Dreamy, Reverb heavy, Faster tempo...",
    btn_generate: "Generate Request",
    queue_title: "Queue",
    status_pending: "Pending",
    status_processing: "Processing",
    status_done: "Completed",
    status_failed: "Failed",
    empty_queue: "Your queue is empty. Start creating!",
    history: "History",
    select: "Select"
  },
  kr: {
    welcome: "당신의 취향으로 음악을 만들어보세요.",
    badge: "베타 v.0.5",
    engine: "멀티 모델 생성 엔진 (Suno + GPT-4o)",
    essential: "필수 정보",
    ref_song_title: "레퍼런스 곡 (곡명 - 가수)",
    ref_song_ph: "예: Ditto",
    ref_song_artist: "by",
    ref_artist_ph: "예: New Jeans",
    target_voice: '보컬 레퍼런스',
    target_voice_ph: '보컬 레퍼런스',
    title: "노래 제목",
    title_ph: "만들고 싶은 곡 제목",
    optional: "선택 사항",
    lyrics: "가사",
    lyrics_ph: "가사를 입력하거나 비워두면 AI가 작사합니다.",
    vibe: "추가 요청 사항 (분위기 등)",
    vibe_ph: "예: 몽환적인 리버브, 템포 빠르게...",
    btn_generate: "생성 요청하기",
    queue_title: "작업 대기열",
    status_pending: "대기중",
    status_processing: "생성중",
    status_done: "완료됨",
    status_failed: "실패",
    empty_queue: "대기열이 비어있습니다.",
    history: "히스토리",
    select: "선택 및 업로드"
  }
};

type PlayerTrack = {
  id: string;
  title: string;
  artist_name: string;
  cover_image_url: string;
  audio_url: string;
  job: SunoJob;
  rawTrack: SunoTrackResult;
  index: number;
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
};

// --- Helper: 타이머 포맷 (HH:mm:ss) ---
const formatCountdown = (targetDate: Date | null) => {
  if (!targetDate) return "";
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "";
  
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function CreateDashboard() {
  const account = useActiveAccount();
  const router = useRouter();

  // --- UI State ---
  const [isKorean, setIsKorean] = useState(false);
  const t = isKorean ? DICT.kr : DICT.en;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<number>>(new Set());

  // --- User Data ---
  const [username, setUsername] = useState<string>('Creator');

  // --- Input State ---
  const [refSongTitle, setRefSongTitle] = useState('');
  const [refSongArtist, setRefSongArtist] = useState('');
  const [targetVoice, setTargetVoice] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [userLyrics, setLyrics] = useState('');
  const [etcInfo, setEtcInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Queue State ---
  const [jobs, setJobs] = useState<SunoJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // --- Player State ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Mobile & Minimized Player UI state
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false); // ✅ [추가] 데스크탑 플레이어 최소화 상태
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);

  // ✅ [추가] Credit & Timer State
  const [credits, setCredits] = useState(3); // 기본 3개
  const [nextResetTime, setNextResetTime] = useState<Date | null>(null);
  const [timerString, setTimerString] = useState("");

  const formatTime = (sec: number) => {
    if (!sec || Number.isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const buildPlayerTrack = (job: SunoJob, track: SunoTrackResult, idx: number): PlayerTrack => ({
    id: track.id,
    title: `${job.target_title} v${idx + 1}`,
    artist_name: `${job.ref_artist} Style (AI)`,
    cover_image_url: track.cover_cdn_url,
    audio_url: track.audio_cdn_url,
    job,
    rawTrack: track,
    index: idx
  });

  const playFromFooter = (pt: PlayerTrack) => {
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(pt);
    setIsPlaying(true);
    setIsPlayerMinimized(false); // 재생 시 플레이어 다시 켬
  };

  const resolveTracksOfCurrentJob = () => currentTrack?.job?.result_data?.tracks || [];

  const handleNext = () => {
    const tracks = resolveTracksOfCurrentJob();
    if (!currentTrack || tracks.length === 0) return;

    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
      return;
    }

    const curIdx = currentTrack.index;

    if (isShuffle && tracks.length > 1) {
      let nextIdx = curIdx;
      while (nextIdx === curIdx) nextIdx = Math.floor(Math.random() * tracks.length);
      playFromFooter(buildPlayerTrack(currentTrack.job, tracks[nextIdx], nextIdx));
      return;
    }

    const nextIdx = curIdx + 1;
    if (nextIdx >= tracks.length) {
      if (repeatMode === 'all') playFromFooter(buildPlayerTrack(currentTrack.job, tracks[0], 0));
      else setIsPlaying(false);
      return;
    }
    playFromFooter(buildPlayerTrack(currentTrack.job, tracks[nextIdx], nextIdx));
  };

  const handlePrev = () => {
    const tracks = resolveTracksOfCurrentJob();
    if (!currentTrack || tracks.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    const curIdx = currentTrack.index;
    const prevIdx = curIdx - 1;
    if (prevIdx < 0) {
      if (repeatMode === 'all') playFromFooter(buildPlayerTrack(currentTrack.job, tracks[tracks.length - 1], tracks.length - 1));
      else audioRef.current && (audioRef.current.currentTime = 0);
      return;
    }
    playFromFooter(buildPlayerTrack(currentTrack.job, tracks[prevIdx], prevIdx));
  };

  const toggleRepeat = () => {
    setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');
  };

  // audio 연결/재생 제어
  useEffect(() => {
    if (!audioRef.current) return;
    if (!currentTrack?.audio_url) return;

    audioRef.current.src = currentTrack.audio_url;
    audioRef.current.currentTime = 0;
    audioRef.current.volume = isMuted ? 0 : volume;

    if (isPlaying) audioRef.current.play().catch(() => {});
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!currentTrack?.audio_url) return;

    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, currentTrack?.audio_url]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // 1. Initial Load (User & Jobs)
  useEffect(() => {
    if (account?.address) {
      fetchProfile();
      fetchJobs();

      const channel = supabase
        .channel('suno_jobs_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'suno_jobs', filter: `user_wallet=eq.${account.address}` },
          () => { fetchJobs(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [account?.address]);

  const fetchProfile = async () => {
    if (!account?.address) return;
    const { data } = await supabase.from('profiles').select('username').eq('wallet_address', account.address).single();
    if (data?.username) setUsername(data.username);
  };

  const fetchJobs = async () => {
    if (!account?.address) return;
    setLoadingJobs(true);
    const { data } = await supabase
      .from('suno_jobs')
      .select('*')
      .eq('user_wallet', account.address)
      .eq('discarded', false)
      .order('created_at', { ascending: false });

    if (data) setJobs(data as SunoJob[]);
    setLoadingJobs(false);
  };

  // 2. Request Creation
  const handleRequestCreate = async () => {
    if (!account?.address) { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Please connect wallet to play", { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;}

    // ✅ [추가] 크레딧 체크 (프론트엔드 방어)
    if (credits <= 0) {
        return toast.error(`Daily limit reached. Resets in ${timerString}`);
    }

    if (!refSongTitle || !refSongArtist || !targetVoice || !targetTitle) {
      return toast.error(isKorean ? "필수 정보를 입력해주세요." : "Required fields missing.");
    }

    try {
      setIsSubmitting(true);
      toast.loading(isKorean ? "한글 발음 변환 및 스타일 분석 중..." : "Translating & Analyzing...");

      const analyzedData = await generateSunoPrompt(
        refSongTitle,
        refSongArtist,
        targetVoice,
        targetTitle,
        userLyrics,
        etcInfo
      );

      if (!analyzedData) throw new Error("Analysis failed");

      const { error } = await supabase.from('suno_jobs').insert({
        user_wallet: account.address,
        ref_track: `${refSongTitle} - ${refSongArtist}`,
        ref_artist: targetVoice,
        target_title: analyzedData.title,
        lyrics: analyzedData.lyrics,
        etc_info: etcInfo,
        gpt_prompt: analyzedData.prompt,
        genres: analyzedData.genres,
        moods: analyzedData.moods,
        tags: analyzedData.tags,
        status: 'pending'
      });

      if (error) throw error;

      toast.dismiss();
      toast.success(isKorean ? "요청 완료!" : "Request queued!");

      setRefSongTitle(''); setRefSongArtist(''); setTargetVoice('');
      setTargetTitle(''); setLyrics(''); setEtcInfo('');
      fetchJobs();
      checkCredits(); // ✅ [추가] 사용했으니 크레딧 갱신
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handlers
  const toggleAccordion = (id: number) => {
    const newSet = new Set(expandedJobIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedJobIds(newSet);
  };

  const handleGoToUpload = async (job: SunoJob, track: SunoTrackResult, index: number) => {
    await supabase.from('suno_jobs').update({ selected_index: index }).eq('id', job.id);
    const query = new URLSearchParams({
      title: job.target_title,
      artist: `${job.ref_artist} Style (AI)`,
      audioUrl: track.audio_cdn_url,
      coverUrl: track.cover_cdn_url,
      genres: (job.genres || []).join(','),
      moods: (job.moods || []).join(','),
      tags: (job.tags || []).join(','),
      jobId: job.id.toString(),
      refInfo: `${job.ref_track} by ${job.ref_artist}`,
      lyrics: track.lyrics_from_api || job.lyrics || '' // ✅ [수정] lyrics 파라미터 추가 (API 가사 우선, 없으면 작업 시 생성된 가사)
    }).toString();
    router.push(`/upload?${query}`);
  };

  const handleDiscardJob = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Discard this job?")) return;
    await supabase.from('suno_jobs').delete().eq('id', id);
    fetchJobs();
  };

  // ✅ [추가] 1. 크레딧 상태 조회 (로드 시 + 작업 완료 시)
  const checkCredits = async () => {
    if (!account?.address) return;

    // 24시간 전 시각 구하기
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentJobs } = await supabase
      .from('suno_jobs')
      .select('created_at')
      .eq('user_wallet', account.address)
      .gte('created_at', oneDayAgo) // 24시간 이내 생성된 것만
      .order('created_at', { ascending: true }); // 오래된 순 정렬

    if (recentJobs) {
      const used = recentJobs.length;
      setCredits(Math.max(0, 3 - used));

      // 만약 3개 다 썼다면, 가장 먼저 생성한 작업 시점으로부터 24시간 뒤가 리셋 타임
      if (used >= 3) {
        const oldestJobTime = new Date(recentJobs[0].created_at).getTime();
        const resetAt = new Date(oldestJobTime + 24 * 60 * 60 * 1000);
        setNextResetTime(resetAt);
      } else {
        setNextResetTime(null);
        setTimerString("");
      }
    }
  };

  // ✅ [추가] 2. 초기 로드 및 계정 변경 시 크레딧 체크
  useEffect(() => {
    checkCredits();
  }, [account?.address]);

  // ✅ [추가] 3. 타이머 돌리기 (1초마다)
  useEffect(() => {
    if (!nextResetTime) return;

    const interval = setInterval(() => {
      const str = formatCountdown(nextResetTime);
      if (str === "") {
        // 시간이 다 되면 다시 크레딧 체크 (리셋)
        checkCredits();
      } else {
        setTimerString(str);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextResetTime]);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      <audio
        ref={audioRef}
        className="hidden"
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration || 0); }}
        onEnded={handleNext}
      />

      {/* CSS Hack: MobilePlayer 내부 버튼 숨김 */}
      <style jsx global>{`
        .create-mobile-player button:has(.lucide-heart),
        .create-mobile-player button:has(.lucide-zap) {
          display: none !important;
        }
      `}</style>

      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu /></button>

          <Link href="/market" className="text-zinc-500 hover:text-white text-sm font-bold transition inline-flex items-center">
            ← Back
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsKorean(!isKorean)}
            className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-white transition bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800"
          >
            <Globe size={14} /> {isKorean ? "KOR" : "ENG"}
          </button>
          <HeaderProfile />
        </div>
      </header>

      {/* Main Content: Split View */}
      {/* ✅ [수정] pb-32 추가하여 하단 플레이어 공간 확보 */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 lg:p-8 pb-40 md:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* === LEFT PANEL: Request Input (Sticky) === */}
        <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24 h-fit">
          {/* Welcome & Badge */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/20 border border-blue-500/20 text-blue-400 text-[10px] font-black tracking-wider uppercase">
              <Sparkles size={12} /> {t.badge} <span className="text-zinc-600">|</span> <Layers size={12} /> {t.engine}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Welcome, {username}<br />
              <span className="bg-clip-text bg-gradient-to-br from-cyan-700 via-blue-700 to-indigo-500 text-zinc-500 md:text-2xl">{t.welcome}</span>
            </h2>
          </div>

          {/* Input Form */}
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 shadow-2xl space-y-6">
            {/* Essential Section */}
            <div className="space-y-4">
              <h3 className="font-bold flex items-center gap-2 text-blue-400 text-sm uppercase tracking-wider">
                <Disc size={16} /> {t.essential}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.ref_song_title}</label>
                  <input value={refSongTitle} onChange={e => setRefSongTitle(e.target.value)} placeholder={t.ref_song_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none transition" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.ref_song_artist}</label>
                  <input value={refSongArtist} onChange={e => setRefSongArtist(e.target.value)} placeholder={t.ref_artist_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none transition" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.target_voice}</label>
                <input value={targetVoice} onChange={e => setTargetVoice(e.target.value)} placeholder={t.target_voice_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none transition" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.title}</label>
                <input value={targetTitle} onChange={e => setTargetTitle(e.target.value)} placeholder={t.title_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm focus:border-blue-500 outline-none transition" />
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Optional Section */}
            <div className="space-y-4">
              <h3 className="font-bold flex items-center gap-2 text-zinc-400 text-sm uppercase tracking-wider">
                <Mic2 size={16} /> {t.optional}
              </h3>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.lyrics}</label>
                <textarea value={userLyrics} onChange={e => setLyrics(e.target.value)} placeholder={t.lyrics_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm h-20 focus:border-zinc-500 outline-none resize-none transition" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">{t.vibe}</label>
                <input value={etcInfo} onChange={e => setEtcInfo(e.target.value)} placeholder={t.vibe_ph} className="w-full bg-black border border-zinc-700 rounded-xl p-3.5 text-sm focus:border-zinc-500 outline-none transition" />
              </div>
            </div>
            {/* Input Form 내부의 Submit Button 부분 교체 */}
            <div className="space-y-3">
                {/* ✅ [추가] Credit Status Bar */}
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        Daily Credits
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${credits === 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {credits} / 3 Available
                    </span>
                </div>

                {/* Progress Bar (Visual) */}
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${credits === 0 ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${(credits / 3) * 100}%` }}
                    />
                </div>

                <button
                    onClick={handleRequestCreate}
                    // ✅ [수정] 크레딧 없으면 비활성화
                    disabled={isSubmitting || !account?.address || credits <= 0}
                    className={`group relative w-full rounded-xl p-[2px] transition-all duration-300
                        ${credits > 0 
                            ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:scale-[1.01]' 
                            : 'bg-zinc-800 cursor-not-allowed opacity-70'}
                    `}
                >
                    <div className="absolute inset-[2px] bg-zinc-900 rounded-[10px] transition-opacity duration-300 ease-in-out group-hover:opacity-0" />
                    <div className="relative z-10 flex items-center justify-center gap-2 py-4 font-black text-white tracking-wide">
                        {isSubmitting ? (
                            <Loader2 className="animate-spin text-white" />
                        ) : (
                            <>
                                {credits > 0 ? (
                                    <>
                                        <Wand2 size={20} className="text-cyan-300 group-hover:text-white group-hover:rotate-12 transition-all duration-300" />
                                        <span className="group-hover:text-white transition-colors">{t.btn_generate}</span>
                                    </>
                                ) : (
                                    // ⏳ 크레딧 소진 시 타이머 표시
                                    <div className="flex items-center gap-2 text-red-400">
                                        <Clock size={18} />
                                        <span>Refill in {timerString || "calculating..."}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </button>
                
                {/* Beta Notice */}
                <p className="text-center text-[10px] text-zinc-600">
                    (Still a beta version. May take 1~10 mins to create)
                </p>
            </div>
          </div>
        </div>

        {/* === RIGHT PANEL: Queue (Scrollable) === */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              {t.queue_title}
              <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">{jobs.length}</span>
            </h3>
            
            {/* ✅ [수정] 새로고침 버튼 */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={fetchJobs} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-full text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-500 transition"
                >
                    <RefreshCw size={12} className={loadingJobs ? "animate-spin" : ""}/> 
                    {loadingJobs ? "Loading..." : "Refresh"}
                </button>
                <button className="text-xs text-zinc-500 hover:text-white transition flex items-center gap-1 ml-2">
                    <Clock size={12} /> {t.history}
                </button>
            </div>
          </div>

          {loadingJobs && <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-zinc-600" size={32} /></div>}

          {!loadingJobs && jobs.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-500">
              <Disc size={48} className="mx-auto mb-4 opacity-20" />
              <p>{t.empty_queue}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`group bg-zinc-900 border transition-all rounded-2xl overflow-hidden ${
                  job.status === 'done' ? 'border-zinc-700 shadow-md' : 'border-zinc-800 opacity-80 hover:opacity-100'
                } ${expandedJobIds.has(job.id) ? 'ring-1 ring-zinc-700 bg-zinc-900' : ''}`}
              >
                {/* Queue Item Header (Clickable) */}
                <div
                  onClick={() => toggleAccordion(job.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          job.status === 'done' ? 'bg-blue-500 shadow-[0_0_8px_lime]' :
                          job.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                          job.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                      />
                    </div>

                    <div>
                      <h4 className={`font-bold text-sm ${job.status === 'done' ? 'text-white' : 'text-zinc-400'}`}>
                        {job.target_title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                        <span className="uppercase tracking-wider font-bold">{
                          job.status === 'done' ? t.status_done :
                          job.status === 'processing' ? t.status_processing :
                          job.status === 'failed' ? t.status_failed : t.status_pending
                        }</span>
                        <span>•</span>
                        <span>{new Date(job.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {job.status === 'done' && !expandedJobIds.has(job.id) && (
                      <span className="text-[10px] font-bold bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Ready</span>
                    )}
                    <button onClick={(e) => handleDiscardJob(job.id, e)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-full transition"><Trash2 size={14} /></button>
                    <div className={`p-2 rounded-full transition ${expandedJobIds.has(job.id) ? 'bg-zinc-800 text-white rotate-180' : 'text-zinc-500'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Accordion Content */}
                {expandedJobIds.has(job.id) && (
                  <div className="border-t border-zinc-800 bg-black/20 p-5 animate-in slide-in-from-top-2 duration-200">
                    {/* Info Block */}
                    <div className="mb-6 flex flex-col md:flex-row gap-4 items-start">
                      <div className="flex-1 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                        {/* ✅ [수정] Quote 스타일 개선 (따옴표 제거, 깔끔하게) */}
                        <div className="flex gap-3 mb-2">
                          <Quote size={16} className="text-zinc-600 shrink-0 mt-1" />
                          <div className="text-sm text-zinc-300 italic space-y-1">
                            <p>Based on <strong className="text-white not-italic">{job.ref_track}</strong></p>
                            <p>Voice style of <strong className="text-blue-400 not-italic">{job.ref_artist}</strong></p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-7 mt-3">
                          {job.genres?.slice(0, 3).map(g => <span key={g} className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">{g}</span>)}
                          {job.moods?.slice(0, 3).map(m => <span key={m} className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">{m}</span>)}
                        </div>
                      </div>
                      {job.error_message && (
                        <div className="flex-1 bg-red-900/10 p-4 rounded-xl border border-red-500/20 text-red-400 text-xs">
                          <AlertCircle size={14} className="mb-1" />
                          {job.error_message}
                        </div>
                      )}
                    </div>

                    {/* Results (Tracks) */}
                    {job.status === 'done' && job.result_data?.tracks ? (
                      <div className="grid grid-cols-1 gap-3">
                        {job.result_data.tracks.map((track, idx) => (
                          // ✅ 기존의 긴 div 덩어리를 이걸로 교체!
                          <SunoTrackItem
                            key={`${job.id}-${idx}`}
                            job={job}
                            track={track}
                            idx={idx}
                            currentTrack={currentTrack}
                            isPlaying={isPlaying}
                            playFromFooter={playFromFooter}
                            buildPlayerTrack={buildPlayerTrack}
                            handleGoToUpload={handleGoToUpload}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : (
                      job.status === 'processing' && (
                        <div className="text-center py-6 text-zinc-500 text-xs animate-pulse">
                          generating tracks...
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ✅ Desktop Footer Player (with Minimize) */}
      {currentTrack && !isPlayerMinimized && (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl animate-in slide-in-from-bottom-5">
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
                <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700" /></div>
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
              <Link 
                  href={`/u?wallet=${currentTrack.artist?.wallet_address}`} 
                  className="text-xs text-zinc-400 truncate hover:underline cursor-pointer"
                  >
                  {currentTrack.artist?.username}
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 w-1/3">
            <div className="flex items-center gap-6">
              <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20} /></button>
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
              </button>
              <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20} /></button>
            </div>

            <div className="w-full max-w-sm flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group"
                onClick={(e) => {
                  if (!audioRef.current || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const newTime = ((e.clientX - rect.left) / rect.width) * duration;
                  audioRef.current.currentTime = newTime;
                }}
              >
                <div className="h-full bg-white rounded-full relative z-10 group-hover:bg-blue-500 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <span className="text-[10px] font-mono w-8 text-zinc-500">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="w-1/3 flex justify-end items-center gap-4">
            <button
              onClick={() => handleGoToUpload(currentTrack.job, currentTrack.rawTrack, currentTrack.index)}
              className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-black hover:bg-zinc-200 transition flex items-center gap-2 shadow-md"
            >
              <UploadCloud size={14} /> {t.select}
            </button>

            <div className="w-px h-6 bg-zinc-800 mx-1"></div>

            {/* ✅ [추가] Minimize Button */}
            <button onClick={() => setIsPlayerMinimized(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition">
                <Minimize2 size={18}/>
            </button>
          </div>
        </div>
      )}

      {/* ✅ [추가] Minimized Floating Player (Desktop) */}
      {currentTrack && isPlayerMinimized && (
          <div 
            onClick={() => setIsPlayerMinimized(false)}
            className="hidden md:flex fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 rounded-full p-2 pr-6 items-center gap-3 shadow-2xl cursor-pointer hover:scale-105 transition animate-in zoom-in slide-in-from-bottom-5"
          >
              <div className={`w-10 h-10 rounded-full overflow-hidden border border-zinc-800 ${isPlaying ? 'animate-spin-slow' : ''}`}>
                  <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/>
              </div>
              <div>
                  <div className="text-xs font-bold text-white max-w-[100px] truncate">{currentTrack.title}</div>
                  <div className="text-[10px] text-blue-400">{isPlaying ? "Playing..." : "Paused"}</div>
              </div>
              <Maximize2 size={14} className="text-zinc-500 ml-2"/>
          </div>
      )}

      {/* ✅ Mobile Player & Select Overlay (기존 유지) */}
      {currentTrack && mobilePlayerOpen && (
        <>
          <div className="md:hidden create-mobile-player">
            <MobilePlayer
              track={currentTrack}
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onNext={handleNext}
              onPrev={handlePrev}
              onClose={() => setMobilePlayerOpen(false)}
              repeatMode={repeatMode}
              onToggleRepeat={toggleRepeat}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              currentTime={currentTime}
              duration={duration}
              onSeek={(val: number) => { if (audioRef.current) audioRef.current.currentTime = val; }}
              isRented={true}
              isLiked={false}
              onToggleLike={() => {}}
            />
          </div>
          <div className="md:hidden fixed bottom-6 left-6 right-6 z-[110]">
            <button
              onClick={() => handleGoToUpload(currentTrack.job, currentTrack.rawTrack, currentTrack.index)}
              className="w-full bg-white text-black py-4 rounded-2xl font-black shadow-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition"
            >
              <UploadCloud size={18} /> {t.select}
            </button>
          </div>
        </>
      )}

      {/* Mobile Mini Player */}
      {currentTrack && !mobilePlayerOpen && (
        <div
          className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40"
          onClick={() => setMobilePlayerOpen(true)}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative ${isPlaying ? 'animate-pulse' : ''}`}>
              {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
              <Link 
                  href={`/u?wallet=${currentTrack.artist?.wallet_address}`} 
                  className="text-xs text-zinc-500 truncate hover:underline cursor-pointer"
                  >
                  {currentTrack.artist?.username}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 pr-1">
            <button
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black shadow-lg"
            >
              {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}