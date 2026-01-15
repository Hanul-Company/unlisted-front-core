'use client';

import React from 'react';
import { Link } from "@/lib/i18n";
import { Play, Radio, Download, ArrowRight, Wand2, Headphones, Sparkles, UserPlus, Disc } from 'lucide-react';
import { usePWA } from './context/PWAContext';
import { motion } from 'framer-motion';
import HeaderProfile from './components/HeaderProfile'; 
import toast from 'react-hot-toast';

// Animations (하단 버튼은 애니메이션 제외)
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const containerAnim = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export default function LandingPage() {
  const { isInstallable, installApp } = usePWA();

  const handleArtistClick = () => {
    const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
    if (headerBtn) {
        headerBtn.click();
    } else {
        toast.error("Please connect wallet from the top right.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30 overflow-hidden flex flex-col">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[150px] animate-pulse-slow"/>
          <div className="absolute bottom-[-20%] right-[20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[150px] animate-pulse-slow delay-1000"/>
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
            {/* ✅ 로고 배경/그림자 제거 */}
            <img src="/icon-192.png" alt="logo" className="h-6 w-6 object-contain"/>
            <span className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500">unlisted</span>
        </div>
        
        <div className="pointer-events-auto flex gap-4 items-center">
            {isInstallable && (
                <button onClick={installApp} className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition text-xs font-bold text-zinc-400">
                    <Download size={14} /> App
                </button>
            )}
            <div className="opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto transition-opacity">
                 <div className="scale-75 origin-right"><HeaderProfile /></div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center items-center relative z-10 px-4 py-24 md:py-20">
        
        <motion.div 
            variants={containerAnim} 
            initial="initial" 
            animate="animate" 
            className="w-full max-w-6xl mx-auto flex flex-col items-center gap-10 md:gap-12"
        >
            {/* Headlines */}
            <div className="text-center space-y-4">
                <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/50 border border-white/5 backdrop-blur-md text-xs font-bold text-zinc-400 mb-2 shadow-lg">
                    <Sparkles size={12} className="text-cyan-400"/> The music never existed
                </motion.div>
                
                {/* ✅ 기본 폰트(Layout), 얇은 두께(font-light) 적용 */}
                <motion.h1 variants={fadeInUp} className="text-5xl md:text-8xl font-light tracking-tight leading-[0.9] text-white">
                    For the music <br/>
                    <span className="font-normal text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500">unlisted.</span>
                </motion.h1>
                
                <motion.p variants={fadeInUp} className="text-zinc-400 text-sm md:text-lg max-w-2xl font-light px-4">
                    The wave of AI <span className="text-white font-medium">music meets daily streaming.</span> <br className="hidden md:block"/>
                    Create, Share, Listen and Earn.
                </motion.p>
            </div>

            {/* ✅ 2. 버튼 높이 축소 (500px -> 340px) */}
            <motion.div variants={fadeInUp} className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 h-auto md:h-[340px]">
                
                {/* [Left] Listener Button */}
                <Link href="/radio" className="w-full h-full group relative block">
                    <div className="relative min-h-[240px] h-full bg-gradient-to-br from-cyan-900/20 to-blue-900/10 rounded-[2rem] border border-white/10 group-hover:border-cyan-500/50 transition-all duration-500 overflow-hidden">
                        <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"/>
                        
                        <div className="relative h-full flex flex-col justify-between p-8 z-10">
                            <div className="flex justify-between items-start">
                                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500 text-cyan-400">
                                    <Headphones size={28} />
                                </div>
                                <ArrowRight className="text-zinc-600 group-hover:text-cyan-400 -rotate-45 group-hover:rotate-0 transition-all duration-300 transform scale-125"/>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl md:text-3xl font-bold text-white group-hover:text-cyan-100 transition-colors">
                                    I am a Listener
                                </h2>
                                <p className="text-zinc-400 group-hover:text-cyan-200/70 transition-colors text-sm leading-relaxed">
                                    Stream fresh <span className="text-white font-bold">AI Music</span>.<br/>
                                    Curate playlists & discover gems.
                                </p>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* [Right] Artist Button */}
                <button onClick={handleArtistClick} className="w-full h-full group relative text-left block">
                    <div className="relative min-h-[240px] h-full bg-gradient-to-bl from-indigo-900/20 to-purple-900/10 rounded-[2rem] border border-white/10 group-hover:border-indigo-500/50 transition-all duration-500 overflow-hidden">
                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"/>
                        
                        <div className="relative h-full flex flex-col justify-between p-8 z-10">
                            <div className="flex justify-between items-start">
                                <div className="p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500 text-indigo-400">
                                    <Wand2 size={28} />
                                </div>
                                <UserPlus className="text-zinc-600 group-hover:text-indigo-400 transition-colors transform scale-125"/>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl md:text-3xl font-bold text-white group-hover:text-indigo-100 transition-colors">
                                    I am an Artist
                                </h2>
                                <p className="text-zinc-400 group-hover:text-indigo-200/70 transition-colors text-sm leading-relaxed">
                                    <span className="text-white font-bold">Create & Publish</span> with AI.<br/>
                                    Upload DNA & earn revenue.
                                </p>
                            </div>
                        </div>
                    </div>
                </button>
            </motion.div>

            {/* ✅ 3. 하단 버튼 (애니메이션 제거하여 노출 보장) */}
            <div className="pt-4 pb-10 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                 <span className="text-zinc-500 text-xs md:text-sm font-medium tracking-wider opacity-80">
                    Let me just
                 </span>

                 <Link href="/market">
                    {/* 그라디언트 테두리 래퍼 */}
                    <button className="relative group rounded-full p-[1px] overflow-hidden transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-cyan-500/20">
                        {/* 1. 배경 (그라디언트) */}
                        <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500"></span>
                        
                        {/* 2. 내부 (검정 -> 호버시 투명) */}
                        <div className="relative px-10 py-4 bg-black rounded-full group-hover:bg-transparent transition-colors duration-300 flex items-center gap-3">
                            {/* 텍스트: 기본 밝은 시안색 -> 호버시 흰색 */}
                            <span className="font-bold text-sm md:text-base tracking-wide text-cyan-400 group-hover:text-white transition-colors">
                                Explore Unlisted first
                            </span>
                            <Disc size={20} className="text-cyan-500 group-hover:text-white group-hover:animate-spin-slow transition-colors"/>
                        </div>
                    </button>
                 </Link>
            </div>

        </motion.div>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-6 text-center text-[10px] text-zinc-700 font-mono uppercase tracking-widest relative z-10">
        © 2026 UNLISTED. AI-POWERED MUSIC PROTOCOL.
      </footer>
    </div>
  );
}