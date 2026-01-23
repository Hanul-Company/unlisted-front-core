'use client';

import React from 'react';
import { Link } from "@/lib/i18n";
import { useRouter } from 'next/navigation';
import { useActiveAccount } from "thirdweb/react";
import toast from 'react-hot-toast';
import { Wand2, Radius, Book, Disc, PlayCircle, Download, X, UploadCloud, TrendingUp, Coins, Zap, Radio } from 'lucide-react';
import { usePWA } from '../context/PWAContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
    const { isInstallable, installApp } = usePWA();
    const account = useActiveAccount();
    const address = account?.address;
    const router = useRouter();

    // ✅ 제한된 메뉴 클릭 핸들러
    const handleRestricted = (path: string) => {
        // 사이드바 먼저 닫기 (모달이 잘 보이게)
        onClose();

        // 1. 비로그인 상태 체크
        if (!address) {
            const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
            if (headerBtn) {
                setTimeout(() => headerBtn.click(), 100); // 사이드바 닫히는 애니메이션 후 클릭
                // toast("Join unlisted now", { icon: '👆' });
            } else {
                toast.error("Please Join unlisted first.");
            }
            return;
        }

        // 2. 로그인 상태면 이동
        router.push(path);
    };
  
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

        {/* ✅ Main CTA: Start Stream (허용: Link 유지) */}
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
                    {/* Explore (허용: Link 유지) */}
                    <Link href="/market" onClick={onClose}>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white cursor-pointer hover:bg-zinc-800 transition">
                            <Disc size={18}/>
                            <span className="text-sm font-medium">Explore</span>
                        </div>
                    </Link>
                    
                    {/* Invest (허용: Link 유지) */}
                    <Link href="/investing" onClick={onClose}>
                        <div className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                            <TrendingUp size={18}/>
                            <span className="text-sm font-medium">Invest (Beta)</span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* 2. My Studio */}
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-3 px-2">My Studio</h3>
                <div className="space-y-1">
                    {/* 🔒 Playlists */}
                    <div onClick={() => handleRestricted('/library')} className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                        <PlayCircle size={18}/>
                        <span className="text-sm font-medium">Playlists</span>
                    </div>

                    {/* 🔒 Portfolio */}
                    {/* <div onClick={() => handleRestricted('/portfolio')} className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                        <Book size={18}/>
                        <span className="text-sm font-medium">Portfolio</span>
                    </div> */}
                </div>
            </div>

            {/* 3. Rewards */}
            <div>
                <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-3 px-2">Rewards</h3>
                <div className="space-y-1">
                    {/* 🔒 Earnings */}
                    <div onClick={() => handleRestricted('/studio')} className="flex gap-3 p-3 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white cursor-pointer transition">
                        <Coins size={18}/> 
                        <span className="text-sm font-medium">Earnings</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Actions (Upload & Create) */}
        <div className="pt-6 mt-4 border-t border-zinc-900 space-y-3">
            
            {/* 🔒 Upload Button */}
            <button onClick={() => handleRestricted('/upload')} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white transition group">
                <UploadCloud size={18} className="group-hover:text-cyan-400 transition-colors"/> 
                <span className="text-sm">Upload & Earn</span>
            </button>
            
            {/* 🔒 Create Button */}
            <div className="pt-2">
                <button onClick={() => handleRestricted('/create')} className="w-full rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2 text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-blue-900/30 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 hover:shadow-blue-900/50 transition-all duration-200 active:scale-[0.99] group">
                    <Wand2 size={18} className="opacity-95 group-hover:opacity-100 transition-opacity" /><span>Create Track</span>
                </button>
            </div>
        </div>
      </div>
    </>
  );
}