'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2 } from 'lucide-react'; // 화살표 아이콘 제거
import { Link } from "@/lib/i18n"; 

import { Chiron_Hei_HK, Lora, Noto_Sans_KR, Sunflower } from 'next/font/google';

const oswald = Chiron_Hei_HK({ subsets: ['latin'], weight: ['400'] }); 
const notoSans = Chiron_Hei_HK({ subsets: ['latin'], weight: ['400', '700', '900'] });

export default function MarketCarousel() {
  const [banners, setBanners] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  // 스와이프를 위한 상태값
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // 마우스 드래그를 위한 상태값
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);

  // 1. 데이터 가져오기
  useEffect(() => {
    const fetchBanners = async () => {
      const { data } = await supabase
        .from('market_banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(5);

      if (data) setBanners(data);
      setLoading(false);
    };
    fetchBanners();
  }, []);

  // 2. 자동 넘김 (10초) - 드래그 중이 아닐 때만
  useEffect(() => {
    if (banners.length <= 1 || isDragging) return; // 드래그 중엔 자동넘김 일시정지
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [banners.length, isDragging]);

  const handlePrev = () => {
    setCurrent((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % banners.length);
  };

  // --- [스와이프 로직 시작] ---
  const minSwipeDistance = 50;

  // 1. 터치 (모바일)
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrev();
  };

  // 2. 마우스 (PC 클릭 드래그)
  const onMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const onMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    if (!startX) return;
    const distance = startX - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrev();
    setStartX(null);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
    setStartX(null);
  };
  // --- [스와이프 로직 끝] ---

  if (loading) return <div className="w-full h-64 md:h-80 bg-zinc-900 animate-pulse rounded-2xl mb-8 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-700"/></div>;
  if (banners.length === 0) return null;

  return (
    <div 
      className={`relative w-full h-64 md:h-[350px] rounded-2xl overflow-hidden mb-8 group bg-zinc-900 border border-zinc-800 select-none cursor-grab active:cursor-grabbing ${notoSans.className}`}
      // 이벤트 핸들러 연결
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      
      {/* Slides */}
      {banners.map((banner, idx) => (
        <div 
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          {/* Background Image & Overlay */}
          <div className="absolute inset-0">
             <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover opacity-50" />
             <div className="absolute inset-0 bg-black/30" />
             <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          </div>

          {/* Content Area - pointer-events-auto를 주어 버튼 클릭은 가능하게 함 */}
          <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 w-full md:w-2/3 pointer-events-auto">
            
            {/* Title */}
            <h2 className={`text-3xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-lg leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 ${oswald.className}`}>
              {banner.title}
            </h2>
            
            {/* Subtitle */}
            {banner.subtitle && (
              <p className="text-zinc-300 text-sm md:text-lg mb-8 font-medium drop-shadow-md animate-in fade-in slide-in-from-bottom-5 duration-1000 break-keep">
                {banner.subtitle}
              </p>
            )}

            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              {/* Button 1 */}
              {banner.btn1_text && banner.btn1_link && (
                <Link href={banner.btn1_link} draggable={false}>
                  <button className="px-6 md:px-8 py-3 rounded-full font-bold text-sm md:text-base text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300">
                    {banner.btn1_text}
                  </button>
                </Link>
              )}

              {/* Button 2 */}
              {banner.btn2_text && banner.btn2_link && (
                <Link href={banner.btn2_link} draggable={false}>
                  <div className="p-[2px] rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:scale-105 transition-all duration-300 group/btn">
                    <div className="px-6 md:px-8 py-[10px] rounded-full bg-black/90 text-white font-bold text-sm md:text-base group-hover/btn:bg-black/50 transition-colors">
                      {banner.btn2_text}
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 화살표 버튼 제거됨 */}

      {/* Indicators (하단 점) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-auto">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
                e.stopPropagation(); // 스와이프 이벤트 전파 방지
                setCurrent(idx);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === current ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}