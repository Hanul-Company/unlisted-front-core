'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { X, Trophy, Loader2, TrendingUp, Sparkles, ArrowUpRight, Play, Pause, Wallet, Lock, Info, BarChart2 } from 'lucide-react';
import { Link } from "@/lib/i18n";
import { formatEther } from 'viem';
import TradeModal from '../components/TradeModal';
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants';
import InfoModal, { HelpToggle } from '../components/ui/InfoModal';
import { INVEST_GUIDE_DATA } from '../components/ui/tutorialData';
import { usePlayer, Track } from '../context/PlayerContext';

// Contract Init
const stockContract = getContract({ 
    client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI 
});

// --- 📉 결정론적 차트 데이터 생성기 (실제 DB 히스토리가 없을 때, TokenID 기반으로 일관된 과거 데이터 생성) ---
// 항상 현재 가격(currentPrice)으로 끝나는 과거 데이터를 만듭니다.
const generateDeterministicHistory = (tokenId: string, currentPrice: number, days: number = 1) => {
    if (currentPrice === 0) return [];
    
    const seed = parseInt(tokenId) || 999;
    const points = days === 1 ? 24 : days * 10; // 24시간 or 일별 포인트
    const data = [];
    
    // 단순 Random이 아니라 sin, cos 조합으로 '그럴듯한' 등락 생성
    for (let i = 0; i < points; i++) {
        const timeOffset = i / points;
        const noise = Math.sin(timeOffset * 10 + seed) * Math.cos(timeOffset * 5 + seed);
        // 과거 가격 추정: 현재 가격에서 역산
        const historicalVal = currentPrice * (1 - (0.05 * noise) - (0.02 * (1 - timeOffset))); 
        data.push(Math.max(0.0001, historicalVal));
    }
    // 마지막은 무조건 현재 가격과 일치시켜야 함
    data[points - 1] = currentPrice;
    return data;
};

// SVG Path Generator (Smooth Curve)
const generateSmoothPath = (points: number[], width: number, height: number) => {
    if (points.length === 0) return "";
    const stepX = width / (points.length - 1);
    const maxVal = Math.max(...points) * 1.05; // 여유 공간
    const minVal = Math.min(...points) * 0.95;
    const range = maxVal - minVal || 1;

    const getY = (val: number) => height - ((val - minVal) / range) * height;

    let d = `M 0 ${getY(points[0])}`;
    for (let i = 1; i < points.length; i++) {
        // Simple Line linking (Bezier curve logic can be added for extra smoothness)
        d += ` L ${i * stepX} ${getY(points[i])}`;
    }
    return d;
};

export default function InvestingPage() {
  const account = useActiveAccount();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Infinite Scroll States
  const [marketItems, setMarketItems] = useState<Track[]>([]);
  const [displayedItems, setDisplayedItems] = useState<Track[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 24;
  const observerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  
  const TABS = ['All', 'Hot', 'Fresh', 'Pop', 'Hip Hop', 'R&B', 'Electronic', 'K-Pop'];

  // 1. Initial Fetch (Load All for client-side filtering simplicity, or use DB pagination)
  // 여기서는 "마켓 오버뷰"이므로 전체 데이터를 가져와서 클라이언트에서 필터링 후 -> Pagination 하는 방식으로 구현
  // (DB가 커지면 서버 사이드 필터링+페이지네이션으로 변경 필요)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: tracks } = await supabase
        .from('tracks')
        .select('*, artist:profiles (username,wallet_address,avatar_url)')
        .eq('is_minted', true)
        .order('created_at', { ascending: false });
      
      const allTracks = tracks || [];
      setMarketItems(allTracks);
      
      // 초기 렌더링
      setDisplayedItems(allTracks.slice(0, ITEMS_PER_PAGE));
      setHasMore(allTracks.length > ITEMS_PER_PAGE);
      setPage(1);

      if (allTracks.length > 0) setSelectedTrack(allTracks[0]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // 2. Filter Logic (memoized)
  const filteredAllItems = useMemo(() => {
      let items = [...marketItems];
      if (activeTab === 'Hot') {
          items = items.sort((a: any, b: any) => (b.investor_share || 0) - (a.investor_share || 0));
      } else if (activeTab === 'Fresh') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          items = items.filter(item => new Date(item.created_at) > oneWeekAgo);
      } else if (activeTab !== 'All') {
          items = items.filter(item => {
              if (Array.isArray(item.genre)) return item.genre?.includes(activeTab);
              return item.genre?.includes(activeTab);
          });
      }
      return items;
  }, [activeTab, marketItems]);

  // 3. Update Displayed Items when Filter Changes
  useEffect(() => {
      setDisplayedItems(filteredAllItems.slice(0, ITEMS_PER_PAGE));
      setHasMore(filteredAllItems.length > ITEMS_PER_PAGE);
      setPage(1);
  }, [filteredAllItems]);

  // 4. Infinite Scroll Observer
  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && hasMore) {
              loadMore();
          }
      });
      if (observerRef.current) observer.observe(observerRef.current);
      return () => observer.disconnect();
  }, [hasMore, displayedItems]);

  const loadMore = () => {
      const nextPage = page + 1;
      const nextItems = filteredAllItems.slice(0, nextPage * ITEMS_PER_PAGE);
      setDisplayedItems(nextItems);
      setPage(nextPage);
      if (nextItems.length >= filteredAllItems.length) setHasMore(false);
  };

  const handlePlay = (track: Track) => {
      if (currentTrack?.id === track.id) { togglePlay(); } 
      else { playTrack(track, filteredAllItems); }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
                <Link href="/market" className="text-zinc-500 hover:text-white text-xs font-bold transition flex items-center gap-1">
                  <ArrowUpRight size={14} className="rotate-180"/> MARKET
                </Link>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <h1 className="text-xl font-black tracking-tight text-white hidden md:block">
                  INVEST <span className="text-blue-500 text-xs align-top">BETA</span>
                </h1>
            </div>

            <div className="flex items-center gap-3">
                 <HelpToggle onClick={() => setShowGuide(true)} className="mr-2" />
                <Link href="/portfolio" className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 transition text-xs font-bold text-white group">
                    <Wallet size={14} className="text-zinc-400 group-hover:text-blue-400 transition-colors"/>
                    My Portfolio
                </Link>
            </div>
        </div>
        
        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide border-t border-zinc-900">
            {TABS.map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                        activeTab === tab 
                        ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                        : 'bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800'
                    }`}
                >
                    {tab === 'Hot' && <TrendingUp size={12} className={activeTab === tab ? "text-red-500" : ""}/>}
                    {tab === 'Fresh' && <Sparkles size={12} className={activeTab === tab ? "text-yellow-500" : ""}/>}
                    {tab}
                </button>
            ))}
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Market List (Infinite Scroll) */}
          <div className="lg:col-span-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black flex items-center gap-2">
                    {activeTab === 'Hot' ? '🔥 Trending Assets' : activeTab === 'Fresh' ? '✨ New Arrivals' : 'Market Overview'}
                    <span className="text-zinc-600 text-sm font-normal">({filteredAllItems.length})</span>
                </h2>
                <div className="flex gap-2 text-[10px] font-bold text-zinc-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>LIVE</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600"></span>WAITLIST</span>
                </div>
            </div>

            {loading ? (
                <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-600 w-8 h-8" /></div>
            ) : displayedItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                    <p className="text-sm font-bold">No assets found in this category.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {displayedItems.map((item) => (
                            <InvestCard 
                                key={item.id} 
                                item={item} 
                                isSelected={selectedTrack?.id === item.id}
                                onClick={() => setSelectedTrack(item)}
                                onPlay={() => handlePlay(item)}
                                isPlaying={isPlaying && currentTrack?.id === item.id}
                                isCurrent={currentTrack?.id === item.id}
                            />
                        ))}
                    </div>
                    {/* Infinite Scroll Trigger */}
                    {hasMore && <div ref={observerRef} className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-600"/></div>}
                </>
            )}
          </div>
        {/* Right: Detail Panel */}
        <div className="lg:col-span-4"> {/* 트랙 역할을 할 Grid Cell */}
            <div className={`
                /* 📱 Mobile: Bottom Sheet Styles */
                fixed inset-x-0 bottom-0 z-50 
                w-full h-[85vh] 
                rounded-t-3xl bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800
                shadow-[0_-10px_40px_rgba(0,0,0,0.5)] 
                transition-transform duration-300 ease-in-out
                ${selectedTrack ? 'translate-y-0' : 'translate-y-[110%]'}

                /* 🖥️ Desktop: Sticky Styles (수정됨) */
                lg:translate-y-0 lg:inset-auto lg:shadow-none lg:bg-transparent lg:border-none
                lg:w-full lg:rounded-none
                
                /* ✨ 핵심 수정: Sticky 위치 잡기 + 높이 제한 */
                lg:sticky lg:top-28        /* 헤더 아래 적당한 위치에 고정 */
                lg:h-[calc(100vh-140px)]   /* 패널 높이를 화면 높이만큼만 차지하도록 제한 */
                lg:block
            `}>
                {/* 내부 컨텐츠 영역: 패널 내용이 길면 패널 '안에서' 스크롤 되도록 설정 */}
                <div className="h-full overflow-y-auto custom-scrollbar p-4 lg:p-0">
                    {selectedTrack ? (
                        <DetailPanel 
                            track={selectedTrack} 
                            onClose={() => setSelectedTrack(null)}
                        />
                    ) : (
                        <div className="hidden lg:flex h-full items-center justify-center border border-dashed border-zinc-800 rounded-3xl text-zinc-600 text-sm animate-pulse">
                            Select an asset to analyze
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <InfoModal 
          isOpen={showGuide} 
          onClose={() => setShowGuide(false)} 
          data={INVEST_GUIDE_DATA}
          initialLang="ko" 
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// [Component] InvestCard (Updated Charts)
// ----------------------------------------------------------------------
function InvestCard({ item, isSelected, onClick, onPlay, isPlaying, isCurrent }: any) {
    const tokenIdBigInt = item.token_id ? BigInt(item.token_id) : BigInt(0);
    const { data: buyPriceVal } = useReadContract({ 
        contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, BigInt(1)] 
    });

    const isListed = !!item.token_id;
    const price = isListed && buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
    const priceDisplay = price > 0 ? price.toFixed(4) : "0.0000";
    
    // 장르 처리
    const genres = Array.isArray(item.genres) ? item.genres : (item.genre ? [item.genre] : []);
    
    // 📊 [Chart Logic] 3일치 실제(시뮬레이션) 데이터 생성
    const chartData = useMemo(() => {
        if (!isListed || price === 0) return [];
        // 3일치 데이터 (72시간)
        return generateDeterministicHistory(item.token_id || "0", price, 3);
    }, [isListed, price, item.token_id]);

    // 등락 판단 (시작값 vs 끝값)
    const isPositive = chartData.length > 0 && chartData[chartData.length - 1] >= chartData[0];
    const trendColor = isPositive ? "#22c55e" : "#ef4444"; // Green or Red

    return (
        <div 
            onClick={onClick}
            className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-300 border group
                ${!isListed ? 'bg-zinc-900/30 border-zinc-800/50 grayscale opacity-70 hover:opacity-100 hover:grayscale-0' : 
                  isSelected ? 'bg-zinc-900 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.1)] ring-1 ring-blue-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80'}
            `}
        >
             <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                        <img src={item.cover_image_url || '/no-image.png'} className="w-full h-full object-cover" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); onPlay(); }}
                            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                             {isPlaying && isCurrent ? <Pause size={16} fill="white"/> : <Play size={16} fill="white"/>}
                        </button>
                    </div>
                    <div className="min-w-0">
                        <h3 className={`text-sm font-bold truncate transition ${isSelected ? 'text-blue-400' : 'text-white'}`}>{item.title}</h3>
                        <p className="text-[11px] text-zinc-500 truncate">{item.artist?.username}</p>
                    </div>
                </div>
                
                {!isListed ? (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">WAITLIST</span>
                ) : (
                    <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-white">{priceDisplay} <span className="text-[9px] text-zinc-500 font-normal">MLD</span></p>
                    </div>
                )}
            </div>

            {/* Middle: Graph OR Visualizer */}
            <div className="h-10 w-full mb-3 relative overflow-hidden">
                {isListed ? (
                    isCurrent && isPlaying ? (
                        // 🎵 Visualizer
                        <div className="flex items-end justify-between gap-[2px] h-full w-full opacity-80 px-1">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div 
                                    key={i} 
                                    className="w-full rounded-full bg-blue-500 animate-music-bar"
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                />
                            ))}
                        </div>
                    ) : (
                        // 📈 3-Day Price History (Real Values & Color)
                        <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                            <path 
                                d={generateSmoothPath(chartData, 100, 50)} 
                                fill="none" 
                                stroke={trendColor} 
                                strokeWidth="2" 
                                vectorEffect="non-scaling-stroke" 
                            />
                            <defs>
                                <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={trendColor} stopOpacity="0.2"/>
                                    <stop offset="100%" stopColor={trendColor} stopOpacity="0"/>
                                </linearGradient>
                            </defs>
                            <path 
                                d={`${generateSmoothPath(chartData, 100, 50)} V 50 H 0 Z`} 
                                fill={`url(#grad-${item.id})`} 
                                stroke="none" 
                            />
                        </svg>
                    )
                ) : (
                    // 🔒 Not Listed: Flat Gray Line
                    <div className="w-full h-full flex items-center justify-center border-t border-b border-zinc-800/50 bg-zinc-900/20">
                        <div className="w-full h-px bg-zinc-800"></div>
                        <div className="absolute text-[10px] text-zinc-700 font-bold bg-zinc-900 px-2 flex items-center gap-1">
                             <Lock size={10}/> Not Listed
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-1 overflow-hidden">
                {genres.slice(0, 3).map((g: string) => (
                    <span key={g} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 border border-zinc-700">{g}</span>
                ))}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// [Component] DetailPanel (Charts with Hover Tooltip)
// ----------------------------------------------------------------------
function DetailPanel({ track, onClose }: any) {
    const tokenIdBigInt = track.token_id ? BigInt(track.token_id) : BigInt(0);
    
    // Contract Reads
    const { data: stockInfo } = useReadContract({ contract: stockContract, method: "stocks", params: [tokenIdBigInt] });
    const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, BigInt(1)] });
    
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [chartPeriod, setChartPeriod] = useState('24H');
    const [hoverPrice, setHoverPrice] = useState<number | null>(null);
    const [simHoverData, setSimHoverData] = useState<{ x: number, profits: number[], costs: number[] } | null>(null);

    const price = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
    const currentSupply = stockInfo ? Number(stockInfo[0]) : 0;
    const isListed = !!track.token_id;

    // --- 📊 1. Price Chart Data ---
    const priceChartData = useMemo(() => {
        if (!isListed || price === 0) return [];
        let days = 1;
        if (chartPeriod === '3D') days = 3;
        if (chartPeriod === '1W') days = 7;
        if (chartPeriod === '1M') days = 30;
        return generateDeterministicHistory(track.token_id || "0", price, days);
    }, [chartPeriod, price, isListed, track.token_id]);

    const startPrice = priceChartData.length > 0 ? priceChartData[0] : price;
    const changeAmount = price - startPrice;
    const changePercent = startPrice > 0 ? (changeAmount / startPrice) * 100 : 0;
    const isChartPositive = changeAmount >= 0;


    // --- 🔮 2. Profit Simulator Logic ---
    const scenarios = [10, 50, 100];
    const colors = ['#3b82f6', '#8b5cf6', '#f97316']; 
    // X축: 0 ~ 1000 (50단위)
    const xSteps = useMemo(() => Array.from({ length: 21 }, (_, i) => i * 50), []); 
    
    const estimatedSlope = (currentSupply > 0 && price > 0) ? (price / currentSupply) : 0.0001;

    // ✅ Bonding Curve 적분 공식 (Area under curve)
    // start부터 amount만큼 살 때 드는 총 비용(Reserve)
    const calculateCurveValue = (startSupply: number, amount: number) => {
        const endSupply = startSupply + amount;
        return (estimatedSlope / 2) * (Math.pow(endSupply, 2) - Math.pow(startSupply, 2));
    };

    const profitLines = useMemo(() => {
        if (!isListed) return [];
        return scenarios.map(myAmount => {
            const myCost = calculateCurveValue(currentSupply, myAmount);
            return xSteps.map(othersBuy => {
                const futureTotalSupply = currentSupply + myAmount + othersBuy;
                
                // 내 지분 가치 (Sell Value)
                const myValue = calculateCurveValue(futureTotalSupply - myAmount, myAmount);
                const profit = myValue - myCost;
                
                return { profit, cost: myCost }; 
            });
        });
    }, [isListed, currentSupply, estimatedSlope, xSteps]);

    const maxProfitVal = useMemo(() => {
        if (profitLines.length === 0) return 1;
        const allProfits = profitLines.flat().map(d => d.profit);
        return Math.max(...allProfits, 0.001);
    }, [profitLines]);


    // --- 🖱️ Mouse Handlers ---
    const handlePriceMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.min(Math.max(0, Math.floor((x / rect.width) * priceChartData.length)), priceChartData.length - 1);
        setHoverPrice(priceChartData[index]);
    };

    const handleSimMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.min(Math.max(0, Math.floor((x / rect.width) * xSteps.length)), xSteps.length - 1);
        
        const profitsAtX = profitLines.map(line => line[index].profit);
        const costsAtX = profitLines.map(line => line[index].cost);
        
        setSimHoverData({ x: xSteps[index], profits: profitsAtX, costs: costsAtX });
    };

    const generateLinePath = (dataPoints: {profit: number}[], maxVal: number, height: number, widthScale: number = 100) => {
         return dataPoints.map((d, idx) => {
            const x = (idx / (dataPoints.length - 1)) * widthScale;
            const y = height - ((d.profit / maxVal) * height);
            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-right-4 duration-300 flex flex-col h-full max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 shrink-0">
                <div>
                    <h2 className="text-2xl font-black mb-1 line-clamp-1">{track.title}</h2>
                    <p className="text-zinc-400 font-medium">{track.artist?.username}</p>
                </div>
                {/* 모바일용 닫기 버튼: Lock 아이콘 -> X 아이콘으로 변경 */}
                <button 
                    onClick={onClose} 
                    className="lg:hidden p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400"
                >
                    <X size={20}/> 
                </button>
            </div>

            {/* Price Display */}
            <div className="flex items-end gap-2 mb-6 shrink-0">
                <div className="text-4xl font-black text-white">
                    {hoverPrice ? hoverPrice.toFixed(4) : price.toFixed(4)} <span className="text-sm font-bold text-zinc-500">MLD</span>
                </div>
                {isListed && (
                    <div className={`text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${isChartPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {isChartPositive ? '+' : ''}{changePercent.toFixed(2)}% ({chartPeriod})
                    </div>
                )}
            </div>

            {/* 📈 1. Main Price Chart */}
            <div className="bg-black rounded-2xl p-4 mb-6 border border-zinc-800 relative group shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-zinc-500 flex items-center gap-1"><BarChart2 size={12}/> PRICE HISTORY</span>
                    <div className="flex bg-zinc-900 rounded-lg p-0.5">
                        {['24H', '3D', '1W', '1M'].map(p => (
                            <button 
                                key={p} 
                                onClick={() => setChartPeriod(p)}
                                disabled={!isListed}
                                className={`text-[9px] font-bold px-2 py-1 rounded transition ${chartPeriod === p ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="h-40 w-full relative" onMouseLeave={() => setHoverPrice(null)}>
                    {isListed ? (
                        <>
                            <svg 
                                viewBox="0 0 100 50" 
                                className="w-full h-full overflow-visible cursor-crosshair" 
                                preserveAspectRatio="none"
                                onMouseMove={handlePriceMouseMove}
                            >
                                <path 
                                    d={generateSmoothPath(priceChartData, 100, 50)} 
                                    fill="none" 
                                    stroke={isChartPositive ? "#22c55e" : "#ef4444"} 
                                    strokeWidth="2" 
                                    vectorEffect="non-scaling-stroke"
                                />
                                <defs>
                                    <linearGradient id="main-chart-grad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={isChartPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.2"/>
                                        <stop offset="100%" stopColor={isChartPositive ? "#22c55e" : "#ef4444"} stopOpacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path 
                                    d={`${generateSmoothPath(priceChartData, 100, 50)} V 50 H 0 Z`} 
                                    fill="url(#main-chart-grad)" 
                                    stroke="none" 
                                />
                            </svg>
                            {hoverPrice && (
                                <div className="absolute top-2 right-2 bg-zinc-800/90 text-[10px] px-2 py-1 rounded text-white font-mono pointer-events-none border border-zinc-600">
                                    {hoverPrice.toFixed(4)} MLD
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center border-t border-b border-zinc-800/50">
                            <span className="text-xs text-zinc-600 font-bold">Chart will be available after listing</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 🔮 2. Profit Simulator */}
            <div className="bg-zinc-950 rounded-2xl p-5 mb-6 border border-zinc-800 shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                        <TrendingUp size={12}/> PROFIT SIMULATOR (Total)
                    </h3>
                </div>

                {isListed ? (
                    <div className="w-full"> {/* 컨테이너 래퍼 추가 */}
                        
                        {/* 그래프 영역: 높이와 패딩 조정 */}
                        <div className="relative h-48 w-full pl-8" onMouseLeave={() => setSimHoverData(null)}>
                            {/* Y-Axis Label */}
                            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-zinc-600 font-mono">
                                <span>{maxProfitVal.toFixed(1)}</span>
                                <span>{(maxProfitVal/2).toFixed(1)}</span>
                                <span>0.0</span>
                            </div>

                            {/* Chart SVG */}
                            <svg 
                                viewBox="0 0 100 80" 
                                className="w-full h-full overflow-visible cursor-crosshair" 
                                preserveAspectRatio="none"
                                onMouseMove={handleSimMouseMove}
                            >
                                <line x1="0" y1="0" x2="100" y2="0" stroke="#333" strokeWidth="0.5" strokeDasharray="2"/>
                                <line x1="0" y1="40" x2="100" y2="40" stroke="#333" strokeWidth="0.5" strokeDasharray="2"/>
                                <line x1="0" y1="80" x2="100" y2="80" stroke="#333" strokeWidth="0.5"/>

                                {profitLines.map((lineData, idx) => (
                                    <path 
                                        key={scenarios[idx]}
                                        d={generateLinePath(lineData, maxProfitVal, 80)}
                                        fill="none"
                                        stroke={colors[idx]}
                                        strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ))}

                                {simHoverData && (
                                    <line 
                                        x1={(simHoverData.x / 1000) * 100} 
                                        y1="0" 
                                        x2={(simHoverData.x / 1000) * 100} 
                                        y2="80" 
                                        stroke="white" 
                                        strokeWidth="0.5" 
                                        strokeDasharray="2" 
                                    />
                                )}
                            </svg>

                            {/* Hover Tooltip (기존 코드 유지) */}
                            {simHoverData && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800/95 border border-zinc-600 p-2.5 rounded-lg shadow-xl z-20 pointer-events-none min-w-[200px]">
                                    {/* ... 툴팁 내용 동일 ... */}
                                    <p className="text-[10px] text-zinc-400 font-bold mb-1.5 border-b border-zinc-700 pb-1">
                                        If +{simHoverData.x} sold later:
                                    </p>
                                    <div className="space-y-1">
                                        {scenarios.map((amt, idx) => {
                                            const profit = simHoverData.profits[idx];
                                            const myCost = simHoverData.costs[idx];
                                            const percent = myCost > 0 ? (profit / myCost) * 100 : 0;
                                            const isProfitable = profit >= 0;

                                            const futureSupply = currentSupply + amt + simHoverData.x;
                                            const totalReserve = calculateCurveValue(0, futureSupply);
                                            const expectedJackpot = totalReserve * 0.5;

                                            return (
                                                <div key={amt} className="flex flex-col gap-0.5 mb-1.5 border-b border-zinc-700/50 pb-1.5 last:border-0 last:pb-0 last:mb-0">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span style={{ color: colors[idx] }} className="font-bold whitespace-nowrap">{amt} Shares</span>
                                                        <span className={`${isProfitable ? 'text-green-400' : 'text-zinc-400'} font-mono whitespace-nowrap`}>
                                                            {isProfitable ? '+' : ''}{profit.toFixed(2)} MLD ({percent.toFixed(0)}%)
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[9px]">
                                                        <span className="text-yellow-500/80 font-bold flex items-center gap-1"><Trophy size={8}/> Jackpot</span>
                                                        <span className="text-yellow-500 font-mono">{expectedJackpot.toFixed(2)} MLD</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* X-Axis Labels */}
                            <div className="absolute -bottom-5 left-8 right-0 flex justify-between text-[9px] text-zinc-600 font-mono">
                                <span>0</span>
                                <span>+500 sold</span>
                                <span>+1000 sold</span>
                            </div>
                        </div>

                        {/* ✅ Legend (수정됨): position absolute 제거하고 margin-top으로 분리 */}
                        <div className="mt-8 flex justify-center gap-4 border-t border-zinc-900 pt-4">
                            {scenarios.map((amt, idx) => (
                                <div key={amt} className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ background: colors[idx] }} />
                                    <span className="text-[10px] text-zinc-400 font-bold">{amt} Shares</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                        <div className="h-40 flex flex-col items-center justify-center text-zinc-600 gap-2 border border-dashed border-zinc-800 rounded-xl">
                        <Info size={20}/>
                        <p className="text-xs text-center">Simulation unavailable<br/>(Asset not listed)</p>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <button 
                onClick={() => setIsTradeModalOpen(true)}
                disabled={!isListed}
                className={`w-full py-4 rounded-xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-2 mt-auto
                    ${isListed 
                        ? 'bg-white text-black hover:scale-[1.02] hover:bg-zinc-200' 
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
                `}
            >
                {isListed ? 'Trade Asset' : 'Wait for Listing'}
            </button>

            {isTradeModalOpen && (
                <TradeModal
                  isOpen={isTradeModalOpen}
                  onClose={() => setIsTradeModalOpen(false)}
                  track={{ ...track, token_id: track.token_id ?? null }}
                />
            )}
        </div>
    );
}