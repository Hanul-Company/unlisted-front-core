'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { X, Play, Pause, Wallet, ExternalLink, Activity, Info, TrendingUp, BarChart2, Youtube, ChevronLeft } from 'lucide-react';
import { Link } from "@/lib/i18n";
import { formatEther } from 'viem';
import TradeModal from '../components/TradeModal';
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants';
import { usePlayer, Track } from '../context/PlayerContext';

const stockContract = getContract({ 
    client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI 
});

// 📈 실제 YouTube Data API를 통해 구한 데이터를 사용합니다.

// SVG 차트 컴포넌트
const AreaChart = ({ data, dates, width=1000, height=300 }: { data: number[], dates?: string[], width?: number, height?: number }) => {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    if(!data || data.length < 2) return <div className="w-full h-full bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500 text-sm rounded-xl">
        <Activity size={24} className="mb-2 opacity-50"/>
        Building initial data points...
    </div>;
    
    // 차트의 최소값을 무조건 0부터 시작하게 하거나 데이터의 최소값에 여백을 두게 할수있음
    // PerpDEX 트레이딩 뷰 느낌을 위해 좀 타이트하게 잡습니다.
    const minVal = Math.min(0, Math.min(...data) * 0.95); // 조회수는 보통 0부터지만, 하단 여백 생성
    const maxVal = Math.max(...data) * 1.05;
    const range = maxVal - minVal || 1;
    
    const d = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - minVal) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const areaD = `${d} V ${height} H 0 Z`;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPos = e.clientX - rect.left;
        const idx = Math.min(Math.max(0, Math.floor((xPos / rect.width) * data.length)), data.length - 1);
        setHoverIdx(idx);
    };

    return (
        <div className="relative w-full h-full" onMouseLeave={() => setHoverIdx(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none" onMouseMove={handleMouseMove}>
                <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#0ecb81" stopOpacity="0.0"/>
                    </linearGradient>
                </defs>
                
                {/* Y-Axis Grid Lines for "trading" feel */}
                <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>
                <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>
                <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>

                <path d={areaD} fill="url(#chartGrad)" />
                <path d={d} fill="none" stroke="#0ecb81" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                
                {hoverIdx !== null && (
                    <line 
                        x1={(hoverIdx / (data.length - 1)) * width}
                        y1="0"
                        x2={(hoverIdx / (data.length - 1)) * width}
                        y2={height}
                        stroke="#ffffff"
                        strokeWidth="1"
                        strokeDasharray="4"
                        opacity={0.5}
                        vectorEffect="non-scaling-stroke"
                    />
                )}
            </svg>
            
            {/* Tooltip */}
            {hoverIdx !== null && (
                <div className="absolute top-0 right-0 py-1.5 px-2 bg-black/90 border border-zinc-700 text-xs font-mono rounded shadow-xl text-white z-10 pointers-events-none flex flex-col gap-0.5">
                    <span className="text-[10px] text-zinc-400 font-sans">
                        {dates && dates[hoverIdx] ? dates[hoverIdx] : `Day ${hoverIdx + 1}`}
                    </span>
                    <span className="font-bold text-[#0ecb81]">{data[hoverIdx].toLocaleString()} Views</span>
                </div>
            )}
            
            {/* Start and End Date Labels roughly below */}
            {dates && dates.length > 1 && (
                <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] font-mono text-zinc-600">
                    <span>{dates[0]}</span>
                    <span>{dates[dates.length - 1]}</span>
                </div>
            )}
        </div>
    );
};

export default function InvestingPage() {
    const account = useActiveAccount();
    const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

    const [marketItems, setMarketItems] = useState<Track[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [loading, setLoading] = useState(true);
    const [youtubeData, setYoutubeData] = useState<Record<string, {cumulativeViews: number[], dailyViews?: number[], dateLabels?: string[], totalViews: number}>>({});

    // 실제 YouTube Views Data Fetch
    useEffect(() => {
        marketItems.forEach(async (track) => {
            const yid = track.youtube_id;
            if (!yid) return;
            // 이미 로드했거나 로드 중이면 스킵
            setYoutubeData(prev => {
                if (prev[yid]) return prev;
                // 약간의 눈속임(초기 상태)을 위해 prev에 빈 데이터를 넣어 불필요한 중복 호출 방지
                return { ...prev, [yid]: { cumulativeViews: [], dailyViews: [], dateLabels: [], totalViews: 0 }};
            });
            try {
                const res = await fetch(`/api/youtube?videoId=${yid}`);
                const data = await res.json();
                if (data && data.cumulativeViews) {
                    setYoutubeData(prev => ({ ...prev, [yid]: data }));
                }
            } catch(e) { 
                console.error("Failed to fetch views for", yid, e);
            }
        });
    }, [marketItems]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: tracks, error } = await supabase
                .from('tracks')
                .select('*, artist:profiles (username,wallet_address,avatar_url)')
                .eq('is_minted', true)
                .not('youtube_id', 'is', null) // Youtube ID 있는 곡들만 (투자 상품)
                .order('created_at', { ascending: false });
            
            if (!error && tracks) {
                // youtube_id가 빈 문자열이 아닌 것만 필터링 (안전장치)
                const validTracks = tracks.filter(t => t.youtube_id && t.youtube_id.trim() !== '');
                setMarketItems(validTracks);
                if (validTracks.length > 0) setSelectedTrack(validTracks[0]);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const handleSelect = (track: Track) => {
        setSelectedTrack(track);
    };

    if (loading) {
        return <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center text-white"><Activity className="animate-pulse w-10 h-10 text-zinc-500" /></div>;
    }

    if (marketItems.length === 0) {
        return <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center text-white text-zinc-500 gap-2 font-bold">
            <Youtube size={32} />
            <p>No investment assets linked to Youtube found.</p>
        </div>;
    }

    return (
        <div className="min-h-screen bg-[#0b0e11] text-zinc-200 font-sans flex flex-col pt-16 lg:pt-0"> 
            {/* Top Navigation Bar */}
            <header className="h-[60px] border-b border-zinc-800/80 bg-[#12161c] flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 lg:static">
                <div className="flex items-center gap-4 lg:gap-6">
                    <Link href="/market" className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition border border-zinc-700/50">
                        <ChevronLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <Activity className="text-blue-500" size={20} />
                        UNLISTED DEX <span className="text-blue-500 text-[10px] px-1.5 py-0.5 bg-blue-500/10 rounded-sm hidden sm:inline-block">BETA</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/portfolio" className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 transition text-xs font-bold text-white shadow-sm border border-zinc-700">
                        <Wallet size={14} className="text-zinc-400"/> Portfolio
                    </Link>
                </div>
            </header>

            {/* Perpdex Main Body */}
            <div className="flex-1 flex flex-col lg:flex-row h-full lg:h-[calc(100vh-60px)] overflow-hidden bg-[#0b0e11]">
                
                {/* LEFT SIDEBAR: Markets List */}
                <div className="w-full lg:w-[320px] border-r border-zinc-800/80 bg-[#12161c] flex flex-col shrink-0 lg:h-full max-h-[40vh] lg:max-h-none overflow-hidden order-2 lg:order-1">
                    <div className="p-3 border-b border-zinc-800/80 shrink-0 flex justify-between items-center text-xs font-bold text-zinc-400">
                        <span className="flex items-center gap-1.5"><TrendingUp size={14}/> MARKETS</span>
                        <span className="text-[10px]">VIEWS / 30D CHG</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {marketItems.map((item) => {
                            const isSelected = selectedTrack?.id === item.id;
                            const yData = youtubeData[item.youtube_id || ""];
                            const viewDataArray = yData?.cumulativeViews || [];
                            const currentViews = viewDataArray.length > 0 ? viewDataArray[viewDataArray.length - 1] : 0;
                            const startViews = viewDataArray.length > 0 ? viewDataArray[0] : 0;
                            const pctChange = startViews > 0 ? ((currentViews - startViews) / startViews) * 100 : 0;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`w-full text-left p-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition flex items-center justify-between gap-3
                                        ${isSelected ? 'bg-zinc-800/80 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}
                                    `}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded shrink-0 overflow-hidden relative">
                                            <img src={item.cover_image_url || '/no-image.png'} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{item.title}</h3>
                                            <p className="text-[10px] text-zinc-500 truncate">{item.artist?.username}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-mono font-medium text-white">{currentViews >= 1000 ? (currentViews/1000).toFixed(1) + 'k' : currentViews}</p>
                                        <p className="text-[10px] text-[#0ecb81] font-mono">+{pctChange.toFixed(1)}%</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* CENTER: Main Chart & Content */}
                {selectedTrack && (
                   <CenterPanel track={selectedTrack} yData={youtubeData[selectedTrack.youtube_id || ""]} />
                )}
            </div>
        </div>
    );
}

// -----------------------------------------------------
// Center & Right Panels Component 
// (separated for cleaner contract hooks per track)
// -----------------------------------------------------
function CenterPanel({ track, yData }: { track: Track, yData?: {cumulativeViews: number[], dailyViews?: number[], dateLabels?: string[], totalViews: number} }) {
    const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
    
    // Contract info for real trading
    const tokenIdBigInt = track.token_id ? BigInt(track.token_id) : BigInt(0);
    const { data: stockInfo } = useReadContract({ contract: stockContract, method: "stocks", params: [tokenIdBigInt] });
    const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, BigInt(1)] });
    
    const price = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
    const currentSupply = stockInfo ? Number(stockInfo[0]) : 0;
    
    const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
    
    // View Data
    const viewData = useMemo(() => {
        if (!yData) return [];
        return chartMode === 'cumulative' ? yData.cumulativeViews : (yData.dailyViews || []);
    }, [yData, chartMode]);
    const dateLabels = yData?.dateLabels || [];

    const currentViews = yData && yData.cumulativeViews.length > 0 ? yData.cumulativeViews[yData.cumulativeViews.length - 1] : 0;
    const pastViews = yData && yData.cumulativeViews.length > 0 ? yData.cumulativeViews[0] : 0;
    const growthPercent = pastViews > 0 ? ((currentViews - pastViews) / pastViews) * 100 : 0;

    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

    const handlePlay = () => {
        if (currentTrack?.id === track.id) { togglePlay(); } 
        else { playTrack(track, [track]); }
    };
    
    const isCurrent = currentTrack?.id === track.id;

    return (
        <>
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0b0e11] order-1 lg:order-2 relative lg:static">
                
                {/* Asset Status Bar (Ticker Info) */}
                <div className="h-[75px] border-b border-zinc-800/80 bg-[#12161c] px-6 flex items-center overflow-x-auto custom-scrollbar shrink-0 gap-8">
                    {/* Track Core Info */}
                    <div className="flex items-center gap-4 shrink-0 pr-6 border-r border-zinc-800">
                        <button onClick={handlePlay} className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition shadow-lg shrink-0">
                            {isPlaying && isCurrent ? <Pause size={20} fill="white" className="text-white"/> : <Play size={20} fill="white" className="text-white ml-1"/>}
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-white whitespace-nowrap">{track.title}</h2>
                            <p className="text-xs text-blue-400 font-bold underline cursor-pointer">{track.artist?.username}</p>
                        </div>
                    </div>
                    
                    {/* Youtube Views Stats */}
                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold mb-0.5">YOUTUBE VIEWS (REAL)</span>
                        <span className="text-base font-mono font-bold text-[#0ecb81] flex items-center gap-1">
                            {currentViews.toLocaleString()} <Activity size={14}/>
                        </span>
                    </div>

                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold mb-0.5">30D CHANGE</span>
                        <span className="text-sm font-mono font-bold text-[#0ecb81]">+{growthPercent.toFixed(2)}%</span>
                    </div>

                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold mb-0.5">TOKEN ID</span>
                        <span className="text-sm font-mono font-bold text-zinc-300">#{track.token_id || "N/A"}</span>
                    </div>
                </div>

                {/* CHART AREA */}
                <div className="h-[45%] lg:h-[60%] border-b border-zinc-800/80 relative p-4 flex flex-col shrink-0">
                    <div className="absolute top-4 left-6 right-6 z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3 pointer-events-none">
                            <Youtube className="text-red-500" size={18}/>
                            {/* 향후 틱톡/기타 플랫폼이 추가된다면 이 부분에 아이콘을 병렬 배치할 수 있습니다 */}
                            <span className="text-xs font-bold text-zinc-300">Omni-Platform Trend</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">ALL-TIME</span>
                        </div>
                        <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                            <button 
                                onClick={() => setChartMode('cumulative')}
                                className={`text-[9px] font-bold px-3 py-1.5 rounded transition ${chartMode === 'cumulative' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >CUMULATIVE</button>
                            <button 
                                onClick={() => setChartMode('daily')}
                                className={`text-[9px] font-bold px-3 py-1.5 rounded transition ${chartMode === 'daily' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >DAILY</button>
                        </div>
                    </div>
                    <div className="flex-1 w-full mt-10">
                        <AreaChart data={viewData} dates={dateLabels} />
                    </div>
                </div>

                {/* BOTTOM AREA: Youtube Video Embed */}
                <div className="flex-1 p-6 overflow-y-auto bg-[#0b0e11] flex flex-col items-center">
                    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                            <Info size={16}/> Underlying Content
                        </h3>
                        {track.youtube_id ? (
                            <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
                                <iframe 
                                    className="w-full h-full"
                                    src={`https://www.youtube.com/embed/${track.youtube_id}`} 
                                    title="YouTube play"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                ></iframe>
                            </div>
                        ) : (
                            <div className="aspect-video w-full rounded-xl border border-zinc-800 border-dashed flex items-center justify-center text-zinc-600">
                                No Youtube Video found.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR: Order Panel */}
            <div className="w-full lg:w-[340px] border-l border-zinc-800/80 bg-[#12161c] flex flex-col shrink-0 order-3 z-20">
                <div className="p-5 border-b border-zinc-800/80 shrink-0">
                    <h2 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                        TRADE ASSET
                    </h2>
                    
                    {/* Real Contract Bonding Curve Info */}
                    <div className="bg-[#0b0e11] rounded-lg p-4 mb-6 border border-zinc-800">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-zinc-500 font-bold">Current Price</span>
                            <span className="text-sm font-mono text-white font-bold">{price > 0 ? price.toFixed(4) : "0.0000"} MLD</span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-zinc-500 font-bold">Total Circulating</span>
                            <span className="text-sm font-mono text-zinc-300">{currentSupply} Shares</span>
                        </div>
                        <div className="h-px w-full bg-zinc-800 my-3 hidden"></div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                            As Youtube view increases, asset visibility jumps. Buy on the bonding curve early to capture potential upside.
                        </p>
                    </div>

                    <button 
                         onClick={() => setIsTradeModalOpen(true)}
                         disabled={!track.token_id}
                         className={`w-full py-3.5 rounded-lg font-black text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#12161c]
                            ${track.token_id 
                                ? 'bg-[#0ecb81] hover:bg-[#0ba668] text-[#12161c] shadow-[0_0_15px_rgba(14,203,129,0.3)]' 
                                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
                         `}
                    >
                        {track.token_id ? 'Launch Trade Terminal' : 'Not Listed Yet'}
                    </button>
                </div>
                
                <div className="flex-1 p-5 overflow-y-auto">
                    <h3 className="text-xs font-bold text-zinc-500 mb-3">ASSET METADATA</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-600">Created At</span>
                            <span className="text-zinc-400 font-mono">{new Date(track.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-600">Artist</span>
                            <span className="text-zinc-400">{track.artist?.username || "Unknown"}</span>
                        </div>
                        {track.genre && track.genre.length > 0 && (
                             <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-600">Genres</span>
                                <span className="text-zinc-400 max-w-[150px] truncate text-right">
                                    {(Array.isArray(track.genre) ? track.genre : [track.genre]).join(", ")}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-600">Contract</span>
                            <Link href={`https://amoy.polygonscan.com/address/${UNLISTED_STOCK_ADDRESS}`} target="_blank" className="text-blue-500 hover:text-blue-400 flex items-center gap-1">
                                Explorer <ExternalLink size={10}/>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {isTradeModalOpen && (
                <TradeModal
                  isOpen={isTradeModalOpen}
                  onClose={() => setIsTradeModalOpen(false)}
                  track={{ ...track, token_id: track.token_id ?? null }}
                />
            )}
        </>
    );
}
