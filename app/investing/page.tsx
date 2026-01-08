'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, TrendingUp, Trophy, Clock, ArrowUpRight, Filter, Search } from 'lucide-react';
import { Link } from "@/lib/i18n";
import { formatEther } from 'viem';
import TradeModal from '../components/TradeModal';
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants';

// Contracts (IP Contract 호출 제거 -> DB값 사용으로 최적화)
const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });

export default function InvestingPage() {
  const account = useActiveAccount();
  
  const [marketItems, setMarketItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'hot' | 'ending'>('all');
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // DB에서 investor_share 포함하여 가져옴
      const { data: tracks } = await supabase
        .from('tracks')
        .select('*')
        .eq('is_minted', true)
        .order('created_at', { ascending: false }); // 기본: 최신순
      
      setMarketItems(tracks || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // ✅ 필터링 및 정렬 로직 구현
  const getFilteredItems = () => {
      let items = [...marketItems];

      if (filter === 'hot') {
          // Hot: 투자자 지분율(investor_share) 높은 순
          // DB 값이 Basis Point(3000)일 수도 있고 % (30)일 수도 있음. 상황에 맞게 정렬
          items.sort((a, b) => (b.investor_share || 0) - (a.investor_share || 0));
      } else if (filter === 'ending') {
          // Ending Soon: 일단 생성일이 오래된 순(오름차순)으로 정렬 (Proxy)
          // 정확히 하려면 모든 컨트랙트 상태를 읽어야 하는데 부하가 심함
          items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      // 'all'은 기본 최신순 유지
      return items;
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 md:p-8 pb-32">
      {/* Header Section */}
      <header className="mb-12 max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-6">
            <div>
                <Link href="/market" className="text-zinc-500 hover:text-white text-xs font-bold mb-4 inline-flex items-center gap-1 transition">
                  <ArrowUpRight size={14} className="rotate-180"/> BACK TO MARKET
                </Link>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-2 uppercase">
                  Jackpot <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">Market</span>
                </h1>
                <p className="text-zinc-400 max-w-xl text-sm md:text-base leading-relaxed">
                  Invest in music copyrights, earn lifetime dividends, and win the jackpot.
                  <br className="hidden md:block"/> Be the last buyer to take 50% of the pool.
                </p>
            </div>
            {/* Stats Summary */}
            <div className="hidden md:flex gap-6 text-right">
                <div>
                    <p className="text-zinc-500 text-xs font-bold mb-1">TOTAL ASSETS</p>
                    <p className="text-2xl font-mono font-bold text-white">{marketItems.length}</p>
                </div>
            </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${filter === 'all' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'}`}>All Assets</button>
            <button onClick={() => setFilter('hot')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${filter === 'hot' ? 'bg-red-500 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'}`}><TrendingUp size={14}/> Hot Yield</button>
            <button onClick={() => setFilter('ending')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${filter === 'ending' ? 'bg-yellow-500 text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-600'}`}><Clock size={14}/> Ending Soon</button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-zinc-600 w-10 h-10" />
            </div>
          ) : (
            filteredItems.map((item) => (
              <JackpotCard 
                key={item.id} 
                item={item} 
                onTrade={() => setSelectedTrack(item)} 
              />
            ))
          )}
      </div>

      {/* Modal */}
      {selectedTrack && (
        <TradeModal
          isOpen={!!selectedTrack}
          onClose={() => setSelectedTrack(null)}
          track={selectedTrack}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// [Component] Jackpot Card (Optimized)
// ----------------------------------------------------------------------
function JackpotCard({ item, onTrade }: { item: any, onTrade: () => void }) {
    const tokenIdBigInt = BigInt(item.token_id || item.id);

    // 1. Contract Reads (Stock 정보 & 가격만 조회)
    // ✅ 최적화: IP Contract 조회(getInvestorShare) 제거 -> DB 값 사용
    const { data: stockInfo } = useReadContract({
        contract: stockContract,
        method: "stocks",
        params: [tokenIdBigInt]
    });
    
    const { data: buyPriceVal } = useReadContract({
        contract: stockContract,
        method: "getBuyPrice",
        params: [tokenIdBigInt, BigInt(1)] 
    });

    // Parsing Data
    const jackpotBalance = stockInfo ? Number(formatEther(stockInfo[2])) : 0;
    const expiryTime = stockInfo ? Number(stockInfo[3]) : 0;
    const buyPrice = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;

    // ✅ DB에서 가져온 값 사용 (만약 BPS(3000)라면 /100, %라면 그대로)
    // 안전하게 100 이상이면 BPS로 간주
    let investorSharePercent = item.investor_share || 0;
    if (investorSharePercent > 100) investorSharePercent /= 100;

    // Timer Logic
    const [timeLeft, setTimeLeft] = useState("Loading...");
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            
            if (expiryTime === 0) {
                setTimeLeft("Ready to Start");
                setProgress(100);
            } else if (expiryTime > now) {
                const diff = expiryTime - now;
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                setTimeLeft(`${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
                
                const totalDuration = 72 * 3600; 
                const p = Math.min(100, (diff / totalDuration) * 100);
                setProgress(p);
            } else {
                setTimeLeft("Round Ended");
                setProgress(0);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [expiryTime]);

    const isHot = investorSharePercent >= 30;
    const isEnding = expiryTime > 0 && (expiryTime - Date.now()/1000 < 3600);

    return (
        <div 
            onClick={onTrade}
            className="group relative bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer flex flex-col h-full"
        >
            {/* Top Image Area */}
            <div className="relative h-48 overflow-hidden bg-black">
                {item.cover_image_url ? (
                    <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-110"/>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">🎵</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"/>
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    {isHot && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
                            <TrendingUp size={10}/> {investorSharePercent}% Yield
                        </span>
                    )}
                    {timeLeft === "Round Ended" && (
                         <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-1 rounded-full">Ended</span>
                    )}
                </div>

                {/* Price Tag */}
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-white/10">
                    {buyPrice.toFixed(4)} MLD
                </div>
            </div>

            {/* Info Area */}
            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-1 line-clamp-1 group-hover:text-green-400 transition">{item.title}</h3>
                    <p className="text-sm text-zinc-500">{item.artist?.username}</p>
                </div>

                {/* Jackpot & Timer Box */}
                <div className="mt-auto bg-zinc-950 rounded-xl p-3 border border-zinc-800 group-hover:border-zinc-700 transition space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                <Trophy size={16}/>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 font-bold">JACKPOT POOL</p>
                                <p className="text-sm font-black text-yellow-500">{jackpotBalance.toFixed(2)} MLD</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] mb-1">
                            <span className={isEnding ? "text-red-500 font-bold animate-pulse" : "text-zinc-500"}>
                                {isEnding ? "ENDING SOON!" : "TIME LEFT"}
                            </span>
                            <span className="font-mono text-white">{timeLeft}</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${isEnding ? 'bg-red-500' : 'bg-green-500'}`} 
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs font-bold text-zinc-600 group-hover:text-white transition">
                    <span>View Details</span>
                    <ArrowUpRight size={16}/>
                </div>
            </div>
        </div>
    );
}