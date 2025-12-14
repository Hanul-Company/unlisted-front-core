'use client';

import React, { useState, useEffect, Suspense } from 'react'; // [Suspense 추가]
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react";
import { Loader2, User, UserPlus, UserCheck, Disc } from 'lucide-react';
import { useSearchParams } from 'next/navigation'; // [변경] useParams -> useSearchParams
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';

// [중요] useSearchParams는 Suspense로 감싸야 빌드 에러가 안 납니다.
export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin"/></div>}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const targetWallet = searchParams.get('wallet') || ""; // [변경] ?wallet=0x... 가져오기

  const account = useActiveAccount();
  const myAddress = account?.address; // 없으면 undefined (비로그인)

  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks'|'likes'>('tracks');

  useEffect(() => {
    if (targetWallet) fetchProfileData();
  }, [targetWallet, myAddress]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('wallet_address', targetWallet).maybeSingle();
      setProfile(prof || { username: 'Unknown', wallet_address: targetWallet });

      if (myAddress) {
        const { data: follow } = await supabase.from('creator_follows')
            .select('*')
            .match({ follower_address: myAddress, creator_address: targetWallet })
            .maybeSingle();
        setIsFollowing(!!follow);
      }
      await fetchTabContent('tracks');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTabContent = async (tab: 'tracks'|'likes') => {
    setActiveTab(tab);
    let data;
    if (tab === 'tracks') {
        const res = await supabase.from('tracks').select('*').eq('uploader_address', targetWallet).order('created_at', { ascending: false });
        data = res.data;
    } else {
        const res = await supabase.from('likes').select('tracks(*)').eq('wallet_address', targetWallet);
        data = res.data?.map((d:any) => d.tracks);
    }
    setTracks(data || []);
  };

  const toggleFollow = async () => {
    if (!myAddress) return toast.error("지갑 연결 필요");
    if (myAddress === targetWallet) return toast.error("본인 팔로우 불가");

    if (isFollowing) {
        await supabase.from('creator_follows').delete().match({ follower_address: myAddress, creator_address: targetWallet });
        setIsFollowing(false);
        toast.success("Unfollowed");
    } else {
        await supabase.from('creator_follows').insert({ follower_address: myAddress, creator_address: targetWallet });
        setIsFollowing(true);
        toast.success("Followed!");
    }
  };

  if (!targetWallet) return <div className="min-h-screen bg-black text-white p-20 text-center">지갑 주소가 없습니다.</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-6 inline-block">← Back to Market</Link>

      <div className="flex flex-col md:flex-row items-center gap-8 mb-12 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800">
        <div className="w-32 h-32 rounded-full bg-zinc-800 overflow-hidden border-4 border-zinc-700 shadow-xl flex items-center justify-center">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover"/> : <User size={48} className="text-zinc-500"/>}
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-black">{profile?.username || 'Anonymous'}</h1>
            <p className="text-zinc-400 font-mono text-sm break-all">{targetWallet}</p>
            <p className="text-zinc-300 max-w-lg">{profile?.bio || "No bio yet."}</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
                {profile?.genres?.map((g:string) => (
                    <span key={g} className="text-xs bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full border border-cyan-500/30">#{g}</span>
                ))}
            </div>
        </div>
        <div>
            <button onClick={toggleFollow} className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition ${isFollowing ? 'bg-zinc-800 text-zinc-300 border border-zinc-600' : 'bg-white text-black hover:scale-105'}`}>
                {isFollowing ? <><UserCheck size={18}/> Following</> : <><UserPlus size={18}/> Follow</>}
            </button>
        </div>
      </div>

      <div className="flex gap-8 border-b border-zinc-800 mb-6">
        <button onClick={() => fetchTabContent('tracks')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='tracks' ? 'border-cyan-500 text-white' : 'border-transparent text-zinc-500'}`}>Uploaded Tracks</button>
        <button onClick={() => fetchTabContent('likes')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='likes' ? 'border-cyan-500 text-white' : 'border-transparent text-zinc-500'}`}>Liked Collection</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? <div className="col-span-full text-center py-20"><Loader2 className="animate-spin inline"/></div> : tracks.length === 0 ? <div className="col-span-full text-center py-20 text-zinc-500">No tracks found.</div> : (
            tracks.map(track => (
                <div key={track.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl hover:bg-zinc-800 transition group cursor-pointer">
                    <div className="aspect-square bg-black rounded-lg mb-4 overflow-hidden relative flex items-center justify-center">
                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <Disc className="text-zinc-700" size={32}/>}
                    </div>
                    <h3 className="font-bold truncate">{track.title}</h3>
                    <p className="text-xs text-zinc-500">{new Date(track.created_at).toLocaleDateString()}</p>
                </div>
            ))
        )}
      </div>
    </div>
  );
}