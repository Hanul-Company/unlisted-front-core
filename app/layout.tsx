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
// ✅ [수정 1] next/script 임포트
import Script from 'next/script';

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
        {/* ✅ [수정 3] 구글 애드센스 스크립트 추가 (next/script 사용) */}
        <Script
          id="adsense-init"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4647509027586331"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className={`${outfit.variable} ${jakarta.variable} font-sans bg-black text-white antialiased selection:bg-cyan-500/30`}>
        <Providers>
          <AuthProvider>
            <PWAProvider>
              {children}

              {/* ✅ [수정 2] PC(md 이상)에서는 PWA 설치 프롬프트 숨기기 */}
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
        </Providers>
      </body>
      
      {/* Google Analytics는 body 밖(html 내부) 혹은 body 끝에 위치해도 괜찮습니다 */}
      <GoogleAnalytics gaId="G-MTPLHYPLD4" />
    </html>
  );
}