'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Users, Disc, Coins, Search, Plus, Trash2, LayoutGrid, Loader2, ArrowUp, ArrowDown, Save, CheckSquare, Square, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type FeaturedPlaylist = {
  id: number;
  name: string;
  is_featured: boolean;
  display_order: number; // 순서 컬럼 추가
  profiles: {
    username: string;
  } | null;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, tracks: 0, total_pmld: 0 });
  
  // Featured Playlist States
  const [featuredList, setFeaturedList] = useState<FeaturedPlaylist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FeaturedPlaylist[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ✅ [NEW] 선택 및 순서 변경 상태
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isOrderChanged, setIsOrderChanged] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchFeaturedPlaylists();
  }, []);

  const fetchStats = async () => {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: trackCount } = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)', { count: 'exact', head: true });
    const { data: pmldData } = await supabase.from('p_mld_balances').select('balance');
    
    const totalPmld = pmldData?.reduce((sum, row) => sum + (row.balance || 0), 0) || 0;
    setStats({ users: userCount || 0, tracks: trackCount || 0, total_pmld: totalPmld });
  };

  const fetchFeaturedPlaylists = async () => {
    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, is_featured, display_order, profiles(username)')
      .eq('is_featured', true)
      .order('display_order', { ascending: true }); // ✅ display_order 기준으로 정렬

    if (error) {
      console.error("Fetch Error:", error);
    } else {
      setFeaturedList(data as any || []);
      setSelectedIds(new Set()); // 목록 갱신 시 선택 초기화
      setIsOrderChanged(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const query = `%${searchQuery}%`;
      const { data: nameMatches } = await supabase
        .from('playlists')
        .select('id, name, is_featured, profiles(username)')
        .ilike('name', query)
        .eq('is_featured', false)
        .limit(10);

      const { data: userMatches } = await supabase
        .from('playlists')
        .select('id, name, is_featured, profiles!inner(username)')
        .ilike('profiles.username', query)
        .eq('is_featured', false)
        .limit(10);

      const allMatches = [...(nameMatches || []), ...(userMatches || [])];
      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.id, item])).values());
      setSearchResults(uniqueMatches.slice(0, 10) as any);
    } catch (e) {
      console.error("Search Error:", e);
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ [NEW] 다중 선택 핸들러
  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // ✅ [NEW] 전체 선택 핸들러
  const toggleSelectAll = () => {
    if (selectedIds.size === featuredList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(featuredList.map(item => item.id)));
  };

  // ✅ [NEW] 순서 변경 핸들러 (UI만 변경)
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newList = [...featuredList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newList.length) return;

    // 배열 순서 swap
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    
    setFeaturedList(newList);
    setIsOrderChanged(true);
  };

  // ✅ [NEW] 변경된 순서 DB 저장
  const saveOrder = async () => {
    setIsSavingOrder(true);
    try {
      // 순서대로 display_order 업데이트
      const updates = featuredList.map((item, index) => ({
        id: item.id,
        display_order: index
      }));

      // Supabase upsert를 사용하여 일괄 업데이트 (id가 PK여야 함)
      // 만약 upsert가 복잡하면 Promise.all로 개별 업데이트 처리
      const promises = updates.map(update => 
        supabase.from('playlists').update({ display_order: update.display_order }).eq('id', update.id)
      );
      
      await Promise.all(promises);

      toast.success("Order saved successfully!");
      setIsOrderChanged(false);
      await fetchFeaturedPlaylists();
    } catch (e) {
      toast.error("Failed to save order");
      console.error(e);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ✅ [NEW] 다중 삭제 기능 (Bulk Delete)
  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Remove ${selectedIds.size} playlists from featured?`)) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('playlists')
        .update({ is_featured: false })
        .in('id', idsArray);

      if (error) throw error;

      toast.success("Selected playlists removed.");
      await fetchFeaturedPlaylists();
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove playlists.");
    }
  };

  // 단일 추가/삭제
  const toggleFeatured = async (id: number, setFeatured: boolean) => {
    if (setFeatured && featuredList.length >= 10) {
      toast.error("Maximum 10 featured playlists allowed.");
      return;
    }

    // 추가할 때는 현재 리스트의 맨 마지막 순서로 배정
    const newOrder = setFeatured ? featuredList.length : 0;

    const { error } = await supabase
      .from('playlists')
      .update({ is_featured: setFeatured, display_order: newOrder })
      .eq('id', id);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success(setFeatured ? "Added to featured" : "Removed");
      await fetchFeaturedPlaylists();
      if (setFeatured) setSearchResults(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard icon={<Users/>} title="Total Users" value={stats.users} />
        <StatCard icon={<Disc/>} title="Total Tracks" value={stats.tracks} />
        <StatCard icon={<Coins/>} title="Circulating pMLD" value={stats.total_pmld} color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Featured List (With Reorder & Bulk Delete) */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="text-blue-400" size={20}/>
              Featured Playlists
            </h2>
            <div className="flex gap-2">
              {/* 순서 저장 버튼 */}
              {isOrderChanged && (
                <button 
                  onClick={saveOrder}
                  disabled={isSavingOrder}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold animate-pulse"
                >
                  {isSavingOrder ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                  Save Order
                </button>
              )}
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${featuredList.length >= 10 ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {featuredList.length} / 10
              </span>
            </div>
          </div>

          {/* Bulk Actions Header */}
          {featuredList.length > 0 && (
            <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-t-xl border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-white transition">
                  {selectedIds.size === featuredList.length && featuredList.length > 0 ? <CheckSquare size={20}/> : <Square size={20}/>}
                </button>
                <span className="text-sm text-zinc-500 font-medium">
                  {selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}
                </span>
              </div>
              
              {selectedIds.size > 0 && (
                <button 
                  onClick={handleBulkRemove}
                  className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm font-bold bg-red-500/10 px-3 py-1 rounded-lg transition"
                >
                  <Trash2 size={16}/> Remove Selected
                </button>
              )}
            </div>
          )}

          <div className="space-y-2 mt-2">
            {featuredList.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No featured playlists yet.</div>
            ) : (
              featuredList.map((pl, index) => (
                <div key={pl.id} className={`flex items-center justify-between p-3 rounded-xl border transition group ${selectedIds.has(pl.id) ? 'bg-blue-900/20 border-blue-500/30' : 'bg-black/40 border-zinc-800'}`}>
                  
                  <div className="flex items-center gap-4 overflow-hidden">
                    {/* Checkbox */}
                    <button onClick={() => toggleSelect(pl.id)} className="text-zinc-500 hover:text-blue-400">
                      {selectedIds.has(pl.id) ? <CheckSquare size={20} className="text-blue-500"/> : <Square size={20}/>}
                    </button>
                    
                    {/* Index */}
                    <span className="text-zinc-600 font-mono text-sm w-4 text-center">{index + 1}</span>

                    {/* Content */}
                    <div className="truncate">
                      <div className="font-bold text-base text-white truncate">{pl.name}</div>
                      <div className="text-zinc-500 text-xs truncate">by {pl.profiles?.username || 'Unknown'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => moveItem(index, 'up')} 
                        disabled={index === 0}
                        className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30 text-zinc-400"
                      >
                        <ArrowUp size={14}/>
                      </button>
                      <button 
                        onClick={() => moveItem(index, 'down')} 
                        disabled={index === featuredList.length - 1}
                        className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30 text-zinc-400"
                      >
                        <ArrowDown size={14}/>
                      </button>
                    </div>

                    {/* Individual Delete */}
                    <button 
                      onClick={() => toggleFeatured(pl.id, false)}
                      className="p-2 hover:bg-red-900/50 text-zinc-500 hover:text-red-500 rounded-lg transition"
                      title="Remove"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Search & Add (Same as before) */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Search size={20} className="text-blue-400"/>
            Find & Add Playlist
          </h2>

          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Playlist name or username..." 
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition text-white placeholder-zinc-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-zinc-800 hover:bg-zinc-700 px-4 rounded-lg transition disabled:opacity-50 text-white"
            >
              {isSearching ? <Loader2 className="animate-spin"/> : <Search/>}
            </button>
          </div>

          <div className="space-y-2">
             {searchResults.map(pl => (
                <div key={pl.id} className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-lg transition">
                   <div className="overflow-hidden">
                     <div className="font-bold truncate text-white">{pl.name}</div>
                     <div className="text-xs text-zinc-400">by {pl.profiles?.username || 'Unknown'}</div>
                   </div>
                   <button 
                     onClick={() => toggleFeatured(pl.id, true)}
                     disabled={featuredList.length >= 10}
                     className="bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <Plus size={18}/>
                   </button>
                </div>
             ))}
             {searchQuery && !isSearching && searchResults.length === 0 && (
               <div className="text-zinc-500 text-center py-4 text-sm">No results found.</div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color="text-white" }: any) {
  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex items-center gap-4">
      <div className={`p-4 rounded-xl bg-zinc-800 ${color}`}>{icon}</div>
      <div>
        <div className="text-zinc-500 text-sm">{title}</div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </div>
    </div>
  );
}