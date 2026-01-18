'use server';

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateLyricsDraft(topic: string, vibe: string) {
    try {
        const prompt = `
      You are a professional songwriter. Write song lyrics based on the user's concept.
      
      Concept/Topic: ${topic}
      Mood/Vibe: ${vibe}
      
      Rules:
      1. Structure the lyrics with tags like [Verse 1], [Chorus], [Bridge], [Outro].
      2. Keep it concise (about 2-3 minutes song length).
      3. Language: Detect the language of the topic. If Korean, write in Korean. If English, write in English.
      4. Make it rhyming and rhythmic.
      
      Output ONLY the lyrics text. No conversational filler.
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // 빠르고 저렴함
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        return response.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Lyrics Gen Error:", error);
        throw new Error("Failed to generate lyrics.");
    }
}