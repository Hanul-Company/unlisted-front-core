'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface PWAContextType {
  isInstallable: boolean;
  installApp: () => void;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  
  // Prevent duplicated events
  const isEventHandled = useRef(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
      return /Android|iPhone|iPad|iPod/i.test(userAgent);
    };

    const handler = (e: any) => {
      e.preventDefault();

      if (isEventHandled.current) return;

      setDeferredPrompt(e);

      if (checkIsMobile()) {
        setIsInstallable(true);
        // toast("Install the app for faster access 📲", { id: 'pwa-install-toast' });
      } else {
        console.log("PC environment detected: PWA install prompt disabled.");
        setIsInstallable(false);
      }

      isEventHandled.current = true;
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      isEventHandled.current = false;
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      toast("The app is already installed, or please use 'Add to Home Screen' from your browser menu.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success("Installation started!");
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      console.log("User dismissed the installation.");
    }
  };

  return (
    <PWAContext.Provider value={{ isInstallable, installApp }}>
      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) throw new Error('usePWA must be used within PWAProvider');
  return context;
};
