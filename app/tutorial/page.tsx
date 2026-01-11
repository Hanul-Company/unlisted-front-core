'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, Globe, ArrowDown, Sparkles } from 'lucide-react';
import { Link } from "@/lib/i18n";
import { motion } from "framer-motion";

type LangCode = 'kr' | 'en' | 'cn' | 'jp';

const LANG_OPTIONS: { code: LangCode; label: string }[] = [
  { code: 'kr', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'cn', label: '中文' },
  { code: 'jp', label: '日本語' },
];

export default function TutorialPage() {
  const [steps, setSteps] = useState<any[]>([]);
  const [currentLang, setCurrentLang] = useState<LangCode>('kr');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  useEffect(() => {
    const fetchSteps = async () => {
      const { data } = await supabase
        .from('tutorial_steps')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) setSteps(data);
    };
    fetchSteps();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30">
      
      {/* Header (Sticky) */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
        <Link href="/market" className="flex items-center gap-2 text-zinc-400 hover:text-white transition font-bold text-sm">
          <ChevronLeft size={20}/> Back
        </Link>
        
        {/* Language Selector */}
        <div className="relative">
            <button 
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-full text-xs font-bold transition text-zinc-300"
            >
                <Globe size={14}/> 
                {LANG_OPTIONS.find(l => l.code === currentLang)?.label}
            </button>
            
            {langMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)}/>
                    <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-50 py-1">
                        {LANG_OPTIONS.map((opt) => (
                            <button
                                key={opt.code}
                                onClick={() => { setCurrentLang(opt.code); setLangMenuOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-zinc-800 transition ${currentLang === opt.code ? 'text-white bg-zinc-800/50' : 'text-zinc-500'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-6 text-center">
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
        >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black tracking-widest uppercase mb-4">
                <Sparkles size={12}/> Guide Book
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-white">
               How to use <br/>
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Unlisted?</span>
            </h1>
            <p className="text-zinc-500 text-sm md:text-base max-w-md mx-auto leading-relaxed">
               {currentLang === 'kr' ? "언리스티드를 100% 즐기는 방법을 소개합니다." : 
                currentLang === 'cn' ? "介绍如何 100% 享受 Unlisted。" :
                currentLang === 'jp' ? "Unlistedを100%楽しむ方法を紹介します。" :
                "Discover how to enjoy Unlisted to the fullest."}
            </p>
        </motion.div>
        
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}
            className="mt-12 flex justify-center animate-bounce opacity-50"
        >
            <ArrowDown className="text-zinc-600"/>
        </motion.div>
      </div>

      {/* Steps Content */}
      <div className="max-w-2xl mx-auto px-6 pb-40 space-y-24">
        {steps.map((step, index) => {
            // 현재 언어에 맞는 텍스트 가져오기 (없으면 영어 -> 한국어 순 폴백)
            const title = step[`title_${currentLang}`] || step.title_en || step.title_kr;
            const desc = step[`desc_${currentLang}`] || step.desc_en || step.desc_kr;

            if (!title) return null;

            return (
                <motion.div 
                    key={step.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex flex-col gap-8"
                >
                    {/* Step Number */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono font-bold text-lg">
                            {index + 1}
                        </div>
                        <div className="h-px flex-1 bg-zinc-900"/>
                    </div>

                    {/* Image */}
                    {step.image_url && (
                        <div className="w-full aspect-video md:aspect-[2/1] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/50 group">
                            <img 
                                src={step.image_url} 
                                alt={title} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                        </div>
                    )}

                    {/* Text */}
                    <div className="space-y-3 px-2">
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                            {title}
                        </h2>
                        <p className="text-zinc-400 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                            {desc}
                        </p>
                    </div>
                </motion.div>
            );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none flex justify-center pb-10">
          <Link href="/market" className="pointer-events-auto bg-white text-black font-black px-8 py-4 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition">
             {currentLang === 'kr' ? "시작하기" : 
              currentLang === 'cn' ? "开始" :
              currentLang === 'jp' ? "始める" :
              "Get Started"}
          </Link>
      </div>

    </div>
  );
}