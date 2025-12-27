'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-ads';
import 'videojs-ima';
import 'videojs-ima/dist/videojs.ima.css';
import { Play, Loader2 } from 'lucide-react'; // 로딩 아이콘 추가

interface AdPlayerProps {
  onComplete: () => void;
  vastUrl?: string;
}

export default function AdPlayer({ onComplete, vastUrl }: AdPlayerProps) {
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  // 구글 공식 리니어(Linear) 광고 테스트 태그
  const DEFAULT_VAST = "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=";
  const finalVastUrl = vastUrl || DEFAULT_VAST;

  useEffect(() => {
    if (!isSdkLoaded || !isStarted || !playerWrapperRef.current) return;
    if (playerRef.current) return;

    // @ts-ignore
    if (typeof window !== 'undefined' && (!window.google || !window.google.ima)) {
      console.warn("Google IMA SDK missing or blocked.");
      onComplete();
      return;
    }

    // DOM 초기화
    playerWrapperRef.current.innerHTML = '';
    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-16-9');
    playerWrapperRef.current.appendChild(videoElement);

    // Video.js 초기화
    const player = videojs(videoElement, {
      controls: true,
      autoplay: true,
      muted: false, 
      playsinline: true,
    }) as any;

    playerRef.current = player;

    // IMA 옵션
    const imaOptions = {
      id: 'video_player',
      adTagUrl: finalVastUrl,
      showCountdown: true,
      debug: false,
      disableCustomPlaybackForIOS10Plus: true, 
    };

    if (player.ima) {
      player.ima(imaOptions);

      player.on('ads-ad-started', () => console.log('Ads started'));
      
      player.on('ads-allads-completed', () => {
        console.log('Ads completed');
        onComplete();
      });

      player.on('ads-error', (e: any) => {
        console.warn('Ad Error Occurred:', e);
        onComplete();
      });

      player.on('ended', () => onComplete());

      player.ready(() => {
         if (player.ima.initializeAdDisplayContainer) {
            player.ima.initializeAdDisplayContainer();
         }

         player.src({
            src: 'https://storage.googleapis.com/gvabox/media/samples/stock.mp4',
            type: 'video/mp4'
         });

         setTimeout(() => {
             try {
                if (player.ima.requestAds) player.ima.requestAds();
                player.play();
             } catch (e) {
                console.error(e);
                onComplete();
             }
         }, 100);
      });
    }

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [isSdkLoaded, isStarted, finalVastUrl, onComplete]);

  return (
    <div className="w-full h-full bg-black flex justify-center items-center relative group overflow-hidden rounded-xl">
      <Script 
        src="//imasdk.googleapis.com/js/sdkloader/ima3.js"
        strategy="afterInteractive"
        onLoad={() => setIsSdkLoaded(true)}
        onError={() => onComplete()}
      />

      {/* 시작하기 오버레이 */}
      {!isStarted && (
        <div 
             // ✅ [수정됨] 변수명 수정 및 로딩 중 클릭 방지 스타일 적용
             className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900/90 ${isSdkLoaded ? 'cursor-pointer' : 'cursor-wait'}`}
             onClick={() => {
                 // ✅ [핵심 수정] setIsSdkLoaded(함수)가 아니라 isSdkLoaded(변수)를 확인해야 함
                 if (isSdkLoaded) {
                     setIsStarted(true);
                 }
             }}
        >
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(234,179,8,0.4)] ${isSdkLoaded ? 'bg-yellow-500 animate-pulse' : 'bg-zinc-700'}`}>
                {isSdkLoaded ? (
                    <Play size={40} fill="black" className="ml-1 text-black"/>
                ) : (
                    <Loader2 size={30} className="animate-spin text-zinc-400"/>
                )}
             </div>
             
             <p className="text-white font-bold text-lg">
                 {isSdkLoaded ? 'Tap to Watch Ad' : 'Loading Ad Resources...'}
             </p>
             <p className="text-zinc-400 text-sm mt-1">Reward: 10 pMLD</p>
        </div>
      )}

      <div ref={playerWrapperRef} className="w-full h-full" />
    </div>
  );
}