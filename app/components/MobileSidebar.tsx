'use client';

import React from 'react';
import { Link } from "@/lib/i18n";
import { Radius, Book, Disc, PlayCircle, Download, X, UploadCloud, LayoutGrid, TrendingUp, Coins, Heart, Zap } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePWA } from '../context/PWAContext';

// [핵심] 이 인터페이스가 있어야 부모 컴포넌트에서 props를 넘길 수 있습니다.
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
      <div className={`fixed top-0 left-0 bottom-0 w-[80%] max-w-xs bg-zinc-950 border-r border-zinc-800 z-[70] p-6 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
            <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                unlisted
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                <X size={24}/>
            </button>
        </div>

        {/* Upload Button */}
        <Link href="/upload" onClick={onClose}>
            <button className="w-full bg-white text-black font-bold py-3 rounded-xl mb-8 flex items-center justify-center gap-2 hover:scale-105 transition">
                <UploadCloud size={20}/> Upload
            </button>
        </Link>

        {/* 메뉴 목록 */}
        <nav className="space-y-6">
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Discover</h3>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition"><Disc size={18}/><span className="text-sm font-medium"> Explore</span></div>
                <Link href="/radio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Radius size={18}/><span className="text-sm font-medium"> unlisted Player</span></div></Link>
                
                <Link href="/investing"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><TrendingUp size={18}/><span className="text-sm font-medium"> Charts</span></div></Link>
            </div>
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3>
                {/* [추가] Earn 메뉴 */}
                <Link href="/earn">
                    <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer">
                        <Zap size={18} className="text-yellow-500"/>
                        <span className="text-sm font-medium text-yellow-500">Free Faucet</span>
                    </div>
                </Link>
                <Link href="/studio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Coins size={18}/> <span className="text-sm font-medium"> Revenue</span></div></Link>
            </div>
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">My Studio</h3>
                <Link href="/portfolio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Book size={18}/><span className="text-sm font-medium"> Portoflio</span></div></Link>
                <Link href="/library"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><PlayCircle size={18}/><span className="text-sm font-medium"> Playlists</span></div></Link>
            </div>
        </nav>
      </div>
    </>
  );
}