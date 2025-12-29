"use client";

import React, { useState } from 'react';
import { Share2, Instagram, Loader2, Link as LinkIcon, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

interface ShareButtonProps {
  assetId: string;
  trackData?: { // 이미지 생성용 데이터 추가
    title: string;
    artist: string;
    coverUrl: string;
  };
  className?: string;
  size?: number;
}

const ShareButton = ({ assetId, trackData, className = "", size = 20 }: ShareButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // 1. 일반 링크 공유 (기존 로직)
  const handleLinkShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!', { icon: '🔗' });
    } catch (err) {
      toast.error('Failed to copy link.');
    }
  };

  // 2. 인스타 스토리용 이미지 생성 및 공유
  const handleStoryShare = async () => {
    if (!trackData) return handleLinkShare(); // 데이터 없으면 링크 공유로 대체
    setIsGenerating(true);

    try {
      // (1) 숨겨진 HTML 요소를 만듭니다 (스토리 비율 9:16)
      const element = document.createElement('div');
      element.style.width = '1080px';
      element.style.height = '1920px';
      element.style.position = 'fixed';
      element.style.top = '-9999px'; // 화면 밖으로 숨김
      element.style.background = 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)';
      element.style.display = 'flex';
      element.style.flexDirection = 'column';
      element.style.alignItems = 'center';
      element.style.justifyContent = 'center';
      element.style.color = 'white';
      element.style.fontFamily = 'sans-serif';
      
      // 내부 디자인 (Spotify 스타일)
      element.innerHTML = `
        <img src="${trackData.coverUrl}" style="width: 800px; height: 800px; border-radius: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); margin-bottom: 60px; object-fit: cover;" crossorigin="anonymous" />
        <h1 style="font-size: 80px; font-weight: 900; margin: 0; text-align: center; max-width: 900px;">${trackData.title}</h1>
        <p style="font-size: 50px; color: #888; margin-top: 20px;">${trackData.artist}</p>
        <div style="margin-top: 100px; background: #22c55e; padding: 20px 60px; border-radius: 99px; font-size: 40px; font-weight: bold; color: black;">
          Listen on unlisted
        </div>
      `;
      
      document.body.appendChild(element);

      // (2) 이미지를 캔버스로 변환
      const canvas = await html2canvas(element, { 
        useCORS: true, // 외부 이미지 허용
        scale: 1 
      });
      document.body.removeChild(element); // 청소

      // (3) Blob(파일)으로 변환
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Image generation failed");
        
        const file = new File([blob], 'share-story.png', { type: 'image/png' });

        // (4) 모바일 네이티브 공유 호출 (파일 첨부)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Check this song',
              text: `Listen to ${trackData.title} by ${trackData.artist}`,
            });
          } catch (err) {
            console.log('Share closed'); // 유저가 닫음
          }
        } else {
          // (5) PC거나 파일 공유 미지원 브라우저면 -> 이미지 다운로드
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `${trackData.title}-story.png`;
          link.click();
          toast.success("Image downloaded! Post it to your story.");
        }
        setIsGenerating(false);
      }, 'image/png');

    } catch (e) {
      console.error(e);
      toast.error("Failed to generate image.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* 1. 인스타 스토리 버튼 (데이터 있을 때만) */}
      {trackData && (
        <button 
            onClick={(e) => { e.stopPropagation(); handleStoryShare(); }}
            disabled={isGenerating}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${className.includes('bg-') ? className : 'bg-zinc-800 text-pink-500 hover:bg-zinc-700'}`}
            title="Share to Story"
        >
            {isGenerating ? <Loader2 size={18} className="animate-spin text-zinc-400"/> : <Instagram size={18} />}
        </button>
      )}

      {/* 2. 일반 링크 복사 버튼 */}
      <button 
        onClick={(e) => { e.stopPropagation(); handleLinkShare(); }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${className.includes('bg-') ? className : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
        title="Copy Link"
      >
        <LinkIcon size={18} />
      </button>
    </div>
  );
};

export default ShareButton;