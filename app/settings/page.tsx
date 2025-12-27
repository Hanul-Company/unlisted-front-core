'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "@/lib/i18n";
import { Camera, Save, Loader2, ArrowLeft, Instagram, Twitter, Youtube, Music, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";

// 장르 목록 (기존 유지)
const GENRES = ["Pop", "K-Pop", "K-Hip Hop", "R&B", "Hip-hop", "Trap", "Lo-fi", "Rock", "Indie Rock", "EDM", "House", "Future Bass", "Jazz", "Acoustic", "Singer-Songwriter", "City Pop"];

export default function SettingsPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  
  // ✅ [NEW] Social Links State
// 1. Socials 초기 상태 정의
  const [socials, setSocials] = useState({
    instagram: '',
    twitter: '',
    youtube: '',
    spotify: '',
    tiktok: '' // 틱톡 등 나중에 추가하기 쉬움
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address)
        .single();

      if (data) {
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
        setSelectedGenres(data.genres || []);
        
        // ✅ [핵심 수정] DB에 저장된 JSON과 초기 상태를 병합
        if (data.social_links) {
           // 기존 state 구조를 유지하면서 DB 데이터를 덮어씌움
           setSocials(prev => ({ ...prev, ...data.social_links }));
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [address]);

  const toggleGenre = (g: string) => { 
    if (selectedGenres.includes(g)) setSelectedGenres(selectedGenres.filter(i => i !== g));
    else { if(selectedGenres.length >= 3) return toast.error("Max 3"); setSelectedGenres([...selectedGenres, g]); }
  };

  const handleSave = async () => {
    if (!address) return;
    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;
      if (newAvatarFile) {
        const fileName = `avatar_${address}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('music_assets').upload(fileName, newAvatarFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('music_assets').getPublicUrl(fileName);
        finalAvatarUrl = data.publicUrl;
      }

      // ✅ [핵심 수정] social_links를 JSON 객체로 저장
      const { error } = await supabase.from('profiles').update({
        username, 
        bio, 
        avatar_url: avatarUrl, // finalAvatarUrl 변수 사용 주의
        genres: selectedGenres,
        social_links: socials // 객체 그대로 저장 (JSONB)
      }).eq('wallet_address', address);

      if (error) throw error;
      toast.success("Profile Updated!");
      router.push('/portfolio'); // 저장 후 포트폴리오로 이동
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-xl">
        <Link href="/market" className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition text-sm font-bold"><ArrowLeft size={18}/> Back to Portfolio</Link>
        
        <h1 className="text-3xl font-black mb-1 text-white">Edit Profile</h1>
        <p className="text-zinc-500 text-sm mb-8">Customize your public persona.</p>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-sm">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <label className="relative cursor-pointer group">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-4 border-zinc-800 shadow-xl overflow-hidden group-hover:border-green-500 transition flex justify-center items-center relative">
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : <Camera className="text-zinc-600" size={32}/>}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold">CHANGE</div>
                </div>
                <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
            </label>
          </div>

          {/* Basic Info */}
          <div className="space-y-5">
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Display Name" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition font-bold"/>
            </div>
            <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white h-32 resize-none focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition text-sm"/>
            </div>
          </div>

          {/* Social Links (Linktree Style) */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 block flex items-center gap-2"><LinkIcon size={12}/> Social Links (ID only)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="relative">
                  <div className="absolute left-4 top-3.5 text-pink-500"><Instagram size={18}/></div>
                  <input placeholder="Instagram ID" value={socials.instagram} onChange={e=>setSocials({...socials, instagram: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-pink-500 outline-none"/>
               </div>
               <div className="relative">
                  <div className="absolute left-4 top-3.5 text-blue-400"><Twitter size={18}/></div>
                  <input placeholder="X (Twitter) ID" value={socials.twitter} onChange={e=>setSocials({...socials, twitter: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-blue-400 outline-none"/>
               </div>
               <div className="relative">
                  <div className="absolute left-4 top-3.5 text-red-500"><Youtube size={18}/></div>
                  <input placeholder="YouTube Handle" value={socials.youtube} onChange={e=>setSocials({...socials, youtube: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-red-500 outline-none"/>
               </div>
               <div className="relative">
                  <div className="absolute left-4 top-3.5 text-green-500"><Music size={18}/></div>
                  <input placeholder="Spotify Artist ID" value={socials.spotify} onChange={e=>setSocials({...socials, spotify: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-green-500 outline-none"/>
               </div>
            </div>
          </div>

          {/* Genres */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3 block">My Vibe (Max 3)</label>
            <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                    <button key={g} onClick={() => toggleGenre(g)} className={`px-4 py-2 rounded-full text-xs font-bold border transition ${selectedGenres.includes(g) ? 'bg-white text-black border-white' : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
                        {g}
                    </button>
                ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full bg-green-500 text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20">
            {saving ? <Loader2 className="animate-spin"/> : <>Save Profile <Save size={18}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}