'use server';

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type PersonaInputs = {
    artists: string[];
    gender: string;      // "male" | "female" | "non-binary" | etc.
    age: string;         // "24"
    nationality: string; // "Korean"
    vibe: string;        // "late night neon, moody, cinematic"
};

type StyleDNA = {
    fashion: string[];
    hair_makeup: string[];
    palette: string[];
    lighting: string[];
    camera: string[];
    background: string[];
    overall: string; // one-line art direction summary
};

function cleanList(xs: string[], max = 6) {
    return (xs || [])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, max);
}

function safeAgeBucket(age: string) {
    const n = Number(String(age).replace(/[^\d]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return 'mid-20s';
    if (n < 18) return 'late teens';
    if (n < 23) return 'early 20s';
    if (n < 30) return 'mid-20s';
    if (n < 40) return '30s';
    if (n < 50) return '40s';
    return '50s+';
}

/**
 * Step 1) Artists -> Style DNA (keywords)
 * - IMPORTANT: 스타일/무드/촬영/컬러만 뽑고, 실존 인물 닮게(얼굴 특징 복제)로 가는 표현은 금지
 */
async function generateStyleDNA(inputs: PersonaInputs): Promise<StyleDNA> {
    const artists = cleanList(inputs.artists, 8);
    const vibe = (inputs.vibe || '').trim();

    const system = `
You are a creative director for realistic editorial album-cover portraits.
Return ONLY valid JSON. No markdown, no commentary.

Rules:
- Extract only STYLE/AESTHETIC cues (fashion, palette, lighting, camera, background).
- Do NOT describe or recreate any specific real person.
- Do NOT output age/race/ethnicity in a way that stereotypes or copies a known individual.
- Keep everything compatible with photorealistic studio/editorial photography.
JSON shape:
{
  "fashion": string[],
  "hair_makeup": string[],
  "palette": string[],
  "lighting": string[],
  "camera": string[],
  "background": string[],
  "overall": string
}
Keep arrays concise (3-6 items each). overall is one sentence. The final output must be a single continuous photograph in one frame (not divided).
`.trim();

    const user = `
Artists for style reference (mood only): ${artists.length ? artists.join(', ') : '(none)'}
Vibe keywords: ${vibe || '(none)'}
Generate Style DNA JSON now.
`.trim();

    const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
    });

    const txt = r.choices?.[0]?.message?.content?.trim() || '';
    try {
        const parsed = JSON.parse(txt);

        // super light validation + fallback defaults
        const dna: StyleDNA = {
            fashion: cleanList(parsed.fashion || [], 6),
            hair_makeup: cleanList(parsed.hair_makeup || [], 6),
            palette: cleanList(parsed.palette || [], 6),
            lighting: cleanList(parsed.lighting || [], 6),
            camera: cleanList(parsed.camera || [], 6),
            background: cleanList(parsed.background || [], 6),
            overall: String(parsed.overall || '').trim() || 'Modern, clean, realistic editorial album-cover portrait.',
        };

        // ensure we always have some usable values
        if (!dna.fashion.length) dna.fashion = ['modern minimalist', 'high-end editorial', 'subtle stage-ready accents'];
        if (!dna.palette.length) dna.palette = ['neutral blacks', 'soft gradients', 'one accent color'];
        if (!dna.lighting.length) dna.lighting = ['soft key light', 'gentle rim light', 'realistic shadows'];
        if (!dna.camera.length) dna.camera = ['50mm lens look', 'shallow depth of field', 'high detail'];
        if (!dna.background.length) dna.background = ['studio gradient backdrop', 'subtle texture', 'clean album-cover vibe'];

        return dna;
    } catch {
        // fallback (in case JSON parsing fails)
        return {
            fashion: ['modern minimalist', 'high-end editorial', 'subtle stage-ready accents'],
            hair_makeup: ['natural skin texture', 'realistic hair detail', 'clean makeup (not glossy CGI)'],
            palette: ['neutral blacks', 'soft gradients', 'one accent color'],
            lighting: ['soft key light', 'gentle rim light', 'realistic shadows'],
            camera: ['50mm lens look', 'shallow depth of field', 'high detail'],
            background: ['studio gradient backdrop', 'subtle texture', 'clean album-cover vibe'],
            overall: 'Modern, clean, realistic editorial album-cover portrait.',
        };
    }
}

/**
 * Step 2) Build final DALL·E prompt using Style DNA
 * - Realism guard rails included (avoid CGI/3D)
 */
function buildImagePrompt(inputs: PersonaInputs, dna: StyleDNA) {
    const gender = (inputs.gender || 'person').trim();
    const ageBucket = safeAgeBucket(inputs.age || '');
    const nationality = (inputs.nationality || 'mixed').trim();
    const vibe = (inputs.vibe || 'modern, clean, artistic').trim();

    const join = (arr: string[]) => arr.filter(Boolean).join(', ');

    return `
High-end editorial album cover portrait photograph of a REAL human musician.

Composition: centered medium close-up (chest-up), facing forward, DIRECT eye contact with the camera.
Subject: ${gender}, looks around ${ageBucket}. Natural, believable features with subtle cues of ${nationality} heritage (avoid stereotypes).
Expression: calm confidence, charismatic, approachable artist profile.

Art direction (Style DNA):
- Fashion: ${join(dna.fashion)}
- Hair & makeup: ${join(dna.hair_makeup)}
- Color palette: ${join(dna.palette)}
- Lighting: ${join(dna.lighting)}
- Camera: ${join(dna.camera)}
- Background: ${join(dna.background)}
Overall: ${dna.overall}

Mood keywords: ${vibe}

Photorealistic, looks like a real camera photo (NOT illustration).
Texture: natural skin texture (visible pores), realistic hair strands, natural skin tones, slight film grain.
Avoid: CGI, 3D render, anime, cartoon, doll-like face, plastic skin, over-smoothed skin, uncanny valley, fantasy features, excessive glow.
No text, no watermark, no logo.
`.trim();
}

export async function generatePersonaImage(inputs: PersonaInputs) {
    try {
        // 1) Artists -> Style DNA
        const dna = await generateStyleDNA(inputs);

        // 2) Style DNA -> Final image prompt
        const prompt = buildImagePrompt(inputs, dna);

        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            style: 'natural',
            response_format: 'b64_json',
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error('Failed to generate image data.');

        return b64;
    } catch (error: any) {
        console.error('DALL-E Generation Error:', error);
        if (
            error?.response?.status === 400 &&
            error?.response?.data?.error?.code === 'content_policy_violation'
        ) {
            throw new Error('Safety policy violation. Try different artist names or vibes.');
        }
        throw new Error(error?.message || 'Failed to generate persona image.');
    }
}
