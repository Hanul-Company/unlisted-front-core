'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "@/lib/i18n";
import { Camera, ArrowRight, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { MUSIC_GENRES } from '../constants';

export default function OnboardingPage() {
  const account = useActiveAccount();
  const address = account?.address; // 없으면 undefined (비로그인)
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null); // Supabase User
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 초기 로딩

  // 1. 유저 체크 (로그인 안 했으면 쫓아냄)
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // 지갑만 연결된 상태면... (레거시 지원)
        if (!address) {
            toast.error("로그인이 필요합니다.");
            router.push('/login');
            return;
        }
      } else {
        setUser(user);
        // 이미 프로필 있으면 마켓으로
        const { data: profile } = await supabase.from('profiles').select('username').eq('auth_user_id', user.id).maybeSingle();
        if (profile) {
            toast("이미 프로필이 있습니다.");
            router.push('/market');
            return;
        }
      }
      setLoading(false);
    };
    init();
  }, [router, address]);

  // ... (handleAvatarChange, toggleGenre 등 기존 로직 동일) ...
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };
  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) setSelectedGenres(selectedGenres.filter(g => g !== genre));
    else { if (selectedGenres.length >= 3) return toast.error("최대 3개까지만 선택 가능합니다."); setSelectedGenres([...selectedGenres, genre]); }
  };

  // [핵심] 가입 완료 로직
  const handleSubmit = async () => {
    // 지갑 체크 제거! (Web2 유저도 통과)
    if (!username) return toast.error("닉네임을 입력해주세요.");
    if (selectedGenres.length === 0) return toast.error("취향을 선택해주세요.");

    setLoading(true);
    try {
      let avatarUrl = null;
      // 파일 업로드 (파일명에 유저 ID 사용)
      const userId = user?.id || address || 'unknown'; 

      if (avatarFile) {
        const fileName = `avatar_${userId}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('music_assets').upload(fileName, avatarFile);
        if (!uploadError) {
            const { data } = supabase.storage.from('music_assets').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
        }
      }

      // DB 저장 (Upsert)
      // *지갑 유저면 wallet_address, 이메일 유저면 auth_user_id 사용
      const profileData = {
        username,
        bio,
        avatar_url: avatarUrl,
        genres: selectedGenres,
        auth_user_id: user?.id || null, // 이메일 유저 ID
        email: user?.email || null,     // 이메일
        wallet_address: address || null, // 지갑 주소 (없으면 null)
      };

      // *기존에 지갑으로 만든 프로필이 있다면 업데이트, 없으면 생성
      // 여기선 간단하게 upsert 쓰되, 충돌 방지를 위해 로직 분기 가능
      // (DB 트리거가 pMLD를 줄 것임)
      
      const { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'auth_user_id' }); // 또는 id

      if (error) throw error;

      toast.success("환영합니다! 100 pMLD가 지급되었습니다.");
      router.push('/market');

    } catch (e: any) {
      console.error(e);
      toast.error("설정 실패: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white"/></div>;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Music Persona
          </h1>
          <p className="text-zinc-400">당신의 음악적 취향을 알려주세요.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          {/* Avatar */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-dashed border-zinc-600 flex items-center justify-center overflow-hidden hover:border-cyan-500 transition">
                    {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <Camera className="text-zinc-500 group-hover:text-cyan-400" />}
                </div>
                <input type="file" onChange={handleAvatarChange} accept="image/*" className="hidden" />
            </label>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white focus:border-cyan-500 outline-none" placeholder="DJ Unlisted"/>
            </div>
          </div>

          {/* Genre Selection */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">
                Your Taste (Max 3) <span className="text-cyan-400">{selectedGenres.length}/3</span>
            </label>
            <div className="flex flex-wrap gap-2">
                {MUSIC_GENRES.map(g => (
                    <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition border flex items-center gap-1 ${
                            selectedGenres.includes(g)
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                        }`}
                    >
                        {g} {selectedGenres.includes(g) && <Check size={12}/>}
                    </button>
                ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin"/> : <>Complete Setup <ArrowRight size={18}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}