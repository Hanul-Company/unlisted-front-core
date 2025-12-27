'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Infinity as InfinityIcon, CheckCircle, Loader2, Music } from 'lucide-react';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (months: number, price: number) => Promise<void>; // Promise 반환으로 변경 권장
  isLoading?: boolean; // 외부에서 로딩 제어 가능
}

export default function RentalModal({ isOpen, onClose, onConfirm, isLoading: externalLoading }: RentalModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<number>(6);
  
  // ✅ [New] UI States
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

  const handleConfirm = async () => {
      const plan = plans.find((p) => p.months === selectedPlan);
      if (!plan) return;

      setStatus('processing'); // 로딩 시작
      
      try {
          // 부모 컴포넌트의 로직 실행 (await 필수)
          await onConfirm(plan.months, plan.price);
          
          setProgress(100);
          setLoadingMsg("Rental Active! 🎉");
          setStatus('success');
          // 잠시 후 닫기 (부모에서 닫을 수도 있지만 여기서 딜레이 줄 수 있음)
          // 보통 부모에서 onClose를 호출하므로 여기선 상태만 success로
      } catch (e) {
          setStatus('idle'); // 실패 시 복구
      }
  };

  if (!isOpen) return null;

  const plans = [
    { months: 1, price: 1, label: '1 Month', icon: Clock },
    { months: 6, price: 5, label: '6 Months', icon: Clock, recommended: true },
    { months: 12, price: 10, label: '1 Year', icon: Clock },
    { months: 999, price: 15, label: 'Forever', icon: InfinityIcon },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        
        {/* 배경 장식 */}
        {status !== 'idle' && <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"/>}

        <div className="flex justify-between items-center mb-6">
          <div><h2 className="text-xl font-black text-white">Rent or Own</h2><p className="text-xs text-zinc-400">Choose your rental period.</p></div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white"><X /></button>
        </div>

        {status === 'idle' ? (
            <>
                <div className="space-y-3 mb-6">
                {plans.map((plan) => (
                    <button key={plan.months} onClick={() => setSelectedPlan(plan.months)} className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedPlan === plan.months ? 'bg-purple-600/10 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPlan === plan.months ? 'bg-purple-500 text-white' : 'bg-zinc-800'}`}><plan.icon size={16} /></div>
                        <div className="text-left"><div className="font-bold text-sm">{plan.label}</div>{plan.recommended && <span className="text-[10px] text-green-400 font-mono">BEST VALUE</span>}</div>
                    </div>
                    <div className="text-right"><div className={`font-bold font-mono ${selectedPlan === plan.months ? 'text-purple-400' : 'text-zinc-500'}`}>{plan.price} <span className="text-[10px]">MLD</span></div></div>
                    </button>
                ))}
                </div>
                <button onClick={handleConfirm} disabled={externalLoading} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2 shadow-lg">
                    {externalLoading ? <Loader2 className="animate-spin" /> : <>Confirm <CheckCircle size={18} /></>}
                </button>
            </>
        ) : (
            // ✅ [Loading UI]
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
                {status === 'processing' ? (
                    <div className="relative"><Loader2 className="animate-spin text-purple-500 w-16 h-16"/><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Music size={20} className="text-white"/></div></div>
                ) : (
                    <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center animate-bounce"><CheckCircle className="text-white w-8 h-8"/></div>
                )}
                
                <div className="space-y-2 w-full">
                    <h4 className="font-bold text-xl text-white animate-pulse">{status === 'success' ? 'Rental Activated!' : 'Processing Payment...'}</h4>
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