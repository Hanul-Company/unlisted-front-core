'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Loader2, TrendingUp, DollarSign, Music, ListMusic, 
  PieChart, Wallet, Calendar, ChevronRight, Activity, Zap, RefreshCw, Coins 
} from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile'; 
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';

// [Thirdweb]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther } from 'viem';

// Contract
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

// [Sub-Component] Stat Card
const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => (
  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition">
    <div className={`absolute -top-2 -right-2 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 ${color}`}>
        <Icon size={80} />
    </div>
    <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <Icon size={14} /> {title}
        </div>
        <div className="text-3xl font-black text-white mb-1 tracking-tight">{value}</div>
        <div className="text-xs text-zinc-500 font-mono">{subValue}</div>
    </div>
  </div>
);

// [Sub-Component] Revenue Stream Card (Dual Currency Support)
const RevenueStreamCard = ({ title, pmldAmount, mldAmount, count, description, icon: Icon, colorClass }: any) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-zinc-800/50 transition cursor-pointer group relative overflow-hidden gap-4">
        <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass} bg-opacity-10 text-white shadow-inner flex-shrink-0`}>
                <Icon size={28} className={colorClass.replace('bg-', 'text-')} />
            </div>
            <div>
                <h3 className="font-bold text-base text-zinc-200 group-hover:text-white transition">{title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{description}</p>
                <div className="text-[10px] text-zinc-600 mt-1 font-mono">{count} transactions</div>
            </div>
        </div>
        
        {/* 수익금 표시 영역 (병기) */}
        <div className="text-right flex flex-col items-end gap-1 w-full md:w-auto">
            {pmldAmount > 0 && (
                <div className="font-bold text-lg text-white flex items-center gap-2">
                    {pmldAmount.toLocaleString()} <span className="text-xs font-normal text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">pMLD</span>
                </div>
            )}
            {mldAmount > 0 && (
                <div className="font-bold text-lg text-emerald-400 flex items-center gap-2">
                    {mldAmount.toLocaleString()} <span className="text-xs font-normal text-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 rounded">MLD</span>
                </div>
            )}
            {pmldAmount === 0 && mldAmount === 0 && (
                <span className="text-zinc-600 text-sm font-bold">-</span>
            )}
        </div>
    </div>
);

// [Sub-Component] Swap Modal
const SwapModal = ({ isOpen, onClose, balance, onSwapSuccess }: any) => {
    const { mutate: sendTransaction } = useSendTransaction();
    const [amount, setAmount] = useState<number | ''>('');
    const [isSwapping, setIsSwapping] = useState(false);
    const account = useActiveAccount();

    const handleSwap = async () => {
        if (!account?.address) return toast.error("Wallet required.");
        const val = Number(amount);
        if (val <= 0) return toast.error("Enter amount.");
        if (val > balance) return toast.error("Insufficient pMLD balance.");

        setIsSwapping(true);
        try {
            // 1. DB Burn
            const { data: res, error } = await supabase.rpc('burn_pmld_for_conversion', { amount: val });
            if (error || res !== 'SUCCESS') throw new Error("Burn failed");

            // 2. Blockchain Mint
            const tx = prepareContractCall({
                contract: tokenContract,
                method: "mint",
                params: [account.address, parseEther(val.toString())]
            });

            sendTransaction(tx, {
                onSuccess: () => {
                    toast.success(`Swapped ${val} pMLD to MLD!`);
                    onSwapSuccess();
                    onClose();
                },
                onError: () => {
                    toast.error("Minting failed. Contact support."); // 실제론 롤백 로직 필요
                }
            });
        } catch (e) {
            console.error(e);
            toast.error("Swap failed.");
        } finally {
            setIsSwapping(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><RefreshCw size={20}/> Swap to Token</h3>
                <div className="bg-black rounded-xl p-4 border border-zinc-800 mb-4">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>From (Points)</span>
                        <span>Max: {balance}</span>
                    </div>
                    <input type="number" className="w-full bg-transparent text-2xl font-bold text-white outline-none" placeholder="0" value={amount} onChange={e => setAmount(Number(e.target.value))}/>
                </div>
                <div className="flex justify-center -my-3 relative z-10"><div className="bg-zinc-800 p-1.5 rounded-full border border-zinc-600"><Zap size={14} className="text-yellow-400 fill-yellow-400"/></div></div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700 mt-2 mb-6">
                     <div className="text-xs text-zinc-500 mb-1">To (MLD Token)</div>
                     <div className="text-2xl font-bold text-emerald-400">{amount || 0}</div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 rounded-xl font-bold text-zinc-400 hover:text-white">Cancel</button>
                    <button onClick={handleSwap} disabled={isSwapping} className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 flex justify-center items-center gap-2">
                        {isSwapping ? <Loader2 className="animate-spin"/> : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function StudioPage() {
  const account = useActiveAccount();
  const address = account?.address;

  // States
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Analytics State
  const [trackRevenue, setTrackRevenue] = useState({ pmld: 0, mld: 0, count: 0 });
  const [playlistRevenue, setPlaylistRevenue] = useState({ pmld: 0, mld: 0, count: 0 });
  const [investRevenue, setInvestRevenue] = useState({ mld: 0, count: 0 }); // 투자는 MLD만 존재
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Swap Modal
  const [showSwapModal, setShowSwapModal] = useState(false);

  useEffect(() => {
    if (address) fetchStudioData();
  }, [address]);

  const fetchStudioData = async () => {
    setLoading(true);
    try {
        // 1. 프로필 및 잔액 (pMLD)
        const { data: prof } = await supabase.rpc('get_my_profile_with_balances');
        if (prof && prof.length > 0) setProfile(prof[0]);

        // 2. 통합 로그 조회 (currency 필드 가정: 'pMLD' | 'MLD')
        const { data: logs } = await supabase
            .from('revenue_logs')
            .select(`*, tracks (title)`)
            .eq('payee_address', address)
            .order('created_at', { ascending: false });

        if (logs) {
            // --- A. 집계 로직 ---
            const tracks = { pmld: 0, mld: 0, count: 0 };
            const playlists = { pmld: 0, mld: 0, count: 0 };
            const invest = { mld: 0, count: 0 };

            logs.forEach(log => {
                const amount = Number(log.amount);
                const currency = log.currency || 'pMLD'; // Default to pMLD if null

                if (log.activity_type === 'collect_fee') {
                    // 음악 판매
                    if (currency === 'MLD') tracks.mld += amount;
                    else tracks.pmld += amount;
                    tracks.count++;
                } else if (log.activity_type === 'curator_reward') {
                    // 플레이리스트 보상
                    if (currency === 'MLD') playlists.mld += amount;
                    else playlists.pmld += amount;
                    playlists.count++;
                } else if (['royalty', 'trade_fee'].includes(log.activity_type)) {
                    // 투자 수익 (무조건 MLD)
                    invest.mld += amount;
                    invest.count++;
                }
            });

            setTrackRevenue(tracks);
            setPlaylistRevenue(playlists);
            setInvestRevenue(invest);

            // --- B. 로그 포매팅 ---
            setRecentLogs(logs.slice(0, 15).map(log => ({
                id: log.id,
                title: log.tracks?.title || getTitleByType(log.activity_type),
                type: formatType(log.activity_type),
                amount: log.amount,
                currency: log.currency || 'pMLD',
                date: log.created_at,
                icon: getIconByType(log.activity_type),
                color: getColorByType(log.activity_type)
            })));
        }

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  // Helper Functions
  const getTitleByType = (type: string) => {
      if (type === 'curator_reward') return 'Playlist Reward';
      if (type === 'royalty') return 'Trading Royalty';
      return 'Revenue';
  };
  const formatType = (type: string) => {
      if (type === 'collect_fee') return 'Music Sales';
      if (type === 'curator_reward') return 'Curator Reward';
      if (type === 'royalty') return 'Investment Income';
      return type.replace('_', ' ');
  };
  const getIconByType = (type: string) => {
      if (type === 'collect_fee') return Music;
      if (type === 'curator_reward') return ListMusic;
      return TrendingUp;
  };
  const getColorByType = (type: string) => {
      if (type === 'collect_fee') return 'text-blue-400 bg-blue-500/10';
      if (type === 'curator_reward') return 'text-purple-400 bg-purple-500/10';
      return 'text-emerald-400 bg-emerald-500/10';
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      
      {/* Navigation */}
      <div className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link href="/market" className="text-zinc-500 hover:text-white transition font-bold text-sm">Exit Studio</Link>
                <div className="h-4 w-px bg-zinc-800"></div>
                <h1 className="font-black text-lg tracking-tight">Creator<span className="text-emerald-500">Studio</span></h1>
            </div>
            <HeaderProfile/>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        
        {/* 1. Overview Section with Swap */}
        <section className="flex flex-col lg:flex-row gap-8 items-stretch">
            <div className="flex-1 space-y-2">
                <h2 className="text-4xl font-black text-white tracking-tight">Overview</h2>
                <p className="text-zinc-400">
                    Welcome, <span className="text-white font-bold">{profile?.username || 'Creator'}</span>.
                </p>
                <div className="pt-4 flex gap-4">
                    <StatCard 
                        title="My Points" 
                        value={profile?.p_mld_balance?.toLocaleString()} 
                        subValue="pMLD (Convertible)" 
                        icon={Coins} 
                        color="text-yellow-500" 
                    />
                    <div className="flex flex-col justify-end">
                        {/* ✅ SWAP BUTTON: Only for pMLD */}
                        <button 
                            onClick={() => setShowSwapModal(true)}
                            className="h-full px-6 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/50 transition group flex flex-col items-center justify-center gap-2"
                        >
                            <RefreshCw size={24} className="text-zinc-400 group-hover:text-emerald-400 group-hover:rotate-180 transition duration-500"/>
                            <span className="text-xs font-bold text-zinc-300">Convert to MLD</span>
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Total MLD Card */}
            <div className="flex-shrink-0 bg-gradient-to-br from-emerald-900/20 to-zinc-900 border border-emerald-500/20 p-8 rounded-2xl flex flex-col justify-center min-w-[300px] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 blur-[80px] opacity-10 group-hover:opacity-20 transition"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-xs mb-2">
                        <Wallet size={16}/> Wallet Earnings
                    </div>
                    <div className="text-5xl font-black text-white tracking-tight">
                        {(trackRevenue.mld + playlistRevenue.mld + investRevenue.mld).toLocaleString()}
                        <span className="text-lg font-medium text-emerald-500 ml-2">MLD</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                        Total tokens earned from all streams
                    </div>
                </div>
            </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            {/* 2. Detailed Revenue Breakdown (Left Column) */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Activity size={20} className="text-zinc-400"/> Revenue Streams</h3>
                </div>

                <div className="space-y-4">
                    {/* A. Music Sales (Dual Currency) */}
                    <RevenueStreamCard 
                        title="Music Sales" 
                        pmldAmount={trackRevenue.pmld}
                        mldAmount={trackRevenue.mld}
                        count={trackRevenue.count}
                        description="Revenue from track collections & rentals."
                        icon={Music}
                        colorClass="bg-blue-500"
                    />

                    {/* B. Playlist Rewards (Dual Currency) */}
                    <RevenueStreamCard 
                        title="Curator Rewards" 
                        pmldAmount={playlistRevenue.pmld}
                        mldAmount={playlistRevenue.mld}
                        count={playlistRevenue.count}
                        description="Rewards from playlist forks & usage."
                        icon={ListMusic}
                        colorClass="bg-purple-500"
                    />

                    {/* C. Investment Income (Only MLD) */}
                    <RevenueStreamCard 
                        title="Investment & Royalties" 
                        pmldAmount={0} // No pMLD
                        mldAmount={investRevenue.mld}
                        count={investRevenue.count}
                        description="Dividends from IP shares & trading fees."
                        icon={TrendingUp}
                        colorClass="bg-emerald-500"
                    />
                </div>

                {/* Monthly Chart (Visual) */}
                <div className="mt-8 pt-8 border-t border-zinc-800">
                     <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider">Performance Trend</h3>
                     <div className="h-48 flex items-end justify-between gap-2 px-2 border-b border-zinc-800 pb-2">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                            <div key={i} className="w-full bg-zinc-800/50 rounded-t-sm relative group hover:bg-emerald-500/20 transition-colors" style={{ height: `${h}%` }}></div>
                        ))}
                     </div>
                </div>
            </div>

            {/* 3. Recent Activity (Right Column) */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden h-fit">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h3 className="font-bold text-white flex items-center gap-2"><Calendar size={16}/> History</h3>
                </div>
                <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {recentLogs.length === 0 ? (
                        <div className="p-10 text-center text-zinc-500 text-sm">No recent activity.</div>
                    ) : (
                        recentLogs.map((log) => (
                            <div key={log.id} className="p-4 hover:bg-zinc-800/50 transition group">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.color.split(' ')[1]} ${log.color.split(' ')[0]}`}>
                                            <log.icon size={14}/>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-zinc-200 group-hover:text-white transition max-w-[150px] truncate">{log.title}</div>
                                            <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-bold">{log.type}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-bold ${log.currency === 'MLD' ? 'text-emerald-400' : 'text-white'}`}>
                                            +{log.amount} <span className="text-[10px]">{log.currency}</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-600">{new Date(log.date).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
      </main>

      <SwapModal 
        isOpen={showSwapModal} 
        onClose={() => setShowSwapModal(false)} 
        balance={profile?.p_mld_balance || 0}
        onSwapSuccess={fetchStudioData}
      />
    </div>
  );
}