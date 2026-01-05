'use server';

import OpenAI from 'openai';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateSunoPrompt(
  refSongTitle: string,
  refSongArtist: string,
  targetVoice: string,
  targetTitle: string,
  userLyrics?: string,
  etcInfo?: string
) {
  console.log("🚀 [Action Start] generateSunoPrompt Called");
  
  // 1. API Key 확인
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY is missing in .env");
    return null;
  }

  // 2. 필수값 확인
  if (!refSongArtist && !refSongTitle) {
    console.error("❌ Error: Missing Reference Info");
    return null;
  }

  console.log(`📝 Inputs: ${refSongTitle} / ${refSongArtist} / ${targetVoice}`);

  const systemPrompt = `
    You are a professional Music Data Analyst.
    
    [TASK]
    1. **Transliteration:** Convert 'Reference Artist' and 'Target Voice' to **Korean Pronunciation (Hangul)**.
       - If they are already Korean, keep them.
       - e.g., "The Weeknd" -> "위켄드", "Maroon 5" -> "마룬파이브".
    2. **Style Analysis:** Select best matching tags from constants.
    3. **Prompt Construction:** Combine them into a descriptive string.

    [CONSTANTS]
    - GENRES: ${JSON.stringify(MUSIC_GENRES)}
    - MOODS: ${JSON.stringify(MUSIC_MOODS)}
    - TAGS: ${JSON.stringify(MUSIC_TAGS)}

    [OUTPUT JSON FORMAT]
    {
      "korean_ref_artist": "Name in Hangul",
      "korean_target_voice": "Name in Hangul",
      "genres": ["Genre1", "Genre2", "Genre3"],
      "moods": ["Mood1", "Mood2", "Mood3"],
      "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5", "Tag6"],
      "prompt_style_description": "Descriptive string of style/vibe ONLY (Do not include song title here)"
    }
  `;

  const userMessage = `
    Analyze this request:
    - Ref Song: ${refSongTitle}
    - Ref Artist: ${refSongArtist}
    - Target Voice: ${targetVoice}
    - Extra Vibe: ${etcInfo || "None"}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const rawContent = response.choices[0].message.content;
    console.log("🤖 GPT Raw Response:", rawContent); // 디버깅용 로그

    if (!rawContent) throw new Error("Empty response from GPT");

    const result = JSON.parse(rawContent);
    
    // 3. 데이터 정제 및 Fallback (한글 변환 실패 시 원본 사용)
    const finalRefArtist = result.korean_ref_artist || refSongArtist;
    const finalTargetVoice = result.korean_target_voice || targetVoice;

    // 4. 최종 프롬프트 조립 (Suno 포맷 최적화)
    // 예: "Song like Sunday Morning, style of 마룬파이브, vocals like 애덤 리바인, Pop, Funk..."
    let finalPrompt = `Song like ${refSongTitle}`;
    
    if (finalRefArtist) finalPrompt += `, style of ${finalRefArtist}`;
    if (finalTargetVoice) finalPrompt += `, vocals like ${finalTargetVoice}`;
    
    // 태그 결합
    const allTags = [
        ...(result.genres || []),
        ...(result.moods || []),
        ...(result.tags || [])
    ].join(', ');

    if (allTags) finalPrompt += `, ${allTags}`;
    if (result.prompt_style_description) finalPrompt += `, ${result.prompt_style_description}`;
    if (etcInfo) finalPrompt += `, ${etcInfo}`;

    console.log("✅ Final Prompt Generated:", finalPrompt);

    return {
      title: targetTitle,
      lyrics: userLyrics || "",
      
      // DB 저장용 메타데이터 (배열이 없으면 빈 배열로)
      genres: result.genres || [],
      moods: result.moods || [],
      tags: result.tags || [],
      
      prompt: finalPrompt 
    };

  } catch (e) {
    console.error("🔥 Generate Prompt Error:", e);
    // 에러 발생 시 null을 리턴하면 프론트에서 "Prompt generation failed" 처리됨
    return null;
  }
}