'use client';

import React from 'react';
import { useAudioCheck } from '@/hooks/useAudioCheck';
import toast from 'react-hot-toast';

import {
  Loader2, UploadCloud, Play, Pause
} from 'lucide-react';

// Props 타입 정의
interface SunoTrackItemProps {
  job: any;
  track: any;
  idx: number;
  currentTrack: any;
  isPlaying: boolean;
  playFromFooter: (track: any) => void;
  buildPlayerTrack: (job: any, track: any, idx: number) => any;
  handleGoToUpload: (job: any, track: any, idx: number) => void;
  t: any;
}

export const SunoTrackItem = ({ 
  job, track, idx, 
  currentTrack, isPlaying, 
  playFromFooter, buildPlayerTrack, handleGoToUpload, 
  t 
}: SunoTrackItemProps) => {
  
  // 1. 오디오 CDN 접근 가능 여부 체크 (Job이 done이어도 CDN 배포에 시간 걸림)
  const isAudioReady = useAudioCheck(track.audio_cdn_url, job.status === 'done');
  
  // 2. "작업 중" 상태 정의 (서버 프로세싱 중이거나 OR 오디오 파일이 아직 안 떴을 때)
  const isProcessingJob = job.status === 'processing';
  const isLoading = isProcessingJob || !isAudioReady;

  // 3. 현재 재생 중인지 체크
  const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;

  return (
    <div
      className={`relative flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${
        isLoading
          ? 'bg-zinc-900/40 border-zinc-800/50' // 로딩 중일 때: 약간 흐리게
          : isCurrentPlaying
            ? 'bg-zinc-900 border-blue-500/50 shadow-md shadow-blue-900/20' // 재생 중
            : 'bg-black/40 border-zinc-800 hover:bg-zinc-900/60' // 대기 중
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden flex-1">
        {/* Cover & Play Area */}
        <div
            className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group transition-all duration-500 ${
            !isLoading ? 'cursor-pointer shadow-lg' : 'cursor-wait'
            }`}
            onClick={() => {
                if (!isLoading) {
                    playFromFooter(buildPlayerTrack(job, track, idx));
                } else {
                    const msg = isProcessingJob ? "Creating music..." : "Finalizing audio...";
                    toast(msg, { icon: "💿" });
                }
            }}
        >
            {/* 앨범 아트 */}
            <img 
                src={track.cover_cdn_url} 
                className={`w-full h-full object-cover transition-transform duration-[2s] ease-in-out ${
                    // 로딩 중일 때는 이미지가 살짝 커지고 블러 처리됨 (작업 중 느낌)
                    isLoading ? 'scale-110 blur-[1px] opacity-80' : 'scale-100 opacity-100'
                }`} 
                alt="cover"
            />

            {/* 오버레이 (스피너 or 재생버튼) */}
            <div className={`absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
                isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } ${isCurrentPlaying ? 'opacity-100' : ''}`}>
                
                {isLoading ? (
                    // ⏳ 로딩 중 표시
                    <Loader2 className="animate-spin text-white/90" size={18}/>
                ) : (
                    // ▶️ 재생 버튼
                    isCurrentPlaying
                    ? <Pause fill="white" size={18} className="text-white drop-shadow-md" />
                    : <Play fill="white" size={18} className="text-white drop-shadow-md ml-0.5" />
                )}
            </div>
        </div>

        {/* Meta Info */}
        <div className="min-w-0 flex-1">
            <h5 className={`font-bold text-sm truncate transition-colors ${isLoading ? 'text-zinc-400' : 'text-zinc-200'}`}>
                {job.target_title || "Untitled Track"} 
                <span className="text-zinc-600 text-xs font-normal ml-2">v{idx + 1}</span>
            </h5>
            
            <div className="text-[11px] mt-0.5 truncate">
                {isProcessingJob ? (
                    // Case 1: 서버 생성 중
                    <span className="text-blue-400 flex items-center gap-1.5 animate-pulse font-medium">
                       Creating Track...
                    </span>
                ) : !isAudioReady ? (
                    // Case 2: 생성 완료됐으나 CDN 대기 중
                    <span className="text-yellow-500 flex items-center gap-1.5 animate-pulse font-medium">
                       Finalizing Audio...
                    </span>
                ) : (
                    // Case 3: 완료
                    <span className="text-zinc-500 flex items-center gap-2">
                        <span>{job.genres?.[0] || 'AI Music'}</span>
                        {track.duration && (
                            <>
                                <span className="w-0.5 h-0.5 rounded-full bg-zinc-600"/> 
                                <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                            </>
                        )}
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="ml-3 shrink-0">
        {isLoading ? (
             // 로딩 중일 땐 비활성 상태의 텍스트 박스
             <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 border border-zinc-800 rounded-lg bg-black/20">
                {isProcessingJob ? "Processing..." : "Finalizing..."}
             </div>
        ) : (
            // 완료되면 선택 버튼
            <button
                onClick={() => handleGoToUpload(job, track, idx)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-bold hover:bg-zinc-200 transition shadow-lg shadow-white/5 active:scale-95"
            >
                <UploadCloud size={14} /> 
                <span className="hidden sm:inline">{t.select}</span>
            </button>
        )}
      </div>
    </div>
  );
};