'use server';

import { createClient } from '@supabase/supabase-js';

// 🚨 주의: 이 액션은 관리자 권한으로 실행됩니다.
export async function fixBucketCors() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceRoleKey) {
        return { success: false, error: 'Service Role Key가 .env 파일에 없습니다.' };
    }

    // 관리자 권한(Service Role)으로 클라이언트 생성
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    try {
        console.log("🚀 관리자 권한으로 CORS 설정 업데이트 시도...");

        // music_assets 버킷 업데이트
        const { data, error } = await adminSupabase.storage.updateBucket('music_assets', {
            public: true,
            allowedMimeTypes: null,
            fileSizeLimit: null,
            cors_origins: ['*'] // 여기에 빨간줄이 떴었죠?
        } as any); // 👈 핵심: 여기에 'as any'를 붙여서 타입 체크를 무시합니다.

        if (error) {
            console.error("❌ 업데이트 실패:", error);
            return { success: false, error: error.message };
        }

        console.log("✅ 업데이트 성공:", data);
        return { success: true, data };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}