"use client";

import React, { useState } from 'react';
import { Share2, Instagram, Loader2, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

interface ShareButtonProps {
  assetId: string;
  trackData?: {
    title: string;
    artist: string;
    coverUrl: string;
  };
  className?: string;
  size?: number;
}

const ShareButton = ({ assetId, trackData, className = "", size = 20 }: ShareButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. 일반 공유 (링크)
  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    const shareData = {
        title: 'unlisted | The music never existed.',
        text: trackData ? `Listen to ${trackData.title} by ${trackData.artist}` : 'Check out this song!',
        url: shareUrl,
    };

    if (navigator.share && navigator.canShare(shareData)) {
        try { await navigator.share(shareData); } catch (err) { console.log('Share closed'); }
    } else {
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!', { icon: '🔗' });
        } catch (err) { toast.error('Failed to copy link.'); }
    }
  };

  // 2. 인스타 스토리 생성 (자동 폰트 사이즈 조절 적용)
  const handleStoryShare = async () => {
    if (!trackData) return handleNativeShare();
    setIsGenerating(true);

    try {
      // ✅ [스마트 폰트 사이즈 계산 함수]
      const calculateFontSize = (text: string) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return { size: 80, wrap: false };

        const maxW = 640; // 커버 아트 너비와 동일
        const baseSize = 80;
        
        // Noto Sans KR 900 굵기 기준으로 측정
        context.font = `900 ${baseSize}px 'Noto Sans KR', sans-serif`;
        const textWidth = context.measureText(text).width;

        // 1. 기본 크기(80px)로 들어가는 경우
        if (textWidth <= maxW) {
            return { size: baseSize, wrap: false };
        }

        // 2. 넘치는 경우: 비율대로 축소
        const newSize = Math.floor(baseSize * (maxW / textWidth));

        // 3. 만약 45px보다 작아지면 -> 차라리 55px로 두 줄 만드는 게 낫다.
        if (newSize < 45) {
            return { size: 55, wrap: true }; // 줄바꿈 허용 모드
        }

        // 4. 적당히 줄어든 경우 -> 한 줄 유지 (nowrap)
        return { size: newSize, wrap: false };
      };

      // 타이틀에 대한 최적의 사이즈 계산
      const { size: titleFontSize, wrap: shouldWrap } = calculateFontSize(trackData.title);

      const element = document.createElement('div');
      
      const style = document.createElement('style');
      style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;900&display=swap');
      `;
      element.appendChild(style);

      Object.assign(element.style, {
        width: '1080px',
        height: '1920px',
        position: 'fixed',
        top: '-9999px',
        left: '0px',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: "'Noto Sans KR', sans-serif",
        zIndex: '9999',
      });
      
      element.innerHTML += `
        <div style="width: 640px; display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 30px;">
            <img 
                src="/logo.png" 
                style="width: 260px; object-fit: contain; margin-bottom: 40px;" 
                crossorigin="anonymous"
            />
            <img 
                src="${trackData.coverUrl}" 
                style="width: 640px; height: 640px; border-radius: 40px; box-shadow: 0 40px 80px rgba(255,255,255,0.1); object-fit: cover;" 
                crossorigin="anonymous" 
            />
        </div>
        
        <div style="width: 640px; text-align: center;">
            <h1 style="
                font-family: 'Noto Sans KR', sans-serif;
                font-size: ${titleFontSize}px; 
                font-weight: 900; 
                margin: 0; 
                line-height: 1.1; 
                letter-spacing: -2px;
                /* 줄바꿈 제어: 계산 결과에 따라 nowrap 또는 normal 적용 */
                white-space: ${shouldWrap ? 'normal' : 'nowrap'};
                word-break: keep-all; 
            ">
                ${trackData.title}
            </h1>
            
            <p style="
                font-family: 'Noto Sans KR', sans-serif;
                font-size: 45px; 
                color: #888; 
                margin-top: 25px; 
                font-weight: 700;
                letter-spacing: -1px;
                white-space: nowrap; /* 아티스트명은 한 줄 유지 */
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
            ">
                ${trackData.artist}
            </p>
        </div>
      `;
      
      document.body.appendChild(element);
      await document.fonts.ready; 

      const canvas = await html2canvas(element, { 
          useCORS: true, 
          scale: 1, 
          backgroundColor: '#000000',
          logging: false,
      });
      
      document.body.removeChild(element);

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Generation failed");
        const file = new File([blob], 'story.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); } 
          catch (err) { console.log('Closed'); }
        } else {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `${trackData.title}.png`;
          link.click();
          toast.success("Image downloaded!");
        }
        setIsGenerating(false);
      }, 'image/png');

    } catch (e) {
      console.error(e);
      toast.error("Failed to generate.");
      setIsGenerating(false);
    }
  };

const baseClass = className || 'bg-zinc-800 hover:bg-zinc-700';

  return (
    <div className="flex gap-2">
      {trackData && (
        <button 
            onClick={(e) => { e.stopPropagation(); handleStoryShare(); }}
            disabled={isGenerating}
            // 👇 수정됨: baseClass + text-pink-500 (인스타 색상 고정)
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${baseClass} text-pink-500`}
        >
            {isGenerating ? <Loader2 size={18} className="animate-spin text-zinc-400"/> : <Instagram size={18} />}
        </button>
      )}

      <button 
        onClick={(e) => { e.stopPropagation(); handleNativeShare(); }}
        // 👇 수정됨: baseClass + text-white (공유 아이콘 밝게 고정)
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${baseClass} text-white`}
      >
        <Share2 size={18} />
      </button>
    </div>
  );
};

export default ShareButton;