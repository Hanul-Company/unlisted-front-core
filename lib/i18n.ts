// Paraglide 같은 거 없이, 그냥 Next.js 기본 기능을 내보내줍니다.
// 이렇게 하면 다른 파일에서 import { Link } from "@/lib/i18n" 해도 에러 안 납니다.

import NextLink from 'next/link';
import { useRouter as useNextRouter, usePathname as useNextPathname, redirect as nextRedirect } from 'next/navigation';

// 1. Link 컴포넌트
export const Link = NextLink;

// 2. 라우터 훅 (Hooks)
export const useRouter = useNextRouter;
export const usePathname = useNextPathname;

// 3. 리다이렉트 함수
export const redirect = nextRedirect;
export const permanentRedirect = nextRedirect; // 임시로 같은 거 연결

// 4. 미들웨어 (빈 껍데기) - middleware.ts에서 호출해도 에러 안 나게
export function middleware(request: any) {
  return undefined; 
}