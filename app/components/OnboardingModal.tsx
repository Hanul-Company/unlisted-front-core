'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from 'thirdweb/react'; // ✅ 지갑 정보 직접 가져오기
import { Loader2, Sparkles, CheckCircle, Music, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyzeUserTaste } from '@/app/actions/analyze-music';

// Props 제거 (스스로 해결하므로)
export default function OnboardingModal() {
  const account = useActiveAccount(); // 지갑 정보 가져오기
  const [show, setShow] = useState(false); // ✅ 보여줄지 말지 상태
  
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState(['', '', '']);
  const [initialAvatar, setInitialAvatar] = useState<string | null>(null);

  // ✅ [핵심] 컴포넌트가 마운트되면 스스로 검사 시작
  useEffect(() => {
    const checkUserStatus = async () => {
      // 1. 지갑 연결 안 됐으면 안 보여줌
      if (!account?.address) return;

      // 2. '나중에 하기' 눌렀으면 안 보여줌 (세션 스토리지)
      if (typeof window !== 'undefined' && sessionStorage.getItem('skip_onboarding') === 'true') {
        return;
      }

      // 3. DB 체크: 이미 닉네임이 있는지 확인
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('wallet_address', account.address)
          .single();

        if (data) {
          setInitialAvatar(data.avatar_url);
          // 닉네임이 없으면 -> 모달 띄움 (show = true)
          // 닉네임이 있으면 -> 안 띄움 (show = false 유지)
          if (!data.username) {
            setShow(true);
          }
        }
      } catch (e) {
        console.error("Profile check error:", e);
      }
    };

    checkUserStatus();
  }, [account?.address]);

  // ---------------------------------------------------------

  const handleSaveProfile = async () => {
    if (!account?.address) return;
    setLoading(true);
    const toastId = toast.loading("Setting up your profile...");

    try {
      const cleanArtists = artists.filter(a => a.trim() !== '');
      let musicTasteData = {};

      if (cleanArtists.length > 0) {
          const result = await analyzeUserTaste(cleanArtists, []); 
          if (result) {
            musicTasteData = { ...result, input_artists: artists, updated_at: new Date().toISOString() };
          }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ username: username, music_taste: musicTasteData })
        .eq('wallet_address', account.address);

      if (error) throw error;

      toast.success("Welcome to Unlisted!", { id: toastId });
      
      // ✅ 저장 후 새로고침 (가장 확실한 반영)
      window.location.reload();

    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem('skip_onboarding', 'true');
    setShow(false); // 그냥 닫기
  };

  // ✅ [핵심] 보여줄 조건이 아니면 아예 렌더링 안 함 (null 리턴)
  if (!show) return null;
  return (
// ✅ [수정 1] h-[100dvh] w-screen 추가: 화면 꽉 채우기 강제
    // ✅ [수정 2] flex-col 추가: 모바일에서 정렬이 더 안정적임
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center h-[100dvh] w-screen bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      
      {/* ✅ [수정 3] m-auto 추가: flex 컨테이너 안에서 스스로 중앙을 찾아가도록 강제 */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden m-auto">
        
        {/* ✅ [추가됨] X 닫기 버튼 (우측 상단) */}
        <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition p-2 rounded-full hover:bg-zinc-800 z-50"
            title="Do it later"
        >
            <X size={20} />
        </button>

        {/* Background Deco */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"/>

        <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-900/20 border-2 border-zinc-800">
                {initialAvatar ? <img src={initialAvatar} className="w-full h-full rounded-full object-cover"/> : <Sparkles className="text-green-400"/>}
            </div>

            <h2 className="text-2xl font-black text-white mb-2">Welcome to unlisted!</h2>
            <p className="text-zinc-400 text-sm mb-8">Let us know a little more about you.</p>

            <div className="space-y-6 text-left">
                {/* Username Input */}
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Artist name</label>
                    <input 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white font-bold focus:border-green-500 outline-none transition"
                        placeholder="Enter your name"
                    />
                </div>

                {/* Quick Taste Input */}
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
                        <Music size={12}/> Top 3 Favorite Artists
                    </label>
                    <div className="space-y-2">
                        {artists.map((artist, idx) => (
                            <input 
                                key={idx} 
                                value={artist} 
                                onChange={(e) => { const n = [...artists]; n[idx] = e.target.value; setArtists(n); }} 
                                placeholder={`Your go-to artist ${idx + 1}`}
                                className="w-full bg-black/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition"
                            />
                        ))}
                    </div>
                    <p className="text-center text-xs text-zinc-500 mt-2">We will get you what you would like.</p>
                </div>
            </div>

            <button 
                onClick={handleSaveProfile} 
                disabled={loading} 
                className="w-full mt-8 bg-green-500 text-black font-black py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
            >
                {loading ? <Loader2 className="animate-spin"/> : <>Get Started <CheckCircle size={18}/></>}
            </button>
        </div>
      </div>
    </div>
  );
}