// hooks/useMediaSession.ts
import { useEffect } from 'react';

interface UseMediaSessionProps {
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  play: () => void;
  pause: () => void;
  next?: () => void;
  prev?: () => void;
  seekTo?: (time: number) => void;
}

export function useMediaSession({
  title,
  artist,
  album = "unlisted Studio",
  coverUrl,
  isPlaying,
  audioRef,
  play,
  pause,
  next,
  prev,
  seekTo
}: UseMediaSessionProps) {
  
  useEffect(() => {
    // 1. 브라우저 지원 여부 및 메타데이터가 없는 경우 체크
    if (!('mediaSession' in navigator) || !title) return;

    // 2. 잠금 화면 메타데이터 업데이트
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      album: album,
      artwork: [
        { src: coverUrl || '/images/default_cover.jpg', sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    // 3. 버튼 액션 핸들러 연결
    navigator.mediaSession.setActionHandler('play', () => {
        play();
        // 필요하다면 여기서 audioRef.current?.play()를 호출해도 되지만, 
        // 보통 부모의 play() 함수 안에서 처리하는 것이 좋습니다.
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        pause();
    });

    if (next) navigator.mediaSession.setActionHandler('nexttrack', next);
    if (prev) navigator.mediaSession.setActionHandler('previoustrack', prev);

    if (seekTo && audioRef.current) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
                seekTo(details.seekTime);
            }
        });
    }

    // 재생 상태 동기화 (선택적: 일부 브라우저/기기에서 필요)
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  }, [title, artist, coverUrl, isPlaying, play, pause, next, prev]);
}