import { useState, useEffect } from 'react';

export function useAudioCheck(url: string, isJobDone: boolean) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. 잡이 완료되지 않았거나 URL이 없으면 체크하지 않음
    if (!isJobDone || !url) return;

    let intervalId: NodeJS.Timeout;

    const checkAudio = async () => {
      try {
        // 방법 A: fetch HEAD 요청 (CORS 설정이 되어 있어야 함)
        // const res = await fetch(url, { method: 'HEAD' });
        // if (res.ok) { setIsReady(true); return true; }
        
        // 방법 B: Audio 객체로 로딩 시도 (CORS 문제 덜함, 가장 확실함)
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          setIsReady(true);
          clearInterval(intervalId); // 성공하면 반복 중단
        };
        audio.onerror = () => {
          // 아직 준비 안됨, 다음 텀에 재시도
        };
        // 살짝 로드 시도
        audio.load(); 
      } catch (e) {
        // 에러 무시 (재시도)
      }
    };

    // 최초 1회 실행
    checkAudio();

    // 준비 안됐으면 3초마다 체크 (최대 2분간 체크 등 제한을 둘 수도 있음)
    if (!isReady) {
      intervalId = setInterval(checkAudio, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [url, isJobDone, isReady]);

  return isReady;
}