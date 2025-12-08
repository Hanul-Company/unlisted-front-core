'use client';

import { useEffect } from 'react';

export default function AdBanner() {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense Error:', err);
    }
  }, []);

  return (
    <div className="my-4 w-full flex justify-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[100px] items-center text-zinc-600 text-xs">
      {/* 실제 애드센스 코드 (승인 전엔 빈칸으로 보임) */}
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', textAlign: 'center' }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // 나중에 본인 ID로 교체
        data-ad-slot="XXXXXXXXXX" // 나중에 슬롯 ID로 교체
      />
      
      {/* 로컬 테스트용 표시 (배포 시 삭제 가능) */}
      <span className="absolute">Google AdSpace (Localhost Mock)</span>
    </div>
  );
}