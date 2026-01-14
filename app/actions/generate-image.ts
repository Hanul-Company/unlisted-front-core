'use server'

import OpenAI from 'openai';

// OpenAI 클라이언트 초기화 (API Key 환경변수 확인 필수)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 입력 타입 정의
type PersonaInputs = {
    artists: string[];
    gender: string;
    age: string;
    nationality: string;
    vibe: string;
};

export async function generatePersonaImage(inputs: PersonaInputs) {
    try {
        // 유효한 아티스트 이름만 쉼표로 연결
        const validArtistsStr = inputs.artists.filter(a => a.trim() !== '').join(', ');

        // ✅ [핵심 수정] 프롬프트 재구성
        // 1. 정면 응시 (facing forward, looking directly at the camera)
        // 2. 가상 인물 느낌 (stylized 3D digital render, NOT a real photo)
        // 3. 스튜디오 컨셉 (futuristic studio lighting)
        const prompt = `
      A medium-shot studio profile portrait of a stylized virtual musician character.
      The character is a ${inputs.gender}, appearing around ${inputs.age} years old, with features inspired by ${inputs.nationality} heritage.
      
      IMPORTANT: The character is facing forward and LOOKING DIRECTLY at the camera.
      
      The image style is a high-quality 3D digital render, like a concept art for a futuristic game, NOT a realistic photograph. Emphasize stylized textures, perhaps slightly glowing skin or digital hair elements.
      
      Their fashion and aesthetic vibe is a stylized interpretation influenced by: ${validArtistsStr}.
      The overall mood and atmosphere is: ${inputs.vibe}.
      
      Setting: A clean, futuristic photography studio with controlled, dramatic lighting and abstract digital screens in the blurred background.
    `;

        console.log("Generating Persona with prompt:", prompt); // 디버깅용 로그

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt.trim(),
            n: 1,
            size: "1024x1024",
            quality: "hd",    // HD 화질
            style: "vivid"    // ✅ 'natural' 대신 'vivid' 사용하여 더 양식화되고 극적인 느낌 강조
        });

        // 응답 데이터 안전성 체크
        if (!response.data || !response.data[0]?.url) {
            throw new Error("Failed to retrieve image URL from OpenAI response.");
        }

        // 성공 시 이미지 URL 반환
        return response.data[0].url;

    } catch (error: any) {
        console.error("DALL-E Generation Error:", error);
        // 에러 메시지를 좀 더 구체적으로 반환 (클라이언트 토스트 메시지용)
        if (error.response?.status === 400 && error.response?.data?.error?.code === 'content_policy_violation') {
            throw new Error("Safety policy violation. Try different artist names or vibes.");
        }
        throw new Error(error.message || "Failed to generate persona image.");
    }
}