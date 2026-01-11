'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Infinity as InfinityIcon, CheckCircle, Loader2, Music, Layers, ArrowUpCircle, CalendarDays, Coins, ShieldCheck } from 'lucide-react';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (months: number, price: number) => Promise<void>;
  isLoading?: boolean;
  
  targetTitle?: string; 
  trackCount?: number;  
  basePrice?: number;   // 기본 10으로 설정됨
  isExtension?: boolean; 
  currentExpiryDate?: string | null;
}

export default function RentalModal({ 
    isOpen, onClose, onConfirm, isLoading: externalLoading,
    targetTitle = "this track", 
    trackCount = 1,
    basePrice = 10, // ✅ 기준 가격 10 (이걸 기준으로 0.1배, 0.5배... 계산)
    isExtension = false,
    currentExpiryDate = null
}: RentalModalProps) {
    
  // 기본 선택값: 6개월
  const [selectedPlan, setSelectedPlan] = useState<number>(6);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");

  // ✅ Lifetime 체크: 만료일이 "Lifetime"이거나 "Forever"인 경우
  const isLifetimeOwned = currentExpiryDate === 'Lifetime' || currentExpiryDate === 'Forever';

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

  // ✅ 가격 계산 함수 (트랙 수 반영)
  const getPrice = (multiplier: number) => { 
      // 예: 1개월 -> 10 * 0.1 * 1 = 1 MLD
      // 예: 6개월 -> 10 * 0.5 * 1 = 5 MLD
      return basePrice * multiplier * trackCount; 
  };

  // ✅ [수정됨] 요청하신 가격 정책 적용
  // basePrice = 10 기준
  const plans = [
    { months: 1, multiplier: 0.1, label: '1 Month', icon: Clock },     // 1 MLD
    { months: 6, multiplier: 0.5, label: '6 Months', icon: Clock, recommended: true }, // 5 MLD
    { months: 12, multiplier: 1.0, label: '1 Year', icon: Clock },     // 10 MLD
    { months: 999, multiplier: 1.5, label: 'Forever', icon: InfinityIcon }, // 15 MLD
  ];

  const actionVerb = isExtension ? "Extend" : "Rent";
  const successTitle = isExtension ? "Extended Successfully! 🎉" : (trackCount > 1 ? "Playlist Collected! 🎉" : "Rental Active! 🎉");

  const handleConfirm = async () => {
      // 이미 평생 소장 중이면 동작 안 함
      if (isLifetimeOwned) return;

      const plan = plans.find((p) => p.months === selectedPlan);
      if (!plan) return;
      
      const finalPrice = getPrice(plan.multiplier);
      
      setStatus('processing'); 
      try {
          await onConfirm(plan.months, finalPrice);
          setProgress(100); 
          setLoadingMsg(successTitle); 
          setStatus('success');
          setTimeout(() => { onClose(); }, 2000);
      } catch (e) { 
          setStatus('idle'); 
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
              
              {/* 만료일 표시 */}
              {isExtension && currentExpiryDate && (
                  <div className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border w-fit ${
                      isLifetimeOwned 
                      ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' 
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                  }`}>
                      {isLifetimeOwned ? <ShieldCheck size={12}/> : <CalendarDays size={12}/>}
                      <span className="text-[10px]">
                          Current: <span className="font-bold">{isLifetimeOwned ? "Lifetime Owned" : currentExpiryDate}</span>
                      </span>
                  </div>
              )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X /></button>
        </div>

        {/* Body */}
        {status === 'idle' ? (
            <>
                {/* ✅ 이미 소장 중일 때 안내 메시지 */}
                {isLifetimeOwned && (
                    <div className="mb-4 text-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700">
                        <p className="text-zinc-400 text-sm">
                            You already own this track forever.<br/>
                            No further payment is needed.
                        </p>
                    </div>
                )}

                <div className="space-y-3 mb-6">
                {plans.map((plan) => {
                    const price = getPrice(plan.multiplier);
                    // 1 MLD = 1 pMLD 이므로 둘 다 price로 표시
                    const displayLabel = (isExtension && plan.months !== 999) ? `+ ${plan.label}` : plan.label;

                    return (
                        <button 
                            key={plan.months} 
                            // ✅ Lifetime일 경우 disabled 처리
                            disabled={isLifetimeOwned || externalLoading}
                            onClick={() => setSelectedPlan(plan.months)} 
                            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all relative overflow-hidden group
                                ${isLifetimeOwned 
                                    ? 'bg-zinc-900 border-zinc-800 opacity-40 cursor-not-allowed grayscale' 
                                    : (selectedPlan === plan.months ? 'bg-purple-600/10 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800')
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedPlan === plan.months && !isLifetimeOwned ? 'bg-purple-500 text-white' : 'bg-zinc-800'}`}>
                                    {isLifetimeOwned && plan.months === 999 ? <CheckCircle size={16}/> : <plan.icon size={16} />}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">{displayLabel}</div>
                                    {plan.recommended && !isLifetimeOwned && <span className="text-[10px] text-green-400 font-mono">BEST VALUE</span>}
                                </div>
                            </div>
                            
                            <div className="text-right">
                                {isLifetimeOwned ? (
                                    <span className="text-xs font-bold text-zinc-500">Owned</span>
                                ) : (
                                    <>
                                        <div className={`font-bold font-mono ${selectedPlan === plan.months ? 'text-purple-400' : 'text-zinc-500'}`}>
                                            {price.toLocaleString()} <span className="text-[10px]">pMLD</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-600">or {price.toLocaleString()} MLD</div>
                                    </>
                                )}
                            </div>
                        </button>
                    );
                })}
                </div>
                
                {/* 결제 안내 문구 */}
                {!isLifetimeOwned && (
                    <div className="flex items-start gap-2 bg-zinc-800/50 p-3 rounded-xl mb-4 border border-zinc-700/50">
                        <Coins size={14} className="text-yellow-500 mt-0.5 shrink-0"/>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            <span className="text-white font-bold">Auto Payment:</span> pMLD points are used first. If insufficient, MLD tokens will be charged.
                        </p>
                    </div>
                )}

                {/* Confirm Button */}
                {!isLifetimeOwned && (
                    <button onClick={handleConfirm} disabled={externalLoading} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                        {externalLoading ? <Loader2 className="animate-spin" /> : <>Confirm <CheckCircle size={18} /></>}
                    </button>
                )}
                
                {/* Close Button only (if owned) */}
                {isLifetimeOwned && (
                    <button onClick={onClose} className="w-full bg-zinc-800 text-white font-bold py-4 rounded-xl hover:bg-zinc-700 transition">
                        Close
                    </button>
                )}
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