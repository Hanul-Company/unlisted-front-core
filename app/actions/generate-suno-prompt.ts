'use server';

import OpenAI from 'openai';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type VocalTags = {
  race?: 'Asian' | 'Black' | 'White';
  gender?: 'Male' | 'Female';
  texture?: 'Clean' | 'Raspy' | 'Breathy' | 'Belting' | 'Whisper';
  emotion?: 'Sexy' | 'Cute' | 'Sad' | 'Energetic';
  ageFeel?: 'Youthful' | 'Mature' | 'Aged';
  accent?: 'American' | 'British' | 'Korean' | 'Japanese' | 'Spanish' | 'African';
};

export type RefSongMeta = {
  genre?: string;
  releaseYear?: string;
  country?: string;
  isExplicit?: boolean;
  durationMs?: number;
};

export async function generateSunoPrompt(
  refSongTitle: string,
  refSongArtist: string,
  targetVoice: string,
  targetTitle: string,
  vocalTags?: VocalTags,
  userLyrics?: string,
  etcInfo?: string,
  refSongMeta?: RefSongMeta
) {
  console.log("🚀 [Action Start] generateSunoPrompt Called");

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY is missing in .env");
    return null;
  }

  if (!refSongArtist && !refSongTitle) {
    console.error("❌ Error: Missing Reference Info");
    return null;
  }

  console.log(`📝 Inputs: ${refSongTitle} by ${refSongArtist} / Voice: ${targetVoice}`);

  // 🔥 [핵심 변경] Two-Track 전략이 적용된 프롬프트 엔진
  const systemPrompt = `
    You are an elite Music Producer, Audio Engineer, and a master Prompt Engineer for Suno AI.
    Your objective is to execute a "Two-Track" analysis for our music platform.

    [TWO-TRACK STRATEGY]
    - **Track A (db_standard_tags):** For our database recommendation algorithm. You MUST select tags STRICTLY AND ONLY from the provided [CONSTANTS]. Do not invent new tags here.
    - **Track B (suno_creative_tags):** For the Suno AI generator. Be hyper-specific, free-form, and sonic-focused. Invent rich descriptions (e.g., "80s analog synth", "heavy sub-bass", "breathy falsetto", "raspy soul belting").

    [CORE TASK]
    1. Analyze the sonic identity of "${refSongTitle}" by "${refSongArtist}".
    2. Analyze the "Target Voice Artist" and "User Vocal Tags".
    3. Output the result separating the standard DB tags from the creative generative tags.

    [CONSTANTS TO CHOOSE FROM (FOR TRACK A ONLY)]
    - GENRES: ${JSON.stringify(MUSIC_GENRES)}
    - MOODS: ${JSON.stringify(MUSIC_MOODS)}
    - TAGS: ${JSON.stringify(MUSIC_TAGS)}

    [OUTPUT JSON FORMAT STRICTLY]
    {
      "db_standard_tags": {
        "genres": ["Exact match from CONSTANTS", ...],
        "moods": ["Exact match from CONSTANTS", ...],
        "tags": ["Exact match from CONSTANTS", ...]
      },
      "suno_creative_tags": {
        "inferred_gender": "Male Vox" | "Female Vox",
        "vocal_texture": "hyper-specific free-form vocal description",
        "instrumentation": "hyper-specific free-form instrumental/sonic description",
        "prompt_style_description": "overall vibe and texture string"
      }
    }

    [CRITICAL RULE]
    - ALWAYS include "inferred_gender". Respect user-selected gender if provided.
  `;

  const metaHints: string[] = [];
  if (refSongMeta?.genre)       metaHints.push(`Genre hint: ${refSongMeta.genre}`);
  if (refSongMeta?.releaseYear) metaHints.push(`Era: ${refSongMeta.releaseYear}s sound`);
  if (refSongMeta?.country)     metaHints.push(`Origin: ${refSongMeta.country}`);
  if (refSongMeta?.isExplicit)  metaHints.push(`Explicit: yes`);

  const userMessage = `
    - Ref Song: "${refSongTitle}" by "${refSongArtist}"
    - Target Voice Artist: "${targetVoice || 'Not specified'}"
    - User Vocal Tags: ${JSON.stringify(vocalTags || {})}
    - Extra Vibe/Requirements: "${etcInfo || "None"}"
    ${metaHints.length > 0 ? `- Additional Context: ${metaHints.join(', ')}` : ''}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // 음악적 깊이를 위해 gpt-4o 사용 유지
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8, 
    });

    const rawContent = response.choices[0].message.content;
    if (!rawContent) throw new Error("Empty response from GPT");

    const result = JSON.parse(rawContent);
    const dbTags = result.db_standard_tags || {};
    const sunoTags = result.suno_creative_tags || {};

    // 1. 성별 태그 확정 (유저 입력 최우선 -> GPT 추론)
    const genderTag = vocalTags?.gender
      ? `${vocalTags.gender} Vox`
      : (sunoTags.inferred_gender || 'Female Vox');

    // 2. 유저 입력 태그 문자열화
    const userVocalArr = [
      vocalTags?.race,
      vocalTags?.ageFeel ? `${vocalTags.ageFeel} voice` : undefined,
      vocalTags?.accent ? `${vocalTags.accent} accent` : undefined,
      vocalTags?.texture,
      vocalTags?.emotion
    ].filter(Boolean).join(', ');

    // 3. 🔥 Suno를 위한 최종 크리에이티브 프롬프트 조립
    const promptParts = [
      `Style of ${refSongArtist}`,
      genderTag,
      sunoTags.vocal_texture,
      userVocalArr,
      targetVoice ? `vocals similar to ${targetVoice}` : '',
      sunoTags.instrumentation,
      sunoTags.prompt_style_description,
      etcInfo
    ].filter(part => part && part.trim().length > 0);

    const finalPrompt = promptParts.join(', ').replace(/,,/g, ',').replace(/\s+/g, ' ').trim();

    console.log("✅ DB Standard Tags:", JSON.stringify(dbTags));
    console.log("✅ Final Optimized Suno Prompt:", finalPrompt);

    // 반환 객체는 DB 저장 요구사항(page.tsx)에 맞춰서 규격화
    return {
      title: targetTitle,
      lyrics: userLyrics || "",
      genres: dbTags.genres || [],
      moods: dbTags.moods || [],
      tags: dbTags.tags || [],
      vocalTags: [genderTag, sunoTags.vocal_texture].filter(Boolean),
      genderTag,
      prompt: finalPrompt
    };

  } catch (e) {
    console.error("🔥 Generate Prompt Error:", e);
    return null;
  }
}