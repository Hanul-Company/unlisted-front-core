'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react"; 
import { Loader2, Coins, Zap, CheckCircle, ArrowLeft, Tv, X, Smartphone } from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import AdPlayer from '../components/AdPlayer'; 

export default function EarnPage() {
  const account = useActiveAccount();
  const address = account?.address;

  const [loading, setLoading] = useState(false);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 쿨타임 타이머
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleStartWatch = () => {
    if (!address) {
        toast.error("Please connect your wallet first.");
        return;
    }
    if (cooldown > 0) {
      toast.error(`Please wait ${cooldown}s for the next ad.`);
      return;
    }
    setAdModalOpen(true);
  };

  // ✅ [수정됨] RPC 교체 (reward_engagement)
  const handleRewardClaim = async () => {
    setAdModalOpen(false);
    setLoading(true);

    try {
      if (!address) {
        toast.error("Wallet disconnected.");
        setLoading(false);
        return;
      }

      // 🚨 여기가 핵심 변경 사항입니다!
      const { data: result, error } = await supabase.rpc('reward_engagement', { 
          p_wallet_address: address, 
          p_amount: 10,               // 보상량 (10 pMLD)
          p_activity_type: 'ad_revenue' // ✅ Studio 대시보드 분류용 키워드
      });

      if (error) throw error;

      if (result === 'SUCCESS') {
          toast.success("Reward Claimed! +10 pMLD");
          setCooldown(60); // 1분 쿨타임
      } else if (result === 'USER_NOT_FOUND') {
          toast.error("Profile not found. Please sign up first.");
      } else {
          throw new Error(result || "Unknown error");
      }

    } catch (e: any) {
      console.error(e);
      toast.error("Claim Failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black -z-10"></div>
      
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
            <Link href="/market" className="text-zinc-500 hover:text-white transition flex items-center gap-2">
                <ArrowLeft size={18}/> Back
            </Link>
            <div className="text-right">
                <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 pr-1">
                    EARN POINTS
                </h1>
                <p className="text-[10px] text-zinc-500 font-mono">WATCH & EARN REWARDS</p>
            </div>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-yellow-500/20 transition duration-1000"/>

            <div className="text-center space-y-6">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-xl relative">
                     <Coins size={40} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"/>
                     <div className="absolute -bottom-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                        +10 pMLD
                     </div>
                </div>

                <div>
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Watch Ad</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Watch a short video to support the platform<br/>
                        and earn <span className="text-yellow-400 font-bold">Free Points</span> instantly.
                    </p>
                </div>

                {/* Status Indicator */}
                <div className="flex justify-center min-h-[30px]">
                    {cooldown > 0 ? (
                        <div className="bg-zinc-800/50 text-zinc-500 px-4 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 border border-zinc-800">
                            <Loader2 size={12} className="animate-spin"/> Refilling... {cooldown}s
                        </div>
                    ) : (
                        <div className="bg-green-500/10 text-green-400 px-4 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 border border-green-500/20 animate-pulse">
                            <Zap size={12} fill="currentColor"/> Ready to Claim
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button 
                    onClick={handleStartWatch}
                    disabled={loading || cooldown > 0}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg transform active:scale-95 ${
                        cooldown > 0 
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700' 
                        : 'bg-white text-black hover:bg-zinc-200 hover:shadow-yellow-500/10'
                    }`}
                >
                    {loading ? <Loader2 className="animate-spin"/> : <><Tv size={20}/> Watch Video</>}
                </button>
            </div>
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-2">
             <p className="text-zinc-600 text-[10px] flex items-center justify-center gap-1">
                <Smartphone size={10}/>
                <span>Works on Mobile & Desktop</span>
             </p>
             <p className="text-zinc-700 text-[10px]">
                * Points are credited to your account instantly.<br/>
                * Abuse may lead to account restrictions.
            </p>
        </div>
      </div>

      {/* Ad Modal */}
      {adModalOpen && (
        <AdWatchModal 
            onComplete={handleRewardClaim} 
            onClose={() => setAdModalOpen(false)}
        />
      )}
    </div>
  );
}

// [Sub Component] Ad Modal (UI Polish)
function AdWatchModal({ onComplete, onClose }: { onComplete: () => void, onClose: () => void }) {
    // 
    const VAST_TAG_URL = "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="absolute top-6 right-6 z-20">
                <button 
                    onClick={onClose} 
                    className="text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition backdrop-blur-md"
                >
                    <X size={24}/>
                </button>
            </div>

            <div className="w-full max-w-4xl aspect-video bg-black relative flex items-center justify-center overflow-hidden shadow-2xl rounded-2xl border border-zinc-800">
                <AdPlayer 
                    vastUrl={VAST_TAG_URL} 
                    onComplete={onComplete} 
                />
            </div>

            <div className="mt-8 text-center space-y-2">
                <p className="text-white font-bold text-lg animate-pulse">Watching Advertisement...</p>
                <p className="text-zinc-500 text-xs">Do not close the window until the ad finishes.</p>
            </div>
        </div>
    );
}