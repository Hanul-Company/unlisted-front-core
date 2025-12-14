'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Coins, Zap, ArrowRight, Activity, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile'; 
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';

// Contract Definition
const tokenContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any
});

export default function StudioPage() {
  // [Change] Wagmi -> Thirdweb Account
  const account = useActiveAccount();
  const address = account?.address;

  // [Change] Transaction Hook
  const { mutate: sendTransaction } = useSendTransaction();

  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [revenueLogs, setRevenueLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Swap States
  const [swapAmount, setSwapAmount] = useState<number>(0);
  const [isSwapping, setIsSwapping] = useState(false);

  // 1. 데이터 로드
  useEffect(() => {
    fetchStudioData();
  }, [address]);

  const fetchStudioData = async () => {
    setLoading(true);
    
    // 프로필 & 잔액
    // (지갑 연결 시 자동 가입된 정보 or 이메일 유저 정보)
    // 여기서는 간단히 RPC로 내 정보 가져오기
    const { data: prof } = await supabase.rpc('get_my_profile_with_balances');
    if (prof && prof.length > 0) setProfile(prof[0]);

    // 수익 로그
    const { data: logs } = await supabase
        .from('revenue_logs')
        .select(`*, tracks (title)`)
        .order('created_at', { ascending: false })
        .limit(20);
        
    setRevenueLogs(logs || []);
    setLoading(false);
  };

  // 3. 환전 로직 (Thirdweb 적용)
  const handleSwap = async () => {
    if (!address) return toast.error("지갑을 연결해야 환전할 수 있습니다.");
    if (swapAmount <= 0) return toast.error("환전할 수량을 입력하세요.");
    if (swapAmount > (profile?.p_mld_balance || 0)) return toast.error("보유 포인트가 부족합니다.");

    setIsSwapping(true);
    try {
        // A. DB에서 pMLD 차감 (Burn)
        // (이 부분은 오프체인 DB 작업이라 서명이 필요 없습니다)
        const { data: result, error } = await supabase.rpc('burn_pmld_for_conversion', { amount: swapAmount });
        
        if (error || result !== 'SUCCESS') {
            throw new Error(error?.message || "포인트 차감 실패");
        }

        // B. 온체인에서 MLD 지급 (Mint)
        // [Thirdweb] 트랜잭션 준비
        const transaction = prepareContractCall({
            contract: tokenContract,
            method: "mint",
            params: [address, BigInt(swapAmount * 1e18)]
        });

        // [Thirdweb] 전송 및 결과 처리
        sendTransaction(transaction, {
            onSuccess: () => {
                toast.success(`${swapAmount} MLD로 환전되었습니다!`);
                setIsSwapping(false);
                setSwapAmount(0);
                fetchStudioData(); // 잔액 갱신
            },
            onError: (err) => {
                console.error(err);
                toast.error("토큰 지급(Mint) 실패. 관리자에게 문의하세요."); // (참고: 실제론 DB 롤백이 필요할 수 있음)
                setIsSwapping(false);
            }
        });

    } catch (e: any) {
        console.error(e);
        toast.error(e.message);
        setIsSwapping(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <header className="mb-10 flex justify-between items-center">
        <div>
            <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-2 block">← Back to Market</Link>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
                Creator Studio
            </h1>
        </div>
        <HeaderProfile/>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Dashboard Cards */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Stats Overview */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase mb-2">
                        <Coins size={16}/> Total Points
                    </div>
                    <div className="text-4xl font-black text-white">{profile?.p_mld_balance || 0} <span className="text-lg text-zinc-500">pMLD</span></div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase mb-2">
                        <Activity size={16}/> Recent Revenue
                    </div>
                    <div className="text-4xl font-black text-green-400">+{revenueLogs.filter(l => l.activity_type === 'collect_fee').length} <span className="text-lg text-green-800">sales</span></div>
                </div>
            </div>

            {/* 2. Transaction History */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold">Revenue History</h3>
                    <span className="text-xs text-zinc-500">Last 20 activities</span>
                </div>
                <div className="divide-y divide-zinc-800 max-h-[400px] overflow-y-auto">
                    {loading ? (
                        <div className="p-10 text-center"><Loader2 className="animate-spin inline"/></div>
                    ) : revenueLogs.length === 0 ? (
                        <div className="p-10 text-center text-zinc-500 text-sm">아직 수익 내역이 없습니다.</div>
                    ) : (
                        revenueLogs.map((log) => (
                            <div key={log.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.activity_type === 'convert_out' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                        {log.activity_type === 'convert_out' ? <ArrowRight size={14}/> : <DollarSign size={14}/>}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">
                                            {log.activity_type === 'collect_fee' ? 'Song Collected' : 
                                             log.activity_type === 'convert_out' ? 'Converted to Token' : 'Revenue'}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {log.tracks?.title ? `Track: ${log.tracks.title}` : new Date(log.created_at).toLocaleDateString()}
                                            {log.payer_address && ` • From ${log.payer_address.slice(0,6)}...`}
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-mono font-bold ${log.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {log.amount > 0 ? '+' : ''}{log.amount} {log.currency}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Right Column: Swap Station */}
        <div className="space-y-6">
            <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500 blur-[80px] opacity-20"/>
                
                <h3 className="text-xl font-black mb-1 flex items-center gap-2"><Zap className="text-yellow-400 fill-yellow-400"/> Swap Station</h3>
                <p className="text-zinc-400 text-xs mb-6">Convert your earned points to real tokens.</p>
                
                <div className="bg-black/50 rounded-xl p-4 border border-zinc-700 mb-2">
                    <div className="text-xs text-zinc-500 mb-1">From (Points)</div>
                    <div className="flex justify-between items-center">
                        <input 
                            type="number" 
                            value={swapAmount}
                            onChange={(e) => setSwapAmount(Number(e.target.value))}
                            className="bg-transparent text-2xl font-bold w-full outline-none"
                            placeholder="0"
                        />
                        <span className="text-sm font-bold text-zinc-400">pMLD</span>
                    </div>
                </div>
                
                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-zinc-800 rounded-full p-1.5 border border-zinc-600">
                        <ArrowRight size={16} className="text-zinc-400 rotate-90"/>
                    </div>
                </div>

                <div className="bg-black/50 rounded-xl p-4 border border-zinc-700 mt-2 mb-6">
                    <div className="text-xs text-zinc-500 mb-1">To (Crypto)</div>
                    <div className="flex justify-between items-center">
                        <div className="text-2xl font-bold text-green-400">{swapAmount}</div>
                        <span className="text-sm font-bold text-green-500">MLD</span>
                    </div>
                </div>

                <button 
                    onClick={handleSwap}
                    disabled={isSwapping || swapAmount <= 0}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSwapping ? <Loader2 className="animate-spin"/> : <>Confirm Swap <Wallet size={18}/></>}
                </button>
                
                <p className="text-[10px] text-zinc-500 text-center mt-4">
                    * 1 pMLD = 1 MLD (1:1 Ratio)<br/>
                    * Blockchain transaction fee (Matic) required.
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}