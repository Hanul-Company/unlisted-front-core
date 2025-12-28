'use client';

import React, { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { TrendingUp, Trophy, Clock, Zap, Disc, Loader2 } from 'lucide-react';

// Contracts
const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const ipContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

interface InvestmentCardProps {
    track: any;
    onPlay: (track: any) => void;
    onInvest: (track: any) => void;
}

export default function InvestmentCard({ track, onPlay, onInvest }: InvestmentCardProps) {
    const tokenIdBigInt = BigInt(track.token_id || track.id);

    // 1. Contract Reads
    const { data: stockInfo, isLoading: isStockLoading } = useReadContract({
        contract: stockContract,
        method: "stocks",
        params: [tokenIdBigInt]
    });


    const { data: buyPriceVal } = useReadContract({
        contract: stockContract,
        method: "getBuyPrice",
        params: [tokenIdBigInt, BigInt(1)]
    });

    // 2. Parsing Data
    const jackpotBalance = stockInfo ? Number(formatEther(stockInfo[2])) : 0;
    const expiryTime = stockInfo ? Number(stockInfo[3]) : 0;
    const price = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;

    // ✅ [변경] DB에서 가져온 값 사용 (없으면 0)
    // track 데이터에 investor_share가 포함되어 있어야 함
    const investorSharePercent = track.investor_share ? track.investor_share / 100 : 0;

    // 3. Timer Logic (Simple Visual)
    const [timeLeftPercent, setTimeLeftPercent] = useState(100);
    const [timeLabel, setTimeLabel] = useState("");

    useEffect(() => {
        if (!stockInfo) return;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiryTime === 0) {
            setTimeLabel("Ready");
            setTimeLeftPercent(100);
        } else if (expiryTime > now) {
            const diff = expiryTime - now;
            const totalDuration = 72 * 3600; // 72h assumption
            const p = Math.min(100, (diff / totalDuration) * 100);
            
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            
            setTimeLabel(`${h}h ${m}m Left`);
            setTimeLeftPercent(p);
        } else {
            setTimeLabel("Ended");
            setTimeLeftPercent(0);
        }
    }, [expiryTime, stockInfo]);

// [수정 후] isStockLoading만 확인하면 됩니다.
    const isLoading = isStockLoading;
    const isHot = investorSharePercent >= 30; // 고배당 기준

    return (
        <div 
            className="min-w-[240px] w-[240px] group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-green-500/50 transition-all hover:shadow-xl cursor-pointer flex flex-col snap-center"
            onClick={() => onPlay(track)}
        >
            {/* Top Image Section */}
            <div className="relative h-32 bg-black overflow-hidden">
                {track.cover_image_url ? (
                    <img src={track.cover_image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-500"/>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700"><Disc size={32}/></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"/>
                
                {/* Badge: Yield */}
                <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-sm ${isHot ? 'bg-red-500/90 text-white border-red-500' : 'bg-black/60 text-zinc-300 border-white/10'}`}>
                        <TrendingUp size={10}/> {investorSharePercent}% Yield
                    </span>
                </div>

                {/* Badge: Price */}
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-white font-bold border border-white/10">
                    {isLoading ? "..." : `${price.toFixed(2)} MLD`}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-3 flex flex-col flex-1 gap-3">
                {/* Title */}
                <div>
                    <h3 className="font-bold text-sm text-white truncate group-hover:text-green-400 transition">{track.title}</h3>
                    <p className="text-xs text-zinc-500 truncate">{track.artist_name}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Jackpot Box */}
                    <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800 group-hover:border-yellow-900/50 transition">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold mb-0.5">
                            <Trophy size={10} className="text-yellow-500"/> JACKPOT
                        </div>
                        <div className="text-sm font-black text-yellow-500 truncate">
                            {isLoading ? "-" : jackpotBalance.toFixed(1)}
                        </div>
                    </div>

                    {/* Timer Box */}
                    <div className="bg-zinc-950 rounded-lg p-2 border border-zinc-800">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold mb-0.5">
                            <Clock size={10} className={timeLeftPercent < 20 ? "text-red-500" : "text-zinc-500"}/> {timeLabel}
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
                            <div 
                                className={`h-full ${timeLeftPercent < 20 ? 'bg-red-500' : 'bg-green-500'}`} 
                                style={{ width: `${timeLeftPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Invest Button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onInvest(track); }} 
                    className="mt-auto w-full bg-white text-black hover:bg-green-400 hover:scale-[1.02] active:scale-95 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition shadow-lg flex items-center justify-center gap-1.5"
                >
                    <Zap size={14} fill="black"/> Invest Now
                </button>
            </div>
        </div>
    );
}