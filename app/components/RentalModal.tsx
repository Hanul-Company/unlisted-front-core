'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Infinity as InfinityIcon, CheckCircle, Loader2, Music, Layers, ArrowUpCircle, CalendarDays, Coins } from 'lucide-react';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (months: number, price: number) => Promise<void>;
  isLoading?: boolean;
  
  targetTitle?: string; 
  trackCount?: number;  
  basePrice?: number;   
  isExtension?: boolean; 
  currentExpiryDate?: string | null;
}

export default function RentalModal({ 
    isOpen, onClose, onConfirm, isLoading: externalLoading,
    targetTitle = "this track", 
    trackCount = 1,
    basePrice = 10,
    isExtension = false,
    currentExpiryDate = null
}: RentalModalProps) {
    
  const [selectedPlan, setSelectedPlan] = useState<number>(6);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");

  // Progress Simulation
  useEffect(() => {
    if (status === 'processing') {
      setProgress(0);
      setLoadingMsg("Processing payment...");
      const interval = setInterval(() => { setProgress(p => (p + Math.random() * 5 > 90 ? 90 : p + Math.random() * 5)); }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => { if(!isOpen) { setStatus('idle'); } }, [isOpen]);

  // ✅ 가격 계산 (트랙 수 반영)
  const getPrice = (multiplier: number) => { return basePrice * multiplier * trackCount; };

  const plans = [
    { months: 1, multiplier: 0.1, label: '1 Month', icon: Clock },
    { months: 6, multiplier: 0.5, label: '6 Months', icon: Clock, recommended: true },
    { months: 12, multiplier: 1.0, label: '1 Year', icon: Clock },
    { months: 999, multiplier: 1.5, label: 'Forever', icon: InfinityIcon },
  ];

  const actionVerb = isExtension ? "Extend" : "Rent";
  const successTitle = isExtension ? "Extended Successfully! 🎉" : (trackCount > 1 ? "Playlist Collected! 🎉" : "Rental Active! 🎉");

  const handleConfirm = async () => {
      const plan = plans.find((p) => p.months === selectedPlan);
      if (!plan) return;
      const finalPrice = getPrice(plan.multiplier);
      
      setStatus('processing'); 
      try {
          // 상위 컴포넌트의 processCollect 함수 실행
          await onConfirm(plan.months, finalPrice);
          setProgress(100); 
          setLoadingMsg(successTitle); 
          setStatus('success');
          
          // 성공 후 잠시 뒤 닫기 (선택사항)
          setTimeout(() => {
             onClose();
          }, 2000);
      } catch (e) { 
          setStatus('idle'); // 에러 나면 다시 선택 화면으로 복귀
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        
        {status !== 'idle' && <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"/>}

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {isExtension ? <ArrowUpCircle size={20} className="text-green-400"/> : (trackCount > 1 ? <Layers size={20}/> : <Music size={20}/>)}
                  {trackCount > 1 ? 'Collect Playlist' : `${actionVerb} Track`}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                  {trackCount > 1 ? `Collecting ${trackCount} tracks` : `${actionVerb} access for "${targetTitle}"`}
              </p>
              
              {isExtension && currentExpiryDate && (
                  <div className="flex items-center gap-1.5 mt-3 bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700 w-fit">
                      <CalendarDays size={12} className="text-zinc-400"/>
                      <span className="text-[10px] text-zinc-300">
                          Current Expiry: <span className="text-white font-bold">{currentExpiryDate}</span>
                      </span>
                  </div>
              )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X /></button>
        </div>

        {/* Body */}
        {status === 'idle' ? (
            <>
                <div className="space-y-3 mb-6">
                {plans.map((plan) => {
                    const price = getPrice(plan.multiplier);
                    const displayLabel = (isExtension && plan.months !== 999) ? `+ ${plan.label}` : plan.label;

                    return (
                        <button key={plan.months} onClick={() => setSelectedPlan(plan.months)} className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedPlan === plan.months ? 'bg-purple-600/10 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPlan === plan.months ? 'bg-purple-500 text-white' : 'bg-zinc-800'}`}>
                                    <plan.icon size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">{displayLabel}</div>
                                    {plan.recommended && <span className="text-[10px] text-green-400 font-mono">BEST VALUE</span>}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`font-bold font-mono ${selectedPlan === plan.months ? 'text-purple-400' : 'text-zinc-500'}`}>
                                    {price.toFixed(1)} <span className="text-[10px]">MLD</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
                </div>
                
                {/* 결제 안내 문구 추가 */}
                <div className="flex items-start gap-2 bg-zinc-800/50 p-3 rounded-xl mb-4 border border-zinc-700/50">
                    <Coins size={14} className="text-yellow-500 mt-0.5 shrink-0"/>
                    <p className="text-[10px] text-zinc-400 leading-tight">
                        <span className="text-white font-bold">Auto Payment:</span> pMLD points are used first. If insufficient, MLD tokens will be charged from your wallet.
                    </p>
                </div>

                <button onClick={handleConfirm} disabled={externalLoading} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    {externalLoading ? <Loader2 className="animate-spin" /> : <>Confirm <CheckCircle size={18} /></>}
                </button>
            </>
        ) : (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
                {status === 'processing' ? (
                    <div className="relative"> <Loader2 className="animate-spin text-purple-500 w-16 h-16"/> <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Music size={20} className="text-white"/></div> </div>
                ) : (
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-bounce shadow-[0_0_20px_lime]"> <CheckCircle className="text-black w-8 h-8"/> </div>
                )}
                <div className="space-y-2 w-full"> <h4 className="font-bold text-xl text-white animate-pulse">{status === 'success' ? successTitle : 'Processing Payment...'}</h4> <p className="text-xs text-zinc-400 font-mono">{loadingMsg}</p> </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative"> <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/> </div>
                <p className="text-[10px] text-zinc-500 mt-2">Checking balance & Securing assets on-chain.</p>
            </div>
        )}
      </div>
    </div>
  );
}