"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Share2, Instagram, Loader2, Image as ImageIcon, Video, Link as LinkIcon, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

interface ShareButtonProps {
  assetId: string;
  trackData?: {
    title: string;
    artist: string;
    coverUrl: string;
    audioUrl?: string;
  };
  className?: string;
  size?: number;
}

const ShareButton = ({ assetId, trackData, className = "", size = 20 }: ShareButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // 메뉴 열림 상태
  const [menuView, setMenuView] = useState<'main' | 'insta'>('main'); // 메뉴 단계 (메인 vs 인스타)
  const [progress, setProgress] = useState(0); 
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기 & 상태 초기화
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setTimeout(() => setMenuView('main'), 200); // 애니메이션 후 초기화
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- [로직 유지] Canvas 생성 ---
  const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!trackData) return null;
    const calculateFontSize = (text: string) => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return { size: 80, wrap: false };
        const maxW = 640;
        const baseSize = 80;
        ctx.font = `900 ${baseSize}px 'Noto Sans KR', sans-serif`;
        const textWidth = ctx.measureText(text).width;
        if (textWidth <= maxW) return { size: baseSize, wrap: false };
        const newSize = Math.floor(baseSize * (maxW / textWidth));
        if (newSize < 45) return { size: 55, wrap: true };
        return { size: newSize, wrap: false };
    };

    const { size: titleFontSize, wrap: shouldWrap } = calculateFontSize(trackData.title);
    const element = document.createElement('div');
    const style = document.createElement('style');
    style.innerHTML = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;900&display=swap');`;
    element.appendChild(style);

    Object.assign(element.style, {
      width: '1080px', height: '1920px', position: 'fixed', top: '-9999px', left: '0px',
      backgroundColor: '#000000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: 'white',
      fontFamily: "'Noto Sans KR', sans-serif", zIndex: '9999',
    });
    
    element.innerHTML += `
      <div style="width: 640px; display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 40px;">
          <img src="/logo.png" style="width: 260px; object-fit: contain; margin-bottom: 40px;" crossorigin="anonymous"/>
          <img src="${trackData.coverUrl}" style="width: 640px; height: 640px; border-radius: 40px; box-shadow: 0 40px 80px rgba(255,255,255,0.1); object-fit: cover;" crossorigin="anonymous"/>
      </div>
      <div style="width: 640px; text-align: center; padding-bottom: 50px;"> 
          <h1 style="font-family: 'Noto Sans KR', sans-serif; font-size: ${titleFontSize}px; font-weight: 900; margin: 0; line-height: 1.1; letter-spacing: -2px; white-space: ${shouldWrap ? 'normal' : 'nowrap'}; word-break: keep-all;">${trackData.title}</h1>
          <p style="font-family: 'Noto Sans KR', sans-serif; font-size: 45px; color: #888; margin-top: 25px; font-weight: 700; letter-spacing: -1px; white-space: nowrap; overflow: visible; text-overflow: clip; max-width: 100%; line-height: 1.4;">${trackData.artist}</p>
      </div>
    `;
    
    document.body.appendChild(element);
    await document.fonts.ready; 
    const canvas = await html2canvas(element, { useCORS: true, scale: 1, backgroundColor: '#000000', logging: false });
    document.body.removeChild(element);
    return canvas;
  };

  // --- [로직 유지] Image Share ---
  const handleImageShare = async () => {
    setIsGenerating(true);
    setProgress(0);
    setMenuOpen(false); // 메뉴 닫기
    const toastId = toast.loading("Generating Image...");

    try {
        const canvas = await generateCanvas();
        if (!canvas) throw new Error("Canvas failed");

        canvas.toBlob(async (blob) => {
            if (!blob) throw new Error("Blob failed");
            const file = new File([blob], `${trackData?.title || 'music'}.png`, { type: 'image/png' });
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
            } else {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${trackData?.title}.png`;
                link.click();
                toast.success("Image downloaded!");
            }
            toast.dismiss(toastId);
            setIsGenerating(false);
        }, 'image/png');
    } catch (e) {
        toast.error("Failed.");
        setIsGenerating(false);
    }
  };

  // --- [로직 유지] Video Share (Optimized) ---
  const handleVideoShare = async () => {
    if (!trackData?.audioUrl) return toast.error("Audio source missing.");
    setIsGenerating(true);
    setProgress(0);
    setMenuOpen(false);

    const START_OFFSET = 45;    
    const RECORD_DURATION = 30; 
    const FADE_DURATION = 2;    
    const FPS = 24;             
    const VIDEO_BITRATE = 3000000; 
    const TARGET_WIDTH = 720;
    const TARGET_HEIGHT = 1280;

    let progressInterval: NodeJS.Timeout;
    const startTimeStamp = Date.now();
    
    progressInterval = setInterval(() => {
        const elapsed = (Date.now() - startTimeStamp) / 1000;
        const p = Math.min((elapsed / RECORD_DURATION) * 100, 99);
        setProgress(p);
    }, 100);

    let audioCtx: AudioContext | null = null;
    let source: AudioBufferSourceNode | null = null;
    let animationId: number | null = null;

    try {
        const originCanvas = await generateCanvas(); 
        if (!originCanvas) throw new Error("Canvas failed");

        const streamCanvas = document.createElement('canvas');
        streamCanvas.width = TARGET_WIDTH;
        streamCanvas.height = TARGET_HEIGHT;
        const streamCtx = streamCanvas.getContext('2d');

        const drawLoop = () => {
            if (streamCtx) streamCtx.drawImage(originCanvas, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
            animationId = requestAnimationFrame(drawLoop);
        };
        drawLoop();

        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(trackData.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = audioCtx.createGain();
        const dest = audioCtx.createMediaStreamDestination();

        const startTime = audioCtx.currentTime;
        const endTime = startTime + RECORD_DURATION;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + FADE_DURATION);
        gainNode.gain.setValueAtTime(1, endTime - FADE_DURATION);
        gainNode.gain.linearRampToValueAtTime(0, endTime);

        source.connect(gainNode);
        gainNode.connect(dest);

        const canvasStream = streamCanvas.captureStream(FPS);
        const combinedStream = new MediaStream([ ...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks() ]);
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm;codecs=vp9';
        const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            clearInterval(progressInterval);
            setProgress(100);

            if (animationId) cancelAnimationFrame(animationId);
            if (source) try { source.stop(); } catch(e) {}
            if (audioCtx) audioCtx.close();

            const blob = new Blob(chunks, { type: mimeType });
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const fileName = `${trackData.title}_clip.${ext}`;
            const file = new File([blob], fileName, { type: mimeType });

            // ✅ [기능 분리] 다운로드 함수 (공유 실패 시에만 실행)
            const triggerDownload = () => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a); 
                a.click(); 
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Saved to device (Share skipped)", { icon: '💾' });
            };

            // 🚀 [핵심 변경] 저장보다 "공유"를 최우선으로 실행
            // 모바일에서는 이 코드가 실행되면 즉시 하단에서 공유 시트가 올라옵니다.
            setTimeout(async () => {
                if (navigator.share && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: trackData.title,
                            text: `Check out ${trackData.title} by ${trackData.artist} on Traverse!`,
                        });
                        // 공유 성공 시
                        toast.success("Shared successfully!", { icon: '✨' });
                    } catch (err) { 
                        // 1. 사용자가 공유 창을 닫았거나(AbortError)
                        // 2. 권한 문제 등으로 실패했을 때 -> 다운로드 실행
                        console.log('Share canceled or failed, downloading instead...');
                        triggerDownload();
                    }
                } else {
                    // PC이거나 공유 API 미지원 브라우저 -> 바로 다운로드
                    triggerDownload();
                }
                
                // 정리 및 UI 초기화
                setIsGenerating(false);
                setProgress(0);
            }, 500); // 0.5초 딜레이 (UI가 100% 도달한 것을 보여주기 위함)
        };

        source.start(0, START_OFFSET); 
        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, RECORD_DURATION * 1000);

    } catch (e: any) {
        clearInterval(progressInterval);
        if (animationId) cancelAnimationFrame(animationId);
        if (audioCtx) audioCtx.close();
        toast.error("Generation failed.");
        setIsGenerating(false);
        setProgress(0);
    }
  };

  // --- [로직 유지] Link Share ---
  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied!');
    setMenuOpen(false);
  };

  const baseClass = className || 'bg-zinc-800 hover:bg-zinc-700';

  return (
    <>
        <div className="relative" ref={menuRef}>
            {/* ✅ 통합된 Single Share Button */}
            <button 
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); setMenuView('main'); }}
                disabled={isGenerating}
                className={`w-full h-full rounded-full flex items-center justify-center transition-all shadow-lg ${baseClass} ${menuOpen ? 'ring-2 ring-white/20 bg-zinc-700' : ''}`}
            >
                {isGenerating ? <Loader2 size={size} className="animate-spin text-zinc-400"/> : <Share2 size={size} className="text-white" />}
            </button>

            {/* ✅ 통합 드롭다운 메뉴 */}
            {menuOpen && !isGenerating && (
                <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 w-40 animate-in fade-in slide-in-from-top-2 origin-top-right">
                    <div className="absolute -top-1.5 right-3 w-3 h-3 bg-zinc-900 border-t border-l border-zinc-700 rotate-45"></div>

                    {/* View 1: Main Menu */}
                    {menuView === 'main' && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handleNativeShare(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left">
                                <LinkIcon size={14} className="text-zinc-500"/> Copy Link
                            </button>
                            <div className="h-px bg-zinc-800 w-full"/>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setMenuView('insta'); }} 
                                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <Instagram size={14} className="text-pink-500"/> Create Post
                                </div>
                                <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400"/>
                            </button>
                        </>
                    )}

                    {/* View 2: Instagram/Media Sub Menu */}
                    {menuView === 'insta' && (
                        <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setMenuView('main'); }} 
                                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition w-full text-left mb-1"
                            >
                                <ChevronLeft size={12}/> Back
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleImageShare(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left">
                                <ImageIcon size={14} className="text-blue-400"/> Image Only
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleVideoShare(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left">
                                <Video size={14} className="text-red-400"/> Video (30s)
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* Progress Overlay (유지) */}
        {isGenerating && progress > 0 && (
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="w-64 flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-pink-500 animate-spin"></div>
                        <Download size={24} className="absolute inset-0 m-auto text-white" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-black text-white tracking-tight">{Math.round(progress)}%</span>
                        <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Creating Content...</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">Please wait a moment</p>
                </div>
            </div>
        )}
    </>
  );
};

export default ShareButton;