'use client';

import React, { useState } from 'react';
import { X, Clock, Infinity as InfinityIcon, CheckCircle, Loader2 } from 'lucide-react';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (months: number, price: number) => void;
  isLoading: boolean;
}

export default function RentalModal({ isOpen, onClose, onConfirm, isLoading }: RentalModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<number>(6); // default: 6 months

  if (!isOpen) return null;

  const plans = [
    { months: 1, price: 1, label: '1 Month', icon: Clock },
    { months: 6, price: 5, label: '6 Months', icon: Clock, recommended: true },
    { months: 12, price: 10, label: '1 Year', icon: Clock },
    { months: 999, price: 15, label: 'Forever', icon: InfinityIcon },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black text-white">Rent or Own</h2>
            <p className="text-xs text-zinc-400">Choose your rental period.</p>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="text-zinc-500 hover:text-white" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {plans.map((plan) => (
            <button
              key={plan.months}
              onClick={() => setSelectedPlan(plan.months)}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                selectedPlan === plan.months
                  ? 'bg-blue-600/10 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedPlan === plan.months ? 'bg-blue-500 text-white' : 'bg-zinc-800'
                  }`}
                >
                  <plan.icon size={16} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm">{plan.label}</div>
                  {plan.recommended && <span className="text-[10px] text-green-400 font-mono">BEST VALUE</span>}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold font-mono ${selectedPlan === plan.months ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {plan.price} <span className="text-[10px]">MLD</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            const plan = plans.find((p) => p.months === selectedPlan);
            if (plan) onConfirm(plan.months, plan.price);
          }}
          disabled={isLoading}
          className="w-full bg-white text-black font-bold py-4 rounded-xl hover:scale-[1.02] transition flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <>Confirm <CheckCircle size={18} /></>}
        </button>

      </div>
    </div>
  );
}
