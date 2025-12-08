'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Coins, Zap, Timer, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdBanner from '../components/AdBanner';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { ConnectButton } from "thirdweb/react"; // 지갑 연결 버튼
import { inAppWallet, createWallet } from "thirdweb/wallets"; // 지갑 옵션

// Contract Definition
const tokenContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any
});

const wallets = [
  inAppWallet({ auth: { options: ["google", "email", "apple"] } }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export default function EarnPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const [loading, setLoading] = useState(false); // 광고 시청 중 여부
  const [timeLeft, setTimeLeft] = useState(0); 
  const [canClaim, setClaim] = useState(true);
  const [rewardType, setRewardType] = useState<'pMLD' | 'MLD'>('pMLD');

  // Timer Logic
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && loading) {
      // 광고 시청 끝 -> 보상 지급 실행
      distributeReward();
    }
  }, [timeLeft, loading]);

  const resetTimer = () => {
    setClaim(false);
    setTimeout(() => setClaim(true), 60000); // 1분 쿨타임
  };

  const startAdWatch = () => {
    if (timeLeft > 0 || !canClaim) return;
    setLoading(true);
    setTimeLeft(5); // 5초 테스트
  };

  const distributeReward = async () => {
    try {
      if (rewardType === 'pMLD') {
        // [Web2] pMLD Claim
        const { data: { user } } = await supabase.auth.getUser();
        // 로그인 체크 (지갑 혹은 이메일)
        if (!user && !address) {
            toast.error("로그인이 필요합니다.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.rpc('claim_pmld_faucet', { amount: 10 });
        if (error) throw error;
        
        toast.success("10 pMLD 적립 완료!");
        setLoading(false);
        resetTimer();

      } else {
        // [Web3] MLD Mint
        if (!address) {
            toast.error("지갑 연결이 필요합니다.");
            setLoading(false);
            return;
        }

        const transaction = prepareContractCall({
            contract: tokenContract,
            method: "mint",
            params: [address, BigInt(10 * 1e18)]
        });

        // 트랜잭션 전송 (비동기) - loading 상태는 트랜잭션 시작 시 해제하고, txPending으로 넘어감
        sendTransaction(transaction, {
            onSuccess: () => {
                toast.success("10 MLD가 지갑으로 전송되었습니다!");
                resetTimer();
            },
            onError: (err) => {
                console.error(err);
                toast.error("전송 실패");
            }
        });
        // 광고 시청 로딩은 끝남 (이제 지갑 서명 대기)
        setLoading(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("적립 실패: " + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black -z-10"></div>
      
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
            <Link href="/market" className="text-zinc-500 hover:text-white transition flex items-center gap-2">
                <ArrowLeft size={18}/> Back
            </Link>
            <div className="text-right">
                <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                    AD REWARDS
                </h1>
                <p className="text-[10px] text-zinc-500 font-mono">WATCH TO EARN</p>
            </div>
        </div>

        {/* Ad Area */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="absolute -top-3 -right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-bounce">
                HOT
            </div>
            
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Zap className="text-yellow-400" size={20}/> Daily Faucet
            </h2>

            {/* 광고 컴포넌트 */}
            <AdBanner />
            
            <p className="text-center text-zinc-500 text-xs my-4">
                광고를 5초간 시청하면 보상이 지급됩니다.
            </p>

            {/* Reward Type Selector */}
            <div className="flex bg-zinc-950 p-1 rounded-lg mb-6 border border-zinc-800">
                <button 
                    onClick={() => setRewardType('pMLD')}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-2 ${rewardType==='pMLD' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Coins size={14}/> 10 pMLD (Web2)
                </button>
                <button 
                    onClick={() => setRewardType('MLD')}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-2 ${rewardType==='MLD' ? 'bg-zinc-800 text-green-400 shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Zap size={14}/> 10 MLD (Web3)
                </button>
            </div>

            {/* Claim Button */}
            <button 
                onClick={startAdWatch}
                disabled={loading || isTxPending || !canClaim || (rewardType === 'MLD' && !address)}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    !canClaim ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' :
                    (loading || isTxPending) ? 'bg-yellow-600/50 text-yellow-200 cursor-wait' :
                    'bg-white text-black hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                }`}
            >
                {loading ? (
                    <>
                        <Timer className="animate-spin" size={20}/> 
                        Watching Ad ({timeLeft}s)...
                    </>
                ) : isTxPending ? (
                    <>
                        <Loader2 className="animate-spin" size={20}/> 
                        Signing Transaction...
                    </>
                ) : !canClaim ? (
                    <>Cooldown active...</>
                ) : (
                    <>Watch & Claim <CheckCircle size={20}/></>
                )}
            </button>
        </div>

        {/* Footer Info */}
        <div className="text-center text-zinc-600 text-xs">
            {rewardType === 'MLD' && !address ? (
                <div className="flex flex-col items-center gap-2 mt-4">
                    <p>MLD를 받으려면 지갑을 연결하세요.</p>
                    <ConnectButton 
                        client={client}
                        wallets={wallets}
                        chain={chain}
                        connectButton={{
                            label: "Connect Wallet to Earn",
                            style: { fontSize: "12px", padding: "8px 16px", borderRadius: "99px" }
                        }}
                    />
                </div>
            ) : (
                <p className="mt-4">하루 최대 10회 참여 가능합니다.</p>
            )}
        </div>
      </div>
    </div>
  );
}