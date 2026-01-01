'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Infinity as InfinityIcon, CheckCircle, Loader2, Music, Layers } from 'lucide-react';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (months: number, price: number) => Promise<void>;
  isLoading?: boolean;
  
  // ✅ 아래 속성들이 추가되어야 page.tsx에서 오류가 사라집니다.
  targetTitle?: string; // (선택)
  trackCount?: number;  // (선택)
  basePrice?: number;   // (선택)
}

export default function RentalModal({ 
    isOpen, onClose, onConfirm, isLoading: externalLoading,
    // ✅ 기본값 설정 (기존 페이지 호환성 유지)
    targetTitle = "this track", 
    trackCount = 1,
    basePrice = 10 
}: RentalModalProps) {
    
  const [selectedPlan, setSelectedPlan] = useState<number>(6);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");

  // Progress Effect
  useEffect(() => {
    if (status === 'processing') {
      setProgress(0);
      setLoadingMsg("Processing payment...");
      const interval = setInterval(() => { setProgress(p => (p + Math.random() * 5 > 90 ? 90 : p + Math.random() * 5)); }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
      if(!isOpen) { setStatus('idle'); }
  }, [isOpen]);

  // 가격 계산 로직
  const getPrice = (multiplier: number) => {
      return basePrice * multiplier * trackCount;
  };

  const plans = [
    { months: 1, multiplier: 0.1, label: '1 Month', icon: Clock },
    { months: 6, multiplier: 0.5, label: '6 Months', icon: Clock, recommended: true },
    { months: 12, multiplier: 1.0, label: '1 Year', icon: Clock },
    { months: 999, multiplier: 1.5, label: 'Forever', icon: InfinityIcon },
  ];

  const handleConfirm = async () => {
      const plan = plans.find((p) => p.months === selectedPlan);
      if (!plan) return;

      const finalPrice = getPrice(plan.multiplier);
      setStatus('processing'); 
      
      try {
          await onConfirm(plan.months, finalPrice);
          setProgress(100);
          setLoadingMsg(trackCount > 1 ? "Playlist Collected! 🎉" : "Rental Active! 🎉");
          setStatus('success');
      } catch (e) {
          setStatus('idle');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        
        {status !== 'idle' && <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"/>}

        <div className="flex justify-between items-center mb-6">
          <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {trackCount > 1 ? <Layers size={20}/> : <Music size={20}/>}
                  {trackCount > 1 ? 'Collect Playlist' : 'Rent Track'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                  {trackCount > 1 ? `Collecting ${trackCount} tracks from "${targetTitle}"` : `Rent "${targetTitle}"`}
              </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X /></button>
        </div>

        {status === 'idle' ? (
            <>
                <div className="space-y-3 mb-6">
                {plans.map((plan) => {
                    const price = getPrice(plan.multiplier);
                    return (
                        <button key={plan.months} onClick={() => setSelectedPlan(plan.months)} className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedPlan === plan.months ? 'bg-purple-600/10 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPlan === plan.months ? 'bg-purple-500 text-white' : 'bg-zinc-800'}`}><plan.icon size={16} /></div>
                            <div className="text-left"><div className="font-bold text-sm">{plan.label}</div>{plan.recommended && <span className="text-[10px] text-green-400 font-mono">BEST VALUE</span>}</div>
                        </div>
                        <div className="text-right"><div className={`font-bold font-mono ${selectedPlan === plan.months ? 'text-purple-400' : 'text-zinc-500'}`}>{price.toFixed(1)} <span className="text-[10px]">MLD</span></div></div>
                        </button>
                    );
                })}
                </div>
                <button onClick={handleConfirm} disabled={externalLoading} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2 shadow-lg">
                    {externalLoading ? <Loader2 className="animate-spin" /> : <>Confirm <CheckCircle size={18} /></>}
                </button>
            </>
        ) : (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
                {status === 'processing' ? (
                    <div className="relative"><Loader2 className="animate-spin text-purple-500 w-16 h-16"/><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Music size={20} className="text-white"/></div></div>
                ) : (
                    <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center animate-bounce"><CheckCircle className="text-white w-8 h-8"/></div>
                )}
                
                <div className="space-y-2 w-full">
                    <h4 className="font-bold text-xl text-white animate-pulse">{status === 'success' ? 'Collection Updated!' : 'Processing Payment...'}</h4>
                    <p className="text-xs text-zinc-400 font-mono">{loadingMsg}</p>
                </div>

                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/>
                </div>
                <p className="text-[10px] text-zinc-600">Securing your listening rights on-chain.</p>
            </div>
        )}
      </div>
    </div>
  );
}