'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { generateSunoPrompt, type VocalTags, type RefSongMeta } from '@/app/actions/generate-suno-prompt';
import { useActiveAccount } from "thirdweb/react";
import HeaderProfile from '../components/HeaderProfile';
import MobilePlayer from '../components/MobilePlayer';
import { Link } from "../../lib/i18n";
import InfoModal, { HelpToggle } from '../components/ui/InfoModal';
import { CREATE_GUIDE_DATA } from '../components/ui/tutorialData';

import {
  Loader2, Mic2, Disc, UploadCloud, Play, Pause, Trash2,
  Clock, RefreshCw, AlertCircle, Wand2, Quote,
  ChevronDown, ChevronUp, Sparkles,
  SkipBack, SkipForward, Minimize2, Maximize2, X,
  Music, Settings2, ChevronLeft, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from "@/lib/i18n";
import { SunoTrackItem } from '../components/SunoTrackItem';
import { generateLyricsDraft } from '@/app/actions/generate-lyrics';

type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

type SunoTrackResult = {
  id: string;
  dom_title: string;
  target_title: string;
  audio_cdn_url: string;
  cover_cdn_url: string;
  created_at: string;
  lyrics_from_api?: string;
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
  creation_type?: 'simple' | 'custom';
};

const DICT = {
  en: {
    welcome: "Create your masterpiece.",
    badge: "Beta v.0.5",
    engine: "Multi-Model AI Engine",
    essential: "Essential",
    vocal_persona: "Vocal Persona",
    ref_song_title: "Reference Track",
    ref_song_ph: "Search or type song name...",
    ref_song_artist: "Artist",
    ref_artist_ph: "e.g. Maroon5",
    target_voice: "Vocal Reference",
    target_voice_ph: "e.g. Tyla",
    title: "Song Title",
    title_ph: "Give your track a name...",
    optional: "Story & Vibe",
    lyrics: "Lyrics & Topic",
    lyrics_ph: "Paste lyrics or leave empty for AI generation.",
    vibe: "Atmosphere",
    vibe_ph: "e.g. Dreamy, Reverb heavy, Faster tempo...",
    btn_generate: "Generate Track",
    queue_title: "Creation Queue",
    status_pending: "Pending",
    status_processing: "Processing",
    status_done: "Completed",
    status_failed: "Failed",
    empty_queue: "Your canvas is blank. Start creating!",
    history: "History",
    select: "Select",
    lyrics_concept_ph: "Describe the topic or story in one sentence. (AI generates lyrics)",
    lyrics_full_ph: "Paste your full lyrics here.",
    lyrics_tip_simple: "Tip: Simple concepts work best. AI will write the rhymes.",
    lyrics_tip_custom: "Tip: Structure your lyrics with [Verse], [Chorus] for better results.",
  },
  kr: {
    welcome: "당신의 취향을 음악으로.",
    badge: "베타 v.0.5",
    engine: "멀티 모델 생성 엔진",
    essential: "필수 정보",
    vocal_persona: "보컬 페르소나",
    ref_song_title: "레퍼런스 곡",
    ref_song_ph: "곡명 검색 또는 직접 입력...",
    ref_song_artist: "가수",
    ref_artist_ph: "예: New Jeans",
    target_voice: '보컬 레퍼런스',
    target_voice_ph: '가수 이름 검색...',
    title: "노래 제목",
    title_ph: "새로운 곡의 제목을 지어주세요...",
    optional: "스토리 & 무드",
    lyrics: "가사 및 주제",
    lyrics_ph: "가사를 입력하거나 비워두면 AI가 작사합니다.",
    vibe: "분위기 (Vibe)",
    vibe_ph: "예: 몽환적인 리버브, 템포 빠르게...",
    btn_generate: "트랙 생성하기",
    queue_title: "작업 대기열",
    status_pending: "대기중",
    status_processing: "생성중",
    status_done: "완료됨",
    status_failed: "실패",
    empty_queue: "대기열이 비어있습니다. 첫 곡을 만들어보세요!",
    history: "히스토리",
    select: "선택 및 업로드",
    lyrics_concept: "가사 컨셉",
    lyrics_full: "전체 가사",
    lyrics_concept_ph: "곡의 주제나 스토리를 적어주세요. (AI가 가사 생성)",
    lyrics_full_ph: "전체 가사를 여기에 붙여넣으세요.",
    lyrics_tip_simple: "Tip: 핵심 키워드나 문장을 넣으면 AI가 완성해줍니다.",
    lyrics_tip_custom: "Tip: [Verse], [Chorus] 태그를 활용해 구조를 짜보세요.",
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

  const [isKorean, setIsKorean] = useState(false);
  const t = isKorean ? DICT.kr : DICT.en;
  const [expandedJobIds, setExpandedJobIds] = useState<Set<number>>(new Set());
  const [username, setUsername] = useState<string>('Creator');

  const [refSongTitle, setRefSongTitle] = useState('');
  const [refSongArtist, setRefSongArtist] = useState('');
  const [targetVoice, setTargetVoice] = useState('');
  const [vocalMode, setVocalMode] = useState<'tags' | 'artist'>('tags');
  const [vocalTags, setVocalTags] = useState<VocalTags>({});
  const [showDetailVox, setShowDetailVox] = useState(false);
  const [targetTitle, setTargetTitle] = useState('');
  const [userLyrics, setLyrics] = useState('');
  const [etcInfo, setEtcInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  type MusicSearchResult = {
    id: string; title: string; artist: string; album: string; artwork: string; artworkHD: string;
    genre?: string; releaseYear?: string; country?: string; isExplicit?: boolean; durationMs?: number;
  };
  type ArtistSearchResult = { id: string; name: string; artwork?: string; genre?: string; };

  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<MusicSearchResult[]>([]);
  const [isSongSearching, setIsSongSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<MusicSearchResult | null>(null);
  const [artistQuery, setArtistQuery] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [isArtistSearching, setIsArtistSearching] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null);
  const songSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artistSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [jobs, setJobs] = useState<SunoJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);

  const [credits, setCredits] = useState(3);
  const [nextResetTime, setNextResetTime] = useState<Date | null>(null);
  const [timerString, setTimerString] = useState("");
  const [lyricsMode, setLyricsMode] = useState<'simple' | 'custom'>('simple');
  const [lyricsCredits, setLyricsCredits] = useState(3);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const formatTime = (sec: number) => {
    if (!sec || Number.isNaN(sec)) return "0:00";
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  };

  const buildPlayerTrack = (job: SunoJob, track: SunoTrackResult, idx: number): PlayerTrack => ({
    id: track.id,
    title: `${job.target_title} v${idx + 1}`,
    artist_name: `${job.ref_artist} Style (AI)`,
    cover_image_url: track.cover_cdn_url,
    audio_url: track.audio_cdn_url,
    job, rawTrack: track, index: idx
  });

  const playFromFooter = (pt: PlayerTrack) => {
    setCurrentTime(0); setDuration(0);
    setCurrentTrack(pt); setIsPlaying(true); setIsPlayerMinimized(false);
  };

  const resolveTracksOfCurrentJob = () => currentTrack?.job?.result_data?.tracks || [];

  const handleNext = () => {
    const tracks = resolveTracksOfCurrentJob();
    if (!currentTrack || tracks.length === 0) return;
    if (repeatMode === 'one') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
      setIsPlaying(true); return;
    }
    const curIdx = currentTrack.index;
    if (isShuffle && tracks.length > 1) {
      let nextIdx = curIdx;
      while (nextIdx === curIdx) nextIdx = Math.floor(Math.random() * tracks.length);
      playFromFooter(buildPlayerTrack(currentTrack.job, tracks[nextIdx], nextIdx)); return;
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
    if (audioRef.current && audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    const prevIdx = currentTrack.index - 1;
    if (prevIdx < 0) {
      if (repeatMode === 'all') playFromFooter(buildPlayerTrack(currentTrack.job, tracks[tracks.length - 1], tracks.length - 1));
      else audioRef.current && (audioRef.current.currentTime = 0);
      return;
    }
    playFromFooter(buildPlayerTrack(currentTrack.job, tracks[prevIdx], prevIdx));
  };

  const toggleRepeat = () => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.audio_url) return;
    audioRef.current.src = currentTrack.audio_url;
    audioRef.current.currentTime = 0;
    audioRef.current.volume = isMuted ? 0 : volume;
    if (isPlaying) audioRef.current.play().catch(() => {});
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.audio_url) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying, currentTrack?.audio_url]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    if (account?.address) {
      fetchProfile(); fetchJobs();
      const channel = supabase.channel('suno_jobs_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'suno_jobs', filter: `user_wallet=eq.${account.address}` }, () => { fetchJobs(); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [account?.address]);

  const searchSongs = async (query: string) => {
    if (!query.trim() || query.length < 2) { setSongResults([]); return; }
    setIsSongSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=6`);
      const data = await res.json();
      setSongResults((data.results ?? []).map((item: any) => ({
        id: String(item.trackId), title: item.trackName ?? '', artist: item.artistName ?? '', album: item.collectionName ?? '',
        artwork: (item.artworkUrl100 ?? '').replace('100x100bb', '120x120bb'),
        artworkHD: (item.artworkUrl100 ?? '').replace('100x100bb', '400x400bb'),
        genre: item.primaryGenreName ?? undefined,
        releaseYear: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
        country: item.country ?? undefined, isExplicit: item.trackExplicitness === 'explicit',
        durationMs: item.trackTimeMillis ?? undefined,
      })));
    } catch { setSongResults([]); } finally { setIsSongSearching(false); }
  };

  const searchArtists = async (query: string) => {
    if (!query.trim() || query.length < 2) { setArtistResults([]); return; }
    setIsArtistSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=musicArtist&limit=5`);
      const data = await res.json();
      setArtistResults((data.results ?? []).map((item: any) => ({
        id: String(item.artistId), name: item.artistName ?? '', artwork: '', genre: item.primaryGenreName ?? undefined,
      })));
    } catch { setArtistResults([]); } finally { setIsArtistSearching(false); }
  };

  const handleSongQueryChange = (val: string) => {
    setSongQuery(val); setSelectedSong(null);
    if (songSearchRef.current) clearTimeout(songSearchRef.current);
    songSearchRef.current = setTimeout(() => searchSongs(val), 350);
  };

  const handleArtistQueryChange = (val: string) => {
    setArtistQuery(val); setSelectedArtist(null);
    if (artistSearchRef.current) clearTimeout(artistSearchRef.current);
    artistSearchRef.current = setTimeout(() => searchArtists(val), 350);
  };

  const selectSong = (song: MusicSearchResult) => {
    setSelectedSong(song); setRefSongTitle(song.title); setRefSongArtist(song.artist);
    setSongQuery(song.title); setSongResults([]);
  };

  const selectArtist = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist); setTargetVoice(artist.name);
    setArtistQuery(artist.name); setArtistResults([]);
  };

  const fetchProfile = async () => {
    if (!account?.address) return;
    const { data } = await supabase.from('profiles').select('username').eq('wallet_address', account.address).single();
    if (data?.username) setUsername(data.username);
  };

  const fetchJobs = async () => {
    if (!account?.address) return;
    setLoadingJobs(true);
    const { data } = await supabase.from('suno_jobs').select('*').eq('user_wallet', account.address).eq('discarded', false).order('created_at', { ascending: false });
    if (data) setJobs(data as SunoJob[]);
    setLoadingJobs(false);
  };

  const handleRequestCreate = async () => {
    if (!account?.address) {
      const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
      if (headerBtn) headerBtn.click(); else toast.error("Please Join unlisted first.");
      return;
    }
    if (!isUnlimited && credits <= 0) return toast.error(`Daily limit reached. Resets in ${timerString}`);
    if (!refSongTitle || !refSongArtist || !targetTitle) return toast.error(isKorean ? "필수 정보를 입력해주세요." : "Required fields missing.");
    if (vocalMode === 'tags' && !vocalTags.gender && !targetVoice) return toast.error(isKorean ? "보컬 성별을 선택해주세요." : "Please select vocal gender.");

    try {
      setIsSubmitting(true);
      toast.loading(isKorean ? "AI가 스타일을 분석 중입니다..." : "AI analyzing style...");

      const analyzedData = await generateSunoPrompt(
        refSongTitle, refSongArtist, targetVoice, targetTitle, vocalTags, userLyrics, etcInfo,
        selectedSong ? {
          genre: selectedSong.genre, releaseYear: selectedSong.releaseYear,
          country: selectedSong.country, isExplicit: selectedSong.isExplicit, durationMs: selectedSong.durationMs,
        } satisfies RefSongMeta : undefined
      );

      if (!analyzedData) throw new Error("Analysis failed");

      const { error } = await supabase.from('suno_jobs').insert({
        user_wallet: account.address,
        ref_track: `${refSongTitle} - ${refSongArtist}`,
        ref_artist: targetVoice || "AI Custom Vocal",
        target_title: analyzedData.title,
        lyrics: lyricsMode === 'custom' ? userLyrics : analyzedData.lyrics,
        creation_type: lyricsMode, etc_info: etcInfo,
        gpt_prompt: analyzedData.prompt, genres: analyzedData.genres, moods: analyzedData.moods, tags: analyzedData.tags,
        status: 'pending'
      });
      if (error) throw error;

      toast.dismiss(); toast.success(isKorean ? "요청이 등록되었습니다!" : "Request queued successfully!");
      setRefSongTitle(''); setRefSongArtist(''); setTargetVoice(''); setTargetTitle(''); setLyrics(''); setEtcInfo('');
      setVocalTags({}); setVocalMode('tags'); setShowDetailVox(false);
      setSongQuery(''); setSelectedSong(null); setArtistQuery(''); setSelectedArtist(null);
      fetchJobs(); checkCredits(); setLyricsMode('simple');
    } catch (e: any) {
      toast.dismiss(); toast.error(e.message);
    } finally { setIsSubmitting(false); }
  };

  const toggleAccordion = (id: number) => {
    const s = new Set(expandedJobIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpandedJobIds(s);
  };

  const handleGoToUpload = async (job: SunoJob, track: SunoTrackResult, index: number) => {
    await supabase.from('suno_jobs').update({ selected_index: index }).eq('id', job.id);
    const finalLyrics = job.creation_type === 'custom' ? (job.lyrics || '') : (track.lyrics_from_api || job.lyrics || '');
    const query = new URLSearchParams({
      title: job.target_title, artist: `${job.ref_artist} Style (AI)`,
      audioUrl: track.audio_cdn_url, coverUrl: track.cover_cdn_url,
      genres: (job.genres || []).join(','), moods: (job.moods || []).join(','),
      tags: (job.tags || []).join(','), jobId: job.id.toString(),
      refInfo: `${job.ref_track} by ${job.ref_artist}`, lyrics: finalLyrics
    }).toString();
    router.push(`/upload?${query}`);
  };

  const handleDiscardJob = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Discard this job?")) return;
    await supabase.from('suno_jobs').delete().eq('id', id);
    fetchJobs();
  };

  const checkCredits = async () => {
    if (!account?.address) return;
    try {
      const { data: profile } = await supabase.from('profiles').select('is_unlimited').eq('wallet_address', account.address).single();
      setIsUnlimited(profile?.is_unlimited || false);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentJobs } = await supabase.from('suno_jobs').select('created_at').eq('user_wallet', account.address).gte('created_at', oneDayAgo).order('created_at', { ascending: true });
      if (recentJobs) {
        const used = recentJobs.length;
        setCredits(Math.max(0, 3 - used));
        if (used >= 3) setNextResetTime(new Date(new Date(recentJobs[0].created_at).getTime() + 86400000));
        else { setNextResetTime(null); setTimerString(""); }
      }
    } catch (e) { console.error(e); }
  };

  const checkLyricsCredits = async () => {
    if (!account?.address) return;
    const { data } = await supabase.from('profiles').select('lyrics_daily_count, last_lyrics_date').eq('wallet_address', account.address).single();
    if (data) {
      const lastDate = data.last_lyrics_date ? new Date(data.last_lyrics_date).getDate() : null;
      if (lastDate !== new Date().getDate()) setLyricsCredits(3);
      else setLyricsCredits(Math.max(0, 3 - (data.lyrics_daily_count || 0)));
    }
  };

  useEffect(() => { checkCredits(); checkLyricsCredits(); }, [account?.address]);
  useEffect(() => {
    if (!nextResetTime) return;
    const interval = setInterval(() => {
      const str = formatCountdown(nextResetTime);
      if (str === "") checkCredits(); else setTimerString(str);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextResetTime]);

  const handleGenerateLyrics = async () => {
    if (lyricsCredits <= 0) return toast.error("Daily lyrics limit reached (3/3).");
    const topic = userLyrics.trim() || targetTitle;
    if (!topic) return toast.error(isKorean ? "주제나 키워드를 입력해주세요." : "Please enter a topic or keywords.");
    setIsGeneratingLyrics(true);
    const toastId = toast.loading("Writing lyrics...");
    try {
      const generatedLyrics = await generateLyricsDraft(topic, etcInfo);
      const { data: profile } = await supabase.from('profiles').select('lyrics_daily_count').eq('wallet_address', account?.address).single();
      await supabase.from('profiles').update({ lyrics_daily_count: (profile?.lyrics_daily_count || 0) + 1, last_lyrics_date: new Date().toISOString() }).eq('wallet_address', account?.address);
      setLyrics(generatedLyrics); setLyricsCredits(prev => prev - 1);
      toast.success("Lyrics Drafted! Feel free to edit.", { id: toastId });
    } catch { toast.error("Failed to generate lyrics.", { id: toastId }); }
    finally { setIsGeneratingLyrics(false); }
  };

  // ─── Reusable sub-components ───────────────────────────────────────────────
  const SectionLabel = ({ children, accent = "bg-indigo-500" }: { children: React.ReactNode; accent?: string }) => (
    <div className="flex items-center gap-3 mb-7">
      <div className={`w-[3px] h-[18px] rounded-full ${accent}`} />
      <span className="text-[10px] font-black tracking-[0.22em] uppercase text-zinc-500">{children}</span>
    </div>
  );

  const SegTab = ({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
    <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5 border border-white/[0.05]">
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold tracking-wide transition-all duration-200 ${value === o.key ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-300'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const inputLineClass = "w-full bg-transparent border-b border-white/[0.08] focus:border-white/30 py-3 text-sm text-white placeholder-zinc-700 outline-none transition-colors duration-200";

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#090909] text-white font-sans flex flex-col relative selection:bg-indigo-500/20">

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-[10%] w-[700px] h-[600px] bg-indigo-950/50 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[500px] h-[500px] bg-violet-950/30 rounded-full blur-[110px]" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] bg-blue-950/20 rounded-full blur-[100px]" />
      </div>

      <audio ref={audioRef} className="hidden"
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration || 0); }}
        onEnded={handleNext}
      />
      <style jsx global>{`.create-mobile-player button:has(.lucide-heart),.create-mobile-player button:has(.lucide-zap){display:none!important}`}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 md:px-10 py-4 bg-[#090909]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <Link href="/market" className="flex items-center gap-2 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          <ChevronLeft size={14} /> Back
        </Link>
        <div className="flex items-center gap-3">
          <HelpToggle onClick={() => setShowGuide(true)} className="text-zinc-600 hover:text-white transition" />
          <button onClick={() => setIsKorean(!isKorean)}
            className="text-[10px] font-black text-zinc-600 hover:text-white tracking-widest px-3 py-1.5 rounded-full border border-white/[0.06] hover:border-white/20 transition-all">
            {isKorean ? "KR" : "EN"}
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
          <HeaderProfile />
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 md:px-10 pt-10 pb-44 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 relative z-10">

        {/* ============================================================
            LEFT PANEL
        ============================================================ */}
        <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-[4.5rem] h-fit">

          {/* Hero */}
          <div className="mb-10">
            <p className="text-[10px] font-black tracking-[0.25em] uppercase text-indigo-400/60 mb-3 flex items-center gap-2">
              <Sparkles size={10} /> {t.engine} · {t.badge}
            </p>
            <h1 className="text-[2.75rem] md:text-5xl font-black tracking-tight leading-[1.05] text-white">
              {t.welcome.replace('.', '')}<span className="text-indigo-400">.</span>
            </h1>
          </div>

          {/* ── 1. Essential ─────────────────────────────────────────────── */}
          <section className="mb-11">
            <SectionLabel accent="bg-indigo-500">{t.essential}</SectionLabel>

            {/* Reference song */}
            <div className="mb-8">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">{t.ref_song_title}</label>
              <div className="relative">
                <div className={`flex items-center gap-3 border-b pb-1 transition-colors duration-200 ${selectedSong ? 'border-indigo-500/50' : 'border-white/[0.08] focus-within:border-white/25'}`}>
                  {selectedSong?.artwork
                    ? <img src={selectedSong.artwork} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                    : <Music size={14} className="text-zinc-700 flex-shrink-0" />
                  }
                  <input value={songQuery} onChange={e => handleSongQueryChange(e.target.value)}
                    placeholder={t.ref_song_ph}
                    className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-zinc-700 outline-none" />
                  {isSongSearching && <Loader2 size={13} className="animate-spin text-zinc-700" />}
                  {selectedSong && !isSongSearching && (
                    <button onClick={() => { setSelectedSong(null); setSongQuery(''); setRefSongTitle(''); setRefSongArtist(''); }}
                      className="text-zinc-600 hover:text-white transition"><X size={13} /></button>
                  )}
                </div>

                {/* Selected meta */}
                {selectedSong && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-zinc-500 font-medium">{selectedSong.artist}</span>
                    {selectedSong.album && <span className="text-[11px] text-zinc-700">· {selectedSong.album}</span>}
                    {selectedSong.releaseYear && <span className="text-[11px] text-zinc-700">· {selectedSong.releaseYear}</span>}
                    {selectedSong.genre && (
                      <span className="text-[9px] font-bold text-indigo-400/70 uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/5">
                        {selectedSong.genre}
                      </span>
                    )}
                  </div>
                )}

                {/* Dropdown */}
                {songResults.length > 0 && !selectedSong && (
                  <div className="absolute z-50 top-[calc(100%+10px)] left-0 right-0 bg-[#131313] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                    {songResults.map(song => (
                      <button key={song.id} onClick={() => selectSong(song)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.03] last:border-0 group">
                        {song.artwork
                          ? <img src={song.artwork} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><Music size={14} className="text-zinc-700" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{song.title}</div>
                          <div className="text-[11px] text-zinc-600 truncate mt-0.5">{song.artist}{song.releaseYear && ` · ${song.releaseYear}`}</div>
                        </div>
                        {song.genre && <span className="text-[9px] text-zinc-700 uppercase tracking-wider">{song.genre}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Song title */}
            <div>
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">{t.title}</label>
              <input value={targetTitle} onChange={e => setTargetTitle(e.target.value)}
                placeholder={t.title_ph} className={inputLineClass} />
            </div>
          </section>

          {/* ── 2. Vocal Persona ──────────────────────────────────────────── */}
          <section className="mb-11">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-3">
                <div className="w-[3px] h-[18px] rounded-full bg-pink-500" />
                <span className="text-[10px] font-black tracking-[0.22em] uppercase text-zinc-500">{t.vocal_persona}</span>
              </div>
              <SegTab
                options={[{ key: 'tags', label: isKorean ? '태그' : 'Tags' }, { key: 'artist', label: isKorean ? '아티스트' : 'Artist' }]}
                value={vocalMode} onChange={v => setVocalMode(v as 'tags' | 'artist')}
              />
            </div>

            {vocalMode === 'tags' ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Gender */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">
                    {isKorean ? '성별' : 'Gender'} <span className="text-red-500/60">*</span>
                  </label>
                  <div className="flex gap-2.5">
                    {(['Male', 'Female'] as const).map(g => (
                      <button key={g}
                        onClick={() => setVocalTags(prev => ({ ...prev, gender: prev.gender === g ? undefined : g }))}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wider border transition-all duration-200 ${
                          vocalTags.gender === g
                            ? g === 'Male' ? 'bg-blue-500/10 text-blue-300 border-blue-500/35' : 'bg-pink-500/10 text-pink-300 border-pink-500/35'
                            : 'bg-transparent border-white/[0.06] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                        }`}>
                        {g === 'Male' ? '♂ Male' : '♀ Female'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced */}
                <div className="border-t border-white/[0.05] pt-4">
                  <button onClick={() => setShowDetailVox(!showDetailVox)}
                    className="w-full flex items-center justify-between group py-1">
                    <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest group-hover:text-zinc-400 transition-colors flex items-center gap-2">
                      <Settings2 size={11} />
                      {isKorean ? '정교하게 보컬 스타일 디자인하기' : 'Detail Vox Options'}
                    </span>
                    <div className="flex items-center gap-2">
                      {[vocalTags.race, vocalTags.texture, vocalTags.emotion, vocalTags.ageFeel, vocalTags.accent].filter(Boolean).length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[9px] font-black">
                          {[vocalTags.race, vocalTags.texture, vocalTags.emotion, vocalTags.ageFeel, vocalTags.accent].filter(Boolean).length}{isKorean ? '개 선택' : ' selected'}
                        </span>
                      )}
                      <ChevronDown size={13} className={`text-zinc-700 transition-transform duration-300 ${showDetailVox ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {showDetailVox && (
                    <div className="space-y-5 pt-5 animate-in slide-in-from-top-2 fade-in duration-200 pl-1 border-l border-white/[0.04] ml-1">

                      {/* Race */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-2.5 block">{isKorean ? '인종' : 'Race'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['Asian', 'Black', 'White'] as const).map(r => (
                            <button key={r}
                              onClick={() => setVocalTags(prev => ({ ...prev, race: prev.race === r ? undefined : r }))}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                                vocalTags.race === r
                                  ? 'bg-violet-500/15 border-violet-500/50 text-violet-300'
                                  : 'bg-transparent border-white/[0.07] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                              }`}>
                              {isKorean ? { Asian: '아시안', Black: '블랙', White: '화이트' }[r] : r}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Texture */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-2.5 block">{isKorean ? '보컬 텍스처' : 'Texture'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['Clean', 'Raspy', 'Breathy', 'Belting', 'Whisper'] as const).map(tex => (
                            <button key={tex}
                              onClick={() => setVocalTags(prev => ({ ...prev, texture: prev.texture === tex ? undefined : tex }))}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                                vocalTags.texture === tex
                                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                                  : 'bg-transparent border-white/[0.07] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                              }`}>
                              {isKorean ? { Clean: '클린', Raspy: '거친', Breathy: '숨섞인', Belting: '벨팅', Whisper: '속삭임' }[tex] : tex}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Emotion */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-2.5 block">{isKorean ? '감정' : 'Emotion'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['Sexy', 'Cute', 'Sad', 'Energetic'] as const).map(val => (
                            <button key={val}
                              onClick={() => setVocalTags(prev => ({ ...prev, emotion: prev.emotion === val ? undefined : val }))}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                                vocalTags.emotion === val
                                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                  : 'bg-transparent border-white/[0.07] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                              }`}>
                              {isKorean ? { Sexy: '섹시', Cute: '큐트', Sad: '슬픔', Energetic: '에너제틱' }[val] : val}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Age Feel */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-2.5 block">{isKorean ? '나이감' : 'Age Feel'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['Youthful', 'Mature', 'Aged'] as const).map(val => (
                            <button key={val}
                              onClick={() => setVocalTags(prev => ({ ...prev, ageFeel: prev.ageFeel === val ? undefined : val }))}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                                vocalTags.ageFeel === val
                                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                  : 'bg-transparent border-white/[0.07] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                              }`}>
                              {isKorean ? { Youthful: '풋풋함', Mature: '성숙함', Aged: '원숙함' }[val] : val}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Accent */}
                      <div>
                        <label className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-2.5 block">{isKorean ? '억양' : 'Accent'}</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['American', 'British', 'Korean', 'Japanese', 'Spanish', 'African'] as const).map(val => (
                            <button key={val}
                              onClick={() => setVocalTags(prev => ({ ...prev, accent: prev.accent === val ? undefined : val }))}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
                                vocalTags.accent === val
                                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                                  : 'bg-transparent border-white/[0.07] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                              }`}>
                              {isKorean
                                ? { American: '🇺🇸 미국', British: '🇬🇧 영국', Korean: '🇰🇷 한국', Japanese: '🇯🇵 일본', Spanish: '🇪🇸 스페인', African: '🌍 아프리카' }[val]
                                : val}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selected tag preview pills */}
                  {Object.values(vocalTags).some(Boolean) && (
                    <div className="flex flex-wrap gap-1.5 pt-4 animate-in fade-in duration-200">
                      {vocalTags.gender && (
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white border border-white/[0.08]">
                          {vocalTags.gender === 'Male' ? '♂' : '♀'} {vocalTags.gender} Vox
                        </span>
                      )}
                      {vocalTags.race    && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-violet-300 border border-white/[0.06]">{vocalTags.race}</span>}
                      {vocalTags.texture && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-cyan-300 border border-white/[0.06]">{vocalTags.texture}</span>}
                      {vocalTags.emotion && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-amber-300 border border-white/[0.06]">{vocalTags.emotion}</span>}
                      {vocalTags.ageFeel && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-emerald-300 border border-white/[0.06]">{vocalTags.ageFeel}</span>}
                      {vocalTags.accent  && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-orange-300 border border-white/[0.06]">{vocalTags.accent}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">{t.target_voice}</label>
                <div className="relative">
                  <div className={`flex items-center gap-3 border-b pb-1 transition-colors duration-200 ${selectedArtist ? 'border-pink-500/40' : 'border-white/[0.08] focus-within:border-white/25'}`}>
                    <Mic2 size={14} className="text-zinc-700 flex-shrink-0" />
                    <input value={artistQuery} onChange={e => handleArtistQueryChange(e.target.value)}
                      placeholder={t.target_voice_ph}
                      className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-zinc-700 outline-none" />
                    {isArtistSearching && <Loader2 size={13} className="animate-spin text-zinc-700" />}
                    {selectedArtist && !isArtistSearching && (
                      <button onClick={() => { setSelectedArtist(null); setArtistQuery(''); setTargetVoice(''); }}
                        className="text-zinc-600 hover:text-white transition"><X size={13} /></button>
                    )}
                  </div>

                  {artistResults.length > 0 && !selectedArtist && (
                    <div className="absolute z-50 top-[calc(100%+10px)] left-0 right-0 bg-[#131313] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in fade-in duration-150">
                      {artistResults.map(artist => (
                        <button key={artist.id} onClick={() => selectArtist(artist)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.03] last:border-0">
                          <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-zinc-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{artist.name}</div>
                            {artist.genre && <div className="text-[11px] text-pink-400/50 truncate mt-0.5">{artist.genre}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Selected artist subtext */}
                {selectedArtist && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in duration-150">
                    {selectedArtist.genre && <span className="text-[10px] text-pink-400/60">{selectedArtist.genre}</span>}
                    <span className="text-[10px] text-zinc-700">· {isKorean ? 'AI가 보컬 스타일 자동 분석' : 'AI analyzes vocal style automatically'}</span>
                  </div>
                )}

                <p className="text-[10px] text-zinc-700 mt-3 flex items-center gap-1.5">
                  <Sparkles size={9} className="text-pink-500/50" />
                  {isKorean ? "AI가 보컬 스타일과 성별을 자동 추출합니다." : "AI extracts vocal style & gender automatically."}
                </p>

                {/* Gender Override */}
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{isKorean ? '성별 수동 설정' : 'Gender Override'}</span>
                    <span className="text-[9px] text-zinc-700">(optional)</span>
                  </div>
                  <div className="flex gap-2">
                    {(['Male', 'Female'] as const).map(g => (
                      <button key={g}
                        onClick={() => setVocalTags(prev => ({ ...prev, gender: prev.gender === g ? undefined : g }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold tracking-wider border transition-all duration-200 ${
                          vocalTags.gender === g
                            ? g === 'Male' ? 'bg-blue-500/10 text-blue-300 border-blue-500/35' : 'bg-pink-500/10 text-pink-300 border-pink-500/35'
                            : 'bg-transparent border-white/[0.06] text-zinc-600 hover:border-white/15 hover:text-zinc-300'
                        }`}>
                        {g === 'Male' ? '♂ Male Vox' : '♀ Female Vox'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── 3. Story & Vibe ───────────────────────────────────────────── */}
          <section className="mb-11">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-3">
                <div className="w-[3px] h-[18px] rounded-full bg-amber-500" />
                <span className="text-[10px] font-black tracking-[0.22em] uppercase text-zinc-500">{t.optional}</span>
              </div>
              <SegTab
                options={[{ key: 'simple', label: 'Idea' }, { key: 'custom', label: 'Full Lyrics' }]}
                value={lyricsMode} onChange={v => setLyricsMode(v as 'simple' | 'custom')}
              />
            </div>

            <div className="space-y-7">
              <div className="relative">
                {lyricsMode === 'custom' && (
                  <button onClick={handleGenerateLyrics} disabled={isGeneratingLyrics || lyricsCredits <= 0}
                    className="absolute right-0 -top-0.5 z-10 flex items-center gap-1.5 text-[10px] font-bold text-amber-400/70 hover:text-amber-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed animate-in fade-in">
                    {isGeneratingLyrics ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    AI Writer
                    <span className="text-zinc-700 font-mono">{lyricsCredits}/3</span>
                  </button>
                )}
                <textarea value={userLyrics} onChange={e => setLyrics(e.target.value)}
                  placeholder={lyricsMode === 'simple' ? t.lyrics_concept_ph : t.lyrics_full_ph}
                  className={`w-full bg-transparent border-b text-sm text-white placeholder-zinc-700 outline-none resize-none transition-colors duration-200 scrollbar-hide py-3 ${
                    lyricsMode === 'custom' ? 'border-amber-500/20 focus:border-amber-400/30 pt-8' : 'border-white/[0.08] focus:border-white/25'
                  } ${isLyricsExpanded ? 'h-56' : 'h-24'}`}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-zinc-700">{lyricsMode === 'simple' ? t.lyrics_tip_simple : t.lyrics_tip_custom}</p>
                  <button onClick={() => setIsLyricsExpanded(!isLyricsExpanded)} className="text-zinc-700 hover:text-zinc-500 transition">
                    {isLyricsExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">{t.vibe}</label>
                <input value={etcInfo} onChange={e => setEtcInfo(e.target.value)}
                  placeholder={t.vibe_ph} className={inputLineClass} />
              </div>
            </div>
          </section>

          {/* ── 4. Generate ───────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">Credits</span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isUnlimited ? "text-amber-400" : credits === 0 ? "text-red-500/80" : "text-indigo-400"
                }`}
              >
                {isUnlimited ? "∞ Unlimited" : `${credits} / 3`}
              </span>
            </div>

            {!isUnlimited && (
              <div className="h-px w-full bg-white/[0.04] mb-7 relative overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full transition-all duration-700 ease-out ${
                    credits === 0 ? "bg-red-500/60" : "bg-gradient-to-r from-indigo-500 to-purple-400"
                  }`}
                  style={{ width: `${(credits / 3) * 100}%` }}
                />
              </div>
            )}

            <button
              onClick={handleRequestCreate}
              disabled={isSubmitting || !account?.address || (!isUnlimited && credits <= 0)}
              className="group relative w-full overflow-hidden rounded-xl p-[2px] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:scale-[1.01]"
            >
              {/* inner dark overlay (hover 시 사라짐) */}
              <div className="absolute inset-[2px] rounded-[10px] bg-zinc-900 transition-opacity duration-300 ease-in-out group-hover:opacity-0" />

              {/* content */}
              <div
                className={`relative z-10 flex w-full items-center justify-center gap-3 py-4 font-bold text-[13px] tracking-widest uppercase transition-all duration-300 ${
                  credits > 0 || isUnlimited ? "text-white" : "text-zinc-500"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={15} /> Processing...
                  </>
                ) : credits > 0 || isUnlimited ? (
                  <>
                    <Wand2
                      size={15}
                      className={`transition-all duration-300 ${
                        isUnlimited
                          ? "text-amber-400 group-hover:text-white group-hover:rotate-12"
                          : "text-indigo-200 group-hover:text-white group-hover:rotate-12"
                      }`}
                    />
                    {t.btn_generate}
                  </>
                ) : (
                  <>
                    <Clock size={15} className="text-red-500/70" /> Refill in {timerString}
                  </>
                )}
              </div>
            </button>
          </section>
        </div>

        {/* ============================================================
            RIGHT PANEL: Queue
        ============================================================ */}
        <div className="lg:col-span-7 flex flex-col gap-4 mt-10 lg:mt-0">

          {/* Queue header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-white tracking-tight">{t.queue_title}</h3>
              <span className="text-[11px] text-zinc-700 font-bold bg-white/[0.04] px-2.5 py-0.5 rounded-md">{jobs.length}</span>
            </div>
            <button onClick={fetchJobs}
              className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-700 hover:text-white transition uppercase tracking-widest">
              <RefreshCw size={11} className={loadingJobs ? "animate-spin" : ""} />
              {isKorean ? "새로고침" : "Refresh"}
            </button>
          </div>

          {loadingJobs && (
            <div className="py-32 flex flex-col items-center gap-3 text-zinc-700">
              <Loader2 className="animate-spin" size={22} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Syncing...</span>
            </div>
          )}

          {!loadingJobs && jobs.length === 0 && (
            <div className="py-32 flex flex-col items-center gap-3 text-zinc-700">
              <Disc size={34} className="opacity-20" />
              <p className="text-sm font-medium">{t.empty_queue}</p>
            </div>
          )}

          <div className="flex flex-col">
            {jobs.map((job, jobIdx) => {
              const isDone = job.status === 'done';
              const isProcessing = job.status === 'processing';
              const isExpanded = expandedJobIds.has(job.id);
              const firstTrackCover = job.result_data?.tracks?.[0]?.cover_cdn_url;

              return (
                <div key={job.id} className={`group border-b border-white/[0.04] last:border-0 transition-all duration-200 ${isExpanded ? 'bg-white/[0.02] rounded-2xl border border-white/[0.06] my-1.5' : ''}`}>

                  {/* Track row (Spotify-style) */}
                  <div onClick={() => toggleAccordion(job.id)}
                    className="flex items-center gap-4 px-3 py-3.5 cursor-pointer hover:bg-white/[0.025] rounded-2xl transition-colors group/row select-none">

                    {/* Index / status */}
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs text-zinc-700 font-mono group-hover/row:hidden">{jobIdx + 1}</span>
                      <div className={`hidden group-hover/row:flex items-center justify-center w-6 h-6 rounded-full ${
                        isDone ? 'bg-indigo-500/15' : isProcessing ? 'bg-blue-500/15' : 'bg-white/5'
                      }`}>
                        {isDone ? <Sparkles size={11} className="text-indigo-400" />
                          : isProcessing ? <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          : <Clock size={11} className="text-zinc-600" />}
                      </div>
                    </div>
                    {/* ✅ 수정된 Cover placeholder (이미지가 있으면 표시, 없으면 아이콘) */}
                    <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${
                      isDone && !firstTrackCover ? 'bg-indigo-900/40' : 'bg-white/[0.04]'
                    }`}>
                      {firstTrackCover ? (
                        <img src={firstTrackCover} alt="cover" className="w-full h-full object-cover" />
                      ) : isDone ? (
                        <Sparkles size={14} className="text-indigo-400/70" />
                      ) : isProcessing ? (
                        <Loader2 size={13} className="animate-spin text-blue-500/60" />
                      ) : (
                        <Music size={13} className="text-zinc-700" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm truncate ${isDone ? 'text-white' : 'text-zinc-500'}`}>
                        {job.target_title}
                      </div>
                      <div className="text-[10px] text-zinc-700 mt-0.5 truncate font-mono">
                        <span className={isDone ? 'text-indigo-500/70' : isProcessing ? 'text-blue-500/70' : ''}>{job.status}</span>
                        {' · '}{new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isDone && !isExpanded && (
                        <span className="text-[9px] font-bold text-indigo-400/70 border border-indigo-500/15 px-2 py-0.5 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity">
                          Ready
                        </span>
                      )}
                      <button onClick={e => handleDiscardJob(job.id, e)}
                        className="p-1.5 text-zinc-800 hover:text-red-400 transition-colors opacity-0 group-hover/row:opacity-100 rounded-lg hover:bg-red-500/8">
                        <Trash2 size={13} />
                      </button>
                      <ChevronDown size={13} className={`text-zinc-700 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-3 pb-4 pt-1 animate-in slide-in-from-top-1 fade-in duration-200">

                      {/* Ref info */}
                      <div className="mb-3.5 px-3 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Style of <span className="text-white font-semibold">{job.ref_track}</span>{' '}
                          with <span className="text-pink-400 font-semibold">{job.ref_artist}</span> vocal
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {job.genres?.slice(0, 3).map(g => (
                            <span key={g} className="text-[9px] px-2 py-0.5 bg-indigo-500/8 text-indigo-400/70 rounded-full border border-indigo-500/12 font-bold">{g}</span>
                          ))}
                          {job.moods?.slice(0, 2).map(m => (
                            <span key={m} className="text-[9px] px-2 py-0.5 bg-purple-500/8 text-purple-400/70 rounded-full border border-purple-500/12 font-bold">{m}</span>
                          ))}
                        </div>
                      </div>

                      {job.error_message && (
                        <div className="mb-3 flex items-start gap-2 text-xs text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5">
                          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                          <span>{job.error_message}</span>
                        </div>
                      )}

                      {job.result_data?.tracks && job.result_data.tracks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {job.result_data.tracks.map((track, idx) => (
                            <SunoTrackItem key={`${job.id}-${idx}`}
                              job={job} track={track} idx={idx}
                              currentTrack={currentTrack} isPlaying={isPlaying}
                              playFromFooter={playFromFooter} buildPlayerTrack={buildPlayerTrack}
                              handleGoToUpload={handleGoToUpload} t={t}
                            />
                          ))}
                        </div>
                      ) : isProcessing ? (
                        <div className="py-8 flex flex-col items-center gap-2.5 text-zinc-700">
                          <Loader2 className="animate-spin text-indigo-500/50" size={20} />
                          <span className="text-[10px] uppercase tracking-widest animate-pulse">Synthesizing Audio...</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ================================================================
          DESKTOP PLAYER BAR
      ================================================================ */}
      {currentTrack && !isPlayerMinimized && (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-[68px] items-center justify-between px-8 z-50 bg-[#0d0d0d]/96 border-t border-white/[0.05] backdrop-blur-2xl animate-in slide-in-from-bottom-3 duration-300">

          {/* Left */}
          <div className="flex items-center gap-3.5 w-[28%]">
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
              {currentTrack.cover_image_url
                ? <img src={currentTrack.cover_image_url} className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-110' : ''}`} />
                : <div className="w-full h-full flex items-center justify-center"><Disc size={18} className="text-zinc-700" /></div>
              }
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-white leading-tight">{currentTrack.title}</div>
              <div className="text-[11px] text-zinc-600 truncate">{currentTrack.artist_name}</div>
            </div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center gap-1.5 w-[44%]">
            <div className="flex items-center gap-7">
              <button onClick={handlePrev} className="text-zinc-600 hover:text-white transition-colors">
                <SkipBack size={17} fill="currentColor" />
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-md">
                {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
              </button>
              <button onClick={handleNext} className="text-zinc-600 hover:text-white transition-colors">
                <SkipForward size={17} fill="currentColor" />
              </button>
            </div>
            <div className="w-full max-w-sm flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-700 tabular-nums">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden cursor-pointer group/bar"
                onClick={e => {
                  if (!audioRef.current || !duration) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
                }}>
                <div className="h-full bg-zinc-400 group-hover/bar:bg-white rounded-full transition-colors duration-150"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <span className="text-[10px] font-mono text-zinc-700 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right */}
          <div className="w-[28%] flex justify-end items-center gap-4">
            <button onClick={() => handleGoToUpload(currentTrack.job, currentTrack.rawTrack, currentTrack.index)}
              className="flex items-center gap-2 bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-zinc-100 transition-colors">
              <UploadCloud size={12} /> {t.select}
            </button>
            <button onClick={() => setIsPlayerMinimized(true)} className="text-zinc-700 hover:text-white transition-colors">
              <Minimize2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Minimized pill */}
      {currentTrack && isPlayerMinimized && (
        <div onClick={() => setIsPlayerMinimized(false)}
          className="hidden md:flex fixed bottom-5 right-6 z-50 bg-[#141414]/95 backdrop-blur-xl border border-white/[0.07] rounded-full pl-1.5 pr-5 py-1.5 items-center gap-3 shadow-2xl cursor-pointer hover:border-white/15 transition-all duration-200 animate-in zoom-in-95 group">
          <div className="w-9 h-9 rounded-full overflow-hidden relative flex-shrink-0">
            <img src={currentTrack.cover_image_url} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-[#141414] rounded-full" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white truncate max-w-[90px]">{currentTrack.title}</div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider">{isPlaying ? 'Playing' : 'Paused'}</div>
          </div>
          <Maximize2 size={12} className="text-zinc-700 group-hover:text-white transition ml-1" />
        </div>
      )}

      {/* Mobile overlays */}
      {currentTrack && mobilePlayerOpen && (
        <>
          <div className="md:hidden create-mobile-player">
            <MobilePlayer track={currentTrack} isPlaying={isPlaying} onPlayPause={() => setIsPlaying(!isPlaying)}
              onNext={handleNext} onPrev={handlePrev} onClose={() => setMobilePlayerOpen(false)}
              repeatMode={repeatMode} onToggleRepeat={toggleRepeat} isShuffle={isShuffle} onToggleShuffle={() => setIsShuffle(!isShuffle)}
              currentTime={currentTime} duration={duration} onSeek={(val: number) => { if (audioRef.current) audioRef.current.currentTime = val; }}
              isRented={true} isLiked={false} onToggleLike={() => {}} />
          </div>
          <div className="md:hidden fixed bottom-6 left-4 right-4 z-[110]">
            <button onClick={() => handleGoToUpload(currentTrack.job, currentTrack.rawTrack, currentTrack.index)}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-2xl active:scale-[0.98] transition-transform">
              <UploadCloud size={15} /> {t.select} & Upload
            </button>
          </div>
        </>
      )}

      {currentTrack && !mobilePlayerOpen && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 bg-[#141414]/95 backdrop-blur-2xl border border-white/[0.07] rounded-2xl p-3 flex items-center gap-3 shadow-2xl z-40"
          onClick={() => setMobilePlayerOpen(true)}>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden flex-shrink-0 relative">
            {currentTrack.cover_image_url
              ? <img src={currentTrack.cover_image_url} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} />
              : <Disc size={16} className="text-zinc-700 m-auto" />
            }
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2 h-2 bg-[#141414] rounded-full" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate text-white">{currentTrack.title}</div>
            <div className="text-[11px] text-zinc-600 truncate">{currentTrack.artist_name}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black flex-shrink-0 active:scale-95 transition-transform">
            {isPlaying ? <Pause size={13} fill="black" /> : <Play size={13} fill="black" className="ml-0.5" />}
          </button>
        </div>
      )}

      <InfoModal isOpen={showGuide} onClose={() => setShowGuide(false)} data={CREATE_GUIDE_DATA} initialLang="ko" />
    </div>
  );
}