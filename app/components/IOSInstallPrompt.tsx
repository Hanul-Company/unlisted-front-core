'use client';

import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

export default function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. iOS 기기인지 확인
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);

    // 2. 이미 앱으로 실행 중인지 확인 (Standalone 모드)
    const isStandalone = (window.navigator as any).standalone;

    // iOS이면서 + 브라우저(앱 아님) 상태일 때만 띄움
    if (isIOS && !isStandalone) {
      setShowPrompt(true);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-5 rounded-2xl shadow-2xl relative">
        
        {/* 닫기 버튼 */}
        <button 
          onClick={() => setShowPrompt(false)} 
          className="absolute top-2 right-2 text-zinc-500 hover:text-white p-2"
        >
          <X size={18} />
        </button>

        <div className="flex gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            {/* 앱 아이콘 대용 (public/icon-192.png가 있으면 그걸 <img>로 넣어도 좋음) */}
            <img src="/icon-192.png" alt="App Icon" className="w-full h-full rounded-xl object-cover"/>
          </div>
          
          <div className="space-y-2 flex-1">
            <h3 className="font-bold text-sm text-white">Install Unlisted App</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Install the app for a smoother experience.
            </p>
            
            {/* 가이드 스텝 */}
            <div className="flex flex-col gap-2 mt-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                1. Tap <Share size={14} className="text-blue-400"/> button below.
              </div>
              <div className="flex items-center gap-2">
                2. Select <span className="font-bold text-white flex items-center gap-1"><PlusSquare size={14}/> Add to Home Screen</span>.
              </div>
            </div>
          </div>
        </div>

        {/* 말풍선 꼬리 (하단 중앙을 가리킴) */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-r border-b border-zinc-700 transform rotate-45"></div>
      </div>
    </div>
  );
}
