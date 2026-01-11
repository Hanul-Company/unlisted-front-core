'use client';

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

// 트랙 타입 정의 (공통 사용)
export type Track = {
  id: number;
  title: string;
  artist_name: string;
  audio_url: string;
  cover_image_url: string | null;
  created_at: string;
  expires_at?: string | null; // Library에서 넘어올 때 사용
  is_minted?: boolean;
  token_id?: number | null;
  uploader_address?: string;
  melody_hash: string | null;
  genre?: string[] | string | null;
  // ✅ [추가] Library 페이지 오류 해결을 위해 아래 두 줄 추가
  mint_error?: string | null;
  duplicate_of_track_id?: number | null;
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
  lyrics?: string | null; // ✅ 가사 필드 추가
};

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[]; // 재생 대기열
  
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  
  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void; // 트랙 재생 (큐 교체 가능)
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  clearPlayer: () => void;
  
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]); // 큐
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');

  // 오디오 이벤트 리스너 연결
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
        if (repeatMode === 'one') {
            audio.currentTime = 0;
            audio.play();
        } else {
            next();
        }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [queue, currentTrack, repeatMode]);

  // 재생 상태 동기화
    useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const playAudio = async () => {
        try {
            // 소스 변경이 필요할 때만 load 호출
            if (audio.src !== currentTrack.audio_url) {
                audio.src = currentTrack.audio_url;
                audio.load(); // 새로운 로드 요청 시작
            }

            if (isPlaying) {
                // play()는 Promise를 반환합니다.
                // 이전 요청이 있다면 기다리거나 취소되는 것을 감안해야 합니다.
                await audio.play();
            } else {
                audio.pause();
            }
        } catch (error: any) {
            // AbortError(새로운 로드 요청으로 인한 중단)는 무시해도 됩니다.
            if (error.name !== 'AbortError') {
                console.error("Playback error:", error);
            }
        }
    };

    playAudio();

  }, [currentTrack, isPlaying]);

  useEffect(() => {
      if(audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Actions
  const playTrack = (track: Track, newQueue?: Track[]) => {
      if (newQueue) setQueue(newQueue);
      // 큐가 없으면 현재 곡 하나만 큐에 넣음
      else if (queue.length === 0) setQueue([track]);
      
      setCurrentTrack(track);
      setIsPlaying(true);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const next = () => {
      if (queue.length === 0) return setIsPlaying(false);
      const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
      let nextIndex = 0;

      if (isShuffle) {
          nextIndex = Math.floor(Math.random() * queue.length);
      } else {
          if (currentIndex === queue.length - 1 && repeatMode === 'off') {
              setIsPlaying(false);
              return;
          }
          nextIndex = (currentIndex + 1) % queue.length;
      }
      setCurrentTrack(queue[nextIndex]);
      setIsPlaying(true);
  };

  const prev = () => {
      if (queue.length === 0) return;
      const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
      if (audioRef.current && audioRef.current.currentTime > 3) {
          audioRef.current.currentTime = 0;
          return;
      }
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      setCurrentTrack(queue[prevIndex]);
      setIsPlaying(true);
  };

  const seek = (time: number) => {
      if (audioRef.current) audioRef.current.currentTime = time;
      setCurrentTime(time);
  };

  const clearPlayer = () => {
    if (audioRef.current) {
        audioRef.current.pause();       // 재생 중지
        audioRef.current.currentTime = 0; // 시간 초기화
        // audioRef.current.src = "";   // (선택) 소스까지 날려버리면 확실합니다.
    }
    setIsPlaying(false);
    setCurrentTrack(null); // 트랙을 없애면 UI도 사라짐
    setQueue([]);
  };

  const toggleShuffle = () => setIsShuffle(!isShuffle);
  const toggleRepeat = () => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');

  return (
    <PlayerContext.Provider value={{
        currentTrack, isPlaying, queue, currentTime, duration, volume, isMuted,
        isShuffle, repeatMode,
        playTrack, togglePlay, next, prev, seek, setVolume, toggleMute: () => setIsMuted(!isMuted),
        toggleShuffle, toggleRepeat,clearPlayer,
        audioRef
    }}>
        {/* ✅ 전역 Audio 태그 */}
        <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />
        {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};