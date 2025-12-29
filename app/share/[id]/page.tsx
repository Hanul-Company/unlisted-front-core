import React from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import MusicPreviewCard from '../../components/share/MusicPreviewCard';
import { supabase } from '@/utils/supabase';

// 1. DB 데이터 가져오기 (가드 절 추가)
const getAssetData = async (id: string) => {
  // ID가 없거나 'undefined' 문자열로 들어오면 바로 리턴
  if (!id || id === 'undefined') {
    console.error("Invalid ID:", id);
    return null;
  }

  const { data, error } = await supabase
    .from('tracks') 
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Supabase Fetch Error (ID: ${id}):`, error);
    return null;
  }
  
  if (!data) return null;

  return {
    id: data.id.toString(),
    title: data.title || "Untitled",
    artist: data.artist_name || "Unknown Artist",
    albumArt: data.cover_image_url || "https://via.placeholder.com/400",
    audioUrl: data.audio_url || "",
    // tracks 테이블에 없는 정보는 임시값
    price: "12,500 KRW", 
    roi: "15.4%", 
    duration: data.duration || 60,
    description: data.description || "이 곡의 주주가 되어보세요.",
  };
};

// 2. [Next.js 15 대응] params 타입 수정 (Promise)
type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // ★ 여기서 await 필수!
  const { id } = await params;
  const data = await getAssetData(id);

  if (!data) {
    return {
      title: 'Unlisted - Music Investment',
      description: '음악 저작권 투자 플랫폼',
    };
  }

  return {
    title: `🎵 ${data.title} - ${data.artist}`,
    description: `🚀 연 수익률 ${data.roi} | 지금 1분 미리듣고 투자하세요!`,
    openGraph: {
      title: `${data.title} (${data.artist})`,
      description: `현재 가격: ${data.price} | 예상 수익률: ${data.roi}\n${data.description}`,
      images: [{ url: data.albumArt, width: 800, height: 800, alt: data.title }],
      type: 'music.song',
    },
  };
}

// 3. 페이지 컴포넌트
export default async function SharedAssetPage({ params }: { params: Promise<{ id: string }> }) {
  // ★ 여기서도 await 필수!
  const { id } = await params;
  
  // ID 유효성 체크
  if (!id || id === 'undefined') return notFound();

  const assetData = await getAssetData(id);

  if (!assetData) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 opacity-50 blur-3xl scale-110"
        style={{ backgroundImage: `url(${assetData.albumArt})` }}
      />
      <div className="absolute inset-0 bg-black/40 z-0" />

      <div className="z-10 w-full max-w-md px-4 py-8">
        <MusicPreviewCard data={assetData} />
      </div>
    </div>
  );
}