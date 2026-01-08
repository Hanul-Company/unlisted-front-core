'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "@/lib/i18n";
import { CakeSlice, Camera, Save, Loader2, ArrowLeft, Instagram, Twitter, Youtube, Music, Link as LinkIcon, Sparkles, BrainCircuit, Lock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { analyzeUserTaste } from '@/app/actions/analyze-music';

export default function SettingsPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();
  
  // --- Section 1: General Profile ---
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState({ instagram: '', twitter: '', youtube: '', spotify: '', tiktok: '' });
  
  // --- Section 2: AI Analysis ---
  const [favArtists, setFavArtists] = useState<string[]>(['', '', '']);
  const [favTracks, setFavTracks] = useState<string[]>(['', '', '']);
  const [analysisResult, setAnalysisResult] = useState<any>(null); // 분석 결과 시각화용
  
  // Status States
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false); // 프로필 저장 중
  const [analyzing, setAnalyzing] = useState(false);       // AI 분석 중
  
  // 24h Lock Logic
  const [canAnalyze, setCanAnalyze] = useState(true);
  const [nextAnalyzeDate, setNextAnalyzeDate] = useState<Date | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) return;
      
      const { data } = await supabase.from('profiles').select('*').eq('wallet_address', address).single();

      if (data) {
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
        if (data.social_links) setSocials(prev => ({ ...prev, ...data.social_links }));

        // Load Music Taste & Check Lock
        if (data.music_taste) {
            if (data.music_taste.input_artists) setFavArtists(data.music_taste.input_artists);
            if (data.music_taste.input_tracks) setFavTracks(data.music_taste.input_tracks);
            
            // 기존 분석 결과가 있으면 UI에 표시
            if (data.music_taste.summary) {
                setAnalysisResult(data.music_taste);
            }

            // 24시간 제한 체크
            if (data.music_taste.updated_at) {
                const lastUpdate = new Date(data.music_taste.updated_at);
                const now = new Date();
                const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
                
                // 🚨 테스트 완료 후 주석 해제 (지금은 테스트 위해 항상 true)
                // if (diffHours < 24) {
                //     setCanAnalyze(false);
                //     setNextAnalyzeDate(new Date(lastUpdate.getTime() + (24 * 60 * 60 * 1000)));
                // }
            }
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [address]);

  // --------------------------------------------------------
  // Action 1: Save General Profile (Unlimited)
  // --------------------------------------------------------
  const handleSaveProfile = async () => {
    if (!address) return;
    setSavingProfile(true);
    const toastId = toast.loading("Saving changes...");

    try {
      let finalAvatarUrl = avatarUrl;
      if (newAvatarFile) {
        const fileName = `avatar_${address}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('music_assets').upload(fileName, newAvatarFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('music_assets').getPublicUrl(fileName);
        finalAvatarUrl = data.publicUrl;
      }

      const { error } = await supabase.from('profiles').update({
        username, bio, avatar_url: finalAvatarUrl, social_links: socials
      }).eq('wallet_address', address);

      if (error) throw error;
      toast.success("General info updated!", { id: toastId });
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setSavingProfile(false);
    }
  };

  // --------------------------------------------------------
  // Action 2: Analyze Taste (Once per 24h)
  // --------------------------------------------------------
  const handleAnalyzeTaste = async () => {
    if (!address) return;
    if (!canAnalyze) return toast.error(`Try again after ${nextAnalyzeDate?.toLocaleTimeString()}`);

    const cleanArtists = favArtists.filter(s => s.trim() !== '');
    const cleanTracks = favTracks.filter(s => s.trim() !== '');

    if (cleanArtists.length === 0 && cleanTracks.length === 0) return toast.error("Please enter at least one artist or song.");

    setAnalyzing(true);
    const toastId = toast.loading("AI is analyzing your musical DNA...");

    try {
        const result = await analyzeUserTaste(cleanArtists, cleanTracks);
        
        if (!result) throw new Error("AI Analysis failed. Try again.");

        const musicTasteData = {
            ...result,
            input_artists: favArtists,
            input_tracks: favTracks,
            updated_at: new Date().toISOString()
        };

        // DB에 취향 정보만 별도로 업데이트
        const { error } = await supabase.from('profiles').update({
            music_taste: musicTasteData
        }).eq('wallet_address', address);

        if (error) throw error;

        setAnalysisResult(musicTasteData); // 화면에 즉시 반영
        setCanAnalyze(false); // 락 걸기
        
        // 다음 업데이트 가능 시간 계산 (UI 표시용)
        const now = new Date();
        setNextAnalyzeDate(new Date(now.getTime() + (24 * 60 * 60 * 1000)));

        toast.success("Analysis Complete!", { id: toastId });
    } catch (e: any) {
        toast.error(e.message, { id: toastId });
    } finally {
        setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNewAvatarFile(e.target.files[0]);
      setAvatarUrl(URL.createObjectURL(e.target.files[0])); 
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-green-500"/></div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans py-12 px-4 flex justify-center">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* =======================================================
            LEFT COLUMN: General Profile Settings
           ======================================================= */}
        <div className="space-y-6">
            <Link href="/market" className="flex items-center gap-2 text-zinc-500 hover:text-white transition text-sm font-bold mb-4"><ArrowLeft size={18}/> Back</Link>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-black mb-6 flex items-center gap-2"><SettingsIcon/> General Settings</h2>
                
                {/* Avatar */}
                <div className="flex justify-center mb-6">
                    <label className="relative cursor-pointer group">
                        <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-800 shadow-xl overflow-hidden group-hover:border-green-500 transition flex justify-center items-center relative">
                            {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : <Camera className="text-zinc-600" size={24}/>}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] font-bold">CHANGE</div>
                        </div>
                        <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                    </label>
                </div>

                {/* Inputs */}
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Username</label>
                        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-green-500 outline-none transition"/>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white h-24 resize-none focus:border-green-500 outline-none transition"/>
                    </div>
                </div>

                <div className="w-full h-px bg-zinc-800 my-6"/>

                {/* Socials */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block flex items-center gap-2"><LinkIcon size={12}/> Social Links</label>
                    <div className="relative"><Instagram size={16} className="absolute left-3 top-3 text-pink-500"/><input placeholder="Instagram ID" value={socials.instagram} onChange={e=>setSocials({...socials, instagram: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-pink-500 outline-none"/></div>
                    <div className="relative"><Twitter size={16} className="absolute left-3 top-3 text-blue-400"/><input placeholder="X ID" value={socials.twitter} onChange={e=>setSocials({...socials, twitter: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-blue-400 outline-none"/></div>
                    <div className="relative"><Youtube size={16} className="absolute left-3 top-3 text-red-500"/><input placeholder="YouTube Handle" value={socials.youtube} onChange={e=>setSocials({...socials, youtube: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-red-500 outline-none transition"/></div>
                    <div className="relative"><Music size={16} className="absolute left-3 top-3 text-green-500"/><input placeholder="Spotify Artist ID" value={socials.spotify} onChange={e=>setSocials({...socials, spotify: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-green-500 outline-none transition"/></div>
                </div>

                <button onClick={handleSaveProfile} disabled={savingProfile} className="w-full mt-6 bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-zinc-700 transition flex items-center justify-center gap-2">
                    {savingProfile ? <Loader2 className="animate-spin" size={18}/> : <>Save General Info <Save size={16}/></>}
                </button>
            </div>
        </div>

        {/* =======================================================
            RIGHT COLUMN: AI Music Taste
           ======================================================= */}
        <div className="space-y-6 lg:pt-10">
            <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"/>

                <div className="relative z-10">
                    <h2 className="text-xl font-black mb-2 flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        <CakeSlice size={24} className="text-purple-400"/> Your Flavor
                    </h2>
                    <p className="text-zinc-500 text-xs mb-6 leading-relaxed">
                        Tell me what you like. I will analyze your taste and make your own flavor to get you tasty musics.
                    </p>

                    {/* Input Fields */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Favorite Artists (Max 3)</label>
                            <div className="grid grid-cols-1 gap-2">
                                {favArtists.map((artist, idx) => (
                                    <input key={idx} value={artist} onChange={(e) => {const n=[...favArtists]; n[idx]=e.target.value; setFavArtists(n);}} placeholder={`Artist ${idx+1}`} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition disabled:opacity-50" disabled={!canAnalyze}/>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Favorite Tracks (Max 3)</label>
                            <div className="grid grid-cols-1 gap-2">
                                {favTracks.map((track, idx) => (
                                    <input key={idx} value={track} onChange={(e) => {const n=[...favTracks]; n[idx]=e.target.value; setFavTracks(n);}} placeholder={`Song - Artist`} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition disabled:opacity-50" disabled={!canAnalyze}/>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Analyze Button */}
                    <button 
                        onClick={handleAnalyzeTaste} 
                        disabled={analyzing || !canAnalyze} 
                        className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition relative overflow-hidden group ${canAnalyze ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-[1.02] active:scale-95' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                    >
                        {analyzing ? <Loader2 className="animate-spin"/> : 
                         !canAnalyze ? <><Lock size={16}/> Locked until {nextAnalyzeDate?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</> : 
                         <><Sparkles size={18}/> Analyze my flavor</>
                        }
                    </button>
                </div>
            </div>

            {/* ✅ [RESULT CARD] 분석 결과 시각화 */}
            {analysisResult && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 animate-in slide-in-from-bottom-5 fade-in duration-700">
                    <div className="flex items-center gap-2 mb-4 text-green-400 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 size={14}/> Analysis Result
                    </div>
                    
                    {/* 1. One-Sentence Summary */}
                    <div className="mb-6">
                        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 leading-tight mb-2">
                            "{analysisResult.summary}"
                        </h3>
                        <p className="text-zinc-500 text-xs">Based on your favorites.</p>
                    </div>

                    {/* 2. Visual Tags Cloud */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-[10px] font-bold text-zinc-600 uppercase block mb-2">Dominant Genres</span>
                            <div className="flex flex-wrap gap-2">
                                {analysisResult.expanded_genres?.map((g:string) => (
                                    <span key={g} className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold">{g}</span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-zinc-600 uppercase block mb-2">Mood & Vibe</span>
                            <div className="flex flex-wrap gap-2">
                                {analysisResult.expanded_moods?.map((m:string) => (
                                    <span key={m} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">{m}</span>
                                ))}
                                {analysisResult.expanded_tags?.slice(0, 5).map((t:string) => (
                                    <span key={t} className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs">{t}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}

// 아이콘 컴포넌트 (편의상 추가)
function SettingsIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>; }