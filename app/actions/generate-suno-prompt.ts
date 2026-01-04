'use server';

import OpenAI from 'openai';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSunoPrompt(
  refTrack: string,  // 예: Ditto
  refArtist: string, // 예: NewJeans
  targetTitle: string,
  userLyrics?: string,
  etcInfo?: string
) {
  // 1. API 키 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY is missing.");
    return null;
  }

  if (!refArtist && !refTrack) return null;

  // 2. GPT 프롬프트 구성 (객관식 문제 풀이 느낌)
  const systemPrompt = `
    You are a professional Musicologist AI.
    Analyze the requested style based on the Reference Track/Artist and map them to our system constants.

    [SYSTEM CONSTANTS]
    - GENRES: ${JSON.stringify(MUSIC_GENRES)}
    - MOODS: ${JSON.stringify(MUSIC_MOODS)}
    - TAGS: ${JSON.stringify(MUSIC_TAGS)}

    [USER INPUT]
    - Ref Track: ${refTrack}
    - Ref Artist: ${refArtist}
    - Extra Info: ${etcInfo || "None"}

    [TASK]
    1. Select top 2-3 GENRES from the list that match the input.
    2. Select top 2-3 MOODS from the list.
    3. Select top 5-7 TAGS (Vocal style, instruments, production) from the list.
    4. **NO Artist Names** in the output tags.

    [OUTPUT JSON FORMAT]
    {
      "genres": ["Pop", "R&B"...],
      "moods": ["Chill", "Dreamy"...],
      "tags": ["Female Vocals", "Soft", "Synth"...],
      "title": "${targetTitle}" 
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 빠르고 저렴함
      messages: [
        { role: 'system', content: "You output only JSON." },
        { role: 'user', content: systemPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5, // 창의성보다는 정확한 매칭 중요
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // 3. 최종 Suno용 프롬프트 스트링 조립
    // 구조: [Genre], [Mood], [Tags], [Extra Info]
    // 예: "Pop, R&B, Chill, Dreamy, Female Vocals, Soft, High quality"
    const finalTags = [
        ...(result.genres || []),
        ...(result.moods || []),
        ...(result.tags || [])
    ];
    
    // 사용자의 etcInfo가 있으면 뒤에 붙여줌 (단, 영어로 번역하거나 그대로 사용)
    let promptString = finalTags.join(", ");
    if (etcInfo) {
        promptString += `, ${etcInfo}`;
    }

    return {
      title: result.title || targetTitle,
      lyrics: userLyrics || "", // 가사는 없으면 빈값 (Suno 자동생성)
      
      // ✅ DB에 저장할 메타데이터 (배열)
      genres: result.genres || [],
      moods: result.moods || [],
      tags: result.tags || [],
      
      // ✅ 워커가 바로 가져다 쓸 최종 프롬프트 문자열
      prompt: promptString 
    };

  } catch (e) {
    console.error("GPT Analysis Error:", e);
    return null;
  }
}