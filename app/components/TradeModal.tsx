'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Info, CheckCircle, Zap } from 'lucide-react';
import { formatEther } from 'viem';
import toast from 'react-hot-toast';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';

const stockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: { id: number; title: string; token_id: number | null; artist_name: string; };
}

export default function TradeModal({ isOpen, onClose, track }: TradeModalProps) {
  const account = useActiveAccount();
  const address = account?.address;
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('1');
  
  // ✅ [New] UI States for Loading
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");

  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // Params
  const tokenIdBigInt = BigInt(track.token_id || track.id);
  const amountBigInt = BigInt(Number(amount || 0) * 1e18);

  // Reads
  const { data: mySharesVal, refetch: refetchShares } = useReadContract({ contract: stockContract, method: "sharesBalance", params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"] });
  const { data: buyPriceVal } = useReadContract({ contract: stockContract, method: "getBuyPrice", params: [tokenIdBigInt, amountBigInt] });
  const { data: sellPriceVal } = useReadContract({ contract: stockContract, method: "getSellPrice", params: [tokenIdBigInt, amountBigInt] });
  const { data: mldBalanceVal } = useReadContract({ contract: tokenContract, method: "balanceOf", params: [address || "0x0000000000000000000000000000000000000000"] });
  const { data: allowanceVal, refetch: refetchAllowance } = useReadContract({ contract: tokenContract, method: "allowance", params: [address || "0x0000000000000000000000000000000000000000", UNLISTED_STOCK_ADDRESS] });

  const myShares = mySharesVal ? Number(formatEther(mySharesVal)) : 0;
  const estimatedCost = buyPriceVal ? Number(formatEther(buyPriceVal)) : 0;
  const estimatedPayout = sellPriceVal ? Number(formatEther(sellPriceVal)) : 0;
  const myMldBalance = mldBalanceVal ? Number(formatEther(mldBalanceVal)) : 0;
  const allowance = allowanceVal || BigInt(0);

  // ✅ [New] Progress Simulation Effect
  useEffect(() => {
    if (status === 'processing') {
      setProgress(0);
      setLoadingMsg("Requesting wallet signature...");
      const interval = setInterval(() => { setProgress(p => (p + Math.random() * 5 > 90 ? 90 : p + Math.random() * 5)); }, 800);
      const t1 = setTimeout(() => setLoadingMsg("Broadcasting transaction..."), 3000);
      const t2 = setTimeout(() => setLoadingMsg("Waiting for block confirmation..."), 8000);
      return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); };
    }
  }, [status]);

  useEffect(() => {
    if (!isOpen) { setAmount('1'); setMode('buy'); setStatus('idle'); }
  }, [isOpen]);

  const handleApprove = () => {
    const transaction = prepareContractCall({ contract: tokenContract, method: "approve", params: [UNLISTED_STOCK_ADDRESS, BigInt(1000000 * 1e18)] });
    setStatus('processing');
    sendTransaction(transaction, {
      onSuccess: () => { setProgress(100); setLoadingMsg("Approved!"); setStatus('success'); toast.success("Approved!"); refetchAllowance(); setTimeout(() => setStatus('idle'), 1500); },
      onError: () => { setStatus('idle'); toast.error("Approval failed."); }
    });
  };

  const handleTrade = () => {
    if (!address) return toast.error("Please connect your wallet.");
    if (Number(amount) <= 0) return toast.error("Enter at least 1 share.");

    setStatus('processing'); // Start Loading UI

    if (mode === 'buy') {
      if (estimatedCost > myMldBalance) { setStatus('idle'); return toast.error("Insufficient MLD balance."); }
      const transaction = prepareContractCall({ contract: stockContract, method: "buyShares", params: [tokenIdBigInt, amountBigInt] });
      sendTransaction(transaction, {
        onSuccess: () => { 
            setProgress(100); setLoadingMsg("Purchase Successful!"); setStatus('success');
            toast.success("Purchase successful!"); refetchShares(); 
            setTimeout(() => { onClose(); setStatus('idle'); }, 1500);
        },
        onError: (err) => { console.error(err); setStatus('idle'); toast.error("Purchase failed."); }
      });
    } else {
      if (Number(amount) > myShares) { setStatus('idle'); return toast.error("Not enough shares."); }
      const transaction = prepareContractCall({ contract: stockContract, method: "sellShares", params: [tokenIdBigInt, amountBigInt] });
      sendTransaction(transaction, {
        onSuccess: () => { 
            setProgress(100); setLoadingMsg("Sell Successful!"); setStatus('success');
            toast.success("Sell successful!"); refetchShares(); 
            setTimeout(() => { onClose(); setStatus('idle'); }, 1500);
        },
        onError: () => { setStatus('idle'); toast.error("Sell failed."); }
      });
    }
  };

  if (!isOpen) return null;
  const costInWei = buyPriceVal || BigInt(0);
  const needsApproval = mode === 'buy' && allowance < costInWei;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 relative">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div><h3 className="font-bold text-lg text-white">{track.title}</h3><p className="text-xs text-zinc-500">{track.artist_name}</p></div>
          <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition text-zinc-400 hover:text-white"><X size={18}/></button>
        </div>

        {/* ✅ [Condition] Status에 따라 UI 분기 */}
        {status === 'idle' ? (
            <>
                <div className="flex p-2 gap-2 bg-zinc-900">
                    <button onClick={() => setMode('buy')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${mode === 'buy' ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}><TrendingUp size={16}/> Buy</button>
                    <button onClick={() => setMode('sell')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${mode === 'sell' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}><TrendingDown size={16}/> Sell</button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                        <div className="flex justify-between text-xs font-bold text-zinc-500 px-1"><span>Amount</span><span className="text-zinc-400">Owned: {myShares.toFixed(2)}</span></div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setAmount(String(Math.max(1, Number(amount) - 1)))} className="w-12 h-12 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl hover:bg-zinc-700 hover:text-white transition active:scale-95 text-zinc-400">-</button>
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 min-w-0 bg-black border border-zinc-700 rounded-xl py-3 px-2 text-center text-2xl font-black text-white focus:outline-none focus:border-green-500 transition placeholder:text-zinc-700" placeholder="0"/>
                            <button onClick={() => setAmount(String(Number(amount) + 1))} className="w-12 h-12 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl hover:bg-zinc-700 hover:text-white transition active:scale-95 text-zinc-400">+</button>
                        </div>
                    </div>

                    <div className="bg-zinc-950 p-5 rounded-2xl space-y-3 border border-zinc-800">
                        <div className="flex justify-between text-sm"><span className="text-zinc-500">Est. Price</span><span className="font-mono text-zinc-300">{mode === 'buy' ? estimatedCost.toFixed(4) : estimatedPayout.toFixed(4)} MLD</span></div>
                        <div className="flex justify-between text-sm"><span className="text-zinc-500">Fees (5%)</span><span className="font-mono text-zinc-600">{(mode === 'buy' ? estimatedCost * 0.05 : estimatedPayout * 0.05).toFixed(4)} MLD</span></div>
                        <div className="h-px bg-zinc-800 my-2"></div>
                        <div className="flex justify-between items-center"><span className="font-bold text-white text-sm">Total</span><span className={`font-mono font-black text-xl ${mode === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{(mode === 'buy' ? estimatedCost * 1.05 : estimatedPayout * 0.95).toFixed(4)} MLD</span></div>
                    </div>

                    {needsApproval ? (
                        <button onClick={handleApprove} className="w-full py-4 rounded-xl font-bold text-lg bg-blue-600 text-white hover:scale-[1.02] transition shadow-lg flex items-center justify-center gap-2">1. Approve MLD</button>
                    ) : (
                        <button onClick={handleTrade} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg ${mode === 'buy' ? 'bg-green-500 text-black' : 'bg-red-600 text-white'}`}>{mode === 'buy' ? 'Confirm Buy' : 'Confirm Sell'}</button>
                    )}
                </div>
            </>
        ) : (
            // ✅ [Loading UI] DonateModal과 동일한 스타일
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
                {status === 'processing' ? (
                    <div className="relative">
                        <Loader2 className="animate-spin text-green-500 w-16 h-16"/>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><TrendingUp size={20} className="text-white"/></div>
                    </div>
                ) : (
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-bounce"><CheckCircle className="text-black w-8 h-8"/></div>
                )}
                
                <div className="space-y-2 w-full">
                    <h4 className="font-bold text-xl text-white animate-pulse">{status === 'success' ? 'Transaction Confirmed!' : 'Processing Trade...'}</h4>
                    <p className="text-xs text-zinc-400 font-mono">{loadingMsg}</p>
                </div>

                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/>
                </div>
                <p className="text-[10px] text-zinc-600">Please wait while we confirm your trade.</p>
            </div>
        )}
      </div>
    </div>
  );
}