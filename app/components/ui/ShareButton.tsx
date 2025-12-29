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

  // 1. 일반 공유 (네이티브 Share Sheet 호출)
  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    const shareData = {
        title: 'unlisted Music Investment',
        text: trackData ? `Listen to ${trackData.title} by ${trackData.artist}` : 'Check out this song!',
        url: shareUrl,
    };

    if (navigator.share && navigator.canShare(shareData)) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Share closed/cancelled');
        }
    } else {
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!', { icon: '🔗' });
        } catch (err) {
            toast.error('Failed to copy link.');
        }
    }
  };

  // 2. 인스타 스토리용 이미지 생성
  const handleStoryShare = async () => {
    if (!trackData) return handleNativeShare();
    setIsGenerating(true);

    try {
      const element = document.createElement('div');
      Object.assign(element.style, {
        width: '1080px',
        height: '1920px',
        position: 'fixed',
        top: '-9999px',
        backgroundColor: '#000000', // 완전 블랙
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'sans-serif',
      });
      
      // ✅ [디자인 수정 핵심]
      // 1. 640px(커버 너비)짜리 래퍼를 만들어 로고와 커버를 묶습니다.
      // 2. 로고 크기를 260px (640px의 약 2/5)로 키웠습니다.
      element.innerHTML = `
        <div style="width: 640px; display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 60px;">
            <img 
                src="/logo.png" 
                style="width: 260px; object-fit: contain; margin-bottom: 30px;" 
                crossorigin="anonymous"
            />

            <img 
                src="${trackData.coverUrl}" 
                style="width: 640px; height: 640px; border-radius: 40px; box-shadow: 0 30px 60px rgba(255,255,255,0.1); object-fit: cover;" 
                crossorigin="anonymous" 
            />
        </div>
        
        <h1 style="font-size: 80px; font-weight: 900; margin: 0; text-align: center; max-width: 900px; line-height: 1.1; white-space: pre-wrap;">${trackData.title}</h1>
        
        <p style="font-size: 50px; color: #888; margin-top: 30px; font-weight: 500;">${trackData.artist}</p>
      `;
      
      document.body.appendChild(element);

      const canvas = await html2canvas(element, { useCORS: true, scale: 1, backgroundColor: '#000000' });
      document.body.removeChild(element);

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Image generation failed");
        const file = new File([blob], 'story.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
            });
          } catch (err) { console.log('Share closed'); }
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
      toast.error("Failed to create image.");
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
            title="Share to Instagram Story"
        >
            {isGenerating ? <Loader2 size={18} className="animate-spin text-zinc-400"/> : <Instagram size={18} />}
        </button>
      )}

      <button 
        onClick={(e) => { e.stopPropagation(); handleNativeShare(); }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${className.includes('bg-') ? className : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
        title="Share Link"
      >
        <Share2 size={18} />
      </button>
    </div>
  );
};

export default ShareButton;