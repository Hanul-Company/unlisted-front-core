import './globals.css';
import type { Metadata } from 'next';
// 1. Noto Sans KR 임포트 (기존 폰트 제거)
import { Noto_Sans_KR } from 'next/font/google';
import { Chiron_Hei_HK } from 'next/font/google';

import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { PWAProvider } from './context/PWAContext';
import PWAPrompt from './components/PWAPrompt';
import IOSInstallPrompt from './components/IOSInstallPrompt';
import { GoogleAnalytics } from "@next/third-parties/google";
import { PlayerProvider } from './context/PlayerContext';
import GlobalPlayer from './components/GlobalPlayer';
import Script from 'next/script';

import OnboardingModal from './components/OnboardingModal';

// 2. 폰트 설정 (다양한 굵기 포함)
const notoSansKr = Chiron_Hei_HK({
  subsets: ['latin'], // 한글은 Next.js가 자동으로 처리합니다.
  weight: ['300', '400', '500', '700', '900'], 
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'unlisted | The music never existed',
  description: 'Discover and invest in unreleased music.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <Script
          id="adsense-init"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4647509027586331"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <meta name="naver-site-verification" content="e531c98d05b623e1d90c75c34c3eec91c7d95122" />
      </head>
      {/* 3. body 클래스 수정: notoSansKr.className 적용 및 기존 font 변수 교체 */}
      <body className={`${notoSansKr.className} bg-black text-white antialiased selection:bg-cyan-500/30`}>
        <Providers>
          <PlayerProvider>
          <AuthProvider>
            <PWAProvider>
              
              <OnboardingModal />

              {children}

              <div className="block md:hidden">
                <PWAPrompt />
                <IOSInstallPrompt />
              </div>

              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'rgba(24, 24, 27, 0.8)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '99px',
                    fontSize: '13px',
                    // 4. 토스트 폰트도 변경된 변수로 적용 (혹은 inherit)
                    fontFamily: 'var(--font-noto), sans-serif', 
                    padding: '12px 20px',
                  },
                  success: { iconTheme: { primary: '#06b6d4', secondary: '#000' } },
                }}
              />
            </PWAProvider>
          </AuthProvider>
          <GlobalPlayer />
          </PlayerProvider>
        </Providers>
      </body>
      
      <GoogleAnalytics gaId="G-MTPLHYPLD4" />
    </html>
  );
}