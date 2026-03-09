'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { X, Play, Pause, Wallet, ExternalLink, Activity, Info, TrendingUp, BarChart2, Youtube, ChevronLeft, Trophy, Percent, Gift, TrendingDown, AlertCircle, Coins, CheckCircle, Loader2 } from 'lucide-react';
import { Link } from "@/lib/i18n";
import { formatEther } from 'viem';
import TradeModal from '../components/TradeModal';
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { usePlayer, Track } from '../context/PlayerContext';
import toast from 'react-hot-toast';

// --- Contract Instances ---
const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const ipContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

//  Platform data types
type PlatformData = {
    cumulativeViews: number[];
    dailyViews: number[];
    dateLabels: string[];
    totalViews: number;
    title?: string;
    thumbnailUrl?: string;
};

type MergedViewData = {
    youtube: PlatformData;
    tiktok: PlatformData;
    merged: {
        dateLabels: string[];
        youtube: { daily: number[]; cumulative: number[] };
        tiktok: { daily: number[]; cumulative: number[] };
        total: { daily: number[]; cumulative: number[] };
    };
};

// 📈 날짜 기반으로 여러 소스를 머지하는 유틸
function mergeTimelineData(youtube: PlatformData, tiktok: PlatformData): MergedViewData['merged'] {
    // 모든 날짜를 합집합으로 수집
    const dateSet = new Set<string>();
    youtube.dateLabels.forEach(d => dateSet.add(d));
    tiktok.dateLabels.forEach(d => dateSet.add(d));
    
    const allDates = Array.from(dateSet).sort();
    
    if (allDates.length === 0) {
        return {
            dateLabels: [],
            youtube: { daily: [], cumulative: [] },
            tiktok: { daily: [], cumulative: [] },
            total: { daily: [], cumulative: [] },
        };
    }
    
    // Build date->value maps
    const ytMap: Record<string, number> = {};
    youtube.dateLabels.forEach((d, i) => { ytMap[d] = youtube.dailyViews[i] || 0; });
    
    const ttMap: Record<string, number> = {};
    tiktok.dateLabels.forEach((d, i) => { ttMap[d] = tiktok.dailyViews[i] || 0; });
    
    // TikTok인데 daily가 비어있고 totalViews만 있는 경우 → 마지막 날에 total을 넣어 표현
    const tiktokHasOnlyTotal = tiktok.dailyViews.length === 0 && tiktok.totalViews > 0;
    if (tiktokHasOnlyTotal && allDates.length > 0) {
        // totalViews를 전 기간에 걸쳐 균등 분배
        const perDay = Math.floor(tiktok.totalViews / allDates.length);
        const remainder = tiktok.totalViews - perDay * allDates.length;
        allDates.forEach((d, i) => {
            ttMap[d] = perDay + (i === allDates.length - 1 ? remainder : 0);
        });
    }
    
    const ytDaily: number[] = [];
    const ttDaily: number[] = [];
    const totalDaily: number[] = [];
    const ytCum: number[] = [];
    const ttCum: number[] = [];
    const totalCum: number[] = [];
    
    let ytRunning = 0, ttRunning = 0;
    
    allDates.forEach(d => {
        const yv = ytMap[d] || 0;
        const tv = ttMap[d] || 0;
        
        ytDaily.push(yv);
        ttDaily.push(tv);
        totalDaily.push(yv + tv);
        
        ytRunning += yv;
        ttRunning += tv;
        
        ytCum.push(ytRunning);
        ttCum.push(ttRunning);
        totalCum.push(ytRunning + ttRunning);
    });
    
    return {
        dateLabels: allDates,
        youtube: { daily: ytDaily, cumulative: ytCum },
        tiktok: { daily: ttDaily, cumulative: ttCum },
        total: { daily: totalDaily, cumulative: totalCum },
    };
}

// 📈 TikTok Logo SVG (lucide doesn't have it)
const TikTokIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.8.1V9a6.33 6.33 0 00-.8-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 0010.86 4.43A6.28 6.28 0 0015.85 15V8.73a8.3 8.3 0 004.88 1.57V6.85a4.86 4.86 0 01-1.14-.16z"/>
    </svg>
);

// SVG Multi-Line 차트 컴포넌트
const MultiLineChart = ({ 
    series, 
    dates, 
    width = 1000, 
    height = 300 
}: { 
    series: { data: number[]; color: string; label: string; gradientId: string }[];
    dates?: string[];
    width?: number; 
    height?: number;
}) => {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    
    // Find the longest data array
    const maxLen = Math.max(...series.map(s => s.data.length), 0);
    
    if (series.length === 0) return <div className="w-full h-full bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500 text-sm rounded-xl">
        <Activity size={24} className="mb-2 opacity-50"/>
        Select a series from the legend.
    </div>;

    if (maxLen < 2) return <div className="w-full h-full bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500 text-sm rounded-xl">
        <Activity size={24} className="mb-2 opacity-50"/>
        Building initial data points...
    </div>;

    // Global min/max across all series
    const allVals = series.flatMap(s => s.data);
    const minVal = Math.min(0, Math.min(...allVals) * 0.95);
    const maxVal = Math.max(...allVals) * 1.05;
    const range = maxVal - minVal || 1;

    const buildPath = (data: number[]) => {
        return data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - minVal) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPos = e.clientX - rect.left;
        const idx = Math.min(Math.max(0, Math.floor((xPos / rect.width) * maxLen)), maxLen - 1);
        setHoverIdx(idx);
    };

    return (
        <div className="relative w-full h-full" onMouseLeave={() => setHoverIdx(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none" onMouseMove={handleMouseMove}>
                <defs>
                    {series.map(s => (
                        <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity="0.2"/>
                            <stop offset="100%" stopColor={s.color} stopOpacity="0.0"/>
                        </linearGradient>
                    ))}
                </defs>
                
                {/* Y-Axis Grid Lines */}
                <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>
                <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>
                <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#333" strokeWidth="0.5" strokeDasharray="3" opacity="0.3"/>

                {/* Render each series */}
                {series.map(s => {
                    if (s.data.length < 2) return null;
                    const d = buildPath(s.data);
                    const areaD = `${d} V ${height} H 0 Z`;
                    return (
                        <g key={s.gradientId}>
                            <path d={areaD} fill={`url(#${s.gradientId})`} />
                            <path d={d} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </g>
                    );
                })}
                
                {/* Hover crosshair */}
                {hoverIdx !== null && (
                    <line 
                        x1={(hoverIdx / (maxLen - 1)) * width}
                        y1="0"
                        x2={(hoverIdx / (maxLen - 1)) * width}
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
                <div className="absolute top-0 right-0 py-2 px-3 bg-black/95 border border-zinc-700 text-xs font-mono rounded-lg shadow-xl text-white z-10 pointer-events-none flex flex-col gap-1 min-w-[140px]">
                    <span className="text-[10px] text-zinc-400 font-sans mb-0.5">
                        {dates && dates[hoverIdx] ? dates[hoverIdx] : `Day ${hoverIdx + 1}`}
                    </span>
                    {series.map(s => (
                        <span key={s.label} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }}/>
                            <span className="text-zinc-400 text-[10px]">{s.label}</span>
                            <span className="ml-auto font-bold" style={{ color: s.color }}>
                                {s.data[hoverIdx] !== undefined ? s.data[hoverIdx].toLocaleString() : '-'}
                            </span>
                        </span>
                    ))}
                </div>
            )}
            
            {/* Date Labels */}
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
    const [youtubeData, setYoutubeData] = useState<Record<string, PlatformData>>({});
    const [tiktokData, setTiktokData] = useState<Record<string, PlatformData>>({});
    
    // 로딩 상태 및 정렬 상태 관리
    const [fetchingYT, setFetchingYT] = useState<Record<string, boolean>>({});
    const [fetchingTT, setFetchingTT] = useState<Record<string, boolean>>({});
    const [sortBy, setSortBy] = useState<'views_desc' | 'views_asc' | 'date_desc' | 'date_asc'>('views_desc');

    // 실제 YouTube Views Data Fetch (Sequentially)
    useEffect(() => {
        const fetchYT = async () => {
            for (const track of marketItems) {
                const yid = track.youtube_id;
                if (!yid) continue;
                if (youtubeData[yid]) continue;

                setFetchingYT(prev => ({ ...prev, [yid]: true }));
                try {
                    const res = await fetch(`/api/youtube?videoId=${yid}`);
                    const data = await res.json();
                    if (data && data.cumulativeViews) {
                        setYoutubeData(prev => ({ ...prev, [yid]: data }));
                    }
                } catch(e) { 
                    console.error("Failed to fetch YT views for", yid, e);
                } finally {
                    setFetchingYT(prev => ({ ...prev, [yid]: false }));
                }
            }
        };
        fetchYT();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketItems]);

    // TikTok Views Data Fetch (Sequentially)
    useEffect(() => {
        const fetchTT = async () => {
            for (const track of marketItems) {
                const tid = track.tiktok_id?.trim();
                const turl = track.tiktok_url?.trim();
                const key = tid || turl || '';
                if (!key || tiktokData[key]) continue;

                setFetchingTT(prev => ({ ...prev, [key]: true }));
                try {
                    const params = new URLSearchParams();
                    if (tid) params.set('tiktokId', tid);
                    if (turl) params.set('tiktokUrl', turl);
                    const res = await fetch(`/api/tiktok?${params.toString()}`);
                    const data = await res.json();
                    if (data) {
                        setTiktokData(prev => ({ ...prev, [key]: {
                            cumulativeViews: data.cumulativeViews || [],
                            dailyViews: data.dailyViews || [],
                            dateLabels: data.dateLabels || [],
                            totalViews: data.totalViews || 0,
                            title: data.title || '',
                            thumbnailUrl: data.thumbnailUrl || ''
                        }}));
                    }
                    // 무료 API Rate limit 방지를 위해 약간 딜레이
                    await new Promise(r => setTimeout(r, 600));
                } catch(e) { 
                    console.error("Failed to fetch TikTok views for", key, e);
                } finally {
                    setFetchingTT(prev => ({ ...prev, [key]: false }));
                }
            }
        };
        fetchTT();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketItems]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: tracks, error } = await supabase
                .from('tracks')
                .select('*, artist:profiles (username,wallet_address,avatar_url)')
                .eq('is_minted', true)
                .not('youtube_id', 'is', null)
                .order('created_at', { ascending: false });
            
            if (!error && tracks) {
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

    // Helper to get total views across platforms
    const getTotalViews = (track: Track) => {
        const ytd = youtubeData[track.youtube_id || ""];
        const ttKey = track.tiktok_id?.trim() || track.tiktok_url?.trim() || '';
        const ttd = tiktokData[ttKey];
        const ytViews = ytd?.cumulativeViews?.length ? ytd.cumulativeViews[ytd.cumulativeViews.length - 1] : 0;
        const ttViews = ttd?.totalViews || 0;
        return ytViews + ttViews;
    };

    const sortedMarketItems = useMemo(() => {
        return [...marketItems].sort((a, b) => {
            if (sortBy === 'views_desc') {
                return getTotalViews(b) - getTotalViews(a);
            } else if (sortBy === 'views_asc') {
                return getTotalViews(a) - getTotalViews(b);
            } else if (sortBy === 'date_desc') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
        });
    }, [marketItems, youtubeData, tiktokData, sortBy]);

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
                        <select 
                            value={sortBy} 
                            onChange={e => setSortBy(e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-700 text-[10px] rounded px-2 py-1 outline-none text-zinc-300 cursor-pointer"
                        >
                            <option value="views_desc">Views (High to Low)</option>
                            <option value="views_asc">Views (Low to High)</option>
                            <option value="date_desc">Newest</option>
                            <option value="date_asc">Oldest</option>
                        </select>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {sortedMarketItems.map((item) => {
                            const isSelected = selectedTrack?.id === item.id;
                            const yData = youtubeData[item.youtube_id || ""];
                            const viewDataArray = yData?.cumulativeViews || [];
                            const currentViews = viewDataArray.length > 0 ? viewDataArray[viewDataArray.length - 1] : 0;
                            const startViews = viewDataArray.length > 0 ? viewDataArray[0] : 0;
                            const pctChange = startViews > 0 ? ((currentViews - startViews) / startViews) * 100 : 0;
                            const totalViews = getTotalViews(item);
                            const hasTikTok = !!(item.tiktok_id || item.tiktok_url);
                            
                            const ttKey = item.tiktok_id?.trim() || item.tiktok_url?.trim() || '';
                            const isFetchingLocalAny = fetchingYT[item.youtube_id || ''] || (hasTikTok && fetchingTT[ttKey]);

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
                                            <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                                                {item.artist?.username}
                                                {hasTikTok && <TikTokIcon size={10} className="text-zinc-500" />}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="flex items-center justify-end gap-1.5 mb-0.5">
                                            {isFetchingLocalAny && <Activity size={10} className="text-zinc-500 animate-spin" />}
                                            <p className="text-xs font-mono font-medium text-white">
                                                {totalViews >= 1000 ? (totalViews/1000).toFixed(1) + 'k' : totalViews}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-[#0ecb81] font-mono">+{pctChange.toFixed(1)}%</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* CENTER: Main Chart & Content */}
                {selectedTrack && (
                   <CenterPanel 
                        track={selectedTrack} 
                        yData={youtubeData[selectedTrack.youtube_id || ""]}
                        tData={tiktokData[selectedTrack.tiktok_id?.trim() || selectedTrack.tiktok_url?.trim() || ""]}
                        fetchingYT={fetchingYT[selectedTrack.youtube_id || ""]}
                        fetchingTT={fetchingTT[selectedTrack.tiktok_id?.trim() || selectedTrack.tiktok_url?.trim() || ""]}
                    />
                )}
            </div>
        </div>
    );
}

// -----------------------------------------------------
// Center & Right Panels Component 
// -----------------------------------------------------
function CenterPanel({ track, yData, tData, fetchingYT, fetchingTT }: { 
    track: Track; 
    yData?: PlatformData; 
    tData?: PlatformData;
    fetchingYT?: boolean;
    fetchingTT?: boolean;
}) {
    const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
    
    // Contract info for real trading
    const tokenIdBigInt = track.token_id ? BigInt(track.token_id) : BigInt(0);
    const { data: stockInfo } = useReadContract({ contract: stockContract, method: "stocks", params: [tokenIdBigInt] });
    const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, BigInt(1)] });
    
    const price = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
    const currentSupply = stockInfo ? Number(stockInfo[0]) : 0;
    
    const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
    const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({ YouTube: true, TikTok: true, Total: true });

    const hasTikTok = !!(track.tiktok_id || track.tiktok_url);
    
    // Merge platform data
    const emptyPlatform: PlatformData = { cumulativeViews: [], dailyViews: [], dateLabels: [], totalViews: 0 };
    const ytPlatform = yData || emptyPlatform;
    const ttPlatform = tData || emptyPlatform;
    
    const merged = useMemo(() => mergeTimelineData(ytPlatform, ttPlatform), [ytPlatform, ttPlatform]);
    
    const chartSeriesAll = useMemo(() => {
        const mode = chartMode;
        const ytVals = mode === 'cumulative' ? merged.youtube.cumulative : merged.youtube.daily;
        const ttVals = mode === 'cumulative' ? merged.tiktok.cumulative : merged.tiktok.daily;
        const totalVals = mode === 'cumulative' ? merged.total.cumulative : merged.total.daily;
        
        const series = [
            { data: ytVals, color: '#FF0000', label: 'YouTube', gradientId: 'ytGrad' },
        ];
        
        if (hasTikTok) {
            series.push({ data: ttVals, color: '#25F4EE', label: 'TikTok', gradientId: 'ttGrad' });
            series.push({ data: totalVals, color: '#A855F7', label: 'Total', gradientId: 'totalGrad' });
        }
        
        return series;
    }, [merged, chartMode, hasTikTok]);

    const chartSeries = useMemo(() => chartSeriesAll.filter(s => visibleSeries[s.label]), [chartSeriesAll, visibleSeries]);

    // Stats
    const ytCurrentViews = ytPlatform.cumulativeViews.length > 0 ? ytPlatform.cumulativeViews[ytPlatform.cumulativeViews.length - 1] : 0;
    const ttCurrentViews = ttPlatform.totalViews || 0;
    const totalCurrentViews = ytCurrentViews + ttCurrentViews;
    
    const pastViews = ytPlatform.cumulativeViews.length > 0 ? ytPlatform.cumulativeViews[0] : 0;
    const growthPercent = pastViews > 0 ? ((ytCurrentViews - pastViews) / pastViews) * 100 : 0;

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
                    
                    {/* Total Views */}
                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold mb-0.5 whitespace-nowrap">TOTAL VIEWS</span>
                        <span className="text-base font-mono font-bold text-[#A855F7] flex items-center gap-1">
                            {totalCurrentViews.toLocaleString()} 
                            {(fetchingYT || fetchingTT) ? <Activity size={14} className="animate-spin text-zinc-500"/> : <Activity size={14}/>}
                        </span>
                    </div>

                    {/* YouTube Views */}
                    <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold mb-0.5 flex items-center gap-1 whitespace-nowrap">
                            <Youtube size={10} className="text-red-500"/> YOUTUBE
                        </span>
                        <span className="text-sm font-mono font-bold text-red-400 flex items-center gap-1">
                            {ytCurrentViews.toLocaleString()}
                            {fetchingYT && <Activity size={10} className="animate-spin text-zinc-500"/>}
                        </span>
                    </div>

                    {/* TikTok Views */}
                    {hasTikTok && (
                        <div className="flex flex-col shrink-0">
                            <span className="text-[10px] text-zinc-500 font-bold mb-0.5 flex items-center gap-1 whitespace-nowrap">
                                <TikTokIcon size={10} className="text-cyan-400"/> TIKTOK
                            </span>
                            <span className="text-sm font-mono font-bold text-cyan-400 flex items-center gap-1">
                                {ttCurrentViews.toLocaleString()}
                                {fetchingTT && <Activity size={10} className="animate-spin text-zinc-500"/>}
                            </span>
                        </div>
                    )}

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
                            {hasTikTok && <TikTokIcon size={18} className="text-cyan-400" />}
                            <span className="text-xs font-bold text-zinc-300">Omni-Platform Trend</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">ALL-TIME</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Legend - Clickable */}
                            <div className="hidden sm:flex items-center gap-3 mr-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                                <button onClick={() => setVisibleSeries(p => ({...p, YouTube: !p.YouTube}))} className={`flex items-center gap-1.5 text-[9px] font-bold transition hover:opacity-80 ${visibleSeries.YouTube ? 'text-zinc-300' : 'text-zinc-600 line-through decoration-zinc-600'}`}>
                                    <span className={`w-2 h-2 rounded-full ${visibleSeries.YouTube ? 'bg-red-500' : 'bg-red-900'}`}/>YouTube
                                </button>
                                {hasTikTok && (
                                    <>
                                        <button onClick={() => setVisibleSeries(p => ({...p, TikTok: !p.TikTok}))} className={`flex items-center gap-1.5 text-[9px] font-bold transition hover:opacity-80 ${visibleSeries.TikTok ? 'text-zinc-300' : 'text-zinc-600 line-through decoration-zinc-600'}`}>
                                            <span className={`w-2 h-2 rounded-full ${visibleSeries.TikTok ? 'bg-cyan-400' : 'bg-cyan-900'}`}/>TikTok
                                        </button>
                                        <button onClick={() => setVisibleSeries(p => ({...p, Total: !p.Total}))} className={`flex items-center gap-1.5 text-[9px] font-bold transition hover:opacity-80 ${visibleSeries.Total ? 'text-zinc-300' : 'text-zinc-600 line-through decoration-zinc-600'}`}>
                                            <span className={`w-2 h-2 rounded-full ${visibleSeries.Total ? 'bg-purple-500' : 'bg-purple-900'}`}/>Total
                                        </button>
                                    </>
                                )}
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
                    </div>
                    <div className="flex-1 w-full mt-10">
                        <MultiLineChart series={chartSeries} dates={merged.dateLabels} />
                    </div>
                </div>

                {/* BOTTOM AREA: Youtube/TikTok Video Embed */}
                <div className="flex-1 p-6 overflow-y-auto bg-[#0b0e11] flex flex-col items-center">
                    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                            <Info size={16}/> Underlying Content
                        </h3>
                        <div className={`grid gap-4 ${hasTikTok && track.youtube_id ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {track.youtube_id && (
                                <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
                                    <iframe 
                                        className="w-full h-full"
                                        src={`https://www.youtube.com/embed/${track.youtube_id}`} 
                                        title="YouTube play"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            )}
                            {hasTikTok && track.tiktok_url && (
                                <a 
                                    href={track.tiktok_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black relative block group"
                                >
                                    {/* Background Image: Prefer API thumbnail, fallback to track cover */}
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                        style={{ backgroundImage: `url(${tData?.thumbnailUrl || track.cover_image_url || '/no-image.png'})` }}
                                    />
                                    
                                    {/* Overlay Gradient for Text Readability */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                                    {/* TikTok Logo & View Count (Top Right) */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-white text-[10px] font-bold border border-white/10 shadow-sm">
                                        <TikTokIcon size={12} className="text-cyan-400" />
                                        <span>TIKTOK</span>
                                    </div>

                                    {/* Center Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border border-white/30 group-hover:bg-cyan-500/80 transition-all duration-300 group-hover:scale-110">
                                            <Play size={24} fill="white" className="text-white ml-1.5" />
                                        </div>
                                    </div>

                                    {/* Bottom Info Area */}
                                    <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                                        <h4 className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md mb-1.5">
                                            {tData?.title || track.title}
                                        </h4>
                                        <div className="flex items-center justify-between">
                                            <p className="text-zinc-300 text-[10px] font-medium drop-shadow-md flex items-center gap-1">
                                                @{track.artist?.username}
                                            </p>
                                            <span className="text-cyan-400 text-[10px] font-bold flex items-center gap-1 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/50">
                                                Watch Native <ExternalLink size={10} />
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            )}
                        </div>
                        {!track.youtube_id && !hasTikTok && (
                            <div className="aspect-video w-full rounded-xl border border-zinc-800 border-dashed flex items-center justify-center text-zinc-600">
                                No content linked.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR: Order Panel */}
            <div className="w-full lg:w-[340px] border-l border-zinc-800/80 bg-[#12161c] flex flex-col shrink-0 order-3 z-20">
                <div className="p-5 border-b border-zinc-800/80 shrink-0">
                    {/* Embedded Trade Terminal */}
                    <div className="flex-1 overflow-y-auto w-full">
                        {track.token_id ? (
                            <div className="w-full">
                                <EmbeddedTradeTerminal track={{ ...track, token_id: track.token_id }} />
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                                    <AlertCircle className="text-zinc-500" size={24} />
                                </div>
                                <h3 className="text-zinc-300 font-bold mb-2">Asset Not Listed</h3>
                                <p className="text-xs text-zinc-500 mb-6">
                                    This track has not been tokenized for trading on the Unlisted DEX yet.
                                </p>
                                <button className="px-4 py-2 bg-zinc-800 text-zinc-400 text-xs font-bold rounded cursor-not-allowed">
                                    Coming Soon
                                </button>
                            </div>
                        )}

                        {/* Asset Metadata */}
                        <div className="mt-8 space-y-4 pt-6 border-t border-zinc-900/50">
                            <h3 className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider">Asset Metadata</h3>
                            
                            <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-600">ID</span>
                                <span className="text-zinc-400 font-mono">#{track.token_id || track.id}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-600">Platform</span>
                                <span className="text-zinc-400">YouTube, TikTok</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-600">Contract</span>
                                <Link href={`https://amoy.polygonscan.com/address/${UNLISTED_STOCK_ADDRESS}`} target="_blank" className="text-blue-500 hover:text-blue-400 flex items-center gap-1">
                                    Explorer <ExternalLink size={10}/>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function EmbeddedTradeTerminal({ track }: { 
    track: { 
        id: number; 
        title: string; 
        token_id: number; 
        artist_name?: string; 
        artist?: { username: string | null; wallet_address: string | null; avatar_url: string | null; } | null; 
    } 
}) {
    const account = useActiveAccount();
    const address = account?.address;
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState<string>('1');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [progress, setProgress] = useState(0);
    const [loadingMsg, setLoadingMsg] = useState("Initializing...");
    const [timeLeftStr, setTimeLeftStr] = useState("00:00:00");

    const { mutate: sendTransaction, isPending } = useSendTransaction();

    const tokenIdBigInt = BigInt(track.token_id);
    const amountBigInt = BigInt(Number(amount || 0));

    // Blockchain Reads
    const { data: stockInfo, refetch: refetchStock } = useReadContract({ contract: stockContract, method: "stocks", params: [tokenIdBigInt] });
    const { data: mySharesVal, refetch: refetchShares } = useReadContract({ contract: stockContract, method: "sharesBalance", params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"] });
    const { data: pendingRewardVal, refetch: refetchRewards } = useReadContract({ contract: stockContract, method: "getPendingReward", params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"] });
    const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, amountBigInt] });
    const { data: sellPriceVal } = useReadContract({ contract: stockContract, method: "getSellPrice", params: [tokenIdBigInt, amountBigInt] });
    const { data: allowanceVal, refetch: refetchAllowance } = useReadContract({ contract: tokenContract, method: "allowance", params: [address || "0x0000000000000000000000000000000000000000", UNLISTED_STOCK_ADDRESS] });
    const { data: mldBalanceVal, refetch: refetchMldBalance } = useReadContract({ contract: tokenContract, method: "balanceOf", params: [address || "0x0000000000000000000000000000000000000000"] });

    const totalShares = stockInfo ? Number(stockInfo[0]) : 0;
    const jackpotBalance = stockInfo ? Number(formatEther(stockInfo[2])) : 0;
    const expiryTime = stockInfo ? Number(stockInfo[3]) : 0;
    const lastBuyer = stockInfo ? stockInfo[4] : "0x0000000000000000000000000000000000000000";
    const isJackpotClaimed = stockInfo ? stockInfo[5] : false;

    const myShares = mySharesVal ? Number(mySharesVal) : 0;
    const pendingReward = pendingRewardVal ? Number(formatEther(pendingRewardVal)) : 0;
    const myOwnership = totalShares > 0 ? ((myShares / totalShares) * 100).toFixed(2) : "0.00";

    const estimatedCost = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
    const estimatedPayout = sellPriceVal ? Number(formatEther(sellPriceVal)) : 0;
    
    const buyTotal = estimatedCost * 1.1; 
    const allowance = allowanceVal || BigInt(0);
    const myMldBalance = mldBalanceVal ? Number(formatEther(mldBalanceVal)) : 0;
    const costInWei = buyPriceVal ? (buyPriceVal * BigInt(110)) / BigInt(100) : BigInt(0);
    
    const isRoundEnded = expiryTime > 0 && Date.now() / 1000 > expiryTime;
    const isWinner = address && lastBuyer && address.toLowerCase() === lastBuyer.toLowerCase();
    const canClaimJackpot = isRoundEnded && isWinner && !isJackpotClaimed;

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            if (expiryTime === 0) setTimeLeftStr("Ready to Start (72h)");
            else if (expiryTime > now) {
                const diff = expiryTime - now;
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                setTimeLeftStr(`${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
            } else setTimeLeftStr("Round Ended");
        }, 1000);
        return () => clearInterval(timer);
    }, [expiryTime]);

    useEffect(() => {
        if (status === 'processing') {
            setProgress(0);
            setLoadingMsg("Processing transaction...");
            const interval = setInterval(() => { setProgress(p => (p + Math.random() * 5 > 90 ? 90 : p + Math.random() * 5)); }, 800);
            return () => clearInterval(interval);
        }
    }, [status]);

    const handleMintTokens = () => {
        if (!address) return toast.error("Please connect your wallet.");
        const toastId = toast.loading("Getting Free MLD...");
        const transaction = prepareContractCall({ contract: tokenContract, method: "mint", params: [address, BigInt(1000 * 1e18)] });
        sendTransaction(transaction, {
            onSuccess: () => { toast.success("1000 MLD Received! Now Approve.", { id: toastId }); refetchMldBalance(); },
            onError: () => toast.error("Mint failed.", { id: toastId })
        });
    };

    const handleApprove = () => {
        const transaction = prepareContractCall({ contract: tokenContract, method: "approve", params: [UNLISTED_STOCK_ADDRESS, BigInt(1000000 * 1e18)] });
        setStatus('processing');
        sendTransaction(transaction, {
            onSuccess: () => { setProgress(100); setStatus('success'); toast.success("Approved!"); refetchAllowance(); setTimeout(() => setStatus('idle'), 1500); },
            onError: () => { setStatus('idle'); toast.error("Failed."); }
        });
    };

    const handleTrade = () => {
        if (!address) {
            const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
            if (headerBtn) headerBtn.click();
            else toast.error("Please Join unlisted first.");
            return;
        }
        setStatus('processing');
        if (mode === 'buy') {
            if (buyTotal > myMldBalance) { setStatus('idle'); return toast.error("Insufficient MLD"); }
            if (timeLeftStr === "Round Ended") { setStatus('idle'); return toast.error("Round Ended. Buying is disabled."); }
            
            const transaction = prepareContractCall({ contract: stockContract, method: "buyShares", params: [tokenIdBigInt, amountBigInt] });
            sendTransaction(transaction, {
                onSuccess: () => { 
                    setProgress(100); setStatus('success'); toast.success("Shares Bought! Timer Extended!"); 
                    refetchShares(); refetchStock(); setTimeout(() => setStatus('idle'), 2000);
                },
                onError: () => { setStatus('idle'); toast.error("Buy Failed."); }
            });
        } else {
            const transaction = prepareContractCall({ contract: stockContract, method: "sellShares", params: [tokenIdBigInt, amountBigInt] });
            sendTransaction(transaction, {
                onSuccess: async () => { 
                    setProgress(100); setStatus('success'); toast.success("Shares Sold!"); 
                    try {
                        await supabase.rpc('log_crypto_revenue', {
                            p_beneficiary_wallet: address,
                            p_payer_address: UNLISTED_STOCK_ADDRESS, p_amount: estimatedPayout, p_currency: 'MLD',
                            p_activity_type: 'investment_return', p_track_id: track.id
                        });
                    } catch (e) {}
                    refetchShares(); refetchStock(); setTimeout(() => setStatus('idle'), 2000);
                },
                onError: () => { setStatus('idle'); toast.error("Sell Failed."); }
            });
        }
    };

    const handleClaimJackpot = () => {
        if (!canClaimJackpot) return;
        setStatus('processing');
        const transaction = prepareContractCall({ contract: stockContract, method: "claimJackpot", params: [tokenIdBigInt] });
        sendTransaction(transaction, {
            onSuccess: async () => {
                setProgress(100); setStatus('success'); toast.success("🏆 JACKPOT CLAIMED!");
                try {
                    await supabase.rpc('log_crypto_revenue', {
                        p_beneficiary_wallet: address, p_payer_address: UNLISTED_STOCK_ADDRESS, p_amount: jackpotBalance / 2,
                        p_currency: 'MLD', p_activity_type: 'jackpot_win', p_track_id: track.id
                    });
                } catch (e) {}
                refetchStock(); setTimeout(() => setStatus('idle'), 2000);
            },
            onError: () => { setStatus('idle'); toast.error("Claim Failed"); }
        });
    }

    const handleClaimReward = () => {
        if (pendingReward <= 0) return toast.error("No rewards to claim.");
        setStatus('processing');
        const transaction = prepareContractCall({ contract: stockContract, method: "claimRewards", params: [tokenIdBigInt] });
        sendTransaction(transaction, {
            onSuccess: async () => { 
                setProgress(100); setStatus('success'); toast.success("Dividends Claimed!"); 
                try {
                    await supabase.rpc('log_crypto_revenue', {
                        p_beneficiary_wallet: address, p_payer_address: UNLISTED_STOCK_ADDRESS, p_amount: pendingReward,
                        p_currency: 'MLD', p_activity_type: 'dividend', p_track_id: track.id
                    });
                } catch (e) {}
                refetchRewards(); setTimeout(() => setStatus('idle'), 1500); 
            },
            onError: () => { setStatus('idle'); toast.error("Claim Failed"); }
        });
    };

    const isInsufficientBalance = mode === 'buy' && buyTotal > myMldBalance;

    return (
        <div className="w-full flex w-full flex-col p-2 space-y-4">
            
            {status === 'idle' ? (
                <>
                {/* 🏆 Jackpot & Timer */}
                <div className={`rounded-xl border border-zinc-800/50 p-4 relative overflow-hidden ${canClaimJackpot ? 'bg-yellow-500/20' : 'bg-gradient-to-r from-yellow-900/10 to-orange-900/10'}`}>
                    <div className="absolute -top-4 -right-4 opacity-5"><Trophy size={80} className="text-yellow-500"/></div>
                    <div className="flex justify-between items-end relative z-10">
                        <div>
                            <p className="text-yellow-500 font-bold text-[10px] flex items-center gap-1 mb-0.5"><Trophy size={10}/> JACKPOT POOL</p>
                            <span className="font-black text-xl text-yellow-400 tracking-tight">{jackpotBalance.toFixed(2)} <span className="text-[10px]">MLD</span></span>
                        </div>
                        <div className="text-right">
                            <p className="text-zinc-500 text-[9px] mb-0.5">TIME LEFT</p>
                            <span className={`font-mono font-bold text-sm ${timeLeftStr === "Round Ended" || (expiryTime > 0 && expiryTime - Date.now()/1000 < 300) ? "text-red-500 animate-pulse" : "text-white"}`}>
                                {timeLeftStr}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 🎁 My Stats & Rewards */}
                <div className="px-3 py-2 bg-zinc-900/40 rounded-xl flex justify-between items-center border border-zinc-800/50">
                    <div className="flex flex-col">
                         <span className="text-[9px] text-zinc-500 flex items-center gap-1"><Percent size={10}/> MY OWNERSHIP</span>
                         <span className="text-xs font-bold text-white">{myOwnership}% <span className="text-zinc-600 font-normal">({myShares} shares)</span></span>
                    </div>
                    {pendingReward > 0 && (
                        <div className="flex items-center gap-2 bg-blue-900/30 px-2 py-1 rounded-lg border border-blue-500/30">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] text-blue-400 font-bold">REWARD</span>
                                <span className="text-xs font-black text-white">{pendingReward.toFixed(4)}</span>
                            </div>
                            <button onClick={handleClaimReward} className="bg-blue-500 hover:bg-blue-400 text-black p-1 rounded transition shadow-lg"><Gift size={12}/></button>
                        </div>
                    )}
                </div>

                {/* Mode Toggles */}
                <div className="flex gap-2">
                    <button onClick={() => setMode('buy')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${mode === 'buy' ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/20' : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}><TrendingUp size={14}/> Buy</button>
                    <button onClick={() => setMode('sell')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${mode === 'sell' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}><TrendingDown size={14}/> Sell</button>
                </div>

                <div className="space-y-4">
                    {/* Amount Input */}
                    <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setAmount(String(Math.max(1, Number(amount) - 1)))} className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-lg hover:bg-zinc-700 hover:text-white transition text-zinc-400 flex items-center justify-center">-</button>
                            <div className="flex-1 text-center flex flex-col items-center">
                                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-center text-2xl font-black text-white focus:outline-none p-0"/>
                                <p className="text-[9px] text-zinc-500">SHARES</p>
                            </div>
                            <button onClick={() => setAmount(String(Number(amount) + 1))} className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-lg hover:bg-zinc-700 hover:text-white transition text-zinc-400 flex items-center justify-center">+</button>
                        </div>
                    </div>

                    {/* Price Info */}
                    <div className="space-y-1.5 px-1">
                        <div className="flex justify-between text-[11px]"><span className="text-zinc-500">Price per share</span><span className="font-mono text-zinc-400">{(mode === 'buy' ? estimatedCost/Number(amount) || 0 : estimatedPayout/Number(amount) || 0).toFixed(4)} MLD</span></div>
                        <div className="flex justify-between items-center bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/50">
                            <span className="font-bold text-zinc-400 text-[11px]">TOTAL {mode === 'buy' ? 'COST' : 'PAYOUT'}</span>
                            <span className={`font-mono font-black text-sm ${mode === 'buy' ? 'text-blue-400' : 'text-red-400'}`}>
                                {(mode === 'buy' ? buyTotal : estimatedPayout).toFixed(4)} MLD
                            </span>
                        </div>
                        {mode === 'buy' && (
                             <div className="flex items-start gap-1.5 text-[9px] text-zinc-500 bg-zinc-900/30 p-2 rounded">
                                <Info size={10} className="mt-0.5 flex-shrink-0"/>
                                <p>Includes 10% Protocol Fee.<br/>Buy to extend timer by 10m.</p>
                             </div>
                        )}
                        {isInsufficientBalance && (
                            <div className="flex items-center gap-1.5 text-red-400 bg-red-900/10 p-2 rounded border border-red-500/20 text-[10px] mt-1">
                                <AlertCircle size={12}/> 
                                <span>Balance: {myMldBalance.toFixed(2)} MLD</span>
                            </div>
                        )}
                    </div>

                    {/* ✅ Main Button Logic */}
                    {mode === 'buy' ? (
                        <>
                            {canClaimJackpot ? (
                                <button onClick={handleClaimJackpot} className="w-full py-3 rounded-lg font-black text-sm bg-yellow-400 text-black hover:scale-[1.02] transition shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-2 animate-pulse">
                                    <Trophy size={16}/> CLAIM JACKPOT
                                </button>
                            ) : isInsufficientBalance ? (
                                <div className="space-y-2">
                                    <button onClick={handleMintTokens} disabled={isPending} className="w-full py-3 rounded-lg font-bold text-sm bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg flex items-center justify-center gap-2">
                                        {isPending ? <Loader2 className="animate-spin w-4 h-4"/> : <><Coins size={14}/> Get Free MLD</>}
                                    </button>
                                </div>
                            ) : allowance < costInWei ? (
                                <button onClick={handleApprove} className="w-full py-3 rounded-lg font-bold text-sm bg-blue-600/20 border border-blue-500 text-blue-400 hover:bg-blue-600/30 transition shadow-lg flex items-center justify-center gap-2">
                                    {isPending ? <Loader2 className="animate-spin w-4 h-4"/> : <><CheckCircle size={16}/> Approve MLD</>}
                                </button>
                            ) : (
                                <button onClick={handleTrade} disabled={timeLeftStr === "Round Ended"} className={`w-full py-3.5 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${timeLeftStr === "Round Ended" ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-500 text-black hover:scale-[1.02] shadow-blue-500/20'}`}>
                                    {timeLeftStr === "Round Ended" ? 'Round Ended' : 'CONFIRM BUY 🚀'}
                                </button>
                            )}
                        </>
                    ) : (
                        <button onClick={handleTrade} className="w-full py-3.5 rounded-lg font-black text-sm bg-red-600/90 hover:bg-red-600 text-white hover:scale-[1.02] transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
                            CONFIRM SELL
                        </button>
                    )}
                </div>
                </>
            ) : (
                // Processing UI
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-10 bg-zinc-900/20 rounded-xl border border-zinc-800/50">
                    {status === 'success' ? (
                        <div className="animate-in zoom-in-50 duration-300">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="text-blue-500 w-8 h-8" strokeWidth={2.5}/>
                            </div>
                            <h4 className="font-bold text-lg text-white">SUCCESS!</h4>
                            <p className="text-xs text-zinc-400 mt-1 mb-4">Transaction complete.</p>
                            <button onClick={() => setStatus('idle')} className="text-blue-400 text-xs hover:text-white underline font-bold px-4 py-2">Trade More</button>
                        </div>
                    ) : (
                        <div>
                            <div className="relative mx-auto w-16 h-16 mb-4">
                                <Loader2 className="animate-spin text-blue-500 w-full h-full opacity-30"/>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-mono text-white">{Math.round(progress)}%</div>
                            </div>
                            <h4 className="font-bold text-sm text-white animate-pulse">Processing...</h4>
                            <p className="text-[10px] text-zinc-500 font-mono mt-1">{loadingMsg}</p>
                            <div className="w-full max-w-[120px] bg-zinc-800 h-1 rounded-full mx-auto mt-4 overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}/></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
