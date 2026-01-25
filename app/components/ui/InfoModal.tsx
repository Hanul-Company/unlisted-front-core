'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Globe, HelpCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ✅ 언어 타입 정의
type Language = 'ko' | 'en' | 'ja' | 'zh' | 'es';

// ✅ 언어 옵션 데이터
const LANG_OPTIONS: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
];

// ✅ 슬라이드 데이터 타입 정의
export interface SlideData {
  id: number;
  icon: React.ReactNode;
  title: Record<Language, string>;
  desc: Record<Language, string>;
}

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SlideData[];
  initialLang?: Language;
}

export default function InfoModal({ isOpen, onClose, data, initialLang = 'ko' }: InfoModalProps) {
  const [current, setCurrent] = useState(0);
  const [lang, setLang] = useState<Language>(initialLang);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrent(0);
      setIsLangMenuOpen(false);
    }
  }, [isOpen]);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const nextSlide = () => {
    if (current < data.length - 1) setCurrent(current + 1);
    else onClose();
  };

  const prevSlide = () => {
    if (current > 0) setCurrent(current - 1);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 배경 */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* 모달 박스 */}
      {/* ⚠️ 중요 수정: overflow-hidden 제거 (메뉴가 밖으로 나갈 수 있게) */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl flex flex-col min-h-[500px]"
      >
        {/* Header: rounded-t-3xl 적용 (상단 모서리만 둥글게) */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-20 relative rounded-t-3xl">
          
          {/* 언어 선택기 */}
          <div className="relative flex items-center" ref={menuRef}>
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-300 transition z-20 ${isLangMenuOpen ? 'bg-zinc-700 ring-2 ring-blue-500/50 border-blue-500' : ''}`}
            >
              <Globe size={14} className="text-blue-400"/>
              {lang.toUpperCase()}
            </button>

            {/* 메뉴 리스트 (absolute 위치) */}
            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 8, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute left-full top-0 ml-2 flex flex-col bg-zinc-800/95 backdrop-blur-xl border border-zinc-600 rounded-xl overflow-hidden shadow-xl min-w-[100px] z-50"
                  style={{ top: '-4px' }}
                >
                  {LANG_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      onClick={() => { setLang(option.code); setIsLangMenuOpen(false); }}
                      className="flex items-center justify-between px-3 py-2.5 text-xs text-left text-zinc-300 hover:bg-blue-600 hover:text-white transition-colors w-full whitespace-nowrap"
                    >
                      <span className="font-bold">{option.label}</span>
                      {lang === option.code && <Check size={12} className="text-blue-400 group-hover:text-white" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 flex flex-col items-center text-center overflow-hidden"> {/* 여기에 overflow-hidden을 둬서 슬라이드 애니메이션은 안 잘리게 유지 */}
          <AnimatePresence mode='wait'>
            <motion.div
              key={`${current}-${lang}`}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex flex-col items-center w-full"
            >
              <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                {data[current].icon}
              </div>
              <h2 className="text-2xl font-black text-white mb-3 leading-tight px-2">{data[current].title[lang]}</h2>
              <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line px-2">{data[current].desc[lang]}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: rounded-b-3xl 적용 */}
        <div className="p-6 pt-0 mt-auto rounded-b-3xl">
            <div className="flex justify-center gap-2 mb-6">
                {data.map((_, idx) => (
                    <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === current ? 'w-6 bg-blue-500' : 'w-1.5 bg-zinc-700'}`} />
                ))}
            </div>
            <div className="flex gap-3">
                {current > 0 && (
                    <button onClick={prevSlide} className="flex-1 py-3.5 rounded-xl font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition">
                        {lang === 'ko' ? '이전' : lang === 'ja' ? '戻る' : lang === 'zh' ? '上一页' : 'Back'}
                    </button>
                )}
                <button onClick={nextSlide} className="flex-1 py-3.5 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] transition-all">
                    {current === data.length - 1 
                        ? (lang === 'ko' ? '시작하기!' : lang === 'ja' ? '始める' : lang === 'zh' ? '开始' : lang === 'es' ? '¡Empezar!' : "Let's Start!") 
                        : (lang === 'ko' ? '다음' : lang === 'ja' ? '次へ' : lang === 'zh' ? '下一页' : lang === 'es' ? 'Siguiente' : 'Next')
                    }
                </button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}

// HelpToggle도 필요하다면 같이 export
export const HelpToggle = ({ onClick, className="" }: { onClick: () => void, className?: string }) => (
    <button onClick={onClick} className={`group flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-700/80 hover:border-zinc-500 transition-all cursor-pointer backdrop-blur-md ${className}`}>
        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors"><HelpCircle size={12} strokeWidth={2.5} /></div>
        <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">Guide</span>
    </button>
);