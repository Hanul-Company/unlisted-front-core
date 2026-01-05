'use client';
import { analyzeTrackMetadata } from '@/app/actions/analyze-music';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '@/app/constants';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle, TrendingUp, Search, Hash, Bot, UploadCloud, Music, Loader2, ArrowLeft, Plus, Trash2, User, Image as ImageIcon, X, ChevronDown, Smile, Disc } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useRouter } from "../../lib/i18n";
import { Link } from "../../lib/i18n";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/image';
import toast from 'react-hot-toast';
import { useActiveAccount } from "thirdweb/react";
import * as mm from 'music-metadata-browser';
import { useSearchParams } from 'next/navigation';

type Contributor = { address: string; share: string; role: string; };

export default function UploadPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Refs for Dropdowns (Click Outside)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLDivElement>(null);
  const genreInputRef = useRef<HTMLDivElement>(null);
  const moodInputRef = useRef<HTMLDivElement>(null);

  // --- Audio State ---
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [creationType, setCreationType] = useState<'ai' | 'human'>('ai');
  
  // --- Image State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isManualImage, setIsManualImage] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [contributors, setContributors] = useState<Contributor[]>([
    { address: '', share: '100', role: 'Main Artist' } 
  ]);

  // --- Meta Data State ---
  const [bpm, setBpm] = useState<string>('');
  
  // 1. Tags Logic
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // 2. Genre Logic (✅ REFACTORED: Array Support)
  const [genres, setGenres] = useState<string[]>([]); 
  const [genreSearch, setGenreSearch] = useState('');
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);

  // 3. Mood Logic
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [moodSearch, setMoodSearch] = useState('');
  const [isMoodDropdownOpen, setIsMoodDropdownOpen] = useState(false);

  // 4. Reference Logic
  const [refArtist, setRefArtist] = useState('');
  const [refTrack, setRefTrack] = useState('');

  // 5. Investor Share Logic
  const [investorShare, setInvestorShare] = useState<number>(30);

  // Suno Job Linking
  const [sunoJobId, setSunoJobId] = useState<string | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Computed Values
  const currentTotalShare = contributors.reduce((sum, c) => sum + Number(c.share || 0), 0);

  // --- Effects ---
  useEffect(() => {
    if (address) {
      setContributors(prev => {
        if (prev[0].address === address) return prev;
        const newContributors = [...prev];
        newContributors[0] = { ...newContributors[0], address: address, role: 'Main Artist' };
        return newContributors;
      });
    }
  }, [address]);

  // Click Outside Handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (tagInputRef.current && !tagInputRef.current.contains(target)) setIsTagDropdownOpen(false);
      if (genreInputRef.current && !genreInputRef.current.contains(target)) setIsGenreDropdownOpen(false);
      if (moodInputRef.current && !moodInputRef.current.contains(target)) setIsMoodDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Auto-Fill from Query Params (Suno Integration)
  useEffect(() => {
    const initFromParams = async () => {
        const pTitle = searchParams.get('title');
        const pAudioUrl = searchParams.get('audioUrl');
        const pCoverUrl = searchParams.get('coverUrl');
        const pGenres = searchParams.get('genres');
        const pMoods = searchParams.get('moods');
        const pTags = searchParams.get('tags');
        const pJobId = searchParams.get('jobId');
        const pRefInfo = searchParams.get('refInfo');

        if (pAudioUrl && pTitle) {
            setIsAutoFilling(true);
            const toastId = toast.loading("Importing from AI Studio...");
            
            try {
                // A. Basic Info
                setTitle(pTitle);
                setSunoJobId(pJobId);
                
                if (pRefInfo) {
                    const parts = pRefInfo.split(' by ');
                    if (parts.length === 2) {
                        setRefTrack(parts[0]);
                        setRefArtist(parts[1]);
                    }
                }

                // B. Tags (Fix: Handle string[] correctly)
                // ✅ 수정 1: 콤마로 쪼개서 배열로 저장
                if (pGenres) setGenres(pGenres.split(',').slice(0, 3)); 
                if (pMoods) setSelectedMoods(pMoods.split(',').slice(0, 3));
                if (pTags) setSelectedTags(pTags.split(',').slice(0, 10));

                // C. Audio File
                const audioRes = await fetch(pAudioUrl);
                const audioBlob = await audioRes.blob();
                const audioFile = new File([audioBlob], `${pTitle}.mp3`, { type: 'audio/mpeg' });
                setFile(audioFile);

                // D. Cover Image
                if (pCoverUrl) {
                    const imgRes = await fetch(pCoverUrl);
                    const imgBlob = await imgRes.blob();
                    setCroppedImageBlob(imgBlob);
                    setIsManualImage(true);
                    setImageSrc(URL.createObjectURL(imgBlob));
                }

                toast.success("Import successful!", { id: toastId });

            } catch (e) {
                console.error(e);
                toast.error("Failed to import AI tracks.", { id: toastId });
            } finally {
                setIsAutoFilling(false);
            }
        }
    };

    if (searchParams.get('audioUrl') && !file && !isAutoFilling) {
        initFromParams();
    }
  }, [searchParams]);

  // --- File Handlers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('audio/')) return toast.error('Audio files only.');

      setFile(selectedFile);
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));

      try {
        const metadata = await mm.parseBlob(selectedFile);
        const picture = metadata.common.picture?.[0];
        if (picture && !isManualImage) {
            const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
            setCroppedImageBlob(blob);
            toast.success("Found embedded cover art.");
        }
      } catch (error) { console.log("Metadata error:", error); }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => { setImageSrc(reader.result as string); setShowCropModal(true); });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => setCroppedAreaPixels(croppedAreaPixels), []);
  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedImageBlob(croppedBlob);
      setIsManualImage(true);
      setShowCropModal(false);
    } catch (e) { console.error(e); }
  };

  // --- Search & Filter Logic ---
  const filteredGenres = MUSIC_GENRES.filter(g => 
    g.toLowerCase().includes(genreSearch.toLowerCase()) && !genres.includes(g)
  );

  const filteredMoods = MUSIC_MOODS.filter(m => 
    m.toLowerCase().includes(moodSearch.toLowerCase()) && 
    !selectedMoods.includes(m)
  );

  const filteredTags = MUSIC_TAGS.filter(t => 
    t.toLowerCase().includes(tagSearch.toLowerCase()) && 
    !selectedTags.includes(t)
  );

  const handleGenreSelect = (g: string) => {
      if (genres.length >= 3) return toast.error("Max 3 genres allowed.");
      setGenres([...genres, g]);
      setGenreSearch('');
      setIsGenreDropdownOpen(false);
  };

  const handleMoodSelect = (m: string) => {
    if (selectedMoods.length >= 3) return toast.error("Max 3 moods allowed.");
    setSelectedMoods([...selectedMoods, m]);
    setMoodSearch('');
    setIsMoodDropdownOpen(false);
  };

  const handleTagAdd = (t: string) => {
    if (selectedTags.length >= 10) return toast.error("Max 10 tags allowed.");
    setSelectedTags([...selectedTags, t]);
    setTagSearch('');
  };

  // --- Upload Logic ---
  const handleUpload = async () => {
    if (!file || !title) return toast.error("Please choose a file and enter a title.");
    // ✅ 수정 2: 배열 길이로 유효성 검사
    if (genres.length === 0) return toast.error("Please select at least one genre.");
    const totalShare = contributors.reduce((sum, c) => sum + Number(c.share), 0);
    if (totalShare !== 100) return toast.error("Revenue split must total 100%.");

    try {
      setUploading(true);
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      
      let artistName = "Anonymous";
      let artistId = null;
      if (address) {
        const { data: profile } = await supabase.from('profiles').select('id, username').eq('wallet_address', address).single();
        if (profile) { artistName = profile.username || "Anonymous"; artistId = profile.id; }
      }

      // 1. AI Analysis 실행
      let aiMetadataResult = {
          ref_artists: refArtist ? [refArtist] : [],
          ref_tracks: refTrack ? [refTrack] : [],
          similar_artists: [] as string[], 
          voice_style: [] as string[],     
          vibe_tags: [] as string[],       
          analyzed_genres: [] as string[], 
          analyzed_moods: [] as string[]   
      };

      if (refArtist || refTrack) {
          toast.loading("AI analyzing track metadata...", { duration: 2000 });
          // 주의: analyzeTrackMetadata 함수도 genres(배열)를 받도록 수정되어 있어야 함
          const analysis = await analyzeTrackMetadata(refArtist, refTrack, genres, selectedMoods);
          if (analysis) {
              aiMetadataResult = { ...aiMetadataResult, ...analysis };
          }
      }

      // 2. Audio Upload
      const audioName = `${timestamp}_${safeTitle}.mp3`;
      const { error: audioErr } = await supabase.storage.from('music_assets').upload(audioName, file);
      if (audioErr) throw audioErr;
      const { data: { publicUrl: audioUrl } } = supabase.storage.from('music_assets').getPublicUrl(audioName);

      // 3. Cover Upload
      let coverUrl = null;
      if (croppedImageBlob) {
        const imageName = `${timestamp}_${safeTitle}_cover.jpg`;
        const { error: imgErr } = await supabase.storage.from('music_assets').upload(imageName, croppedImageBlob);
        if (imgErr) throw imgErr;
        const { data: { publicUrl } } = supabase.storage.from('music_assets').getPublicUrl(imageName);
        coverUrl = publicUrl;
      } else {
        coverUrl = '/images/default_cover.jpg';
      }

      // 4. DB Insert
      const { data: newTrack, error: dbError } = await supabase
        .from('tracks')
        .insert([{
            title, description, lyrics, audio_url: audioUrl, cover_image_url: coverUrl,
            // ✅ 수정 3: genres 배열을 DB 'genre' 컬럼(text[])에 매핑
            genre: genres, 
            moods: selectedMoods, 
            bpm: bpm ? parseInt(bpm) : null,
            context_tags: selectedTags,
            investor_share: investorShare * 100,
            
            ai_metadata: aiMetadataResult,

            uploader_address: address, artist_name: artistName, creation_type: creationType, artist_id: artistId,
        }])
        .select().single();

      if (dbError) throw dbError;

      // Update Suno Job
      if (sunoJobId) {
         await supabase.from('suno_jobs').update({ 
             status: 'published',
             published_track_id: newTrack.id,
             uploaded_track_id: newTrack.id
         }).eq('id', sunoJobId);
      }

      // 5. Contributors
      const contributorsData = contributors.map(c => ({ track_id: newTrack.id, wallet_address: c.address, role: c.role, share_percentage: Number(c.share) }));
      await supabase.from('track_contributors').insert(contributorsData);

      toast.dismiss();
      toast.success('Upload complete!');
      router.push('/market');

    } catch (error: any) {
      toast.dismiss();
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Contributors Helpers (생략 없이 유지)
  const addContributor = () => setContributors(p => [...p, { address: '', share: '0', role: 'Contributor' }]);
  const removeContributor = (i: number) => setContributors(p => { const n = [...p]; n.splice(i, 1); const sum = n.reduce((s, c, x) => x===0 ? s : s + Number(c.share||0), 0); if(n[0]) n[0].share = String(Math.max(0, 100 - sum)); return n; });
  const updateContributor = (i: number, f: keyof Contributor, v: string) => setContributors(p => { const n = [...p]; if(f!=='share') { n[i] = {...n[i], [f]: v}; return n; } let val = Math.max(0, Math.min(100, Number(v))); if(i===0) { const others = p.reduce((s, c, x) => x===0 ? s : s+Number(c.share||0), 0); n[0].share = String(Math.min(val, Math.max(0, 100 - others))); } else { const othersExMe = p.reduce((s, c, x) => (x===0||x===i) ? s : s+Number(c.share||0), 0); n[i].share = String(Math.min(val, Math.max(0, 100 - othersExMe))); const sumOthers = n.reduce((s, c, x) => x===0 ? s : s+Number(c.share||0), 0); if(n[0]) n[0].share = String(Math.max(0, 100 - sumOthers)); } return n; });

  const getInvestorTier = (share: number) => {
      if (share <= 20) return { label: "DEFENSIVE", color: "text-blue-400", desc: "Low risk for you, low appeal for investors." };
      if (share <= 35) return { label: "BALANCED", color: "text-green-400", desc: "Standard market rate. Good balance." };
      return { label: "AGGRESSIVE", color: "text-red-400", desc: "High investor appeal! Faster funding expected." };
  };
  const tier = getInvestorTier(investorShare);
  const totalColorClass = currentTotalShare === 100 ? 'text-emerald-400' : currentTotalShare < 100 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-4 py-8 sm:px-6 font-sans flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="p-2 bg-zinc-900/80 rounded-full hover:bg-zinc-800 transition border border-zinc-700/70"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">Upload Masterpiece</h1>
            <p className="text-xs text-zinc-500 mt-1">Upload your master track to the unlisted ecosystem.</p>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl relative overflow-hidden">

          {/* Loading Overlay */}
          {isAutoFilling && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                 <Loader2 className="animate-spin text-green-500 mb-2" size={32}/>
                 <p className="text-sm font-bold animate-pulse">Importing track from AI Studio...</p>
             </div>
          )}
          
          {/* File Upload Section */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div onClick={() => imageInputRef.current?.click()} className="w-32 h-32 bg-zinc-900 rounded-xl border border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/80 hover:bg-zinc-900/80 overflow-hidden relative shrink-0">
              <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/*" className="hidden"/>
              {croppedImageBlob ? <img src={URL.createObjectURL(croppedImageBlob)} className="w-full h-full object-cover"/> : <><ImageIcon size={24} className="text-zinc-500 mb-1"/><span className="text-[10px] text-zinc-500 text-center leading-tight">300x300<br/>Cover Art</span></>}
            </div>
            {croppedImageBlob && <button onClick={(e) => { e.stopPropagation(); setCroppedImageBlob(null); setIsManualImage(false); if (imageInputRef.current) imageInputRef.current.value = ''; }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition z-10"><X size={14}/></button>}
            
            <div onClick={() => fileInputRef.current?.click()} className={`flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all min-h-[5.5rem] ${file ? 'border-green-500/80 bg-green-500/10' : 'border-zinc-700 hover:border-cyan-500/80 hover:bg-zinc-900/60'}`}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden"/>
              {file ? <><Music size={24} className="text-green-400 mb-2"/><p className="text-green-300 font-semibold text-xs sm:text-sm truncate max-w-[220px]">{file.name}</p></> : <><UploadCloud size={24} className="text-zinc-400 mb-2"/><p className="text-zinc-300 font-medium text-xs sm:text-sm">Upload MP3 / WAV</p></>}
            </div>
          </div>

          {/* Creation Type */}
          <div className="mb-2"><label className="text-xs text-zinc-500 uppercase font-bold">Who created the melody?</label></div>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
            <button onClick={() => setCreationType('ai')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${creationType === 'ai' ? 'bg-zinc-900 border-cyan-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}><div className={`p-3 rounded-full ${creationType === 'ai' ? 'bg-cyan-500 text-white' : 'bg-zinc-900'}`}><Bot size={22}/></div><div className="font-bold text-sm">Gen AI</div></button>
            <button onClick={() => setCreationType('human')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${creationType === 'human' ? 'bg-zinc-900 border-green-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}><div className={`p-3 rounded-full ${creationType === 'human' ? 'bg-green-500 text-black' : 'bg-zinc-900'}`}><User size={22}/></div><div className="font-bold text-sm">Human</div></button>
          </div>

          {/* Metadata Inputs */}
          <div className="space-y-4">
            <div><label className="text-xs text-zinc-500 uppercase font-bold">Title</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white text-sm focus:outline-none focus:border-cyan-500/80" placeholder="Track Title"/></div>
            <div><label className="text-xs text-zinc-500 uppercase font-bold">Lyrics</label><textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white h-24 resize-none text-sm focus:outline-none focus:border-cyan-500/80" placeholder="Paste full lyrics here (optional)."/></div>
          </div>

          {/* Dropdown Section */}
          <div className="mt-8 space-y-6">
            
            {/* ✅ 수정 4: Genre Multi-Select UI 적용 */}
            <div ref={genreInputRef} className="relative z-30">
                <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-2 mb-1">
                   <Disc size={12}/> Primary Genres (Max 3)
                </label>
                
                {/* 선택된 장르 배지 표시 */}
                <div className="flex flex-wrap gap-2 mb-1"> 
                    {genres.map(g => (
                        <span key={g} className="bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-in zoom-in duration-200">
                            {g} <button onClick={() => setGenres(genres.filter(sg => sg !== g))} className="ml-1 hover:text-white"><X size={12}/></button>
                        </span>
                    ))}
                </div>

                <div className="relative">
                    <input 
                        type="text"
                        value={genreSearch}
                        onFocus={() => setIsGenreDropdownOpen(true)}
                        onChange={(e) => { setGenreSearch(e.target.value); setIsGenreDropdownOpen(true); }}
                        className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 placeholder:text-zinc-500"
                        placeholder="Search Genre..."
                    />
                    <ChevronDown size={16} className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none"/>
                </div>

                {isGenreDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 z-50">
                        {filteredGenres.length > 0 ? filteredGenres.map(g => (
                            <button key={g} onClick={() => handleGenreSelect(g)} className="w-full text-left px-4 py-3 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white flex justify-between items-center group">
                                {g} {genres.includes(g) && <CheckCircle size={14} className="text-cyan-500"/>}
                            </button>
                        )) : <div className="p-3 text-xs text-zinc-500 text-center">No matching genre</div>}
                    </div>
                )}
            </div>

            {/* Moods & Tags (기존과 동일) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div ref={moodInputRef} className="relative z-20">
                    <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-2 mb-1">
                        <Smile size={12}/> Moods (Max 3)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-1"> 
                        {selectedMoods.map(m => (
                            <span key={m} className="bg-cyan-900/30 border border-cyan-500/30 text-cyan-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-in zoom-in duration-200">
                                {m} <button onClick={() => setSelectedMoods(selectedMoods.filter(sm=>sm!==m))} className="ml-1 hover:text-white"><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            value={moodSearch}
                            onFocus={() => setIsMoodDropdownOpen(true)}
                            onChange={(e) => { setMoodSearch(e.target.value); setIsMoodDropdownOpen(true); }}
                            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600"
                            placeholder="Search Mood..."
                        />
                        <ChevronDown size={16} className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none"/>
                    </div>
                    {isMoodDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 z-50">
                            {filteredMoods.length > 0 ? filteredMoods.map(m => (
                                <button key={m} onClick={() => handleMoodSelect(m)} className="w-full text-left px-4 py-3 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white flex justify-between items-center">
                                    {m} <Plus size={14} className="text-zinc-600"/>
                                </button>
                            )) : <div className="p-3 text-xs text-zinc-500 text-center">No matching mood</div>}
                        </div>
                    )}
                </div>

                <div ref={tagInputRef} className="relative z-10">
                    <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-2 mb-1">
                        <Hash size={12}/> Context Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-1">
                        {selectedTags.map(t => (
                            <span key={t} className="bg-blue-900/30 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-in zoom-in duration-200">
                                {t} <button onClick={() => setSelectedTags(selectedTags.filter(st=>st!==t))} className="ml-1 hover:text-white"><X size={12}/></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative">
                        <input 
                            type="text"
                            value={tagSearch}
                            onFocus={() => setIsTagDropdownOpen(true)}
                            onChange={(e) => { setTagSearch(e.target.value); setIsTagDropdownOpen(true); }}
                            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600"
                            placeholder="Search Tags..."
                        />
                        <Search size={16} className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none"/>
                    </div>
                    {isTagDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 z-50">
                             {filteredTags.length > 0 ? filteredTags.map(t => (
                                <button key={t} onClick={() => handleTagAdd(t)} className="w-full text-left px-4 py-3 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white flex justify-between items-center">
                                    #{t} <Plus size={14} className="text-zinc-600"/>
                                </button>
                            )) : <div className="p-3 text-xs text-zinc-500 text-center">No matching tags</div>}
                        </div>
                    )}
                </div>
            </div>
          </div>
          
          <div className="mt-8 space-y-4 border-t border-zinc-800 pt-6">
              <div className="flex items-center gap-2 mb-2"><Bot size={16} className="text-purple-400"/><span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AI Reference (Optional)</span></div>
              <p className="text-[11px] text-zinc-500 mb-4">Help our AI understand your track better.</p>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Ref Artist</label><input type="text" value={refArtist} onChange={(e) => setRefArtist(e.target.value)} placeholder="e.g. The Weeknd" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500/80"/></div>
                  <div><label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Ref Track</label><input type="text" value={refTrack} onChange={(e) => setRefTrack(e.target.value)} placeholder="e.g. Blinding Lights" className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500/80"/></div>
              </div>
          </div>

          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Investor Share</label>
                  <span className={`text-xs font-black px-2 py-0.5 rounded border border-white/10 bg-black/50 ${tier.color}`}>{tier.label}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">Decide how much of the <strong>future revenue</strong> you want to share with investors.<br/>Higher share = Faster funding & Viral potential.</p>
              <div className="relative h-10 flex items-center mb-6 px-2"><input type="range" min="10" max="50" step="5" value={investorShare} onChange={(e) => setInvestorShare(parseInt(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500 z-10 relative"/><div className="absolute top-6 left-0 right-0 flex justify-between text-[10px] text-zinc-600 font-mono px-1"><span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span></div></div>
              <div className="bg-black rounded-xl p-4 border border-zinc-800 flex items-center gap-6">
                  <div className="w-16 h-16 relative"><svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#333" strokeWidth="4" /><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray={`${investorShare}, 100`} /></svg><div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{investorShare}%</div></div>
                  <div className="flex-1 space-y-2"><div className="flex justify-between text-xs"><span className="text-zinc-500">For Investors</span><span className="text-green-400 font-bold">{investorShare}% (Revenue)</span></div><div className="flex justify-between text-xs"><span className="text-zinc-500">For You & Team</span><span className="text-white font-bold">{100 - investorShare}% (Retained)</span></div><div className="h-px bg-zinc-800 my-1"/><p className="text-[10px] text-zinc-500 italic">"{tier.desc}"</p></div>
              </div>
          </div>

          <div className="mt-8">
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Revenue Split</label>
            <p className="text-[11px] text-zinc-500 mb-3">Your share starts at 100%. When you enter other contributors’ shares, your share decreases automatically. Total must remain 100% to publish.</p>
            <div className="space-y-2">{contributors.map((c, idx) => (<div key={idx} className="flex items-center gap-2"><input type="text" value={idx === 0 ? (address || '') : c.address} onChange={(e) => updateContributor(idx, 'address', e.target.value)} className={`flex-1 border rounded-lg px-3 py-2 text-[11px] sm:text-xs focus:outline-none focus:border-cyan-500/80 ${idx === 0 ? 'bg-zinc-950 text-zinc-500 cursor-not-allowed border-zinc-800' : 'bg-zinc-900 text-white border-zinc-700'}`} disabled={idx === 0} placeholder="0x..."/><div className="flex items-center gap-1"><input type="number" value={c.share} onChange={(e) => updateContributor(idx, 'share', e.target.value)} className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-[11px] sm:text-xs text-right focus:outline-none focus:border-cyan-500/80"/><span className="text-[10px] text-zinc-500">% </span></div>{contributors.length > 1 && idx !== 0 && (<button type="button" onClick={() => removeContributor(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>)}</div>))}</div>
            <div className="mt-2 flex items-center justify-between"><button type="button" onClick={addContributor} className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300"><Plus size={14}/> Add contributor</button><div className={`text-[11px] font-mono ${totalColorClass}`}>Total: {currentTotalShare}%</div></div>
          </div>
          <button onClick={handleUpload} disabled={!file || !title || uploading} className="w-full mt-8 py-4 bg-white text-black rounded-xl font-bold hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed">{uploading ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={18}/> Publishing...</span> : 'Publish Track'}</button>
        </div>
      </div>

      {showCropModal && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-zinc-900 w-full max-w-md p-6 rounded-2xl relative h-[500px] flex flex-col border border-zinc-700"><h3 className="text-lg font-bold mb-4">Adjust Cover Art</h3><div className="relative flex-1 bg-black rounded-lg overflow-hidden mb-4"><Cropper image={imageSrc!} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}/></div><div className="flex gap-4"><button onClick={() => setShowCropModal(false)} className="flex-1 py-3 bg-zinc-800 rounded-lg font-bold hover:bg-zinc-700">Cancel</button><button onClick={handleCropSave} className="flex-1 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200">Save Cover</button></div></div></div>}
    </div>
  );
}