'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount} from "thirdweb/react";
import { useRouter } from 'next/navigation';
import { Camera, Save, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

// [추가] 장르 및 무드 상수
const GENRES = [
  // Pop & K
  "Pop",
  "K-Pop",
  "K-Hip Hop",
  "R&B",

  // Hip-hop / Chill
  "Hip-hop",
  "Trap",
  "Lo-fi",

  // Rock / Band
  "Rock",
  "Indie Rock",

  // Electronic / Dance
  "EDM",
  "House",
  "Future Bass",

  // Jazz / Acoustic / Film
  "Jazz",
  "Acoustic",
  "Singer-Songwriter",
  "Cinematic",

  // 기타
  "City Pop",
];

export default function SettingsPage() {
  const account = useActiveAccount();
  const address = account?.address; // 없으면 undefined (비로그인)


  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]); // [추가]

// [수정] 기존 데이터 불러오기
  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) return;
      const { data } = await supabase.from('profiles').select('*').eq('wallet_address', address).single();
      if (data) {
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
        setSelectedGenres(data.genres || []); // [추가] 장르 불러오기
      }
      setLoading(false);
    };
    fetchProfile();
  }, [address]);

  // [추가] 장르 토글 (Onboarding과 동일)
  const toggleGenre = (g: string) => { /* ...동일 로직... */ 
    if (selectedGenres.includes(g)) setSelectedGenres(selectedGenres.filter(i => i !== g));
    else { if(selectedGenres.length >= 3) return toast.error("Max 3"); setSelectedGenres([...selectedGenres, g]); }
  };

  const handleSave = async () => {
    if (!address) return;
    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // 새 이미지가 있다면 업로드
      if (newAvatarFile) {
        const fileName = `avatar_${address}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('music_assets').upload(fileName, newAvatarFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('music_assets').getPublicUrl(fileName);
        finalAvatarUrl = data.publicUrl;
      }

    // [수정] Update 시 genres 포함
      const { error } = await supabase.from('profiles').update({
        username, bio, avatar_url: finalAvatarUrl,
        genres: selectedGenres // [추가]
      }).eq('wallet_address', address);

      if (error) throw error;

      toast.success("프로필이 업데이트되었습니다.");
      router.push('/');
    } catch (e: any) {
      toast.error("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNewAvatarFile(e.target.files[0]);
      setAvatarUrl(URL.createObjectURL(e.target.files[0])); // 미리보기
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Link href="/market" className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition"><ArrowLeft size={18}/> Cancel</Link>
        
        <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden group-hover:border-cyan-500 transition **flex justify-center items-center**">
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : <Camera className="**text-zinc-600**"/>}
                </div>
                <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                <div className="absolute bottom-0 right-0 bg-zinc-800 p-1.5 rounded-full border border-zinc-700 text-blue-400"><Camera size={14}/></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white focus:border-cyan-500 outline-none"/>
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 mt-1 text-white h-24 resize-none focus:border-cyan-500 outline-none"/>
            </div>
          </div>

        {/* [추가] Genre Selector */}
        <div>
            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">My Taste</label>
            <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                    <button key={g} onClick={() => toggleGenre(g)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedGenres.includes(g) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {g}
                    </button>
                ))}
            </div>
        </div>

          <button onClick={handleSave} disabled={saving} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin"/> : <>Save Changes <Save size={18}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}