'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount } from "thirdweb/react"; // Wallet Hook
import { Loader2, Coins, Zap, CheckCircle, ArrowLeft, Tv, X } from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import AdPlayer from '../components/AdPlayer'; // 아까 만든 플레이어

export default function EarnPage() {
  // ✅ [수정 1] Thirdweb Account 사용
  const account = useActiveAccount();
  const address = account?.address;

  const [loading, setLoading] = useState(false);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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

  // ✅ [수정 2] 보상 지급 로직 (Wallet 기반 RPC 호출)
  const handleRewardClaim = async () => {
    setAdModalOpen(false);
    setLoading(true);

    try {
      // 1. 지갑 연결 확인
      if (!address) {
        toast.error("Wallet disconnected. Cannot claim.");
        setLoading(false);
        return;
      }

      // 2. RPC 호출 (지갑 주소 전달)
      const { data: result, error } = await supabase.rpc('claim_pmld_faucet_by_wallet', { 
          p_wallet_address: address, // 로그인 세션 대신 지갑 주소 전달
          p_amount: 10 
      });

      if (error) throw error;

      if (result === 'OK') {
          toast.success("Reward Claimed! +10 pMLD");
          setCooldown(60); // 1분 쿨타임
      } else if (result === 'NO_PROFILE') {
          toast.error("Profile not found. Please sign up first.");
      } else {
          throw new Error(result);
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
      
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black -z-10"></div>
      
      <div className="w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
            <Link href="/market" className="text-zinc-500 hover:text-white transition flex items-center gap-2">
                <ArrowLeft size={18}/> Back
            </Link>
            <div className="text-right">
                <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 pr-1">
                    FREE FAUCET
                </h1>
                <p className="text-[10px] text-zinc-500 font-mono">WATCH ADS & EARN POINTS</p>
            </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"/>

            <div className="text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center border-4 border-zinc-700 shadow-lg">
                    <Coins size={36} className="text-yellow-400"/>
                </div>

                <div>
                    <h2 className="text-3xl font-black text-white mb-2">10 pMLD</h2>
                    <p className="text-zinc-400 text-sm">
                        Watch a short video ad to claim free points.<br/>
                        Use points to collect music or boost tracks.
                    </p>
                </div>

                <div className="flex justify-center">
                    {cooldown > 0 ? (
                        <div className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full text-xs font-mono font-bold flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin"/> Refilling... {cooldown}s
                        </div>
                    ) : (
                        <div className="bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-xs font-mono font-bold flex items-center gap-2">
                            <Zap size={12} fill="currentColor"/> Ready to Claim
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleStartWatch}
                    disabled={loading || cooldown > 0}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                        cooldown > 0 
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:scale-[1.02] hover:shadow-yellow-500/20'
                    }`}
                >
                    {loading ? <Loader2 className="animate-spin"/> : <><Tv size={20}/> Watch Ad to Earn</>}
                </button>
            </div>
        </div>

        <p className="text-center text-zinc-600 text-xs">
            * Rewards are credited instantly as pMLD (Web2 Points).<br/>
            * Abuse of the system may lead to account suspension.
        </p>
      </div>

      {/* ✅ AdPlayer가 들어있는 모달 */}
      {adModalOpen && (
        <AdWatchModal 
            onComplete={handleRewardClaim} 
            onClose={() => setAdModalOpen(false)}
        />
      )}
    </div>
  );
}

// [AdWatchModal] 기존과 동일하지만 AdPlayer 적용 확인
function AdWatchModal({ onComplete, onClose }: { onComplete: () => void, onClose: () => void }) {
    // 테스트용 VAST 태그 (나중에 본인 것으로 교체)
    const VAST_TAG_URL = "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <div className="text-xs font-bold text-zinc-400 bg-black/50 px-3 py-1 rounded-full border border-zinc-700">
                    Sponsored Ad
                </div>
                <button 
                    onClick={onClose} 
                    className="text-zinc-400 hover:text-white pointer-events-auto bg-black/50 p-2 rounded-full"
                >
                    <X size={20}/>
                </button>
            </div>

            <div className="w-full max-w-4xl aspect-video bg-black relative flex items-center justify-center overflow-hidden shadow-2xl">
                <AdPlayer 
                    vastUrl={VAST_TAG_URL} 
                    onComplete={onComplete} 
                />
            </div>

            <div className="absolute bottom-10 text-center space-y-2 pointer-events-none">
                <p className="text-zinc-500 text-xs">Advertisement provided by Google</p>
            </div>
        </div>
    );
}