'use client';

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // 1. 방어 코드: 이미 광고가 로드되어 내용이 찼거나, data-ad-status 속성이 있다면 실행하지 않음
    if (adRef.current && adRef.current.innerHTML.replace(/\s/g, "").length > 0) {
      return;
    }
    
    // 혹은 data-ad-status 속성 체크 (AdSense가 로드되면 이 속성을 추가함)
    if (adRef.current && adRef.current.getAttribute('data-ad-status')) {
        return;
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e: any) {
      // 2. 에러가 나더라도 'adsbygoogle' 관련 에러면 무시 (사용자 경험엔 지장 없음)
      // 개발자 콘솔이 지저분해지는 것을 방지
      if (process.env.NODE_ENV !== 'production') {
          console.error("AdSense push error (usually safe to ignore):", e.message);
      }
    }
  }, []);

  return (
    <div className="w-full flex justify-center my-4 overflow-hidden">
        {/* ref={adRef} 추가 */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client="ca-pub-4647509027586331"
        data-ad-slot="1234567890" // ⚠️ 본인의 슬롯 ID 확인 필수
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}