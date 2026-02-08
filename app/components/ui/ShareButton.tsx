"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Share2,
  Instagram,
  Loader2,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  ChevronRight,
  ChevronLeft,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";

// ✅ 추가: WebM duration fix + MP4 faststart remux(인스타 duration 1초 인식 문제 해결 핵심)
import fixWebmDuration from "fix-webm-duration";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

/**
 * ffmpeg.wasm 싱글톤 로드(매번 로드 방지)
 * - MP4가 fMP4(분절)로 생성되어 인스타/안드 파서가 duration을 1초로 보는 문제를
 *   "copy remux + faststart"로 안정화
 */
let _ffmpeg: FFmpeg | null = null;
let _ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (_ffmpegLoading) return _ffmpegLoading;

  const ffmpeg = new FFmpeg();
  _ffmpegLoading = (async () => {
    await ffmpeg.load();
    _ffmpeg = ffmpeg;
    return ffmpeg;
  })();

  return _ffmpegLoading;
}

/**
 * 핵심: 컨테이너만 다시 써서(재인코딩 X) 메타데이터(duration / moov 위치) 정상화
 * -c copy (재인코딩 없음)
 * -movflags +faststart (moov를 앞으로)
 * -fflags +genpts / -reset_timestamps 1 (일부 타임스탬프 호환성)
 */
async function remuxToMp4FastStart(inputBlob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  const inName = "in.bin";
  const outName = "out.mp4";

  // 남아있을 수 있는 파일 정리(실패해도 무시)
  try {
    await ffmpeg.deleteFile(inName);
  } catch {}
  try {
    await ffmpeg.deleteFile(outName);
  } catch {}

  await ffmpeg.writeFile(inName, await fetchFile(inputBlob));

  await ffmpeg.exec([
    "-fflags",
    "+genpts",
    "-i",
    inName,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-reset_timestamps",
    "1",
    outName,
  ]);

  const data = await ffmpeg.readFile(outName);
  const fixedBlob = new Blob([data as any], { type: "video/mp4" });

  // 정리
  try {
    await ffmpeg.deleteFile(inName);
  } catch {}
  try {
    await ffmpeg.deleteFile(outName);
  } catch {}

  return fixedBlob;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "insta">("main");
  const [progress, setProgress] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setTimeout(() => setMenuView("main"), 200);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Canvas 생성 ---
  const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!trackData) return null;

    const calculateFontSize = (text: string) => {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d");
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

    const element = document.createElement("div");
    const style = document.createElement("style");
    style.innerHTML = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700;900&display=swap');`;
    element.appendChild(style);

    Object.assign(element.style, {
      width: "1080px",
      height: "1920px",
      position: "fixed",
      top: "-9999px",
      left: "0px",
      backgroundColor: "#000000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontFamily: "'Noto Sans KR', sans-serif",
      zIndex: "9999",
    });

    element.innerHTML += `
      <div style="width: 640px; display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 40px;">
          <img src="/logo.png" style="width: 260px; object-fit: contain; margin-bottom: 40px;" crossorigin="anonymous"/>
          <img src="${trackData.coverUrl}" style="width: 640px; height: 640px; border-radius: 40px; box-shadow: 0 40px 80px rgba(255,255,255,0.1); object-fit: cover;" crossorigin="anonymous"/>
      </div>
      <div style="width: 640px; text-align: center; padding-bottom: 50px;"> 
          <h1 style="font-family: 'Noto Sans KR', sans-serif; font-size: ${titleFontSize}px; font-weight: 900; margin: 0; line-height: 1.1; letter-spacing: -2px; white-space: ${
            shouldWrap ? "normal" : "nowrap"
          }; word-break: keep-all;">${trackData.title}</h1>
          <p style="font-family: 'Noto Sans KR', sans-serif; font-size: 45px; color: #888; margin-top: 25px; font-weight: 700; letter-spacing: -1px; white-space: nowrap; overflow: visible; text-overflow: clip; max-width: 100%; line-height: 1.4;">${
            trackData.artist
          }</p>
      </div>
    `;

    document.body.appendChild(element);
    await document.fonts.ready;
    const canvas = await html2canvas(element, {
      useCORS: true,
      scale: 1,
      backgroundColor: "#000000",
      logging: false,
    });
    document.body.removeChild(element);
    return canvas;
  };

  const handleImageShare = async () => {
    setIsGenerating(true);
    setProgress(0);
    setMenuOpen(false);
    const toastId = toast.loading("Generating Image...");

    try {
      const canvas = await generateCanvas();
      if (!canvas) throw new Error("Canvas failed");

      canvas.toBlob(
        async (blob) => {
          if (!blob) throw new Error("Blob failed");
          const file = new File([blob], `${trackData?.title || "music"}.png`, { type: "image/png" });

          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
          } else {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `${trackData?.title}.png`;
            link.click();
            toast.success("Image downloaded!");
          }

          toast.dismiss(toastId);
          setIsGenerating(false);
        },
        "image/png"
      );
    } catch {
      toast.error("Failed.");
      setIsGenerating(false);
    }
  };

  // --- 🎥 Video Share Logic ---
  const handleVideoShare = async () => {
    if (!trackData?.audioUrl) return toast.error("Audio source missing.");
    setIsGenerating(true);
    setProgress(0);
    setMenuOpen(false);

    const RECORD_DURATION = 30; // 30초
    const FADE_DURATION = 2;
    const FPS = 30;
    const VIDEO_BITRATE = 5_000_000;
    const TARGET_WIDTH = 1080;
    const TARGET_HEIGHT = 1920;

    let progressInterval: ReturnType<typeof setInterval>;
    const startTimeStamp = Date.now();

    progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTimeStamp) / 1000;
      const p = Math.min((elapsed / RECORD_DURATION) * 100, 99);
      setProgress(p);
    }, 100);

    let audioCtx: AudioContext | null = null;
    let source: AudioBufferSourceNode | null = null;
    let animationId: number | null = null;
    let combinedStream: MediaStream | null = null;

    try {
      const originCanvas = await generateCanvas();
      if (!originCanvas) throw new Error("Canvas failed");

      const streamCanvas = document.createElement("canvas");
      streamCanvas.width = TARGET_WIDTH;
      streamCanvas.height = TARGET_HEIGHT;
      const streamCtx = streamCanvas.getContext("2d");

      const drawLoop = () => {
        if (streamCtx) {
          streamCtx.fillStyle = "#000000";
          streamCtx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
          streamCtx.drawImage(originCanvas, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        }
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
      combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

      // ✅ 갤럭시/인스타 호환 최적화: 가능한 MP4(H.264/AAC) 우선 시도
      const mimeTypes = [
        "video/mp4;codecs=avc1.4d401f,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=h264",
        "video/webm",
      ];

      let selectedMimeType = "video/webm";
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: VIDEO_BITRATE,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        clearInterval(progressInterval);
        setProgress(100);

        if (animationId) cancelAnimationFrame(animationId);
        if (audioCtx) audioCtx.close();
        if (combinedStream) combinedStream.getTracks().forEach((track) => track.stop());

        const rawBlob = new Blob(chunks, { type: selectedMimeType });

        // ✅✅✅ 핵심 수정: 인스타 duration 1초 인식 문제 해결
        // 1) webm이면 duration 패치 + 가능하면 mp4로 remux
        // 2) mp4면 fMP4/메타 문제를 faststart remux로 안정화
        let finalBlob: Blob = rawBlob;
        try {
          if (selectedMimeType.includes("webm")) {
            // WebM duration patch(ms)
            finalBlob = await fixWebmDuration(rawBlob, RECORD_DURATION * 1000);

            // 인스타 업로드 목적이면 mp4가 더 안정적이라 remux 시도
            // (환경/코덱에 따라 실패할 수 있어 실패 시 webm 유지)
            try {
              finalBlob = await remuxToMp4FastStart(finalBlob);
            } catch {
              // noop: 그대로 webm 유지
            }
          } else {
            // MP4면 remux로 moov/metadata 정상화(재인코딩 없음)
            finalBlob = await remuxToMp4FastStart(rawBlob);
          }
        } catch {
          finalBlob = rawBlob;
        }

        // 최종은 mp4로 저장/공유(인스타 최우선)
        const fileName = `${trackData.title}_clip.mp4`;
        const file = new File([finalBlob], fileName, { type: "video/mp4" });

        const triggerDownload = () => {
          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Saved to device!", { icon: "💾" });
        };

        setTimeout(async () => {
          if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: trackData.title,
                text: `Check out ${trackData.title} by ${trackData.artist}!`,
              });
              toast.success("Shared successfully!", { icon: "✨" });
            } catch {
              triggerDownload();
            }
          } else {
            triggerDownload();
          }

          setIsGenerating(false);
          setProgress(0);
        }, 100);
      };

      source.start(0);
      recorder.start();

      setTimeout(() => {
        if (recorder.state === "recording") {
          combinedStream?.getTracks().forEach((track) => track.stop());
          recorder.stop();
        }
      }, RECORD_DURATION * 1000);
    } catch {
      clearInterval(progressInterval);
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close();
      toast.error("Generation failed.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/share/${assetId}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
    setMenuOpen(false);
  };

  const baseClass = className || "bg-zinc-800 hover:bg-zinc-700";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
            setMenuView("main");
          }}
          disabled={isGenerating}
          className={`w-full h-full rounded-full flex items-center justify-center transition-all shadow-lg ${baseClass} ${
            menuOpen ? "ring-2 ring-white/20 bg-zinc-700" : ""
          }`}
        >
          {isGenerating ? (
            <Loader2 size={size} className="animate-spin text-zinc-400" />
          ) : (
            <Share2 size={size} className="text-white" />
          )}
        </button>

        {menuOpen && !isGenerating && (
          <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 w-40 animate-in fade-in slide-in-from-top-2 origin-top-right">
            {menuView === "main" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNativeShare();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left"
                >
                  <LinkIcon size={14} className="text-zinc-500" /> Copy Link
                </button>
                <div className="h-px bg-zinc-800 w-full" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuView("insta");
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Instagram size={14} className="text-pink-500" /> Create Post
                  </div>
                  <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                </button>
              </>
            )}

            {menuView === "insta" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuView("main");
                  }}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition w-full text-left mb-1"
                >
                  <ChevronLeft size={12} /> Back
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImageShare();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left"
                >
                  <ImageIcon size={14} className="text-blue-400" /> Image Only
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVideoShare();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition w-full text-left"
                >
                  <Video size={14} className="text-red-400" /> Video (30s)
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isGenerating && progress > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
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
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">Wait a moment...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareButton;
