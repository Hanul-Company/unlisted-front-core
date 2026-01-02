'use client';

import React from 'react';
import { Link } from "@/lib/i18n";
import { Radius, Book, Disc, PlayCircle, Download, X, UploadCloud, TrendingUp, Coins, Zap, Radio } from 'lucide-react';
import { usePWA } from '../context/PWAContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
    const { isInstallable, installApp } = usePWA();
  
    return (
    <>
      {/* 1. 배경 (Overlay) */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 2. 슬라이딩 패널 (Drawer) */}
      <div className={`fixed top-0 left-0 bottom-0 w-[85%] max-w-xs bg-zinc-950 border-r border-zinc-800 z-[70] p-6 transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
            <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                unlisted
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                <X size={24}/>
            </button>
        </div>

        {/* ✅ [New] Main CTA: Start Stream */}
        <Link href="/radio" onClick={onClose}>
            <button className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-bold py-4 rounded-xl mb-8 flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-lg shadow-blue-900/20 group">
                <Radio size={20} className="group-hover:animate-pulse" fill="currentColor"/> 
                Start Stream
            </button>
        </Link>

        {/* 메뉴 목록 (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto space-y-8 pr-2">
            
            {/* 1. Discover */}
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-3 px-2">Discover</h3>
                <div className="space-y-1">
                    <Link href="/market" onClick={onClose}>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white cursor-pointer hover:bg-zinc-800 transition">
                            <Disc size={18}/>
                            <span className="text-sm font-medium">Explore</span>
                        </div>
                    </Link>
                    <Link href="/investing" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <TrendingUp size={18}/>
                            <span className="text-sm font-medium">Invest</span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* 2. My Studio */}
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-3 px-2">My Studio</h3>
                <div className="space-y-1">
                    <Link href="/library" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <PlayCircle size={18}/>
                            <span className="text-sm font-medium">Playlists</span>
                        </div>
                    </Link>
                    <Link href="/portfolio" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <Book size={18}/>
                            <span className="text-sm font-medium">Portfolio</span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* 3. Rewards */}
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-3 px-2">Rewards</h3>
                <div className="space-y-1">
                    <Link href="/studio" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <Coins size={18}/> 
                            <span className="text-sm font-medium">Earnings</span>
                        </div>
                    </Link>
                    <Link href="/earn" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <Zap size={18} className="text-yellow-500"/>
                            <span className="text-sm font-medium text-yellow-500">Free Faucet</span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>

        {/* Footer Actions (Upload & PWA) */}
        <div className="pt-6 mt-4 border-t border-zinc-900 space-y-3">
            {/* PWA Install Button */}
            {isInstallable && (
                <button 
                    onClick={installApp} 
                    className="w-full bg-zinc-900 text-zinc-300 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                >
                    <Download size={14}/> Install App
                </button>
            )}

            {/* Upload Button */}
            <Link href="/upload" onClick={onClose}>
                <button className="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition group">
                    <UploadCloud size={18} className="group-hover:text-cyan-400 transition-colors"/> 
                    <span className="text-sm">Upload & Earn</span>
                </button>
            </Link>
        </div>

      </div>
    </>
  );
}