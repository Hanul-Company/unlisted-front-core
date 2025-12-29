"use client";

import React from 'react';
import { Share2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareButtonProps {
  assetId: string;
  className?: string;
  size?: number;
  showText?: boolean;
}

const ShareButton = ({ assetId, className = "", size = 20, showText = false }: ShareButtonProps) => {
  
  const handleShare = async () => {
    // 공유용 URL 생성 (현재 도메인 + /share/id)
    const shareUrl = `${window.location.origin}/share/${assetId}`;

    // 모바일 네이티브 공유 기능 (가능하면 우선 사용)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'unlisted | AI music Investment',
          text: 'Check this song & profit expected 🎵',
          url: shareUrl,
        });
        return;
      } catch (err) {
        console.log('Share canceled or failed, falling back to clipboard');
      }
    }

    // PC거나 네이티브 공유 실패 시 -> 클립보드 복사
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link has been copied!', {
        icon: '🔗',
        style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    } catch (err) {
      toast.error('Failed to copy Share link.');
    }
  };

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation(); // 부모 클릭 이벤트 방지
        handleShare();
      }}
      className={`flex items-center gap-2 text-zinc-400 hover:text-white transition-colors active:scale-95 ${className}`}
    >
      <Share2 size={size} />
      {showText && <span className="text-xs font-medium">Share</span>}
    </button>
  );
};

export default ShareButton;