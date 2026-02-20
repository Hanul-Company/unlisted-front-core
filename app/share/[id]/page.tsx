import React from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import MusicPreviewCard from '../../components/share/MusicPreviewCard';
import { supabase } from '@/utils/supabase';

// 1. DB 데이터 가져오기 (가드 절 및 아티스트 이름 안전장치 추가)
const getAssetData = async (id: string) => {
  // ID가 없거나 'undefined' 문자열로 들어오면 바로 리턴
  if (!id || id === 'undefined') {
    console.error("Invalid ID:", id);
    return null;
  }

  const { data, error } = await supabase
    .from('tracks') 
    .select('*, artist:profiles(username, wallet_address, avatar_url)')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Supabase Fetch Error (ID: ${id}):`, error);
    return null;
  }
  
  if (!data) return null;

  // ✅ 아티스트 이름 확실하게 가져오기 (profiles 조인 실패 시 tracks 테이블의 artist_name 사용)
  const artistName = data.artist?.username || data.artist_name || "Unlisted Artist";

  return {
    id: data.id.toString(),
    title: data.title || "Untitled",
    // ✅ Card 컴포넌트에 넘겨줄 객체 형태로 안전하게 세팅
    artist: { 
        username: artistName, 
        wallet_address: data.artist?.wallet_address || null, 
        avatar_url: data.artist?.avatar_url || null 
    },
    albumArt: data.cover_image_url || "https://via.placeholder.com/400",
    audioUrl: data.audio_url || "",
    duration: data.duration || 60,
    description: data.description || "Discover this track on Unlisted.",
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
  const { id } = await params;
  const data = await getAssetData(id);

  if (!data) {
    return {
      title: 'Unlisted - The music never existed',
      description: 'Discover AI Music',
    };
  }

  // ✅ 메타데이터 타이틀을 명확하게 '곡이름 - 아티스트명'으로 지정
  const pageTitle = `${data.title} - ${data.artist.username}`;

  return {
    title: `🎵 ${pageTitle}`,
    description: `Stream & Create on Unlisted.`,
    openGraph: {
      title: pageTitle, // 카카오톡, 인스타 등 공유 시 메인 텍스트
      description: data.description,
      images: [{ url: data.albumArt, width: 800, height: 800, alt: data.title }],
      type: 'music.song',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: data.description,
      images: [data.albumArt],
    }
  };
}

// 3. 페이지 컴포넌트
export default async function SharedAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // ID 유효성 체크
  if (!id || id === 'undefined') return notFound();

  const assetData = await getAssetData(id);

  if (!assetData) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* 배경 블러 효과 */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 opacity-50 blur-3xl scale-110"
        style={{ backgroundImage: `url(${assetData.albumArt})` }}
      />
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* 카드 렌더링 영역 */}
      <div className="z-10 w-full max-w-md px-4 py-8">
        <MusicPreviewCard data={assetData} />
      </div>
    </div>
  );
}