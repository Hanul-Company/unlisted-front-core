import './globals.css';
import type { Metadata } from 'next';
// 폰트 설정 (기존 유지)
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
// [필수] PWAProvider 임포트
import { PWAProvider } from './context/PWAContext';
import PWAPrompt from './components/PWAPrompt';
import IOSInstallPrompt from './components/IOSInstallPrompt'; // [추가]ㅇ

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: 'unlisted | The music never existed',
  description: 'Discover and invest in unreleased music.',
  // [추가] manifest 파일 명시
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png', // 아이폰용 아이콘 지정
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${jakarta.variable} font-sans bg-black text-white antialiased selection:bg-cyan-500/30`}>
        <Providers>
          <AuthProvider>
            {/* [핵심] PWAProvider로 children을 감싸야 usePWA가 작동합니다 */}
            <PWAProvider>
              {children}
              <PWAPrompt />
              <IOSInstallPrompt /> {/* [추가] iOS용 */}
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
    </html>
  );
}
