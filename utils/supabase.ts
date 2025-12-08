import { createClient } from '@supabase/supabase-js';

// .env.local에 넣은 키를 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Key is missing in .env.local");
}

// 앱 어디서든 불러다 쓸 수 있는 싱글톤 클라이언트
export const supabase = createClient(supabaseUrl, supabaseKey);