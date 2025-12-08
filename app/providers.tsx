'use client';

import { ThirdwebProvider } from "thirdweb/react";
import { AuthProvider } from './context/AuthContext';
import { PWAProvider } from './context/PWAContext';
import PWAPrompt from './components/PWAPrompt'; 

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AuthProvider>
        <PWAProvider>
            {children}
            <PWAPrompt />
        </PWAProvider>
      </AuthProvider>
    </ThirdwebProvider>
  );
}