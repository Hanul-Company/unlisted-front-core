'use server';

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// ✅ 단일 곡이 아닌, 곡 리스트를 받는 스키마로 변경
const playlistSchema = z.object({
    tracks: z.array(
        z.object({
            artist: z.string().describe("Artist name"),
            title: z.string().describe("Song title"),
        })
    ).describe("List of songs found in the image (max 10)"),
});

export async function analyzePlaylistImage(formData: FormData) {
    const file = formData.get('image') as File;

    if (!file) {
        return { success: false, error: "No image provided" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const result = await generateObject({
            model: openai('gpt-4o'), // Vision 모델 필수
            schema: playlistSchema,
            messages: [
                {
                    role: 'system',
                    content: 'You are a music data extractor. Analyze the playlist screenshot. Extract ALL visible songs (Artist & Title). Return a maximum of 10 songs. If artist is missing, try to infer or leave empty.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract list of songs from this image (up to 10 items).' },
                        { type: 'image', image: dataUrl }
                    ]
                }
            ]
        });

        // tracks 배열 반환
        return {
            success: true,
            data: result.object.tracks // [{title:..., artist:...}, ...]
        };

    } catch (error) {
        console.error("OpenAI Analysis Error:", error);
        return { success: false, error: "Failed to analyze image." };
    }
}