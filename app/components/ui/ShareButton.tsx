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

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    const shareData = {
        title: 'unlisted Music Investment',
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

  const handleStoryShare = async () => {
    if (!trackData) return handleNativeShare();
    setIsGenerating(true);

    try {
      const element = document.createElement('div');
      
      // ✅ 1. 폰트 강제 주입을 위한 스타일 태그 생성
      // Noto Sans KR 중에서도 제일 굵은 900(Black)을 가져옵니다.
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
        left: '0px', // 모바일에서 뷰포트 밖으로 밀리지 않게 고정
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        // ✅ 2. 폰트 패밀리 강제 지정 (중요)
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
        
        <div style="width: 800px; text-align: center;">
            <h1 style="
                font-family: 'Noto Sans KR', sans-serif;
                font-size: 80px; 
                font-weight: 900; 
                margin: 0; 
                line-height: 1.2; 
                word-break: keep-all; /* 한글 단어 잘림 방지 */
                white-space: pre-wrap; /* 줄바꿈/띄어쓰기 보존 */
                letter-spacing: -2px; /* 자간 좁게 (타이포 느낌) */
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
            ">
                ${trackData.artist}
            </p>
        </div>
      `;
      
      document.body.appendChild(element);

      // ✅ 3. 폰트 로딩 대기 (아주 짧은 시간)
      // 웹폰트가 로딩되기 전에 캡처되면 기본폰트로 찍히므로 약간의 텀을 줍니다.
      await document.fonts.ready; 

      const canvas = await html2canvas(element, { 
          useCORS: true, 
          scale: 1, // 모바일에서 너무 큰 해상도 방지
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

  return (
    <div className="flex gap-2">
      {trackData && (
        <button 
            onClick={(e) => { e.stopPropagation(); handleStoryShare(); }}
            disabled={isGenerating}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${className.includes('bg-') ? className : 'bg-zinc-800 text-pink-500 hover:bg-zinc-700'}`}
        >
            {isGenerating ? <Loader2 size={18} className="animate-spin text-zinc-400"/> : <Instagram size={18} />}
        </button>
      )}

      <button 
        onClick={(e) => { e.stopPropagation(); handleNativeShare(); }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${className.includes('bg-') ? className : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
      >
        <Share2 size={18} />
      </button>
    </div>
  );
};

export default ShareButton;