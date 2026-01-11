'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { generateSunoPrompt } from '@/app/actions/generate-suno-prompt';
import { useActiveAccount } from "thirdweb/react";
import HeaderProfile from '../components/HeaderProfile';
import MobilePlayer from '../components/MobilePlayer'; 
import { Link } from "../../lib/i18n";
import { useAudioCheck } from '@/hooks/useAudioCheck';
import toast from 'react-hot-toast';

import {
  Loader2, Mic2, Disc, UploadCloud, Play, Pause, Trash2,
  Clock, RefreshCw, AlertCircle, Wand2, Menu, Quote,
  ChevronDown, ChevronUp, Globe, Sparkles, Layers,
  SkipBack, SkipForward, Volume2, VolumeX, Minimize2, Maximize2, X
} from 'lucide-react';

// Props 타입 정의 (필요한 것만)
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
  
  // ✅ 여기서 가용성 체크! (Job은 Done이지만, 파일은 아직일 수 있음)
  const isAudioReady = useAudioCheck(track.audio_cdn_url, job.status === 'done');

  return (
    <div
      className={`relative flex items-center gap-4 p-3 rounded-xl border transition ${
        currentTrack?.audio_url === track.audio_cdn_url && isPlaying
          ? 'bg-zinc-800 border-green-500/50'
          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {/* Cover & Play Area */}
      <div
        className={`w-14 h-14 rounded-lg overflow-hidden relative shrink-0 shadow-lg ${
           isAudioReady ? 'cursor-pointer group' : 'cursor-wait opacity-60'
        }`}
        onClick={() => {
            if (isAudioReady) {
                playFromFooter(buildPlayerTrack(job, track, idx));
            } else {
                toast("Audio is finalizing... Please wait.", { icon: "⏳" });
            }
        }}
      >
        <img src={track.cover_cdn_url} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] transition-opacity duration-300">
            {!isAudioReady ? (
                // ⏳ 로딩 중 표시
                <Loader2 className="animate-spin text-white/80" size={20}/>
            ) : (
                // ▶️ 재생 버튼 (Hover 시 또는 재생 중일 때 보임)
                <div className={`opacity-0 group-hover:opacity-100 transition ${currentTrack?.audio_url === track.audio_cdn_url && isPlaying ? 'opacity-100' : ''}`}>
                    {currentTrack?.audio_url === track.audio_cdn_url && isPlaying
                    ? <Pause fill="white" size={20} />
                    : <Play fill="white" size={20} />}
                </div>
            )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex-1 min-w-0">
        <h5 className="font-bold text-sm text-white truncate">
          {job.target_title} <span className="text-zinc-600 text-xs font-normal">v{idx + 1}</span>
        </h5>
        <div className="text-[11px] text-zinc-500 mt-0.5">
            {!isAudioReady ? (
                <span className="text-yellow-500 flex items-center gap-1 animate-pulse font-bold">
                   Finalizing Audio...
                </span>
            ) : (
                <span>AI Generated • Ready</span>
            )}
        </div>
      </div>

      {/* Action Button */}
      <button
        disabled={!isAudioReady} // 준비 안됐으면 선택 불가
        onClick={() => handleGoToUpload(job, track, idx)}
        className={`px-4 py-2 text-xs font-bold rounded-lg transition shadow-md flex items-center gap-2 ${
            isAudioReady 
            ? 'bg-white text-black hover:bg-zinc-200' 
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        <UploadCloud size={14} /> {t.select}
      </button>
    </div>
  );
};