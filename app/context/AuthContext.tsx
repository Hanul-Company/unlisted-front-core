'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useActiveAccount, useConnectModal } from "thirdweb/react";
import { client } from "@/utils/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";

interface AuthContextType {
  requireAuth: (callback?: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// [설정] 로그인 옵션 (HeaderProfile과 동일하게 맞춤)
const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "apple"] },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount(); // 현재 로그인된 계정 확인
  const { connect } = useConnectModal(); // Thirdweb 로그인 모달 훅
  
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // 계정이 연결되면(로그인 성공), 미뤄뒀던 액션 실행
  useEffect(() => {
    if (account && pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [account, pendingAction]);

  const requireAuth = async (callback?: () => void) => {
    if (account) {
      // 이미 로그인됨 -> 바로 실행
      if (callback) callback();
    } else {
      // 로그인 안됨 -> 액션 저장해두고 Thirdweb 모달 열기
      if (callback) setPendingAction(() => callback);
      
      // [핵심] Thirdweb 모달 호출
      try {
        await connect({ 
            client,
            wallets,
            theme: "dark",
            size: "compact",
            welcomeScreen: {
                title: "Join Unlisted",
                subtitle: "Login to continue",
            }
        });
      } catch (e) {
          console.error("Login cancelled", e);
          setPendingAction(null); // 취소하면 대기열 비움
      }
    }
  };

  return (
    <AuthContext.Provider value={{ requireAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};