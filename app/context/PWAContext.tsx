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
  
  // 이벤트 중복 발생 방지를 위한 ref
  const isEventHandled = useRef(false);

  useEffect(() => {
    // 1. 모바일 기기인지 체크하는 함수
    const checkIsMobile = () => {
      const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
      return /Android|iPhone|iPad|iPod/i.test(userAgent);
    };

    const handler = (e: any) => {
      // 브라우저 기본 설치 배너 막기 (필수)
      e.preventDefault();
      
      // 이미 처리된 이벤트거나, PC라면 무시
      if (isEventHandled.current) return;
      
      // PC에서는 설치 프롬프트 저장만 해두고, UI(isInstallable)는 켜지 않음
      setDeferredPrompt(e);

      // 2. 모바일일 때만 설치 가능 상태로 변경 (팝업/버튼 노출용)
      if (checkIsMobile()) {
        setIsInstallable(true);
        // 만약 여기서 자동으로 토스트를 띄우고 싶다면 아래 주석 해제
        // toast("앱을 설치하면 더 빠르게 이용할 수 있어요! 📲", { id: 'pwa-install-toast' });
      } else {
        console.log("PC 환경 감지됨: PWA 설치 유도를 비활성화합니다.");
        setIsInstallable(false);
      }
      
      isEventHandled.current = true;
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS 등 PWA 호환성 이슈 대비용 (선택사항)
    // iOS Safari는 beforeinstallprompt가 안 뜨므로 별도 처리가 필요할 수 있음

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      isEventHandled.current = false; // 클린업 시 리셋
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      toast("이미 설치되었거나, 브라우저 메뉴에서 '홈 화면에 추가'를 이용해주세요.");
      return;
    }

    // 설치 프롬프트 실행
    deferredPrompt.prompt();
    
    // 유저 응답 대기
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success("설치 시작!");
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      console.log("유저가 설치 거절함");
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