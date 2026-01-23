'use server';

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ [중요] DB 저장 규격과 동일한 정규화 함수
// 예: "Sam Smith" -> "SAMSMITH", "New Jeans" -> "NEWJEANS"
const normalize = (str: string) => str.replace(/\s+/g, '').toUpperCase();

const SYSTEM_PROMPT = `
You are a smart music search assistant for 'Unlisted'.

### GOAL
Translate the user's query into a list of searchable keywords.
**CRITICAL:** If the user mentions a specific **Artist**, you MUST also generate 3-5 **Similar Artists** who have a similar style/genre.

### DATABASE VOCABULARY
- **Genres:** Pop, Hip-Hop, R&B, Electronic, Rock, Jazz, Lo-Fi, K-Pop, etc.
- **Moods:** Happy, Chill, Sad, Energetic, Focus, Romantic, Dark, Dreamy, Sexy, Groovy.

### OUTPUT FORMAT
Return a JSON object with two arrays:
1. "keywords": General mood/genre keywords (English).
2. "artists": Specific artist names found in the query AND similar artists you recommend.

### EXAMPLES
User: "비오는 날 듣기 좋은 헤이즈 스타일 노래"
Output: {
  "keywords": ["Rainy", "Sentimental", "R&B", "Emotional"],
  "artists": ["Heize", "Dean", "Crush", "Colde", "Hoody"]
}

User: "Justin Bieber 느낌의 팝"
Output: {
  "keywords": ["Pop", "Upbeat", "Catchy", "Mainstream"],
  "artists": ["Justin Bieber", "Shawn Mendes", "Ariana Grande", "Charlie Puth"]
}
`;

export async function extractSearchKeywords(userQuery: string) {
    if (!userQuery.trim()) return [];

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userQuery }
            ],
            temperature: 0.5, // 유사 아티스트 추천을 위해 창의성 살짝 높임
            response_format: { type: "json_object" } // JSON 모드 강제
        });

        const jsonString = completion.choices[0].message.content || "{}";
        const result = JSON.parse(jsonString);

        // 1. 일반 키워드 (Mood, Genre 등)
        const keywords = Array.isArray(result.keywords) ? result.keywords : [];

        // 2. 아티스트 키워드 -> 정규화 수행 (SAMSMITH 형태로 변환)
        const rawArtists = Array.isArray(result.artists) ? result.artists : [];
        const normalizedArtists = rawArtists.map((artist: string) => normalize(artist));

        // 3. 두 배열 합치기 (중복 제거)
        // 일반 키워드 + 정규화된 아티스트명
        const finalKeywords = Array.from(new Set([...keywords, ...normalizedArtists]));

        console.log(`🔍 AI Search: "${userQuery}" ->`, finalKeywords);

        return finalKeywords;
    } catch (e) {
        console.error("AI Search Error:", e);
        return [];
    }
}