// app/actions/analyze-music.ts

'use server';

import OpenAI from 'openai';
import { 
  MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS, 
  GENRE_MAPPING, MOOD_MAPPING 
} from '../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const normalize = (str: string) => str.replace(/\s+/g, '').toUpperCase();

export async function analyzeUserTaste(favArtists: string[], favTracks: string[]) {
  // 1. API 키 확인 로그
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY is missing in .env.local");
    return null;
  }

  if (!favArtists.length && !favTracks.length) return null;

  console.log("🚀 Analyzing User Taste for:", favArtists, favTracks);

  const prompt = `
    You are a cool musicologist AI. Analyze the user's taste based on their favorites.

    User Favorites:
    - Artists: ${favArtists.join(', ')}
    - Tracks: ${favTracks.join(', ')}

    System Data:
    - GENRES: ${JSON.stringify(MUSIC_GENRES)}
    - MOODS: ${JSON.stringify(MUSIC_MOODS)}
    - TAGS: ${JSON.stringify(MUSIC_TAGS)}

    Task:
    1. Identify 3 "Similar Artists" for EACH input artist.
    2. Extract top 5 GENRES.
    3. Extract top 5 MOODS.
    4. Extract top 10 TAGS.
    5. [IMPORTANT] Create a "summary": A single, stylish sentence defining their taste (e.g., "You love late-night drive vibes mixed with emotional K-Pop vocals.").

    Output JSON:
    {
      "summary": "Your music taste definition...",
      "similar_artists": ["..."],
      "genres": ["..."],
      "moods": ["..."],
      "tags": ["..."]
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: [
        { role: 'system', content: "You output only JSON." },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    console.log("✅ OpenAI Response:", content);

    const result = JSON.parse(content || '{}');

    // ✅ [수정] 유사 아티스트 데이터 구조 처리 (Array vs Object 대응)
    let flatSimilarArtists: string[] = [];
    
    if (Array.isArray(result.similar_artists)) {
        // 배열로 왔을 경우 그대로 사용
        flatSimilarArtists = result.similar_artists;
    } else if (typeof result.similar_artists === 'object' && result.similar_artists !== null) {
        // 객체로 왔을 경우 (현재 에러 상황), 값들만 추출해서 평탄화(flat)
        // 예: { "post malone": ["A", "B"], "new jeans": ["C"] } -> ["A", "B", "C"]
        flatSimilarArtists = Object.values(result.similar_artists).flat() as string[];
    }

    const expandedGenres = (result.genres || []).map((g: string) => GENRE_MAPPING[g] || g);
    const expandedMoods = (result.moods || []).map((m: string) => MOOD_MAPPING[m] || m);

    return {
      fav_artists: favArtists.map(normalize),
      fav_tracks: favTracks.map(normalize),
      // ✅ 수정된 변수 사용
      expanded_artists: flatSimilarArtists.map(normalize),
      expanded_genres: [...new Set(expandedGenres)],
      expanded_moods: [...new Set(expandedMoods)],
      expanded_tags: result.tags || [],
      summary: result.summary || "Your taste is unique and eclectic." // ✅ 요약 필드 추가
    };

  } catch (error) {
    console.error("🔥 AI Analysis Failed:", error);
    return null;
  }
}


/**
 * ✅ [NEW] 트랙 업로드 시 AI 분석 (Upload Page용)
 */
export async function analyzeTrackMetadata(
  refArtist: string, 
  refTrack: string, 
  genre: string, 
  moods: string[]
) {
  // 1. 레퍼런스 정보가 없으면 분석 스킵 (비용 절약)
  if (!refArtist && !refTrack) return null;
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt = `
    Analyze metadata for a music track based on the uploader's input.

    Input Data:
    - Primary Genre: ${genre}
    - Moods: ${moods.join(', ')}
    - Reference Artist: ${refArtist || 'None'}
    - Reference Track: ${refTrack || 'None'}

    System Tags: ${JSON.stringify(MUSIC_TAGS)}

    Task:
    1. Identify 5 "Similar Artists" based on the Reference Artist/Track (if provided) or Genre.
    2. Suggest 5 "Vibe Tags" from the System Tags list that fit this style.
    3. Describe the likely "Voice Style" (e.g., Autotuned, Husky, Falsetto, Clear) in 1-2 keywords.
    4. Suggest 2-3 "Sub-Genres" or specific styles under the Primary Genre.

    Output JSON:
    {
      "similar_artists": ["Name1", "Name2"...],
      "vibe_tags": ["Tag1", "Tag2"...],
      "voice_style": ["Style1"...],
      "analyzed_genres": ["SubGenre1", "SubGenre2"...]
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 빠르고 저렴함
      messages: [
        { role: 'system', content: "You are a music metadata expert. Output only JSON." },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // 배열/객체 에러 방지용 평탄화
    let flatSimilarArtists: string[] = [];
    if (Array.isArray(result.similar_artists)) {
        flatSimilarArtists = result.similar_artists;
    } else if (typeof result.similar_artists === 'object' && result.similar_artists !== null) {
        flatSimilarArtists = Object.values(result.similar_artists).flat() as string[];
    }

    return {
      ref_artists: refArtist ? [normalize(refArtist)] : [],
      ref_tracks: refTrack ? [normalize(refTrack)] : [],
      similar_artists: flatSimilarArtists.map(normalize),
      voice_style: result.voice_style || [],
      vibe_tags: result.vibe_tags || [],
      analyzed_genres: result.analyzed_genres || [],
      analyzed_moods: moods // 입력받은 무드 그대로 유지
    };

  } catch (e) {
    console.error("Track Analysis Failed:", e);
    return null; // 실패 시 null 반환 (업로드는 계속 진행)
  }
}