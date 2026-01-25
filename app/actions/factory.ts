'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// ✅ AI가 반환할 데이터의 구조를 정의합니다 (Zod Schema)
const trackSchema = z.object({
    artist: z.string().describe("The name of the artist, singer, or band"),
    title: z.string().describe("The title of the song or track"),
});

export async function analyzePlaylistImage(formData: FormData) {
    const file = formData.get('image') as File;

    if (!file) {
        return { success: false, error: "No image provided" };
    }

    try {
        // 1. 이미지를 Base64 Data URL로 변환
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg'; // 기본값 설정
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // 2. OpenAI GPT-4o (Vision) 호출
        // generateObject를 사용하면 AI가 무조건 JSON 포맷으로 답하도록 강제합니다.
        const result = await generateObject({
            model: openai('gpt-4o'), // Vision 기능이 있는 모델 필수 (gpt-4o 추천)
            schema: trackSchema,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert music data extractor. Analyze the screenshot of a music player (Spotify, Apple Music, YouTube Music, etc.) and extract the song title and artist name. If multiple songs are visible, prioritize the one that appears to be currently playing or is the main focus.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract the artist and song title from this image.' },
                        { type: 'image', image: dataUrl }
                    ]
                }
            ]
        });

        // 3. 성공 결과 반환
        return {
            success: true,
            data: result.object // { artist: "The Weeknd", title: "Starboy" } 형태
        };

    } catch (error) {
        console.error("OpenAI Analysis Error:", error);
        return { success: false, error: "Failed to analyze image. Please try again." };
    }
}

// ------------------------------------------------------------------

// DB 저장 및 보상 지급 (기존 로직 유지 or 실제 DB 연동)
export async function submitTrainingData(data: any) {
    console.log("Saving training data to DB:", data);

    // TODO: 여기에 실제 Supabase Insert 로직을 넣으시면 됩니다.
    // await supabase.from('training_data').insert(...)

    // 시뮬레이션 딜레이
    await new Promise(r => setTimeout(r, 1000));

    return { success: true, reward: 10 };
}