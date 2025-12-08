import { supabase } from './supabase';

export type CollectionResult = 
  | { status: 'success', via: 'pMLD' }
  | { status: 'already_exists' }
  | { status: 'insufficient_pmld' } // MLD 결제 필요
  | { status: 'error', message: string };

// 1. pMLD로 수집 시도 (RPC 호출)
export async function tryCollectWithPMLD(trackId: number): Promise<CollectionResult> {
  try {
    const { data, error } = await supabase.rpc('add_to_collection_using_p_mld', {
      p_track_id: trackId,
    });

    if (error) throw error;

    if (data === 'PAID_WITH_PMLD') return { status: 'success', via: 'pMLD' };
    if (data === 'ALREADY_IN_COLLECTION') return { status: 'already_exists' };
    if (data === 'INSUFFICIENT_PMLD') return { status: 'insufficient_pmld' };
    
    return { status: 'error', message: 'Unknown response' };
  } catch (err: any) {
    console.error("pMLD Collect Error:", err);
    return { status: 'error', message: err.message };
  }
}

// 2. MLD 결제 성공 후 DB 기록 (오라클 역할)
export async function confirmMLDCollection(trackId: number, walletAddress: string) {
    // 프로필 ID 조회
    const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', walletAddress).single();
    if (!profile) return;

    // Collections 테이블에 'MLD'로 기록
    const { error } = await supabase.from('collections').insert({
        profile_id: profile.id,
        track_id: trackId,
        paid_with: 'MLD'
    });

}