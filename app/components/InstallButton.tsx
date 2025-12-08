'use client';

import { usePWA } from '../context/PWAContext';
import { Download } from 'lucide-react';

export default function InstallButton() {
  const { isInstallable, installApp } = usePWA();

  // 설치 불가능한 환경(이미 설치됨 or iOS)이면 안 보임
  if (!isInstallable) return null;

  return (
    <button 
      onClick={installApp}
      className="w-full bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition border border-zinc-700 mt-4 animate-pulse"
    >
      <Download size={18} /> Install App
    </button>
  );
}