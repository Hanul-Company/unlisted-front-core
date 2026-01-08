'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Trophy, Clock, Gift, Share2, Percent, Info, Coins, CheckCircle, AlertCircle } from 'lucide-react';
import { formatEther } from 'viem';
import toast from 'react-hot-toast';

import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';

// Contract Instances
const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const ipContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: { id: number; title: string; token_id: number | null; artist_name: string;   artist?: { username: string | null;wallet_address: string | null; avatar_url: string | null;} | null;};}

export default function TradeModal({ isOpen, onClose, track }: TradeModalProps) {
  const account = useActiveAccount();
  const address = account?.address;
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('1');
  
  // UI States
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");
  const [timeLeftStr, setTimeLeftStr] = useState("00:00:00");

  const { mutate: sendTransaction, isPending } = useSendTransaction();

  const tokenIdBigInt = BigInt(track.token_id || track.id);
  const amountBigInt = BigInt(Number(amount || 0));

  // --- Reads ---
  const { data: stockInfo, refetch: refetchStock } = useReadContract({ contract: stockContract, method: "stocks", params: [tokenIdBigInt] });
  const { data: mySharesVal, refetch: refetchShares } = useReadContract({ contract: stockContract, method: "sharesBalance", params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"] });
  const { data: pendingRewardVal, refetch: refetchRewards } = useReadContract({ contract: stockContract, method: "getPendingReward", params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"] });
  const { data: investorShareVal } = useReadContract({ contract: ipContract, method: "getInvestorShare", params: [tokenIdBigInt] });

  const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, amountBigInt] });
  const { data: sellPriceVal } = useReadContract({ contract: stockContract, method: "getSellPrice", params: [tokenIdBigInt, amountBigInt] });
  
  const { data: allowanceVal, refetch: refetchAllowance } = useReadContract({ contract: tokenContract, method: "allowance", params: [address || "0x0000000000000000000000000000000000000000", UNLISTED_STOCK_ADDRESS] });
  
  // ✅ [수정] 잔액 조회 시 refetch 추가 (Mint 후 UI 갱신을 위해)
  const { data: mldBalanceVal, refetch: refetchMldBalance } = useReadContract({ contract: tokenContract, method: "balanceOf", params: [address || "0x0000000000000000000000000000000000000000"] });

  // Parsing
  const totalShares = stockInfo ? Number(stockInfo[0]) : 0;
  const jackpotBalance = stockInfo ? Number(formatEther(stockInfo[2])) : 0;
  const expiryTime = stockInfo ? Number(stockInfo[3]) : 0;
  const myShares = mySharesVal ? Number(mySharesVal) : 0;
  const pendingReward = pendingRewardVal ? Number(formatEther(pendingRewardVal)) : 0;
  const investorSharePercent = investorShareVal ? Number(investorShareVal) / 100 : 0;
  const myOwnership = totalShares > 0 ? ((myShares / totalShares) * 100).toFixed(2) : "0.00";

  const estimatedCost = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
  const estimatedPayout = sellPriceVal ? Number(formatEther(sellPriceVal)) : 0;
  
  // Fees calculation
  const buyTotal = estimatedCost * 1.1; 
  const allowance = allowanceVal || BigInt(0);
  const myMldBalance = mldBalanceVal ? Number(formatEther(mldBalanceVal)) : 0;
  const costInWei = buyPriceVal ? (buyPriceVal * BigInt(110)) / BigInt(100) : BigInt(0);

  // --- Timer ---
  useEffect(() => {
    const timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        if (expiryTime === 0) {
            setTimeLeftStr("Ready to Start (72h)");
        } else if (expiryTime > now) {
            const diff = expiryTime - now;
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setTimeLeftStr(`${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
        } else {
            setTimeLeftStr("Round Ended");
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiryTime]);

  // --- Progress Logic ---
  useEffect(() => {
    if (status === 'processing') {
      setProgress(0);
      setLoadingMsg("Processing transaction...");
      const interval = setInterval(() => { setProgress(p => (p + Math.random() * 5 > 90 ? 90 : p + Math.random() * 5)); }, 800);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => { if (!isOpen) { setStatus('idle'); } }, [isOpen]);

  // --- Handlers ---

  // ✅ [New] Mint Handler (HeaderProfile 로직 이식)
  const handleMintTokens = () => {
    if (!address) return toast.error("Please connect your wallet.");
    
    const toastId = toast.loading("Getting Free MLD...");
    
    const transaction = prepareContractCall({
      contract: tokenContract,
      method: "mint",
      params: [address, BigInt(1000 * 1e18)],
    });

    sendTransaction(transaction, {
      onSuccess: () => {
        toast.success("1000 MLD Received! Now Approve.", { id: toastId });
        refetchMldBalance(); // 잔액 갱신 -> 다음 단계(Approve)로 자동 전환됨
      },
      onError: (err) => {
        console.error("Mint Error:", err);
        toast.error("Mint failed.", { id: toastId });
      }
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
    if (!address) return toast.error("Connect wallet");
    setStatus('processing');

    if (mode === 'buy') {
        if (buyTotal > myMldBalance) { setStatus('idle'); return toast.error("Insufficient MLD"); }
        if (timeLeftStr === "Round Ended") { setStatus('idle'); return toast.error("Round Ended. Buying is disabled."); }
        
        const transaction = prepareContractCall({ contract: stockContract, method: "buyShares", params: [tokenIdBigInt, amountBigInt] });
        sendTransaction(transaction, {
            onSuccess: () => { 
                setProgress(100); setStatus('success'); 
                toast.success("Shares Bought! Timer Extended!"); 
                refetchShares(); refetchStock();
            },
            onError: () => { setStatus('idle'); toast.error("Buy Failed."); }
        });
    } else {
        const transaction = prepareContractCall({ contract: stockContract, method: "sellShares", params: [tokenIdBigInt, amountBigInt] });
        sendTransaction(transaction, {
            onSuccess: () => { 
                setProgress(100); setStatus('success'); toast.success("Shares Sold!"); 
                refetchShares(); refetchStock();
                setTimeout(() => { onClose(); setStatus('idle'); }, 1500);
            },
            onError: () => { setStatus('idle'); toast.error("Sell Failed."); }
        });
    }
  };

  const handleShare = async () => {
      const shareText = `I just invested in "${track.title}" on MelodyLink! 🎵\n\nOwner Benefit: ${investorSharePercent}% Collection Yield\nJackpot Pool: ${jackpotBalance.toFixed(1)} MLD\n\nJoin the revolution! 🚀 #MelodyLink #MusicInvestment`;
      
      if (navigator.share) {
          try {
              await navigator.share({ title: 'Melody Link Investment', text: shareText, url: window.location.href });
              toast.success("Thanks for sharing!");
          } catch (error: any) {
              if (error.name === 'AbortError') return;
              navigator.clipboard.writeText(shareText);
              toast.success("Copied to clipboard instead!");
          }
      } else {
          navigator.clipboard.writeText(shareText);
          toast.success("Copied to clipboard! Post it on Twitter/TikTok!");
      }
  };

  const handleClaimReward = () => {
      setStatus('processing');
      const transaction = prepareContractCall({ contract: stockContract, method: "claimRewards", params: [tokenIdBigInt] });
      sendTransaction(transaction, {
          onSuccess: () => { setProgress(100); setStatus('success'); toast.success("Dividends Claimed!"); refetchRewards(); setTimeout(() => setStatus('idle'), 1500); },
          onError: () => { setStatus('idle'); toast.error("Claim Failed"); }
      });
  };

  // ✅ 조건 변수 (잔액 부족 여부)
  const isInsufficientBalance = mode === 'buy' && buyTotal > myMldBalance;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 relative">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
            <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    {track.title}
                    {investorSharePercent >= 30 && (
                        <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1 animate-pulse">
                            <TrendingUp size={10}/> Hot Yield {investorSharePercent}%
                        </span>
                    )}
                </h3>
                <p className="text-xs text-zinc-500">{track.artist?.username}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition text-zinc-400 hover:text-white"><X size={18}/></button>
        </div>

        {status === 'idle' ? (
            <>
                {/* 🏆 Jackpot & Timer */}
                <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 p-4 border-b border-zinc-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Trophy size={60} className="text-yellow-500"/></div>
                    <div className="flex justify-between items-end mb-2 relative z-10">
                        <div>
                            <p className="text-yellow-500 font-bold text-xs flex items-center gap-1 mb-1"><Trophy size={12}/> JACKPOT POOL</p>
                            <span className="font-black text-2xl text-yellow-400 tracking-tight">{jackpotBalance.toFixed(2)} <span className="text-sm">MLD</span></span>
                        </div>
                        <div className="text-right">
                            <p className="text-zinc-500 text-[10px] mb-1">TIME LEFT</p>
                            <span className={`font-mono font-bold text-lg ${timeLeftStr === "Round Ended" || (expiryTime > 0 && expiryTime - Date.now()/1000 < 300) ? "text-red-500 animate-pulse" : "text-white"}`}>
                                {timeLeftStr}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 🎁 My Stats */}
                <div className="px-5 py-3 bg-zinc-900/50 flex justify-between items-center border-b border-zinc-800">
                    <div className="flex flex-col">
                         <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Percent size={10}/> MY OWNERSHIP</span>
                         <span className="text-sm font-bold text-white">{myOwnership}% <span className="text-zinc-600 font-normal">({myShares} shares)</span></span>
                    </div>
                    {pendingReward > 0 && (
                        <div className="flex items-center gap-2 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-500/30">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-green-400 font-bold">REWARD</span>
                                <span className="text-sm font-black text-white">{pendingReward.toFixed(4)}</span>
                            </div>
                            <button onClick={handleClaimReward} className="bg-green-500 hover:bg-green-400 text-black p-1.5 rounded-md transition shadow-lg shadow-green-500/20"><Gift size={14}/></button>
                        </div>
                    )}
                </div>

                {/* Trade Actions */}
                <div className="flex p-2 gap-2 bg-zinc-900">
                    <button onClick={() => setMode('buy')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${mode === 'buy' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}><TrendingUp size={16}/> Buy</button>
                    <button onClick={() => setMode('sell')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${mode === 'sell' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}><TrendingDown size={16}/> Sell</button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Amount Input */}
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setAmount(String(Math.max(1, Number(amount) - 1)))} className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-xl hover:bg-zinc-700 hover:text-white transition text-zinc-400">-</button>
                            <div className="flex-1 text-center">
                                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-center text-3xl font-black text-white focus:outline-none p-0"/>
                                <p className="text-[10px] text-zinc-500 mt-1">SHARES</p>
                            </div>
                            <button onClick={() => setAmount(String(Number(amount) + 1))} className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-xl hover:bg-zinc-700 hover:text-white transition text-zinc-400">+</button>
                        </div>
                    </div>

                    {/* Price Info */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-zinc-500">Price per share</span><span className="font-mono text-zinc-400">{(mode === 'buy' ? estimatedCost/Number(amount) || 0 : estimatedPayout/Number(amount) || 0).toFixed(4)} MLD</span></div>
                        <div className="flex justify-between items-center bg-zinc-800/50 p-3 rounded-xl">
                            <span className="font-bold text-white text-sm">TOTAL ESTIMATED</span>
                            <span className={`font-mono font-black text-xl ${mode === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                {(mode === 'buy' ? buyTotal : estimatedPayout).toFixed(4)} MLD
                            </span>
                        </div>
                        {mode === 'buy' && (
                             <div className="flex items-start gap-2 text-[10px] text-zinc-500 bg-zinc-900/50 p-2 rounded">
                                <Info size={12} className="mt-0.5 flex-shrink-0"/>
                                <p>Includes 10% Fee (Jackpot, Dividends, Artist). <br/>Buying extends Jackpot timer by 10 mins.</p>
                             </div>
                        )}
                        {/* ✅ [New] 잔액 부족 시 경고 문구 */}
                        {isInsufficientBalance && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-900/10 p-2 rounded border border-red-500/20 text-xs mt-2">
                                <AlertCircle size={14}/> 
                                <span>Insufficient Balance: {myMldBalance.toFixed(2)} MLD</span>
                            </div>
                        )}
                    </div>

                    {/* ✅ Main Button Logic (Faucet -> Approve -> Buy) */}
                    {mode === 'buy' ? (
                        <>
                            {isInsufficientBalance ? (
                                // 1. 잔액 부족 시: Faucet UI 노출
                                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-xl text-center">
                                        <p className="text-purple-300 font-bold text-sm mb-1 flex items-center justify-center gap-1">
                                            <Gift size={14}/> Want to get free MLD?
                                        </p>
                                        <p className="text-[10px] text-purple-400/70">Testnet tokens are available for free.</p>
                                    </div>
                                    <button 
                                        onClick={handleMintTokens} 
                                        disabled={isPending}
                                        className="w-full py-4 rounded-xl font-bold text-lg bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg flex items-center justify-center gap-2"
                                    >
                                        {isPending ? <Loader2 className="animate-spin"/> : <><Coins size={18}/> Get 1000 Free MLD</>}
                                    </button>
                                </div>
                            ) : allowance < costInWei ? (
                                // 2. 잔액 충분 & 승인 필요 시: Approve UI 노출
                                <button 
                                    onClick={handleApprove} 
                                    className="w-full py-4 rounded-xl font-bold text-lg bg-blue-600 text-white hover:scale-[1.02] transition shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isPending ? <Loader2 className="animate-spin"/> : <><CheckCircle size={18}/> Step 1. Approve Contract</>}
                                </button>
                            ) : (
                                // 3. 모든 조건 충족 시: Buy UI 노출
                                <button 
                                    onClick={handleTrade} 
                                    disabled={timeLeftStr === "Round Ended"}
                                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${
                                        timeLeftStr === "Round Ended" ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-green-500 text-black hover:scale-[1.02] shadow-green-500/20'
                                    }`}
                                >
                                    {timeLeftStr === "Round Ended" ? 'Round Ended (Trading Only)' : 'CONFIRM BUY 🚀'}
                                </button>
                            )}
                        </>
                    ) : (
                        // Sell Mode
                        <button 
                            onClick={handleTrade}
                            className="w-full py-4 rounded-xl font-bold text-lg bg-red-600 text-white hover:scale-[1.02] transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                        >
                            CONFIRM SELL
                        </button>
                    )}
                </div>
            </>
        ) : (
            // Processing / Success UI
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 min-h-[350px]">
                {status === 'success' ? (
                    <>
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                            <Trophy className="text-black w-10 h-10" strokeWidth={3}/>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-black text-2xl text-white italic">SUCCESS!</h4>
                            <p className="text-sm text-zinc-400">
                                You now own <span className="text-white font-bold">{amount} Shares</span> of<br/>
                                <span className="text-yellow-400 font-bold">{track.title}</span>
                            </p>
                        </div>
                        
                        <div className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-[10px] text-zinc-500 mb-3 uppercase font-bold tracking-wider">Boost Your Investment</p>
                            <button onClick={handleShare} className="w-full py-3 bg-white text-black font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-zinc-200 transition">
                                <Share2 size={18}/> Share to Boost Price
                            </button>
                        </div>
                        
                        <button onClick={onClose} className="text-zinc-500 text-xs hover:text-white underline">Close Window</button>
                    </>
                ) : (
                    <>
                        <div className="relative">
                            <Loader2 className="animate-spin text-green-500 w-16 h-16"/>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">{Math.round(progress)}%</div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold text-xl text-white animate-pulse">Processing...</h4>
                            <p className="text-xs text-zinc-500 font-mono">{loadingMsg}</p>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }}/></div>
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );
}