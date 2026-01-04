'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { generateSunoPrompt } from '@/app/actions/generate-suno-prompt';
import { useActiveAccount } from "thirdweb/react"; 
import HeaderProfile from '../components/HeaderProfile'; // ✅ 기존 컴포넌트 사용
import { 
  Loader2, Mic2, Disc, UploadCloud, Play, Pause, Trash2, 
  Clock, RefreshCw, AlertCircle, Wand2, Menu 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from "@/lib/i18n";

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

type SunoJob = {
  id: number;
  target_title: string;
  ref_artist: string;
  status: JobStatus;
  created_at: string;
  result_data: {
    tracks?: {
      title: string;
      audio_url: string;
      cover_url: string;
      tags: string;
    }[]
  } | null;
  error_message?: string;
};

export default function CreateDashboard() {
  const account = useActiveAccount(); 
  const router = useRouter();
  
  // --- Tabs ---
  const [activeTab, setActiveTab] = useState<'new' | 'queue'>('new');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 모바일 메뉴용 (Header 호환)

  // --- Input State ---
  const [refTrack, setRefTrack] = useState('');
  const [refArtist, setRefArtist] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [etcInfo, setEtcInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Queue State ---
  const [jobs, setJobs] = useState<SunoJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // --- Preview State ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedTrackIdx, setSelectedTrackIdx] = useState<number | null>(null);

  // 1. 초기 로드
  useEffect(() => {
    if (account?.address) {
      fetchJobs();
      
      const channel = supabase
        .channel('suno_jobs_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'suno_jobs', filter: `user_wallet=eq.${account.address}` },
          (payload) => { fetchJobs(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [account?.address, activeTab]);

  const fetchJobs = async () => {
    if (!account?.address) return;
    setLoadingJobs(true);
    const { data } = await supabase
      .from('suno_jobs')
      .select('*')
      .eq('user_wallet', account.address)
      .order('created_at', { ascending: false });
    
    if (data) setJobs(data);
    setLoadingJobs(false);
  };

  // 2. 작업 요청
  const handleRequestCreate = async () => {
    if (!account?.address) return toast.error("지갑을 연결해주세요.");
    if (!refTrack || !refArtist || !targetTitle) return toast.error("필수 정보를 입력해주세요.");

    try {
      setIsSubmitting(true);
      toast.loading("스타일 분석 및 작업 대기열 등록 중...");

      // A. GPT 분석 요청 (새로운 로직)
      const analyzedData = await generateSunoPrompt(refTrack, refArtist, targetTitle, lyrics, etcInfo);
      
      if (!analyzedData) throw new Error("분석 실패. 다시 시도해주세요.");

      // B. DB Queue에 삽입 (컬럼 추가됨)
      const { error } = await supabase.from('suno_jobs').insert({
        user_wallet: account.address,
        ref_track: refTrack,
        ref_artist: refArtist,
        target_title: analyzedData.title,
        lyrics: analyzedData.lyrics,
        etc_info: etcInfo,
        
        // ✅ [핵심] 분석된 데이터 저장
        gpt_prompt: analyzedData.prompt, // Suno에게 던질 최종 문자열
        genres: analyzedData.genres,     // 나중에 마켓 업로드 시 사용
        moods: analyzedData.moods,
        tags: analyzedData.tags,
        
        status: 'pending'
      });

      if (error) throw error;

      toast.dismiss();
      toast.success("작업이 대기열에 등록되었습니다!");
      
      // 초기화 및 탭 이동
      setRefTrack(''); setRefArtist(''); setTargetTitle(''); setLyrics(''); setEtcInfo('');
      setActiveTab('queue');
      fetchJobs();

    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Play/Publish Logic
  const togglePlay = (url: string) => {
    if (!audioRef.current) return;
    if (playingUrl === url) {
      audioRef.current.pause();
      setPlayingUrl(null);
    } else {
      audioRef.current.src = url;
      audioRef.current.play();
      setPlayingUrl(url);
    }
  };

  const handlePublish = async (job: SunoJob, trackIdx: number) => {
    if (!job.result_data?.tracks || !account?.address) return;
    const track = job.result_data.tracks[trackIdx];
    const toastId = toast.loading("마켓에 업로드 중...");

    try {
        const { error } = await supabase.from('tracks').insert({
            title: track.title,
            artist_name: `${job.ref_artist} Style (AI)`,
            audio_url: track.audio_url,
            cover_image_url: track.cover_url,
            genre: "AI Generated",
            ai_metadata: { 
                vibe_tags: track.tags.split(',').map((t:string) => t.trim()),
                ref_artists: [job.ref_artist]
            },
            uploader_address: account.address,
            creation_type: 'ai',
            investor_share: 3000
        });

        if (error) throw error;
        await supabase.from('suno_jobs').delete().eq('id', job.id);
        toast.success("발행 완료!", { id: toastId });
        router.push('/market');

    } catch (e: any) {
        toast.error("발행 실패: " + e.message, { id: toastId });
    }
  };

  const handleDeleteJob = async (id: number) => {
    if(!confirm("삭제하시겠습니까?")) return;
    await supabase.from('suno_jobs').delete().eq('id', id);
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <audio ref={audioRef} onEnded={() => setPlayingUrl(null)} className="hidden"/>

      {/* ✅ [Header] 기존 스타일 적용 */}
      <header className="flex justify-between items-center p-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-800">
          <div className="flex items-center gap-4">
             {/* 모바일 메뉴 버튼 (필요시 기능 연결) */}
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu/></button>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                AI Studio
             </h1>
          </div>
          <div className="flex items-center gap-3"> 
             {/* 토큰 밸런스 등이 있다면 여기에 추가 */}
             <HeaderProfile /> 
          </div>
      </header>

      {/* ✅ [Main Content] */}
      <main className="max-w-4xl mx-auto p-6 pb-20">
        
        {/* Intro & Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
                <p className="text-zinc-500 text-sm">Create, Queue, and Publish your AI music.</p>
            </div>
            
            <div className="flex bg-zinc-900 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('new')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'new' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    New Request
                </button>
                <button 
                    onClick={() => setActiveTab('queue')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'queue' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Job Queue
                    {jobs.filter(j => j.status === 'processing').length > 0 && (
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                    )}
                </button>
            </div>
        </div>

        {/* === TAB 1: NEW REQUEST === */}
        {activeTab === 'new' && (
            <div className="animate-in fade-in slide-in-from-left-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-4">
                        <h3 className="font-bold flex items-center gap-2 text-green-400"><Disc size={18}/> Essential Info</h3>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Ref Track</label>
                            <input value={refTrack} onChange={e=>setRefTrack(e.target.value)} placeholder="e.g. Ditto - NewJeans" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-green-500 outline-none"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Target Voice</label>
                            <input value={refArtist} onChange={e=>setRefArtist(e.target.value)} placeholder="e.g. NewJeans" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-green-500 outline-none"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Song Title</label>
                            <input value={targetTitle} onChange={e=>setTargetTitle(e.target.value)} placeholder="New Song Title" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-green-500 outline-none"/>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 space-y-4">
                            <h3 className="font-bold flex items-center gap-2 text-zinc-400"><Mic2 size={18}/> Optional</h3>
                            <textarea value={lyrics} onChange={e=>setLyrics(e.target.value)} placeholder="Lyrics (Optional)" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm h-24 focus:border-zinc-500 outline-none resize-none"/>
                            <input value={etcInfo} onChange={e=>setEtcInfo(e.target.value)} placeholder="Extra style requirements..." className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-zinc-500 outline-none"/>
                        </div>

                        <button 
                            onClick={handleRequestCreate}
                            disabled={isSubmitting || !account?.address}
                            className="w-full py-4 bg-white text-black font-black rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Wand2 size={18}/> Add to Queue</>}
                        </button>
                        {!account?.address && <p className="text-center text-xs text-red-500">Please connect wallet via header profile.</p>}
                    </div>
                </div>
            </div>
        )}

        {/* === TAB 2: JOB QUEUE === */}
        {activeTab === 'queue' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-5">
                <div className="flex justify-between items-center px-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase">Your Jobs ({jobs.length})</span>
                    <button onClick={fetchJobs} className="text-zinc-500 hover:text-white"><RefreshCw size={14}/></button>
                </div>

                {loadingJobs && <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-zinc-500"/></div>}
                
                {!loadingJobs && jobs.length === 0 && (
                    <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                        No jobs in queue.
                    </div>
                )}

                {jobs.map((job) => (
                    <div key={job.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition hover:border-zinc-700">
                        <div className="p-4 flex items-center justify-between bg-zinc-950/30">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${job.status === 'completed' ? 'bg-green-500' : job.status === 'processing' ? 'bg-blue-500 animate-pulse' : job.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}/>
                                <div>
                                    <h3 className="font-bold text-sm text-white">{job.target_title}</h3>
                                    <p className="text-xs text-zinc-500">{new Date(job.created_at).toLocaleString()} • {job.ref_artist} Style</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${job.status === 'completed' ? 'bg-green-900/30 text-green-400' : job.status === 'processing' ? 'bg-blue-900/30 text-blue-400' : job.status === 'failed' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                    {job.status}
                                </span>
                                <button onClick={() => handleDeleteJob(job.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>

                        {job.status === 'pending' && <div className="p-4 text-xs text-zinc-500 flex items-center gap-2"><Clock size={14}/> Waiting for worker...</div>}
                        {job.status === 'processing' && <div className="p-4 text-xs text-blue-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Generating music on AI server...</div>}
                        {job.status === 'failed' && <div className="p-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle size={14}/> Error: {job.error_message || "Unknown error"}</div>}

                        {job.status === 'completed' && job.result_data?.tracks && (
                            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                                <p className="text-xs text-zinc-500 mb-3 font-bold uppercase">Generated Versions</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {job.result_data.tracks.map((track, tIdx) => (
                                        <div key={tIdx} className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedJobId === job.id && selectedTrackIdx === tIdx ? 'bg-green-500/10 border-green-500' : 'bg-black border-zinc-800 hover:border-zinc-600'}`} onClick={() => { setSelectedJobId(job.id); setSelectedTrackIdx(tIdx); }}>
                                            <div className="w-12 h-12 bg-zinc-800 rounded shrink-0 overflow-hidden relative group">
                                                <img src={track.cover_url} className="w-full h-full object-cover"/>
                                                <button onClick={(e) => { e.stopPropagation(); togglePlay(track.audio_url); }} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                    {playingUrl === track.audio_url ? <Pause fill="white" size={16}/> : <Play fill="white" size={16}/>}
                                                </button>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-sm truncate">{track.title}</div>
                                                <div className="text-[10px] text-zinc-500 truncate">{track.tags}</div>
                                            </div>
                                            {selectedJobId === job.id && selectedTrackIdx === tIdx && (
                                                <button onClick={(e) => { e.stopPropagation(); handlePublish(job, tIdx); }} className="bg-green-500 text-black text-xs font-bold px-3 py-1.5 rounded-full hover:scale-105 transition flex items-center gap-1 shadow-lg">
                                                    <UploadCloud size={12}/> Publish
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}