'use client';

import { MUSIC_GENRES, MUSIC_MOODS } from '@/app/constants'; // 또는 '../constants'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, Bot, Globe, Database, UploadCloud, Music, Loader2, ArrowLeft, CheckCircle, Plus, Trash2, User, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Cropper from 'react-easy-crop'; // 크롭 라이브러리
import { getCroppedImg } from '@/utils/image'; // 아까 만든 유틸
import toast from 'react-hot-toast';
import { useReadContract, useActiveAccount,useSendTransaction } from "thirdweb/react";




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
  const [creationType, setCreationType] = useState<'human' | 'ai'>('human');
  
  // --- Image State ---
  const [imageSrc, setImageSrc] = useState<string | null>(null); // 원본 이미지 경로
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null); // 자른 이미지 결과물
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropModal, setShowCropModal] = useState(false); // 팝업 표시 여부

  const [uploading, setUploading] = useState(false);
  const [contributors, setContributors] = useState<Contributor[]>([
    { address: '', share: '100', role: 'Main Artist' } 
  ]);

  const [genre, setGenre] = useState(MUSIC_GENRES[0]); // 기본값
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // 현재 총 지분 (UI 표시용)
  const currentTotalShare = contributors.reduce(
    (sum, c) => sum + Number(c.share || 0),
    0
  );

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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('audio/')) return toast.error('오디오 파일만 가능합니다.');
      setFile(selectedFile);
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
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
      if (selectedMoods.length >= 3) return toast.error("무드는 최대 3개까지 선택 가능합니다.");
      setSelectedMoods([...selectedMoods, mood]);
    }
  };

  // 업로드 실행
  const handleUpload = async () => {
    if (!file || !title) return toast.error("파일과 제목을 입력해주세요.");
    const totalShare = contributors.reduce((sum, c) => sum + Number(c.share), 0);
    if (totalShare !== 100) return toast.error("지분율 합계는 100%여야 합니다.");

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

      // 3. DB 저장
      const { data: newTrack, error: dbError } = await supabase
        .from('tracks')
        .insert([{
            title: title,
            description: description,
            lyrics: lyrics,
            audio_url: audioUrl,
            cover_image_url: coverUrl, // [추가됨]
            genre: genre,
            moods: selectedMoods,
            uploader_address: address,
            artist_name: artistName,
            creation_type: creationType,
            artist_id: artistId, // [핵심] 이제 Foreign Key가 연결됩니다!
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
      toast.success('업로드 완료! 서버가 곧 분석을 시작합니다.');
      router.push('/market');

    } catch (error: any) {
      toast.error(`업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // -----------------------------
  // Contributors 핸들러 (자동 지분 조정)
  // -----------------------------

  const addContributor = () => {
    setContributors(prev => [
      ...prev,
      { address: '', share: '0', role: 'Contributor' }
    ]);
  };

  const removeContributor = (index: number) => {
    setContributors(prev => {
      const next = [...prev];
      next.splice(index, 1);

      // 나(0번)를 제외한 나머지 합
      const othersSum = next.reduce((sum, c, idx) => {
        if (idx === 0) return sum;
        return sum + Number(c.share || 0);
      }, 0);

      if (next[0]) {
        const mainShare = Math.max(0, Math.min(100, 100 - othersSum));
        next[0] = { ...next[0], share: String(mainShare) };
      }

      return next;
    });
  };

  const updateContributor = (index: number, field: keyof Contributor, value: string) => {
    setContributors(prev => {
      const next = [...prev];

      // address / role 등 share 이외 필드
      if (field !== 'share') {
        next[index] = { ...next[index], [field]: value };
        return next;
      }

      // share 업데이트 로직
      let num = Number(value);
      if (isNaN(num)) num = 0;
      num = Math.max(0, Math.min(100, num)); // 0~100 사이로 클램핑

      // 0번 = Main Artist
      if (index === 0) {
        const othersSum = prev.reduce((sum, c, idx) => {
          if (idx === 0) return sum;
          return sum + Number(c.share || 0);
        }, 0);

        const maxMain = Math.max(0, 100 - othersSum);
        const finalMain = Math.min(num, maxMain);

        next[0] = { ...next[0], share: String(finalMain) };
        return next;
      }

      // index > 0 : 다른 컨트리뷰터
      const othersSumExcludingThis = prev.reduce((sum, c, idx) => {
        if (idx === 0 || idx === index) return sum;
        return sum + Number(c.share || 0);
      }, 0);

      // 이 컨트리뷰터에게 줄 수 있는 최대치 (나머지 + 나 합쳐서 100)
      const maxForThis = Math.max(0, 100 - othersSumExcludingThis);
      const finalShare = Math.min(num, maxForThis);

      next[index] = { ...next[index], share: String(finalShare) };

      // 이 시점에서 next 기준, 나머지(0 제외) 합 계산
      const sumOthers = next.reduce((sum, c, idx) => {
        if (idx === 0) return sum;
        return sum + Number(c.share || 0);
      }, 0);

      if (next[0]) {
        const mainShare = Math.max(0, 100 - sumOthers);
        next[0] = { ...next[0], share: String(mainShare) };
      }

      return next;
    });
  };

  // -----------------------------
  // Render
  // -----------------------------

  // Total 색상 스타일
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
              Unlisted 생태계에 마스터 트랙을 업로드합니다.
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
                    Drag & drop 지원 예정
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
                  Unlisted Native<br />(생태계 전용 독점 자산)
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
                  Real-world Ready<br />(Spotify/Melon 확장 가능)
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
                placeholder="가사 전체를 넣어주세요 (선택)."
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

          {/* Contributors */}
          <div className="mt-8">
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">
              Revenue Split
            </label>
            <p className="text-[11px] text-zinc-500 mb-3">
              기본적으로 내 지분은 100%에서 시작하며, 다른 컨트리뷰터의 지분을 입력하면 내 지분이 자동으로 줄어듭니다. 총합은 100%를 유지해야 업로드할 수 있습니다.
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
                aspect={1} // 1:1 정방형 고정
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
