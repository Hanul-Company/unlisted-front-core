'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Users, Disc, Coins, Search, Plus, Trash2, LayoutGrid, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type FeaturedPlaylist = {
  id: number;
  name: string;
  is_featured: boolean;
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

  useEffect(() => {
    fetchStats();
    fetchFeaturedPlaylists();
  }, []);

  const fetchStats = async () => {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: trackCount } = await supabase.from('tracks').select('*', { count: 'exact', head: true });
    const { data: pmldData } = await supabase.from('p_mld_balances').select('balance');
    
    const totalPmld = pmldData?.reduce((sum, row) => sum + (row.balance || 0), 0) || 0;
    setStats({ users: userCount || 0, tracks: trackCount || 0, total_pmld: totalPmld });
  };

  const fetchFeaturedPlaylists = async () => {
    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, is_featured, profiles(username)')
      .eq('is_featured', true)
      .order('id', { ascending: false }); // 최신 등록순

    if (error) {
      console.error("Fetch Error:", error);
    } else {
      setFeaturedList(data as any || []);
    }
  };

  // 2단계 검색 로직 (이름 검색 + 유저명 검색 병합)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const query = `%${searchQuery}%`;

      // 1. 플레이리스트 이름으로 검색
      const { data: nameMatches, error: nameError } = await supabase
        .from('playlists')
        .select('id, name, is_featured, profiles(username)')
        .ilike('name', query)
        .eq('is_featured', false) // 이미 추가된 건 제외
        .limit(10);

      if (nameError) throw nameError;

      // 2. 작성자 닉네임으로 검색 (Inner Join 활용)
      const { data: userMatches, error: userError } = await supabase
        .from('playlists')
        .select('id, name, is_featured, profiles!inner(username)')
        .ilike('profiles.username', query)
        .eq('is_featured', false)
        .limit(10);

      if (userError) throw userError;

      // 3. 결과 병합 및 중복 제거 (ID 기준)
      const allMatches = [...(nameMatches || []), ...(userMatches || [])];
      
      const uniqueMatches = Array.from(
        new Map(allMatches.map(item => [item.id, item])).values()
      );

      setSearchResults(uniqueMatches.slice(0, 10) as any);

    } catch (e) {
      console.error("Search Error:", e);
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ [수정] 토글 시 목록 즉시 갱신 (await 사용)
  const toggleFeatured = async (id: number, setFeatured: boolean) => {
    // 추가하려는 경우 10개 제한 체크
    if (setFeatured && featuredList.length >= 10) {
      toast.error("Maximum 10 featured playlists allowed.");
      return;
    }

    // 1. DB 업데이트
    const { error } = await supabase
      .from('playlists')
      .update({ is_featured: setFeatured })
      .eq('id', id);

    if (error) {
      toast.error("Update failed");
      console.error(error);
    } else {
      toast.success(setFeatured ? "Added to featured" : "Removed from featured");
      
      // 2. [중요] DB 업데이트 후 목록 다시 불러오기 (await로 기다림)
      await fetchFeaturedPlaylists();

      // 3. 추가한 경우 검색 결과 목록에서 즉시 제거하여 UI 깔끔하게 처리
      if (setFeatured) {
        setSearchResults(prev => prev.filter(p => p.id !== id));
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard icon={<Users/>} title="Total Users" value={stats.users} />
        <StatCard icon={<Disc/>} title="Total Tracks" value={stats.tracks} />
        <StatCard icon={<Coins/>} title="Circulating pMLD" value={stats.total_pmld} color="text-cyan-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Current Featured List */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="text-green-400" size={20}/>
              Featured Playlists
            </h2>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${featuredList.length >= 10 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
              {featuredList.length} / 10
            </span>
          </div>

          <div className="space-y-3">
            {featuredList.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No featured playlists yet.</div>
            ) : (
              featuredList.map(pl => (
                <div key={pl.id} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-zinc-800 animate-in fade-in slide-in-from-left-5 duration-300">
                  <div>
                    <div className="font-bold text-lg text-white">{pl.name}</div>
                    <div className="text-zinc-500 text-sm">by {pl.profiles?.username || 'Unknown'}</div>
                  </div>
                  <button 
                    onClick={() => toggleFeatured(pl.id, false)}
                    className="p-2 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-500 rounded-lg transition"
                    title="Remove"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Search & Add */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 h-fit">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Search size={20} className="text-blue-400"/>
            Find & Add Playlist
          </h2>

          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Search by playlist name or username..." 
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 transition text-white placeholder-zinc-600"
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
             {searchResults.length > 0 && (
               <div className="text-xs text-zinc-500 mb-2 uppercase font-bold tracking-wider">Search Results</div>
             )}
             
             {searchResults.map(pl => (
                <div key={pl.id} className="flex items-center justify-between p-3 hover:bg-zinc-800 rounded-lg transition group">
                   <div className="overflow-hidden">
                     <div className="font-bold truncate text-white">{pl.name}</div>
                     <div className="text-xs text-zinc-400">by {pl.profiles?.username || 'Unknown'}</div>
                   </div>
                   <button 
                     onClick={() => toggleFeatured(pl.id, true)}
                     disabled={featuredList.length >= 10}
                     className="bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <Plus size={18}/>
                   </button>
                </div>
             ))}

             {searchQuery && !isSearching && searchResults.length === 0 && (
               <div className="text-zinc-500 text-center py-4 text-sm">
                 No playlists found matching "{searchQuery}"
               </div>
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