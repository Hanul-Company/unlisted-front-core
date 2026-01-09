'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from "@/lib/i18n"; 

// ✅ [1] 폰트 가져오기 (원하는 폰트로 교체 가능)
// 예시: 'Oswald' (영문 타이틀에 강렬함), 'Noto_Sans_KR' (한글 기본)
import { Lora, Noto_Sans_KR } from 'next/font/google';

const oswald = Lora({ subsets: ['latin'], weight: ['400'] }); 
const notoSans = Noto_Sans_KR({ subsets: ['latin'], weight: ['400', '700', '900'] });

export default function MarketCarousel() {
  const [banners, setBanners] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // 2. 자동 넘김 (5초)
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handlePrev = () => {
    setCurrent((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % banners.length);
  };

  if (loading) return <div className="w-full h-64 md:h-80 bg-zinc-900 animate-pulse rounded-2xl mb-8 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-700"/></div>;
  if (banners.length === 0) return null;

  return (
    // ✅ [폰트 적용] 여기서 className에 폰트 변수를 넣어주면 자식 요소들에 적용됩니다.
    <div className={`relative w-full h-64 md:h-[350px] rounded-2xl overflow-hidden mb-8 group bg-zinc-900 border border-zinc-800 ${notoSans.className}`}>
      
      {/* Slides */}
      {banners.map((banner, idx) => (
        <div 
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          {/* Background Image & Overlay */}
          <div className="absolute inset-0">
             <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover opacity-50" />
             <div className="absolute inset-0 bg-black/30" />
             <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          </div>

          {/* Content Area */}
          {/* ✅ [수정 핵심] max-w-3xl 제거 -> w-full md:w-2/3 적용 */}
          <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 w-full md:w-2/3">
            
            {/* Title */}
            <h2 className={`text-3xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-lg leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 ${oswald.className}`}>
              {/* 필요하다면 여기서만 다른 폰트(oswald) 적용 가능 */}
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
                <Link href={banner.btn1_link}>
                  <button className="px-6 md:px-8 py-3 rounded-full font-bold text-sm md:text-base text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300">
                    {banner.btn1_text}
                  </button>
                </Link>
              )}

              {/* Button 2 */}
              {banner.btn2_text && banner.btn2_link && (
                <Link href={banner.btn2_link}>
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

      {/* Navigation Arrows */}
      <button 
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 hover:bg-white/20 backdrop-blur-md text-white/50 hover:text-white transition opacity-0 group-hover:opacity-100"
      >
        <ChevronLeft size={24} />
      </button>
      <button 
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/30 hover:bg-white/20 backdrop-blur-md text-white/50 hover:text-white transition opacity-0 group-hover:opacity-100"
      >
        <ChevronRight size={24} />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === current ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}