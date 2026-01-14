'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Loader2, TrendingUp, Music, ListMusic, 
  Wallet, Calendar, Activity, Zap, RefreshCw, Coins, 
  Smartphone, BarChart3, ArrowRightLeft, Info
} from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile'; 
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';

// [Thirdweb]
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther, formatEther } from 'viem';

// Contract
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

// ✅ [NEW] 소수점 사이즈를 줄여주는 헬퍼 컴포넌트
const NumberWithSmallDecimal = ({ value, className }: { value: number, className?: string }) => {
  // 1. 숫자를 문자열로 변환 (콤마 포함, 소수점 최대 2~4자리 설정)
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  // 2. 소수점 기준으로 분리
  const [integer, decimal] = formatted.split('.');

  return (
    <span className={className}>
      {integer}
      {decimal && (
        // text-[0.6em]: 부모 폰트 크기의 60%로 설정 (자동 비율 조절)
        // opacity-70: 소수점은 살짝 흐리게 처리하여 시각적 위계 설정
        <span className="text-[0.6em] font-medium opacity-80">.{decimal}</span>
      )}
    </span>
  );
};

// 1. Dashboard Card (Updated: Total Sum as Hero)
const DashboardCard = ({ title, mldValue, pmldValue, icon: Icon, colorClass, label }: any) => {
  const totalValue = mldValue + pmldValue;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition backdrop-blur-sm h-full flex flex-col justify-between">
        {/* Background Icon Decoration */}
        <div className={`absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 transition transform group-hover:scale-110 ${colorClass}`}>
            <Icon size={120} />
        </div>

        <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                <div className={`p-1.5 rounded-md ${colorClass} bg-opacity-20`}>
                    <Icon size={14} className={colorClass.replace('bg-', 'text-')}/>
                </div>
                {title}
            </div>
            
            {/* Main Hero Number (Sum) */}
            <div className="mb-4">
                <div className="flex items-baseline gap-1">
                    {/* ✅ 수정됨: 헬퍼 컴포넌트 사용 */}
                    <NumberWithSmallDecimal 
                        value={totalValue} 
                        className="text-5xl font-black text-white tracking-tight"
                    />
                    <span className="text-lg font-medium text-zinc-600">Total</span>
                </div>
            </div>

            {/* Breakdown Row (MLD vs pMLD) */}
            <div className="flex items-center gap-4 border-t border-zinc-800/50 pt-3">
                {/* MLD */}
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-emerald-500/70 mb-0.5">Token (MLD)</span>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        {/* ✅ 수정됨 */}
                        <NumberWithSmallDecimal value={mldValue} />
                    </div>
                </div>
                <div className="w-px h-8 bg-zinc-800"></div>
                {/* pMLD */}
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-600 mb-0.5">Points (pMLD)</span>
                    <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-lg">
                        <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                        {/* ✅ 수정됨 */}
                        <NumberWithSmallDecimal value={pmldValue} />
                    </div>
                </div>
            </div>
        </div>

        {label && <div className="mt-4 pt-2 text-[10px] text-zinc-600 font-mono">{label}</div>}
    </div>
  );
};

// 2. Revenue Stream Item
const RevenueStreamRow = ({ title, pmldAmount, mldAmount, count, icon: Icon, colorClass }: any) => (
    <div className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl hover:bg-zinc-800/50 transition group">
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-10 text-white`}>
                <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
            </div>
            <div>
                <h4 className="font-bold text-zinc-200 text-sm">{title}</h4>
                <div className="text-[10px] text-zinc-500">{count} transactions</div>
            </div>
        </div>
        <div className="text-right">
            <div className="font-bold text-white text-sm">
                {(mldAmount + pmldAmount).toLocaleString()} <span className="text-zinc-600 text-xs">Total</span>
            </div>
            <div className="flex justify-end gap-2 text-[10px] mt-0.5">
                {mldAmount > 0 && <span className="text-emerald-500">{mldAmount.toLocaleString()} MLD</span>}
                {pmldAmount > 0 && <span className="text-zinc-500">{pmldAmount.toLocaleString()} pMLD</span>}
            </div>
        </div>
    </div>
);

// 3. Swap Modal (With Fee Logic)
const SwapModal = ({ isOpen, onClose, balance, onSwapSuccess }: any) => {
    const { mutate: sendTransaction } = useSendTransaction();
    const [amount, setAmount] = useState<number | ''>('');
    const [isSwapping, setIsSwapping] = useState(false);
    const account = useActiveAccount();

    const FEE_PERCENT = 0;
    const receiveAmount = amount ? Number(amount) * (1 - FEE_PERCENT / 100) : 0;

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

            // 2. Blockchain Mint (수수료 제외한 금액)
            const tx = prepareContractCall({
                contract: tokenContract,
                method: "mint",
                params: [account.address, parseEther(receiveAmount.toString())]
            });

            sendTransaction(tx, {
                onSuccess: () => {
                    toast.success(`Swapped ${val} pMLD to ${receiveAmount} MLD!`);
                    onSwapSuccess();
                    onClose();
                },
                onError: () => {
                    toast.error("Minting failed. Contact support.");
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
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm relative shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
                
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <RefreshCw size={18} className="text-emerald-500"/> Convert Points
                </h3>

                {/* From */}
                <div className="bg-black rounded-xl p-4 border border-zinc-800">
                    <div className="flex justify-between text-xs text-zinc-500 mb-2">
                        <span>Convert Amount</span>
                        <span>Avail: {balance.toLocaleString()} pMLD</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <input 
                            type="number" 
                            className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder-zinc-700" 
                            placeholder="0" 
                            value={amount} 
                            onChange={e => setAmount(Number(e.target.value))}
                        />
                        <span className="text-sm font-bold text-zinc-500">pMLD</span>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-zinc-800 p-2 rounded-full border border-zinc-600 shadow-lg">
                        <ArrowRightLeft size={16} className="text-zinc-400 rotate-90"/>
                    </div>
                </div>

                {/* To */}
                <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50 mt-2 mb-4">
                     <div className="flex justify-between text-xs text-zinc-500 mb-2">
                        <span>You Receive (MLD)</span>
                        <span className="text-yellow-500 flex items-center gap-1"><Info size={10}/> {FEE_PERCENT}% Fee Applied</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-emerald-400">{receiveAmount.toLocaleString()}</div>
                        <span className="text-sm font-bold text-emerald-500/50">MLD</span>
                     </div>
                </div>

                <button onClick={handleSwap} disabled={isSwapping || !amount} className="w-full py-3.5 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition">
                    {isSwapping ? <Loader2 className="animate-spin" size={18}/> : 'Confirm Conversion'}
                </button>
            </div>
        </div>
    );
};

const PerformanceChart = ({ monthlyData }: { monthlyData: any[] }) => {
    const maxVal = Math.max(...monthlyData.map(d => d.total), 1);
    const len = monthlyData.length; // 데이터 전체 길이 확인
    return (
        <div className="w-full h-64 flex items-end justify-between gap-2 mt-4 select-none relative">
            {monthlyData.map((data, i) => {
                // ✅ [핵심 로직] 인덱스에 따라 툴팁 위치 클래스 동적 할당
                let tooltipPositionClass = "left-1/2 -translate-x-1/2"; // 기본: 중앙 정렬
                let tooltipOriginClass = "origin-bottom"; // 애니메이션 기준점
                if (i < 2) { 
                    // 왼쪽 끝 2개 데이터: 왼쪽 정렬
                    tooltipPositionClass = "left-0"; 
                    tooltipOriginClass = "origin-bottom-left";
                } else if (i >= len - 2) { 
                    // 오른쪽 끝 2개 데이터: 오른쪽 정렬
                    tooltipPositionClass = "right-0";
                    tooltipOriginClass = "origin-bottom-right";
                }
                return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                        {/* Tooltip */}
                        <div className={`
                            absolute bottom-full mb-2 w-48 bg-zinc-800 border border-zinc-700 p-3 rounded-xl shadow-xl 
                            opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none
                            ${tooltipPositionClass} ${tooltipOriginClass} 
                        `}>
                            {/* z-index를 z-50으로 높여서 다른 요소 위에 확실히 뜨게 함 */}
                            <div className="text-xs font-bold text-white mb-2 border-b border-zinc-700 pb-1">{data.month}</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-zinc-400"><span>Music</span><span className="text-blue-400">{data.music.toLocaleString()}</span></div>
                                <div className="flex justify-between text-[10px] text-zinc-400"><span>Playlist</span><span className="text-purple-400">{data.playlist.toLocaleString()}</span></div>
                                <div className="flex justify-between text-[10px] text-zinc-400"><span>Invest</span><span className="text-emerald-400">{data.invest.toLocaleString()}</span></div>
                                <div className="flex justify-between text-[10px] text-zinc-400"><span>Ads</span><span className="text-yellow-400">{data.ads.toLocaleString()}</span></div>
                                <div className="flex justify-between text-xs font-bold text-white pt-1 border-t border-zinc-700 mt-1"><span>Total</span><span>{data.total.toLocaleString()}</span></div>
                            </div>
                        </div>
                        {/* Bars (Stacked) */}
                        <div className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse relative bg-zinc-800/30 hover:brightness-125 transition-all" style={{ height: `${(data.total / maxVal) * 100}%` }}>
                            {data.total > 0 ? (
                                <>
                                    <div style={{ height: `${(data.music / data.total) * 100}%` }} className="w-full bg-blue-500"></div>
                                    <div style={{ height: `${(data.playlist / data.total) * 100}%` }} className="w-full bg-purple-500"></div>
                                    <div style={{ height: `${(data.invest / data.total) * 100}%` }} className="w-full bg-emerald-500"></div>
                                    <div style={{ height: `${(data.ads / data.total) * 100}%` }} className="w-full bg-yellow-500"></div>
                                </>
                            ) : (
                                <div className="w-full h-1 bg-zinc-800"></div>
                            )}
                        </div>
                        
                        {/* Label */}
                        <div className="text-[10px] text-zinc-600 text-center mt-2 font-mono group-hover:text-zinc-400">{data.label}</div>
                    </div>
                );
            })}
        </div>
    );
};


// --- [Main Page] ---

export default function StudioPage() {
  const account = useActiveAccount();
  const address = account?.address;

  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [walletMldBalance, setWalletMldBalance] = useState<number>(0); // 실제 지갑 잔액
  
  // Revenue Stats
  const [trackRevenue, setTrackRevenue] = useState({ pmld: 0, mld: 0, count: 0 });
  const [playlistRevenue, setPlaylistRevenue] = useState({ pmld: 0, mld: 0, count: 0 });
  const [investRevenue, setInvestRevenue] = useState({ mld: 0, count: 0 });
  const [adRevenue, setAdRevenue] = useState({ pmld: 0, mld: 0, count: 0 }); // New: Ads/Offerwall
  
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]); // 12 months data

  const [loading, setLoading] = useState(true);
  const [showSwapModal, setShowSwapModal] = useState(false);

  useEffect(() => {
    if (address) {
        // 1. 지갑이 연결된 경우: 데이터 가져오기
        fetchStudioData();
        fetchWalletBalance();
    } else {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 500);
        
        return () => clearTimeout(timer);
    }
  }, [address]);

  // 1. Fetch Real Wallet MLD Balance (Blockchain)
  const fetchWalletBalance = async () => {
      try {
          const balance = await readContract({
              contract: tokenContract,
              method: "balanceOf",
              params: [address as string]
          });
          setWalletMldBalance(Number(formatEther(balance as bigint)));
      } catch (e) {
          console.error("Wallet Fetch Error:", e);
      }
  };

  // 2. Fetch DB Data & Process
  const fetchStudioData = async () => {
    if (!address) return;
    setLoading(true);
    
    try {
        // A. Profile & Points
        const { data: rawProfile, error: profError } = await supabase
            .from('profiles')
            .select(`*, p_mld_balances (balance)`)
            .ilike('wallet_address', address)
            .maybeSingle(); 

        if (profError || !rawProfile) {
            setLoading(false);
            return;
        }

        const userProfile = {
            ...rawProfile,
            p_mld_balance: Array.isArray(rawProfile.p_mld_balances) 
                ? rawProfile.p_mld_balances[0]?.balance || 0 
                : rawProfile.p_mld_balances?.balance || 0
        };
        setProfile(userProfile);

        // B. Logs
        const { data: logs } = await supabase
            .from('revenue_logs')
            .select(`*, tracks (title)`)
            .eq('beneficiary_id', userProfile.id)
            .order('created_at', { ascending: false });

        if (logs) {
            processLogs(logs);
        }

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const processLogs = (logs: any[]) => {
      const tracks = { pmld: 0, mld: 0, count: 0 };
      const playlists = { pmld: 0, mld: 0, count: 0 };
      const invest = { mld: 0, count: 0 };
      const ads = { pmld: 0, mld: 0, count: 0 }; // New Category

      // 12개월 차트용 초기 데이터 생성
      const monthlyStats: {[key: string]: any} = {};
      const today = new Date();
      for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${d.getMonth()}`; // 구분키
          monthlyStats[key] = { 
              label: d.toLocaleString('default', { month: 'short' }), // Jan, Feb...
              month: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
              music: 0, playlist: 0, invest: 0, ads: 0, total: 0 
          };
      }

      logs.forEach(log => {
          const amount = Number(log.amount) || 0;
          const rawType = (log.activity_type || '').toLowerCase().trim();
          const rawCurrency = (log.currency || 'pMLD').trim().toUpperCase();
          const isMLD = rawCurrency === 'MLD';
          const logDate = new Date(log.created_at);
          const monthKey = `${logDate.getFullYear()}-${logDate.getMonth()}`;

          // --- 1. 누적 합계 계산 ---
          if (['collect_fee', 'streaming', 'purchase', 'sale', 'track_sale', 'rental_fee'].includes(rawType)) {
              if (isMLD) tracks.mld += amount; else tracks.pmld += amount;
              tracks.count++;
              if (monthlyStats[monthKey]) monthlyStats[monthKey].music += amount;
          } 
          else if (['curator_reward', 'reward', 'playlist_reward'].includes(rawType)) {
              if (isMLD) playlists.mld += amount; else playlists.pmld += amount;
              playlists.count++;
              if (monthlyStats[monthKey]) monthlyStats[monthKey].playlist += amount;
          } 
          else if (['royalty', 'trade_fee', 'dividend', 'invest'].includes(rawType)) { 
              invest.mld += amount;
              invest.count++;
              if (monthlyStats[monthKey]) monthlyStats[monthKey].invest += amount;
          }
          // New: Ads / Offerwall / Login Bonus
          else if (['ad_revenue', 'offerwall', 'daily_checkin', 'watch_to_earn', 'engagement'].includes(rawType)) {
              if (isMLD) ads.mld += amount; else ads.pmld += amount;
              ads.count++;
              if (monthlyStats[monthKey]) monthlyStats[monthKey].ads += amount;
          }

          // 차트 총합 업데이트
          if (monthlyStats[monthKey]) monthlyStats[monthKey].total += amount;
      });

      setTrackRevenue(tracks);
      setPlaylistRevenue(playlists);
      setInvestRevenue(invest);
      setAdRevenue(ads);
      setChartData(Object.values(monthlyStats)); // 객체를 배열로 변환

      // --- 2. 최근 로그 ---
      setRecentLogs(logs.slice(0, 10).map(log => {
        const type = (log.activity_type || '').toLowerCase();
        let displayType = 'Revenue';
        let icon = TrendingUp;
        let color = 'text-zinc-400 bg-zinc-800';

        if (type.includes('rental') || type.includes('stream') || type.includes('collect')) {
            displayType = 'Music Sales'; icon = Music; color = 'text-blue-400 bg-blue-500/10';
        } else if (type.includes('curator') || type.includes('playlist')) {
            displayType = 'Curator Reward'; icon = ListMusic; color = 'text-purple-400 bg-purple-500/10';
        } else if (type.includes('royalty') || type.includes('invest')) {
            displayType = 'Investment'; icon = BarChart3; color = 'text-emerald-400 bg-emerald-500/10';
        } else if (type.includes('ad') || type.includes('offer') || type.includes('checkin')) {
            displayType = 'Engagement'; icon = Smartphone; color = 'text-yellow-400 bg-yellow-500/10';
        }

        return {
            id: log.id,
            title: log.tracks?.title || displayType,
            type: displayType,
            amount: log.amount,
            currency: log.currency || 'pMLD',
            date: log.created_at,
            icon,
            color
        };
      }));
  };

  // Calculate Totals for Display
  const totalLifetimeMLD = trackRevenue.mld + playlistRevenue.mld + investRevenue.mld + adRevenue.mld;
  const totalLifetimePMLD = trackRevenue.pmld + playlistRevenue.pmld + adRevenue.pmld;
  const currentAssetsMLD = walletMldBalance;
  const currentAssetsPMLD = profile?.p_mld_balance || 0;

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      
      {/* Header */}
      <div className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link href="/market" className="text-zinc-500 hover:text-white transition font-bold text-sm">Exit</Link>
                <div className="h-4 w-px bg-zinc-800"></div>
                <h1 className="font-black text-lg tracking-tight">My<span className="text-emerald-500">Earnings</span></h1>
            </div>
            <HeaderProfile/>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* 1. Dashboard Top (Overview) */}
        <section>
            <div className="flex flex-col md:flex-row gap-6 mb-6">
                
                {/* A. Lifetime Revenue */}
                <div className="flex-1">
                    <DashboardCard 
                        title="Lifetime Revenue" 
                        mldValue={totalLifetimeMLD} 
                        pmldValue={totalLifetimePMLD}
                        icon={TrendingUp} 
                        colorClass="bg-emerald-500"
                        label="Total earnings accumulated since joining."
                    />
                </div>

                {/* B. Current Holdings */}
                <div className="flex-1">
                    <DashboardCard 
                        title="Current Assets" 
                        mldValue={currentAssetsMLD} // Blockchain Value
                        pmldValue={currentAssetsPMLD} // DB Value
                        icon={Wallet} 
                        colorClass="bg-blue-500"
                        label="Available balance in wallet & platform."
                    />
                </div>

                {/* C. Quick Action (Swap) */}
                <div className="md:w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between items-center text-center group hover:border-zinc-700 transition relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                    <div className="mt-2 w-full">
                        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700 group-hover:scale-110 group-hover:bg-zinc-700 transition shadow-inner">
                            <RefreshCw size={24} className="text-emerald-400"/>
                        </div>
                        <h3 className="font-bold text-white text-lg">Convert Points</h3>
                        <p className="text-xs text-zinc-500 mt-1 px-2">Swap your accumulated pMLD to MLD tokens.</p>
                    </div>
                    <button 
                        onClick={() => setShowSwapModal(true)}
                        className="w-full py-3 bg-white text-black text-sm font-bold rounded-xl mt-4 hover:bg-zinc-200 transition"
                    >
                        Convert Now
                    </button>
                </div>
            </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* 2. Main Content (Left: Chart + Streams) */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Performance Chart */}
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                    {/* ✅ [수정된 부분] Header Layout */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        
                        {/* Title */}
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            <BarChart3 size={20} className="text-zinc-400"/> Performance Trend
                        </h3>

                        {/* Legend (범례) */}
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Music</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Playlist</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Invest</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Ads</div>
                        </div>
                    </div>
                    
                    <PerformanceChart monthlyData={chartData} />
                </div>

                {/* Revenue Streams Breakdown */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-white px-1">Revenue Sources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RevenueStreamRow 
                            title="Music Sales & Rentals" 
                            pmldAmount={trackRevenue.pmld}
                            mldAmount={trackRevenue.mld}
                            count={trackRevenue.count}
                            icon={Music}
                            colorClass="bg-blue-500"
                        />
                         <RevenueStreamRow 
                            title="Curator Rewards" 
                            pmldAmount={playlistRevenue.pmld}
                            mldAmount={playlistRevenue.mld}
                            count={playlistRevenue.count}
                            icon={ListMusic}
                            colorClass="bg-purple-500"
                        />
                         <RevenueStreamRow 
                            title="Investment & Royalties" 
                            pmldAmount={0}
                            mldAmount={investRevenue.mld}
                            count={investRevenue.count}
                            icon={TrendingUp}
                            colorClass="bg-emerald-500"
                        />
                         {/* Ads/Offerwall */}
                         <RevenueStreamRow 
                            title="Engagement & Ads" 
                            pmldAmount={adRevenue.pmld}
                            mldAmount={adRevenue.mld}
                            count={adRevenue.count}
                            icon={Smartphone}
                            colorClass="bg-yellow-500"
                        />
                    </div>
                </div>

            </div>

            {/* 3. Sidebar (Right: History) */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden h-[600px] flex flex-col">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h3 className="font-bold text-white flex items-center gap-2"><Calendar size={18}/> Activity Log</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {recentLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2">
                            <Activity size={30} className="opacity-20"/>
                            <span>No recent activity.</span>
                        </div>
                    ) : (
                        recentLogs.map((log) => (
                            <div key={log.id} className="p-3 hover:bg-zinc-800 rounded-xl transition group flex items-center justify-between cursor-default">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.color}`}>
                                        <log.icon size={14}/>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-zinc-300 group-hover:text-white truncate transition">{log.title}</div>
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold">{log.type}</div>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0 pl-2">
                                    <div className={`text-sm font-bold ${log.currency === 'MLD' ? 'text-emerald-400' : 'text-white'}`}>
                                        +{log.amount} <span className="text-[10px]">{log.currency}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-600">{new Date(log.date).toLocaleDateString()}</div>
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
        onSwapSuccess={() => { fetchStudioData(); fetchWalletBalance(); }}
      />
    </div>
  );
}