'use server';

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBulkVariants(baselineTitle: string, baselineLyrics: string, count: number) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const systemPrompt = `
    You are an expert music lyricist and title creator.
    The user will provide a "Baseline Title" and a "Baseline Lyrics Idea".
    Your task is to generate exactly ${count} distinct variants of the title and lyrics ideas that share the same theme but have slightly different angles, vibes, or perspectives.

    Return the result strictly as a JSON object with a "variants" array:
    {
      "variants": [
        {
          "title": "A highly catchy, slightly different title",
          "lyrics": "A short lyrics idea or paragraph based on the baseline but varied."
        }
      ]
    }
    
    Make sure to generate exactly ${count} items.
  `;

  const userMessage = `
    Baseline Title: "${baselineTitle}"
    Baseline Lyrics Idea: "${baselineLyrics}"
    Number of variants needed: ${count}
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const rawContent = response.choices[0].message.content;
  if (!rawContent) throw new Error("Empty response from GPT");

  return JSON.parse(rawContent);
}
