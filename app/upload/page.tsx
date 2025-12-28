'use client';

import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '@/app/constants'; // 또는 '../constants'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp, Search, Hash, Zap, Bot, Globe, Database, UploadCloud, Music, Loader2, ArrowLeft, CheckCircle, Plus, Trash2, User, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useRouter } from "../../lib/i18n";
import { Link } from "../../lib/i18n";
import Cropper from 'react-easy-crop'; // 크롭 라이브러리
import { getCroppedImg } from '@/utils/image'; // 아까 만든 유틸
import toast from 'react-hot-toast';
import { useReadContract, useActiveAccount,useSendTransaction } from "thirdweb/react";
import * as mm from 'music-metadata-browser'; // ✅ MP3 분석용

// Contracts
import { getContract, prepareContractCall } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";

type Contributor = { address: string; share: string; role: string; };

export default function UploadPage() {
  const account = useActiveAccount();
  const address = account?.address; // 없으면 undefined (비로그인)
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Audio State ---
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [creationType, setCreationType] = useState<'ai' | 'human'>('ai');
  
  // --- Image State ---ß
  const [imageSrc, setImageSrc] = useState<string | null>(null); // 원본 이미지 경로
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null); // 자른 이미지 결과물
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false); // 팝업 표시 여부
  // ✅ [추가] 사용자가 직접 이미지를 올렸는지 확인하는 플래그
  const [isManualImage, setIsManualImage] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [contributors, setContributors] = useState<Contributor[]>([
    { address: '', share: '100', role: 'Main Artist' } 
  ]);

  // --- [NEW] Optional Meta Data ---
  const [bpm, setBpm] = useState<string>(''); // BPM 입력 (숫자지만 입력 편의상 string)
  
  // --- [NEW] Tag System ---
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLDivElement>(null); // 드롭다운 감지용 Ref
  const [genre, setGenre] = useState(MUSIC_GENRES[0]); // 기본값
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // ✅ [NEW] Investor Share Logic
  const [investorShare, setInvestorShare] = useState<number>(30); // 기본값 30%

  // Contributors
  const currentTotalShare = contributors.reduce((sum, c) => sum + Number(c.share || 0), 0);

  // 내 주소 자동 주입
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

// 오디오 파일 선택
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('audio/')) return toast.error('Audio files only.');

      setFile(selectedFile);
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));

      // ✅ MP3 메타데이터에서 커버 이미지 추출 로직
      try {
        const metadata = await mm.parseBlob(selectedFile);
        const picture = metadata.common.picture?.[0];

        if (picture) {
          // 🛑 [수정] 사용자가 수동으로 이미지를 설정하지 않았을 때만 MP3 커버 적용
          if (!isManualImage) {
            const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
            setCroppedImageBlob(blob);
            toast.success("Found embedded cover art in the MP3.");
          }
        }
      } catch (error) {
        console.log("Metadata extraction failed (ignored):", error);
      }
    }
  };

  // 이미지 파일 선택
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setShowCropModal(true); // 크롭 모달 띄우기
      });
      reader.readAsDataURL(file);
    }
  };

  // 크롭 완료 처리
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      setCroppedImageBlob(croppedBlob);
      
      // ✅ [추가] 사용자가 직접 이미지를 저장했으므로 플래그를 true로 설정
      setIsManualImage(true); 
      
      setShowCropModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  // 무드 토글 함수
  const toggleMood = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter(m => m !== mood));
    } else {
      if (selectedMoods.length >= 3) return toast.error("You can select up to 3 moods.");
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  // --- [NEW] Tag Logic Start ---
  
  // 검색어에 맞는 태그 필터링 (이미 선택된 건 제외)
  const filteredTags = MUSIC_TAGS.filter(tag => 
    tag.toLowerCase().includes(tagSearch.toLowerCase()) && 
    !selectedTags.includes(tag)
  );

  // 태그 추가
  const handleTagAdd = (tag: string) => {
    if (selectedTags.length >= 10) return toast.error("You can add up to 10 tags.");
    setSelectedTags([...selectedTags, tag]);
    setTagSearch(''); // 검색어 초기화
    // setIsTagDropdownOpen(false); // 연속 선택을 위해 닫지 않음 (원하면 주석 해제)
  };

  // 태그 삭제
  const handleTagRemove = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- [NEW] Tag Logic End ---

  // 업로드 실행
  const handleUpload = async () => {
    if (!file || !title) return toast.error("Please choose a file and enter a title.");
    const totalShare = contributors.reduce((sum, c) => sum + Number(c.share), 0);
    if (totalShare !== 100) return toast.error("Revenue split must total 100%.");

    try {
      setUploading(true);
      
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();

      // [수정 1] 내 프로필에서 'username'뿐만 아니라 'id'도 가져오기
      let artistName = "Anonymous";
      let artistId = null; // UUID 저장용 변수

      if (address) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, username') // [중요] id 추가
            .eq('wallet_address', address)
            .single();
        
        if (profile) {
            artistName = profile.username || "Anonymous";
            artistId = profile.id; // 프로필 ID 확보
        }
      }

      // 1. 오디오 업로드
      const audioName = `${timestamp}_${safeTitle}.mp3`;
      const { error: audioErr } = await supabase.storage.from('music_assets').upload(audioName, file);
      if (audioErr) throw audioErr;
      const { data: { publicUrl: audioUrl } } = supabase.storage.from('music_assets').getPublicUrl(audioName);

      // 2. 이미지 업로드 (있으면)
      let coverUrl = null;
      if (croppedImageBlob) {
        const imageName = `${timestamp}_${safeTitle}_cover.jpg`;
        const { error: imgErr } = await supabase.storage.from('music_assets').upload(imageName, croppedImageBlob);
        if (imgErr) throw imgErr;
        const { data: { publicUrl } } = supabase.storage.from('music_assets').getPublicUrl(imageName);
        coverUrl = publicUrl;
      }
      else {
        // ✅ B. 아무것도 없을 때 디폴트 이미지 사용
        coverUrl = '/images/default_cover.jpg';
      }

     // 3. DB 저장 부분 수정
      const { data: newTrack, error: dbError } = await supabase
        .from('tracks')
        .insert([{
            title: title,
            description: description,
            lyrics: lyrics,
            audio_url: audioUrl,
            cover_image_url: coverUrl,
            genre: genre,
            moods: selectedMoods,
            
            // ✅ [추가] BPM 및 태그 저장
            bpm: bpm ? parseInt(bpm) : null,
            context_tags: selectedTags, 
            
            uploader_address: address,
            artist_name: artistName,
            creation_type: creationType,
            artist_id: artistId,
        }])
        .select().single();

      if (dbError) throw dbError;

      // 4. Contributors 저장
      const contributorsData = contributors.map(c => ({
          track_id: newTrack.id,
          wallet_address: c.address, role: c.role, share_percentage: Number(c.share)
      }));
      await supabase.from('track_contributors').insert(contributorsData);

      // 5. AI 분석
      toast.success('Upload complete! The server will start analysis shortly.');
      router.push('/market');

    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // -----------------------------
  // Contributors 핸들러 (자동 지분 조정)
  // -----------------------------

  const addContributor = () => setContributors(p => [...p, { address: '', share: '0', role: 'Contributor' }]);
  const removeContributor = (i: number) => setContributors(p => { 
      const n = [...p]; n.splice(i, 1); 
      const sum = n.reduce((s, c, x) => x===0 ? s : s + Number(c.share||0), 0);
      if(n[0]) n[0].share = String(Math.max(0, 100 - sum));
      return n; 
  });
  const updateContributor = (i: number, f: keyof Contributor, v: string) => setContributors(p => {
      const n = [...p]; if(f!=='share') { n[i] = {...n[i], [f]: v}; return n; }
      let val = Math.max(0, Math.min(100, Number(v)));
      if(i===0) {
         const others = p.reduce((s, c, x) => x===0 ? s : s+Number(c.share||0), 0);
         n[0].share = String(Math.min(val, Math.max(0, 100 - others)));
      } else {
         const othersExMe = p.reduce((s, c, x) => (x===0||x===i) ? s : s+Number(c.share||0), 0);
         n[i].share = String(Math.min(val, Math.max(0, 100 - othersExMe)));
         const sumOthers = n.reduce((s, c, x) => x===0 ? s : s+Number(c.share||0), 0);
         if(n[0]) n[0].share = String(Math.max(0, 100 - sumOthers));
      }
      return n;
  });

  // --- Investors 핸들러 --
  const getInvestorTier = (share: number) => {
      if (share <= 20) return { label: "DEFENSIVE", color: "text-blue-400", desc: "Low risk for you, low appeal for investors." };
      if (share <= 35) return { label: "BALANCED", color: "text-green-400", desc: "Standard market rate. Good balance." };
      return { label: "AGGRESSIVE", color: "text-red-400", desc: "High investor appeal! Faster funding expected." };
  };
  const tier = getInvestorTier(investorShare);

  const totalColorClass =
    currentTotalShare === 100
      ? 'text-emerald-400'
      : currentTotalShare < 100
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-4 py-8 sm:px-6 font-sans flex justify-center">
      <div className="w-full max-w-2xl">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="p-2 bg-zinc-900/80 rounded-full hover:bg-zinc-800 transition border border-zinc-700/70"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Upload Masterpiece
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Upload your master track to the unlisted ecosystem.
            </p>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          
          {/* A. 앨범 커버 + 오디오 파일 업로드 섹션 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* 1. 앨범 커버 업로드 */}
            <div 
              onClick={() => imageInputRef.current?.click()}
              className="w-32 h-32 bg-zinc-900 rounded-xl border border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/80 hover:bg-zinc-900/80 overflow-hidden relative shrink-0"
            >
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              {croppedImageBlob ? (
                <img
                  src={URL.createObjectURL(croppedImageBlob)}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <ImageIcon size={24} className="text-zinc-500 mb-1" />
                  <span className="text-[10px] text-zinc-500 text-center leading-tight">
                    300x300<br />Cover Art
                  </span>
                </>
              )}
            </div>

            {/* ✅ [추가] 이미지가 있을 때만 삭제 버튼 표시 */}
              {croppedImageBlob && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 부모 클릭 이벤트 방지
                    setCroppedImageBlob(null); // 이미지 비우기
                    setIsManualImage(false);   // 수동 모드 해제 (다시 MP3 커버 받을 수 있게 됨)
                    if (imageInputRef.current) imageInputRef.current.value = ''; // input 초기화
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition z-10"
                  title="Remove cover art"
                >
                  <X size={14} />
                </button>
              )}

            {/* 2. 오디오 파일 업로드 */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all min-h-[5.5rem] ${
                file
                  ? 'border-green-500/80 bg-green-500/10'
                  : 'border-zinc-700 hover:border-cyan-500/80 hover:bg-zinc-900/60'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
              />
              {file ? (
                <>
                  <Music size={24} className="text-green-400 mb-2" />
                  <p className="text-green-300 font-semibold text-xs sm:text-sm truncate max-w-[220px]">
                    {file.name}
                  </p>
                </>
              ) : (
                <>
                  <UploadCloud size={24} className="text-zinc-400 mb-2" />
                  <p className="text-zinc-300 font-medium text-xs sm:text-sm">
                    Upload MP3 / WAV
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Drag & drop coming soon
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 0. Origin Selection (AI vs Human) */}
          <div className="mb-2">
            <label className="text-xs text-zinc-500 uppercase font-bold">
              Who created the melody?
            </label>
          </div>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => setCreationType('ai')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                creationType === 'ai' 
                  ? 'bg-zinc-900 border-cyan-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div
                className={`p-3 rounded-full ${
                  creationType === 'ai' ? 'bg-cyan-500 text-white' : 'bg-zinc-900'
                }`}
              >
                <Bot size={22}/>
              </div>
              <div>
                <div className="font-bold text-sm">Gen AI</div>
                <div className="text-[10px] mt-1 opacity-70 leading-tight">
                  Unlisted Native<br />(ecosystem-only exclusive asset)
                </div>
              </div>
            </button>
            <button
              onClick={() => setCreationType('human')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center ${
                creationType === 'human' 
                  ? 'bg-zinc-900 border-green-500 text-white shadow-[0_0_18px_rgba(34,197,94,0.45)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <div
                className={`p-3 rounded-full ${
                  creationType === 'human' ? 'bg-green-500 text-black' : 'bg-zinc-900'
                }`}
              >
                <User size={22}/>
              </div>
              <div>
                <div className="font-bold text-sm">Human</div>
                <div className="text-[10px] mt-1 opacity-70 leading-tight">
                  Real-world Ready<br />(can expand to Spotify/Melon)
                </div>
              </div>
            </button>
          </div>

          {/* 메타데이터 입력 */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white text-sm focus:outline-none focus:border-cyan-500/80"
                placeholder="Track Title"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold">
                Lyrics
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white h-24 resize-none text-sm focus:outline-none focus:border-cyan-500/80"
                placeholder="Paste full lyrics here (optional)."
              />
            </div>
          </div>

          {/* 장르 & 무드 선택 UI */}
          <div className="flex gap-4 mt-6 flex-col sm:flex-row">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                Genre
              </label>
              <select 
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 mt-1 text-white text-sm focus:outline-none focus:border-cyan-500/80"
              >
                {MUSIC_GENRES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2 block">
              Moods (Max 3)
            </label>
            <div className="flex flex-wrap gap-2">
              {MUSIC_MOODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMood(m)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    selectedMoods.includes(m) 
                      ? 'bg-blue-600 border-cyan-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* --- [NEW] BPM & Context Tags Section --- */}
          <div className="mt-6 space-y-6 border-t border-zinc-800 pt-6">
            {/* 1. BPM Input */}
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                BPM (Optional)
              </label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                placeholder="e.g. 120"
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white text-sm focus:outline-none focus:border-cyan-500/80 font-mono"
              />
            </div>

            {/* 2. Tag Input System */}
            <div ref={tagInputRef} className="relative z-20">
                <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Context Tags</span>
                    <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Max 10</span>
                </label>
                
                {/* Selected Tags Display */}
                <div className="flex flex-wrap gap-2 mb-2 min-h-[2rem] py-2">
                    {selectedTags.length === 0 && (
                        <span className="text-xs text-zinc-600 italic py-1">No tags selected.</span>
                    )}
                    {selectedTags.map(tag => (
                        <span key={tag} className="bg-blue-900/30 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 group animate-in fade-in zoom-in duration-200">
                            <Hash size={10} className="opacity-50"/>
                            {tag}
                            <button onClick={() => handleTagRemove(tag)} className="ml-1 hover:text-white"><X size={12}/></button>
                        </span>
                    ))}
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-zinc-500" size={16} />
                    <input 
                        type="text"
                        value={tagSearch}
                        onFocus={() => setIsTagDropdownOpen(true)}
                        onChange={(e) => { setTagSearch(e.target.value); setIsTagDropdownOpen(true); }}
                        className="w-full bg-black border border-zinc-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-green-500 text-sm placeholder:text-zinc-600"
                        placeholder="Search vibe tags (e.g. workout, coding, lofi...)"
                    />
                </div>

                {/* Dropdown Results */}
                {isTagDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent">
                        {filteredTags.length > 0 ? (
                            filteredTags.map(tag => (
                                <button 
                                    key={tag}
                                    onClick={() => handleTagAdd(tag)}
                                    className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between group transition border-b border-zinc-800/50 last:border-0"
                                >
                                    <span className="text-sm text-zinc-300 group-hover:text-white font-medium">#{tag}</span>
                                    <Plus size={14} className="text-zinc-600 group-hover:text-green-400"/>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-xs text-zinc-500 text-center">
                                {tagSearch ? "No matching tags." : "Type to search."}
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>

          {/* ✅ [NEW] Investor Share Slider Section */}
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-green-500"/> Investor Share
                  </label>
                  <span className={`text-xs font-black px-2 py-0.5 rounded border border-white/10 bg-black/50 ${tier.color}`}>
                      {tier.label}
                  </span>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                  Decide how much of the <strong>future revenue</strong> you want to share with investors.<br/>
                  Higher share = Faster funding & Viral potential.
              </p>
              
              <div className="relative h-10 flex items-center mb-6 px-2">
                  <input 
                      type="range" 
                      min="10" max="50" step="5" 
                      value={investorShare} 
                      onChange={(e) => setInvestorShare(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500 z-10 relative"
                  />
                  {/* Ticks */}
                  <div className="absolute top-6 left-0 right-0 flex justify-between text-[10px] text-zinc-600 font-mono px-1">
                      <span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span>
                  </div>
              </div>

              {/* Simulation Box */}
              <div className="bg-black rounded-xl p-4 border border-zinc-800 flex items-center gap-6">
                  <div className="w-16 h-16 relative">
                      {/* Donut Chart Visual */}
                      <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#333" strokeWidth="4" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="4" strokeDasharray={`${investorShare}, 100`} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{investorShare}%</div>
                  </div>
                  <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">For Investors</span>
                          <span className="text-green-400 font-bold">{investorShare}% (Revenue)</span>
                      </div>
                      <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">For You & Team</span>
                          <span className="text-white font-bold">{100 - investorShare}% (Retained)</span>
                      </div>
                      <div className="h-px bg-zinc-800 my-1"/>
                      <p className="text-[10px] text-zinc-500 italic">
                          "{tier.desc}"
                      </p>
                  </div>
              </div>
          </div>

          {/* Contributors */}
          <div className="mt-8">
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">
              Revenue Split
            </label>
            <p className="text-[11px] text-zinc-500 mb-3">
              Your share starts at 100%. When you enter other contributors’ shares, your share decreases automatically. Total must remain 100% to publish.
            </p>

            <div className="space-y-2">
              {contributors.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={idx === 0 ? (address || '') : c.address}
                    onChange={(e) => updateContributor(idx, 'address', e.target.value)}
                    className={`flex-1 border rounded-lg px-3 py-2 text-[11px] sm:text-xs focus:outline-none focus:border-cyan-500/80 ${
                      idx === 0
                        ? 'bg-zinc-950 text-zinc-500 cursor-not-allowed border-zinc-800'
                        : 'bg-zinc-900 text-white border-zinc-700'
                    }`}
                    disabled={idx === 0}
                    placeholder="0x..."
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={c.share}
                      onChange={(e) => updateContributor(idx, 'share', e.target.value)}
                      className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-[11px] sm:text-xs text-right focus:outline-none focus:border-cyan-500/80"
                    />
                    <span className="text-[10px] text-zinc-500">% </span>
                  </div>
                  {contributors.length > 1 && idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => removeContributor(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={addContributor}
                className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300"
              >
                <Plus size={14}/> Add contributor
              </button>
              <div className={`text-[11px] font-mono ${totalColorClass}`}>
                Total: {currentTotalShare}%
              </div>
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || !title || uploading}
            className="w-full mt-8 py-4 bg-white text-black rounded-xl font-bold hover:scale-[1.02] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={18}/>
                Publishing...
              </span>
            ) : (
              'Publish Track'
            )}
          </button>
        </div>
      </div>

      {/* 크롭 모달 */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-md p-6 rounded-2xl relative h-[500px] flex flex-col border border-zinc-700">
            <h3 className="text-lg font-bold mb-4">Adjust Cover Art</h3>
            <div className="relative flex-1 bg-black rounded-lg overflow-hidden mb-4">
              <Cropper
                image={imageSrc!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCropModal(false)}
                className="flex-1 py-3 bg-zinc-800 rounded-lg font-bold hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCropSave}
                className="flex-1 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200"
              >
                Save Cover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}