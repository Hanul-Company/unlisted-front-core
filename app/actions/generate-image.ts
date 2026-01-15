'use server';

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Types ---
type PersonaInputs = {
    artists: string[];
    gender: string;
    age: string;
    nationality: string;
    vibe: string;
};

// --- Helpers ---
function cleanList(xs: string[], max = 6) {
    return (xs || [])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, max);
}

// File -> Base64 변환 (GPT-4o Vision 전송용)
async function fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${file.type};base64,${buffer.toString('base64')}`;
}

/**
 * [Step 1] User Image Analysis (GPT-4o Vision)
 * 업로드된 사진에서 시각적 특징(Visual DNA)을 추출합니다.
 */
async function analyzeUserImage(base64Image: string): Promise<string> {
    const systemPrompt = `
    You are an expert visual profiler. 
    Analyze the uploaded portrait and describe the subject's physical traits to recreate them in a NEW generated image.
    
    Focus on:
    1. Facial structure (face shape, jawline, cheekbones)
    2. Eyes (shape, color, eyelids)
    3. Nose & Lips shape
    4. Hair (shape, length, direction, color, style)
    5. Skin tone
    6. Distinctive features
    
    Output a concise, comma-separated paragraph describing ONLY the physical appearance. 
    DO NOT describe the background, lighting, or clothing. 
    DO NOT use the person's name even if you recognize them.
  `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Vision 지원 모델
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe the physical appearance of this person for a character generation prompt." },
                        { type: "image_url", image_url: { url: base64Image } },
                    ],
                },
            ],
            max_tokens: 300,
        });

        return response.choices[0]?.message?.content || "";
    } catch (e) {
        console.error("Vision Analysis Error:", e);
        return "";
    }
}

/**
 * [Step 2] Style DNA Generation (Text-only)
 * 아티스트와 바이브를 기반으로 스타일 프롬프트를 생성합니다.
 */
function buildStylePrompt(inputs: PersonaInputs) {
    const validArtists = cleanList(inputs.artists).join(', ');

    return `
    Style & Aesthetic:
    - Fashion and vibe inspired by a mix of: ${validArtists}.
    - Mood: ${inputs.vibe}.
    - Artistic Direction: High-quality 3D digital render or cinematic concept art. NOT a simple photo, but a stylized hyper-realistic portrait.
    - Lighting: Dramatic studio lighting, volumetric, cinematic.
  `;
}

/**
 * ✅ Main Server Action
 * 기존 settings 페이지와 호환되도록 FormData를 받아서 처리합니다.
 */
export async function generatePersonaImage(formData: FormData) {
    try {
        // 1. Inputs 파싱
        const inputsRaw = formData.get('inputs');
        if (!inputsRaw) throw new Error('Missing inputs.');
        const inputs = JSON.parse(String(inputsRaw)) as PersonaInputs;

        // 2. 이미지 파일 확인 (없을 수도 있음)
        const personaImageFile = formData.get('personaImage') as File | null;

        let visualDescription = "";

        // 3. 이미지가 있다면 -> Vision으로 분석 (Face DNA 추출)
        if (personaImageFile && personaImageFile.size > 0) {
            console.log("Analyzing user face...");
            const base64Image = await fileToBase64(personaImageFile);
            visualDescription = await analyzeUserImage(base64Image);
        }

        // 4. 최종 DALL-E 3 프롬프트 조립
        // 이미지가 있으면 분석된 얼굴 묘사를 넣고, 없으면 기본 입력값(성별/나이/국적) 사용
        const subjectDescription = visualDescription
            ? `Subject Appearance (Recreate this person): ${visualDescription}. The subject should look exactly like this description but in the requested style.`
            : `Subject: A ${inputs.gender}, approximately ${inputs.age} years old, of ${inputs.nationality} descent.`;

        const finalPrompt = `
      A medium-shot studio profile portrait of a stylized virtual musician.
      
      ${subjectDescription}
      
      IMPORTANT: The character is facing forward and LOOKING DIRECTLY at the camera.
      
      ${buildStylePrompt(inputs)}
      
      Setting: A clean, realistic, artistic photography studio with backgrounds full of abstract lights and shadows, not certain objects.
      Quality: highly detailed, sharp focus.
    `;

        console.log("Generating with prompt:", finalPrompt);

        // 5. DALL-E 3 이미지 생성
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
            response_format: "b64_json", // Client에서 바로 업로드하기 위해 Base64 수신
        });

        if (!response.data || !response.data[0]?.b64_json) {
            throw new Error("Failed to generate image data.");
        }

        // Base64 문자열 반환 (Client에서 File로 변환 후 Storage 업로드)
        return response.data[0].b64_json;

    } catch (error: any) {
        console.error("Generate Persona Error:", error);
        if (error?.response?.status === 400 && error?.response?.data?.error?.code === 'content_policy_violation') {
            throw new Error("Safety policy violation. Try different artist names or vibes.");
        }
        throw new Error(error.message || "Failed to generate persona image.");
    }
}