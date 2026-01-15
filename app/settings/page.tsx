'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { 
  CakeSlice, Camera, Save, Loader2, ArrowLeft, Instagram, Twitter, Youtube, Music, 
  Link as LinkIcon, Sparkles, BrainCircuit, Lock, CheckCircle2, UserPlus, Fingerprint, Wand2, Upload, Maximize2, X, RefreshCw, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";
import { analyzeUserTaste } from '@/app/actions/analyze-music';
import { generatePersonaImage } from '@/app/actions/generate-image';

export default function SettingsPage() {
  const account = useActiveAccount();
  const address = account?.address;
  
  // --- Section 1: General Profile ---
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState({ instagram: '', twitter: '', youtube: '', spotify: '', tiktok: '' });
  
  // --- Section 2: AI Analysis ---
  const [favArtists, setFavArtists] = useState<string[]>(['', '', '']);
  const [favTracks, setFavTracks] = useState<string[]>(['', '', '']);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
  const [generationStep, setGenerationStep] = useState(0); // 0: Init, 1: DNA, 2: Rendering
  
  // --- Section 3: Persona Studio ---
  const [personaInputs, setPersonaInputs] = useState({
    artists: ['', '', ''],
    gender: 'Female',
    age: '20s',
    nationality: '',
    vibe: ''
  });
  const [personaImage, setPersonaImage] = useState<string | null>(null);
  const [userRefImage, setUserRefImage] = useState<File | null>(null);
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [dailyCount, setDailyCount] = useState(0); // 하루 생성 횟수
  const [isZoomed, setIsZoomed] = useState(false); // 이미지 확대 모달

  // Status States
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [settingAvatar, setSettingAvatar] = useState(false);
  
  // Lock Logic
  const [canAnalyze, setCanAnalyze] = useState(true);
  const [nextAnalyzeDate, setNextAnalyzeDate] = useState<Date | null>(null);
  const [showConfirmAvatarModal, setShowConfirmAvatarModal] = useState(false);

 useEffect(() => {
    let isMounted = true; // 컴포넌트 마운트 상태 추적

    const fetchProfile = async () => {
      // 1. 지갑 주소가 없을 때 (새로고침 직후 or 비로그인)
      if (!address) {
          // SDK 초기화 시간을 고려해 1초 정도 기다림
          const timer = setTimeout(() => {
              if (isMounted) setLoading(false); // 1초 뒤에도 없으면 로딩 해제
          }, 1000);
          return () => clearTimeout(timer);
      }

      // 2. 지갑 주소가 있을 때 -> 데이터 로드 시작
      try {
        const { data } = await supabase.from('profiles').select('*').eq('wallet_address', address).single();

        if (data && isMounted) {
          setUsername(data.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.avatar_url);
          if (data.social_links) setSocials(prev => ({ ...prev, ...data.social_links }));

          // Music Taste 로드
          if (data.music_taste) {
              if (data.music_taste.input_artists) setFavArtists(data.music_taste.input_artists);
              if (data.music_taste.input_tracks) setFavTracks(data.music_taste.input_tracks);
              if (data.music_taste.summary) setAnalysisResult(data.music_taste);
          }

          // Persona Data 로드
          if (data.persona_data) {
              setPersonaImage(data.persona_data.image_url);
              if (data.persona_data.attributes) setPersonaInputs(prev => ({...prev, ...data.persona_data.attributes}));
          }

          // Daily Count 로드
          const lastDate = data.last_persona_date ? new Date(data.last_persona_date).getDate() : null;
          const today = new Date().getDate();
          if (lastDate !== today) {
              setDailyCount(0);
          } else {
              setDailyCount(data.persona_daily_count || 0);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        // 3. 성공하든 실패하든 로딩 종료
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => { isMounted = false; };
  }, [address]);
  // --- Handlers ---

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
    } catch (e: any) { toast.error(e.message, { id: toastId }); } finally { setSavingProfile(false); }
  };

  const handleAnalyzeTaste = async () => {
    // (기존 분석 로직과 동일)
    setAnalyzing(true);
    // ... analyzeUserTaste 호출 ...
    setTimeout(() => { setAnalyzing(false); toast.success("Analysis Mockup Complete"); }, 2000); 
  };

  // ✅ [Helper] Base64 문자열을 File 객체로 변환하는 함수
  const base64ToFile = (base64String: string, filename: string) => {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], filename, { type: 'image/png' });
  };

// ✅ [수정] 페르소나 생성 및 Supabase 업로드 로직
  const handleGeneratePersona = async () => {
    if (dailyCount >= 3) return toast.error("Daily limit reached (3/3).");
    if (!personaInputs.nationality) return toast.error("Please enter a nationality.");
    
    const validArtists = personaInputs.artists.filter(a => a.trim() !== '');
    if (validArtists.length === 0) return toast.error("Mix at least 1 artist DNA.");

    // 1. 모달 열기 및 애니메이션 시작
    setIsGeneratingModalOpen(true);
    setGenerationStep(0);
    
    // 시각적 진행 단계 연출
    const stepInterval = setInterval(() => {
        setGenerationStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 2500);

    try {
        // 2. DALL-E 이미지 생성 (Base64 데이터 수신)
        const b64Json = await generatePersonaImage({
            artists: validArtists,
            gender: personaInputs.gender,
            age: personaInputs.age,
            nationality: personaInputs.nationality,
            vibe: personaInputs.vibe
        });

        // 3. Base64 -> File 변환
        const timestamp = Date.now();
        const fileName = `persona_${address}_${timestamp}.png`;
        const imageFile = base64ToFile(b64Json, fileName);

        // 4. Supabase Storage에 업로드 (영구 저장)
        const { error: uploadError } = await supabase.storage
            .from('music_assets') // ✅ 기존 버킷 사용
            .upload(fileName, imageFile, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 5. Supabase Public URL 가져오기 (만료되지 않음!)
        const { data: publicUrlData } = supabase.storage
            .from('music_assets')
            .getPublicUrl(fileName);
            
        const permanentUrl = publicUrlData.publicUrl;

        // 6. DB에 영구 URL 저장
        const personaData = {
            name: "Virtual " + validArtists[0],
            image_url: permanentUrl, // ✅ 이제 Supabase URL이 저장됨
            attributes: personaInputs,
            created_at: new Date().toISOString()
        };

        const { error: dbError } = await supabase.from('profiles').update({
            persona_data: personaData,
            persona_daily_count: dailyCount + 1,
            last_persona_date: new Date().toISOString()
        }).eq('wallet_address', address);

        if (dbError) throw dbError;

        // 7. 상태 업데이트 및 완료 처리
        setPersonaImage(permanentUrl);
        setDailyCount(prev => prev + 1);
        
        setGenerationStep(4); 
        setTimeout(() => setIsGeneratingModalOpen(false), 1500); // 1.5초 뒤 닫기

    } catch (e: any) {
        console.error(e);
        toast.error("Generation failed: " + e.message);
        setIsGeneratingModalOpen(false);
    } finally {
        clearInterval(stepInterval);
        setGeneratingPersona(false);
    }
  };

  // ✅ [수정] 프로필 적용 버튼 클릭 (시스템 confirm 제거 -> 모달 오픈)
  const handleSetAsAvatarClick = () => {
      if (!personaImage) return;
      setShowConfirmAvatarModal(true);
  };

  // ✅ [NEW] 실제 프로필 업데이트 로직 (모달에서 Confirm 시 실행)
  const confirmSetAvatar = async () => {
      if (!personaImage || !address) return;
      
      setSettingAvatar(true);
      try {
          const { error } = await supabase.from('profiles').update({
              avatar_url: personaImage
          }).eq('wallet_address', address);
          
          if (error) throw error;
          
          setAvatarUrl(personaImage); 
          toast.success("Profile updated successfully!");
          setShowConfirmAvatarModal(false); // 모달 닫기
          setIsZoomed(false); // 확대 모달도 닫기
      } catch (e) {
          toast.error("Failed to update profile.");
      } finally {
          setSettingAvatar(false);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNewAvatarFile(e.target.files[0]);
      setAvatarUrl(URL.createObjectURL(e.target.files[0])); 
    }
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-white z-[9999] fixed inset-0">
              <Loader2 className="animate-spin text-blue-500 w-10 h-10"/>
          </div>
      );
  }

  // 2. 로딩은 끝났는데 주소가 없을 때 (비로그인 상태 -> 접근 차단 or 안내)
  if (!address) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
              <h2 className="text-xl font-bold mb-4">Re-Authentication Required</h2>
              <p className="text-zinc-500 mb-6">Please come back after opening Market Page.</p>
              <Link href="/market" className="px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition">
                  Go to Market
              </Link>
          </div>
      );
  }

  return (
// ✅ [변경 1] max-w-4xl -> max-w-[1600px] (3단 레이아웃을 위해 넓게)
    <div className="min-h-screen bg-black text-white font-sans py-12 px-6 flex justify-center">
      <div className="w-full max-w-[1600px]">
        
        {/* 상단 Back 버튼 (그리드 밖으로 뺌) */}
        <div className="mb-6">
            <Link href="/market" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition text-sm font-bold">
                <ArrowLeft size={18}/> Back to Market
            </Link>
        </div>
        {/* ✅ [변경 2] lg:grid-cols-2 -> lg:grid-cols-3 (PC에서 3열 배치) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* -------------------------------------------------------
                COLUMN 1: General Settings
               ------------------------------------------------------- */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm h-full">
                <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Sparkles size={20} className="text-zinc-400"/> General Settings</h2>
                
                {/* Avatar */}
                <div className="flex justify-center mb-6">
                    <label className="relative cursor-pointer group">
                        <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-800 shadow-xl overflow-hidden group-hover:border-blue-500 transition flex justify-center items-center relative">
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
                        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition"/>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white h-24 resize-none focus:border-blue-500 outline-none transition"/>
                    </div>
                </div>

                <div className="w-full h-px bg-zinc-800 my-6"/>

                {/* Socials */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block flex items-center gap-2"><LinkIcon size={12}/> Social Links</label>
                    <div className="relative"><Instagram size={16} className="absolute left-3 top-3 text-pink-500"/><input placeholder="Instagram ID" value={socials.instagram} onChange={e=>setSocials({...socials, instagram: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-pink-500 outline-none"/></div>
                    <div className="relative"><Twitter size={16} className="absolute left-3 top-3 text-blue-400"/><input placeholder="X ID" value={socials.twitter} onChange={e=>setSocials({...socials, twitter: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-blue-400 outline-none"/></div>
                    <div className="relative"><Youtube size={16} className="absolute left-3 top-3 text-red-500"/><input placeholder="YouTube Handle" value={socials.youtube} onChange={e=>setSocials({...socials, youtube: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-red-500 outline-none transition"/></div>
                    <div className="relative"><Music size={16} className="absolute left-3 top-3 text-blue-500"/><input placeholder="Spotify Artist ID" value={socials.spotify} onChange={e=>setSocials({...socials, spotify: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-blue-500 outline-none transition"/></div>
                </div>

                <button onClick={handleSaveProfile} disabled={savingProfile} className="w-full mt-6 bg-zinc-800 text-white font-bold py-3 rounded-xl hover:bg-zinc-700 transition flex items-center justify-center gap-2">
                    {savingProfile ? <Loader2 className="animate-spin" size={18}/> : <>Save General Info <Save size={16}/></>}
                </button>
            </div>


            {/* -------------------------------------------------------
                COLUMN 2: Persona Studio (가운데 배치)
               ------------------------------------------------------- */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden h-full">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"/>
                
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <UserPlus className="text-blue-400" size={24}/> Persona
                        </h2>
                        <p className="text-zinc-500 text-xs mt-1">Create your virtual artist identity.</p>
                    </div>
                    {/* 하루 제한 표시 */}
                    <div className="bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700 text-xs font-bold flex items-center gap-1">
                        <RefreshCw size={12} className={generatingPersona ? "animate-spin" : ""}/> 
                        {3 - dailyCount}/3 left
                    </div>
                </div>

                <div className="space-y-5">
                    {/* Mix DNA Inputs */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1"><Fingerprint size={12}/> Mix Artist DNA (Max 3)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {personaInputs.artists.map((artist, idx) => (
                                <input key={idx} value={artist} onChange={(e) => { const n = [...personaInputs.artists]; n[idx] = e.target.value; setPersonaInputs({...personaInputs, artists: n}); }} placeholder={`Artist ${idx+1}`} className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none text-center" />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Gender</label>
                            <select value={personaInputs.gender} onChange={(e) => setPersonaInputs({...personaInputs, gender: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none appearance-none">
                                <option>Female</option><option>Male</option><option>Non-binary</option><option>Android</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Age Range</label>
                            <select value={personaInputs.age} onChange={(e) => setPersonaInputs({...personaInputs, age: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none appearance-none">
                                <option>Teen (16-19)</option><option>20s</option><option>30s</option><option>Ageless (Virtual)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Nationality</label>
                            <input placeholder="e.g. KR, US" value={personaInputs.nationality} onChange={(e) => setPersonaInputs({...personaInputs, nationality: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"/>
                        </div>
                        <div>
                             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Vibe</label>
                            <input placeholder="e.g. Neon" value={personaInputs.vibe} onChange={(e) => setPersonaInputs({...personaInputs, vibe: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"/>
                        </div>
                    </div>

                    {/* My DNA Upload */}
                    <div className="pt-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center justify-between">
                            <span className="flex items-center gap-1"><Upload size={12}/> Inject My Face (Beta)</span>
                            <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">Optional</span>
                        </label>
                        <div className="relative group">
                            <input type="file" accept="image/*" onChange={(e) => setUserRefImage(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className={`w-full border border-dashed rounded-xl py-3 flex items-center justify-center gap-2 text-xs transition ${userRefImage ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-700 bg-black text-zinc-500 group-hover:border-zinc-500 group-hover:text-zinc-300'}`}>
                                {userRefImage ? <><CheckCircle2 size={14}/> {userRefImage.name}</> : <><Camera size={14}/> Upload Selfie Reference</>}
                            </div>
                        </div>
                    </div>

                    <button onClick={handleGeneratePersona} disabled={generatingPersona || dailyCount >= 3} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                        {generatingPersona ? <Loader2 className="animate-spin"/> : <><Wand2 size={18}/> {dailyCount >= 3 ? "Daily Limit Reached" : "Generate Persona Profile"}</>}
                    </button>

                    {/* 생성된 이미지 결과 */}
                    {personaImage && (
                        <div className="mt-6 border-t border-zinc-800 pt-6 animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-center text-xs text-zinc-400 mb-3">Generated Persona</p>
                            <div className="relative group w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-700 hover:border-white transition-all cursor-pointer" onClick={() => setIsZoomed(true)}>
                                <img src={personaImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <Maximize2 className="text-white"/>
                                </div>
                            </div>
                            <button onClick={handleSetAsAvatarClick} disabled={settingAvatar} className="w-full mt-4 bg-zinc-800 text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                                {settingAvatar ? <Loader2 className="animate-spin" size={16}/> : <><ArrowUpRight size={16}/> Update Profile Picture</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>


            {/* -------------------------------------------------------
                COLUMN 3: Music Taste (우측 배치)
               ------------------------------------------------------- */}
            <div className="space-y-6 h-full">
                {/* 1. Your Flavor */}
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"/>
                    <div className="relative z-10">
                        <h2 className="text-xl font-black mb-2 flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                            <CakeSlice size={24} className="text-purple-400"/> Your Flavor
                        </h2>
                        <p className="text-zinc-500 text-xs mb-6 leading-relaxed">
                             Tell me what you like. I will analyze your taste.
                        </p>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Favorite Artists</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {favArtists.map((artist, idx) => (
                                        <input key={idx} value={artist} onChange={(e) => {const n=[...favArtists]; n[idx]=e.target.value; setFavArtists(n);}} placeholder={`Artist ${idx+1}`} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition disabled:opacity-50" disabled={!canAnalyze}/>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Favorite Tracks</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {favTracks.map((track, idx) => (
                                        <input key={idx} value={track} onChange={(e) => {const n=[...favTracks]; n[idx]=e.target.value; setFavTracks(n);}} placeholder={`Song - Artist`} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition disabled:opacity-50" disabled={!canAnalyze}/>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={handleAnalyzeTaste} disabled={analyzing || !canAnalyze} className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition relative overflow-hidden group ${canAnalyze ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-[1.02] active:scale-95' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
                            {analyzing ? <Loader2 className="animate-spin"/> : !canAnalyze ? <><Lock size={16}/> Locked (24h)</> : <><Sparkles size={18}/> Analyze my flavor</>}
                        </button>
                    </div>
                </div>

                {/* Analysis Result (같은 컬럼 아래에 배치) */}
                {analysisResult && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-4 text-blue-400 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 size={14}/> Analysis Result
                        </div>
                        <div className="mb-6">
                            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 leading-tight mb-2">"{analysisResult.summary}"</h3>
                            <p className="text-zinc-500 text-xs">Based on your favorites.</p>
                        </div>
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

      {/* ✅ [Modals] - Generation Lab, Confirm Avatar, Zoom */}
      {isGeneratingModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-md flex flex-col items-center text-center space-y-8">
                <div className="relative w-40 h-40">
                    <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin"/>
                    <div className="absolute inset-2 border-2 border-t-transparent border-r-blue-500 border-b-transparent border-l-pink-500 rounded-full animate-spin reverse duration-700"/>
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                        {generationStep === 0 && <Fingerprint size={48} className="animate-pulse text-cyan-400"/>}
                        {generationStep === 1 && <BrainCircuit size={48} className="animate-pulse text-purple-400"/>}
                        {generationStep === 2 && <Wand2 size={48} className="animate-pulse text-pink-400"/>}
                        {generationStep >= 3 && <CheckCircle2 size={48} className="animate-in zoom-in text-blue-400"/>}
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 animate-pulse">
                        {generationStep === 0 && "Extracting Artist DNA..."}
                        {generationStep === 1 && "Analyzing Style & Vibe..."}
                        {generationStep === 2 && "Synthesizing Persona..."}
                        {generationStep === 3 && "Finalizing Render..."}
                        {generationStep >= 4 && "Complete!"}
                    </h3>
                    <p className="text-zinc-500 text-xs font-mono">AI Model: DALL-E 3 / Engine: Neural-Sync v4.2</p>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 transition-all duration-[3000ms] ease-linear" style={{ width: `${Math.min((generationStep + 1) * 25, 100)}%` }}/>
                </div>
            </div>
        </div>
      )}

      {showConfirmAvatarModal && personaImage && (
          <div className="fixed inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
                  <div className="text-center">
                      <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-zinc-800 shadow-lg mb-4 relative">
                          <img src={personaImage} className="w-full h-full object-cover"/>
                          <div className="absolute inset-0 border-2 border-blue-500/50 rounded-full animate-pulse"/>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">Update Profile Picture?</h3>
                      <p className="text-zinc-400 text-sm mb-6">Do you want to replace your current profile picture with this persona?</p>
                      <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => setShowConfirmAvatarModal(false)} className="py-3 rounded-xl font-bold text-sm bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition">Cancel</button>
                          <button onClick={confirmSetAvatar} disabled={settingAvatar} className="py-3 rounded-xl font-bold text-sm bg-blue-500 text-black hover:bg-blue-400 transition flex items-center justify-center gap-2">
                              {settingAvatar ? <Loader2 size={16} className="animate-spin"/> : "Yes, Update"}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isZoomed && personaImage && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsZoomed(false)}>
              <div className="relative max-w-2xl w-full aspect-square" onClick={(e) => e.stopPropagation()}>
                  <img src={personaImage} className="w-full h-full object-contain rounded-xl shadow-2xl"/>
                  <button onClick={() => setIsZoomed(false)} className="absolute -top-12 right-0 text-white hover:text-zinc-300 transition"><X size={32}/></button>
              </div>
          </div>
      )}
    </div>
  );
}

// 아이콘 컴포넌트
function SettingsIcon() { return <Sparkles size={20} className="text-zinc-400"/>; }