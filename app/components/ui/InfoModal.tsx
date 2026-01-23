'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Globe, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ✅ 슬라이드 데이터 타입 정의
export interface SlideData {
  id: number;
  icon: React.ReactNode; // 아이콘이나 이미지 URL
  title: { ko: string; en: string };
  desc: { ko: string; en: string };
}

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SlideData[]; // 👈 여기에 어떤 데이터를 넣느냐에 따라 내용이 바뀜
  initialLang?: 'ko' | 'en';
}

export default function InfoModal({ isOpen, onClose, data, initialLang = 'ko' }: InfoModalProps) {
  const [current, setCurrent] = useState(0);
  const [lang, setLang] = useState<'ko' | 'en'>(initialLang);

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) setCurrent(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const nextSlide = () => {
    if (current < data.length - 1) setCurrent(current + 1);
    else onClose(); // 마지막 장에서 누르면 닫기
  };

  const prevSlide = () => {
    if (current > 0) setCurrent(current - 1);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 배경 (클릭 시 닫힘) */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* 모달 박스 */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header: 언어 변경 & 닫기 */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
          <button 
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition"
          >
            <Globe size={14} className="text-blue-400"/>
            {lang === 'ko' ? 'KR' : 'EN'}
          </button>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body: 슬라이드 내용 */}
        <div className="flex-1 p-6 flex flex-col items-center text-center min-h-[360px]">
          <AnimatePresence mode='wait'>
            <motion.div
              key={current}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex flex-col items-center w-full"
            >
              {/* 이미지/아이콘 영역 */}
              <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                {data[current].icon}
              </div>

              {/* 텍스트 영역 */}
              <h2 className="text-2xl font-black text-white mb-3 leading-tight">
                {data[current].title[lang]}
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                {data[current].desc[lang]}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: 페이지네이션 & 컨트롤 */}
        <div className="p-6 pt-0 mt-auto">
            {/* Dots */}
            <div className="flex justify-center gap-2 mb-6">
                {data.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === current ? 'w-6 bg-blue-500' : 'w-1.5 bg-zinc-700'}`} 
                    />
                ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
                {current > 0 && (
                    <button 
                        onClick={prevSlide}
                        className="flex-1 py-3.5 rounded-xl font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
                    >
                        {lang === 'ko' ? '이전' : 'Back'}
                    </button>
                )}
                <button 
                    onClick={nextSlide}
                    className="flex-1 py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] transition-all"
                >
                    {current === data.length - 1 
                        ? (lang === 'ko' ? '시작하기!' : "Let's Start!") 
                        : (lang === 'ko' ? '다음' : 'Next')
                    }
                </button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}

// ✅ [Tip] 물음표 토글 버튼 컴포넌트 (따로 파일로 만들어도 되고, 여기에 export 해도 됨)
export const HelpToggle = ({ onClick, className="" }: { onClick: () => void, className?: string }) => (
    <button 
        onClick={onClick}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-700/80 hover:border-zinc-500 transition-all cursor-pointer backdrop-blur-md ${className}`}
    >
        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <HelpCircle size={12} strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">Guide</span>
    </button>
);