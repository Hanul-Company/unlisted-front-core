import './globals.css';
import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
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

// ✅ [추가] 전역 온보딩 모달 임포트
import OnboardingModal from './components/OnboardingModal';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

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
      <body className={`${outfit.variable} ${jakarta.variable} font-sans bg-black text-white antialiased selection:bg-cyan-500/30`}>
        <Providers>
          <PlayerProvider>
          <AuthProvider>
            <PWAProvider>
              
              {/* ✅ [추가] 전역 온보딩 모달 배치 */}
              {/* 스스로 지갑 연결 여부와 DB를 체크하여 렌더링되므로 Props가 필요 없습니다. */}
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
                    fontFamily: 'var(--font-jakarta)',
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