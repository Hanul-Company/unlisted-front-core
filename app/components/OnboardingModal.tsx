'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Sparkles, CheckCircle, Music } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyzeUserTaste } from '@/app/actions/analyze-music'; // 아까 만든 서버 액션 활용

interface OnboardingModalProps {
  userAddress: string;
  initialUsername: string;
  initialAvatar: string | null;
  onComplete: () => void;
}

export default function OnboardingModal({ userAddress, initialUsername, initialAvatar, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1); // 1: Welcome & Name, 2: Music Taste
  const [username, setUsername] = useState(initialUsername);
  const [loading, setLoading] = useState(false);
  
  // Music Taste Inputs
  const [artists, setArtists] = useState(['', '', '']);

  const handleSaveProfile = async () => {
    setLoading(true);
    const toastId = toast.loading("Setting up your profile...");

    try {
      // 1. AI Analysis (입력된 아티스트가 있을 경우)
      const cleanArtists = artists.filter(a => a.trim() !== '');
      let musicTasteData = {};

      if (cleanArtists.length > 0) {
          // 트랙 정보는 없으니 빈 배열로 보냄
          const result = await analyzeUserTaste(cleanArtists, []); 
          if (result) {
            musicTasteData = {
                ...result,
                input_artists: artists,
                updated_at: new Date().toISOString()
            };
          }
      }

      // 2. Update Profile
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username,
          music_taste: musicTasteData, // AI 분석 결과 저장
          // avatar는 이미 생성때 들어갔으므로 수정 안함 (필요하면 추가)
        })
        .eq('wallet_address', userAddress);

      if (error) throw error;

      toast.success("Welcome to Unlisted!", { id: toastId });
      onComplete(); // 모달 닫기
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background Deco */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"/>

        <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-900/20 border-2 border-zinc-800">
                {initialAvatar ? <img src={initialAvatar} className="w-full h-full rounded-full"/> : <Sparkles className="text-green-400"/>}
            </div>

            <h2 className="text-2xl font-black text-white mb-2">Welcome, Investor!</h2>
            <p className="text-zinc-400 text-sm mb-8">Let's set up your profile to start collecting.</p>

            <div className="space-y-6 text-left">
                {/* Username Input */}
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Display Name</label>
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
                                placeholder={`Artist ${idx + 1}`}
                                className="w-full bg-black/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition"
                            />
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">* AI will curate your feed based on this.</p>
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