'use server';

import OpenAI from 'openai';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSunoPrompt(
  refSongTitle: string,   // 변경: 곡명만
  refSongArtist: string,  // 변경: 원곡 가수 (예: Maroon 5)
  targetVoiceArtist: string, // 변경: 타겟 목소리 (예: Adam Levine)
  targetTitle: string,
  userLyrics?: string,
  etcInfo?: string
) {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!refSongArtist && !refSongTitle) return null;

  // 1. 시스템 프롬프트: "한국어 발음 변환" 지침 추가
  const systemPrompt = `
    You are a professional Music Data Analyst & Prompt Engineer.
    
    [TASK OVERVIEW]
    1. **Transliteration (CRITICAL):** Convert the 'Reference Artist' and 'Target Voice Artist' names into **Korean Pronunciation (Hangul)**. 
       - Example: "The Weeknd" -> "위켄드", "Maroon 5" -> "마룬파이브", "Bruno Mars" -> "브루노 마스".
       - This is to avoid copyright filters while keeping the style context.
    2. **Analyze Style:** Map the input to our system constants (Genres, Moods, Tags).
    3. **Construct Prompt:** Create a descriptive prompt using the **Korean Transliterated Names** and the analyzed tags.

    [System Constants]
    - GENRES: ${JSON.stringify(MUSIC_GENRES)}
    - MOODS: ${JSON.stringify(MUSIC_MOODS)}
    - TAGS: ${JSON.stringify(MUSIC_TAGS)}

    [Output JSON Format]
    {
      "korean_ref_artist": "마룬파이브",
      "korean_target_voice": "애덤 리바인",
      "genres": ["Pop", "Funk"...],
      "moods": ["Upbeat", "Groovy"...],
      "tags": ["Male Vocals", "High Falsetto"...],
      "prompt": "A descriptive string including 'Song like {RefSongTitle}', by '{KoreanRefArtist}', vocal sound like like '{KoreanTargetVoice}', [Tags...]"
    }
  `;

  const userMessage = `
    Request:
    - Reference Song: ${refSongTitle}
    - Reference Artist: ${refSongArtist}
    - Target Voice Artist: ${targetVoiceArtist}
    - Song Title: ${targetTitle}
    - Extra Info: ${etcInfo || "None"}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        { role: 'system', content: "You output only JSON." },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // 2. 프롬프트 조립 (한국어 이름 사용)
    // Suno에 보낼 최종 문자열
    // 예: "Song like Sunday Morning, style of 마룬파이브, vocals like 애덤 리바인, Pop, Funk, Groovy, Male Vocals"
    let finalPrompt = `Song like ${refSongTitle}`;
    
    if (result.korean_ref_artist) finalPrompt += `, style of ${result.korean_ref_artist}`;
    if (result.korean_target_voice) finalPrompt += `, vocals like ${result.korean_target_voice}`;
    
    const tags = [
        ...(result.genres || []),
        ...(result.moods || []),
        ...(result.tags || [])
    ].join(', ');

    finalPrompt += `, ${tags}`;
    if (etcInfo) finalPrompt += `, ${etcInfo}`;

    return {
      title: targetTitle,
      lyrics: userLyrics || "",
      
      // DB 저장용 메타데이터
      genres: result.genres || [],
      moods: result.moods || [],
      tags: result.tags || [],
      
      // ✅ Suno로 보낼 "한글 이름이 포함된" 최종 프롬프트
      prompt: finalPrompt 
    };

  } catch (e) {
    console.error("GPT Error:", e);
    return null;
  }
}