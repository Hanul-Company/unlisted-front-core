'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1) Capture the browser signal that the app is installable.
    const handler = (e: any) => {
      e.preventDefault(); // Prevent the default mini-infobar
      setDeferredPrompt(e); // Save the event
      setShowPrompt(true); // Show our custom UI
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // 2) Trigger the saved install prompt
    deferredPrompt.prompt();

    // 3) Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success("Starting app installation!");
    } else {
      toast("Installation canceled.");
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div className="bg-zinc-900/90 backdrop-blur-md border border-cyan-500/30 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Install App</h3>
            <p className="text-xs text-zinc-400">Add to your home screen for faster access.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowPrompt(false)}
            className="p-2 text-zinc-500 hover:text-white transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <button
            onClick={handleInstallClick}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-full transition shadow-lg shadow-cyan-900/20"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
