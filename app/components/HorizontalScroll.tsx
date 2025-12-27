'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string; 
}

export default function HorizontalScroll({ children, className = "" }: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  // 스크롤 위치 체크
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 0);
      // 오차 범위를 위해 1px 정도 여유를 둠
      setShowRight(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.7;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    // ✅ [수정 1] 부모 그룹 이름을 'group/scroll'로 지정하여 자식들과 분리
    <div className="relative group/scroll">
      
      {/* Left Button */}
      {showLeft && (
        <button
          onClick={() => scroll('left')}
          // ✅ [수정 2] group-hover 대신 group-hover/scroll 사용
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300 hidden md:flex"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex overflow-x-auto scrollbar-hide scroll-smooth ${className}`}
      >
        {children}
      </div>

      {/* Right Button */}
      {showRight && (
        <button
          onClick={() => scroll('right')}
          // ✅ [수정 3] group-hover 대신 group-hover/scroll 사용
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-black/60 hover:bg-black/90 text-white rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-300 hidden md:flex"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}