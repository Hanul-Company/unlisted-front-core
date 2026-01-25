'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Hammer, Search, Image as ImageIcon, Sparkles, Database, 
  CheckCircle2, Loader2, Plus, X, Zap, History, LayoutGrid, Music, ArrowLeft, ListChecks, PlayCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '@/app/constants';
import { analyzePlaylistImage } from '@/app/actions/factory'; 
import { useActiveAccount, useReadContract } from "thirdweb/react";
import HeaderProfile from '../components/HeaderProfile';
import { supabase } from '@/utils/supabase';
import { Link } from "@/lib/i18n";
import { getContract } from "thirdweb"; 
import { client, chain } from '@/utils/thirdweb';
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '@/app/constants';
import { formatEther } from 'viem';

// MLD Contract Init
const mldContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any,
});

// Types
type TrackInfo = { title: string; artist: string; coverUrl?: string };
type SubmissionHistory = { 
    id: string; 
    track_title: string; 
    track_artist: string; 
    created_at: string; 
    reward_amount: number; 
};

export default function MLDFactoryPage() {
  const account = useActiveAccount();
  const address = account?.address;
  
  // Tabs & Modes
  const [activeTab, setActiveTab] = useState<'share_taste' | 'coming_soon'>('share_taste');
  const [inputMode, setInputMode] = useState<'search' | 'scan'>('search');

  // User State
  const [balance, setBalance] = useState({ pmld: 0, mld: '0' });
  const [history, setHistory] = useState<SubmissionHistory[]>([]);

  // Queue & Working State (핵심 변경 부분)
  const [miningQueue, setMiningQueue] = useState<TrackInfo[]>([]); // 대기열
  const [workingTrack, setWorkingTrack] = useState<TrackInfo | null>(null); // 현재 작업 중인 곡

  // Form State
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackInfo[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Tagging State
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Search Filters
  const [genreSearch, setGenreSearch] = useState('');
  const [moodSearch, setMoodSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blockchain Balance
  const { data: mldBalanceVal } = useReadContract({
    contract: mldContract,
    method: "balanceOf",
    params: [address || "0x0000000000000000000000000000000000000000"]
  });

  // --- Initial Data Fetch ---
  useEffect(() => {
    if (address) {
        fetchHistory();
        fetchPmldBalance();
    }
  }, [address]);

  useEffect(() => {
      if (mldBalanceVal) {
          setBalance(prev => ({ ...prev, mld: Number(formatEther(mldBalanceVal)).toLocaleString(undefined, {maximumFractionDigits: 0}) }));
      }
  }, [mldBalanceVal]);

  const fetchHistory = async () => {
    const { data } = await supabase
        .from('training_submissions')
        .select('*')
        .eq('user_address', address)
        .order('created_at', { ascending: false })
        .limit(10);
    if (data) setHistory(data);
  };

  const fetchPmldBalance = async () => {
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', address).single();
      if (profile) {
          const { data: balRow } = await supabase.from('p_mld_balances').select('balance').eq('profile_id', profile.id).maybeSingle();
          setBalance(prev => ({ ...prev, pmld: balRow?.balance || 0 }));
      }
  };

  // --- Queue Logic ---
  const addToQueue = (track: TrackInfo) => {
      if (miningQueue.length >= 10) return toast.error("Queue is full (Max 10). Please mine existing tracks first.");
      
      // 중복 체크
      const isExist = miningQueue.some(t => t.title === track.title && t.artist === track.artist);
      if (isExist) return toast.error("Already in queue.");

      setMiningQueue(prev => [track, ...prev]); // 최신순 추가
      toast.success("Added to Mining Queue!");
  };

  const removeFromQueue = (index: number) => {
      setMiningQueue(prev => prev.filter((_, i) => i !== index));
  };

  // --- Search Handler ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&limit=5`);
      const data = await res.json();
      setSearchResults(data.results.map((item: any) => ({
        title: item.trackName,
        artist: item.artistName,
        coverUrl: item.artworkUrl100.replace('100x100', '300x300')
      })));
    } catch (err) { toast.error("Search failed."); } 
    finally { setLoading(false); }
  };

  // --- Image Scan Handler ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const previewUrl = URL.createObjectURL(file);
    setPreviewImage(previewUrl);
    setAnalyzing(true);

    const formData = new FormData();
    formData.append('image', file);
    const result = await analyzePlaylistImage(formData);
    
    if (result.success && result.data && Array.isArray(result.data)) {
        const foundTracks = result.data.map((t: any) => ({
            title: t.title,
            artist: t.artist,
            coverUrl: previewUrl 
        }));

        // 큐에 추가 (10개 제한)
        setMiningQueue(prev => {
            const combined = [...foundTracks, ...prev]; // 새 결과 우선
            const unique = combined.filter((v, i, a) => a.findIndex(t => t.title === v.title && t.artist === v.artist) === i);
            if (unique.length > 10) {
                toast("Queue limited to 10 items.");
                return unique.slice(0, 10);
            }
            return unique;
        });
        
        toast.success(`Scanned ${foundTracks.length} tracks!`);
    } else {
        toast.error("Could not extract info. Try manual search.");
    }
    setAnalyzing(false);
  };

  // --- Submit Handler (Mining) ---
  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (loading) return; 

    if (!address) return toast.error("Please connect wallet.");
    if (!workingTrack) return toast.error("No track selected.");
    if (selectedGenres.length === 0) return toast.error("Select at least 1 Genre.");
    if (selectedMoods.length === 0) return toast.error("Select at least 1 Mood.");
    if (selectedTags.length < 3) return toast.error("Please select at least 3 Context Tags.");

    setLoading(true);
    const REWARD = 10;
    
    try {
        // 1. Insert Detailed Record
        const { error: submitErr } = await supabase.from('training_submissions').insert({
            user_address: address,
            track_title: workingTrack.title,
            track_artist: workingTrack.artist,
            cover_url: workingTrack.coverUrl,
            metadata: { genres: selectedGenres, moods: selectedMoods, tags: selectedTags },
            reward_amount: REWARD,
            source_type: inputMode
        });
        
        if (submitErr) throw submitErr;

        // 2. Call RPC
        const { error: rpcError } = await supabase.rpc('reward_engage', {
            p_wallet_address: address,
            p_amount: REWARD,
            p_activity_type: 'mining_pool_reward'
        });

        if (rpcError) throw rpcError;

        // 3. UI Updates
        setBalance(prev => ({ ...prev, pmld: prev.pmld + REWARD }));
        await fetchHistory();
        
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-zinc-900 border border-cyan-500/50 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4`}>
                <div className="bg-cyan-500/20 p-2 rounded-full text-cyan-400"><Zap size={24} fill="currentColor"/></div>
                <div>
                    <h3 className="font-bold text-lg">Data Mined!</h3>
                    <p className="text-zinc-400 text-sm">Reward: <span className="text-cyan-400 font-bold">+{REWARD} pMLD</span></p>
                </div>
            </div>
        ));

        // 4. Queue Cleaning
        // 현재 작업 완료된 곡을 큐에서 제거하고 작업창을 닫습니다.
        setMiningQueue(prev => prev.filter(t => t.title !== workingTrack.title));
        setWorkingTrack(null);

        // Reset Inputs
        setSelectedGenres([]);
        setSelectedMoods([]);
        setSelectedTags([]);
        setGenreSearch('');
        setMoodSearch('');
        setTagSearch('');

    } catch (error: any) {
        console.error("Submit Error:", error);
        toast.error(`Submission failed: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };

  // --- Filtering & Sorting ---
  const filteredGenres = useMemo(() => {
      let list = MUSIC_GENRES;
      if (genreSearch) list = list.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase()));
      return [...list].sort((a, b) => a.localeCompare(b));
  }, [genreSearch]);

  const filteredMoods = useMemo(() => {
      let list = MUSIC_MOODS;
      if (moodSearch) list = list.filter(m => m.toLowerCase().includes(moodSearch.toLowerCase()));
      return [...list].sort((a, b) => a.localeCompare(b));
  }, [moodSearch]);

  const filteredTags = useMemo(() => {
      let list = MUSIC_TAGS;
      if (tagSearch) list = list.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
      return [...list].sort((a, b) => a.localeCompare(b));
  }, [tagSearch]);

  const toggleSelection = (list: string[], setList: any, item: string) => {
    if (list.includes(item)) setList(list.filter((i:string) => i !== item));
    else if (list.length < 3) setList([...list, item]);
    else toast.error("Max 3 items.");
  };

  const toggleTag = (tag: string) => {
      if (selectedTags.includes(tag)) setSelectedTags(prev => prev.filter(t => t !== tag));
      else {
          if (selectedTags.length >= 10) return toast.error("Max 10 tags.");
          setSelectedTags(prev => [...prev, tag]);
      }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
        <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
            <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/market" className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition text-zinc-400 hover:text-white">
                        <ArrowLeft size={20}/>
                    </Link>
                    <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                        MINING POOL <Hammer size={16} className="text-cyan-500"/>
                    </h1>
                    <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                    <span className="hidden md:block text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                        Provide data for AI and get free MLD.
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
                        <div className="flex items-center gap-1.5">
                            <Zap size={14} className="text-yellow-400 fill-yellow-400"/>
                            <span className="text-xs font-bold text-white">{balance.pmld.toLocaleString()} <span className="text-zinc-500">pMLD</span></span>
                        </div>
                        <div className="w-px h-3 bg-zinc-700"/>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-blue-500"/>
                            <span className="text-xs font-bold text-white">{balance.mld} <span className="text-zinc-500">MLD</span></span>
                        </div>
                    </div>
                    <HeaderProfile />
                </div>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Sidebar (Nav & Balance) */}
            <div className="lg:col-span-3 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 px-2">Mining Zones</h3>
                    <nav className="space-y-1">
                        <button onClick={() => setActiveTab('share_taste')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'share_taste' ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}>
                            <Sparkles size={18} className={activeTab === 'share_taste' ? "text-cyan-400" : ""}/> Share Your Taste
                        </button>
                        <button disabled className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all text-zinc-600 cursor-not-allowed opacity-50 bg-transparent">
                            <LayoutGrid size={18}/> Data Labeling (Soon)
                        </button>
                    </nav>
                </div>
                <div className="md:hidden bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-400">Your Balance</span>
                    <span className="text-sm font-black text-white">{balance.pmld} pMLD</span>
                </div>
            </div>

            {/* Center: Workspace */}
            <div className="lg:col-span-6 space-y-6">
                {activeTab === 'share_taste' && (
                    <>
                        {/* --- 1. Collection Mode (Visible if NOT working on a track) --- */}
                        {!workingTrack && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"/>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Share Your Taste</h2>
                                            <p className="text-xs mt-1 font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">1 Song from Real World, 1 Song to AI World.</p>
                                        </div>
                                        <div className="flex bg-black rounded-lg p-1 border border-zinc-800">
                                            <button onClick={() => { setInputMode('search'); setSearchResults([]); }} className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${inputMode === 'search' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Search</button>
                                            <button onClick={() => { setInputMode('scan'); }} className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${inputMode === 'scan' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Scan Img</button>
                                        </div>
                                    </div>

                                    {/* A. Search Mode */}
                                    {inputMode === 'search' && (
                                        <div className="space-y-4">
                                            <form onSubmit={handleSearch} className="relative">
                                                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Artist or Song..." className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 pl-10 text-sm focus:border-cyan-500 outline-none"/>
                                                <Search size={16} className="absolute left-3.5 top-3.5 text-zinc-500"/>
                                                {searchQuery && <button type="submit" className="absolute right-2 top-2 p-1.5 bg-zinc-800 rounded-lg text-white hover:bg-zinc-700"><Search size={14}/></button>}
                                            </form>
                                            <div className="space-y-2">
                                                {loading && <div className="py-4 text-center"><Loader2 className="animate-spin inline text-zinc-500"/></div>}
                                                {searchResults.map((track, idx) => (
                                                    <div key={idx} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/50 text-left transition group">
                                                        <img src={track.coverUrl} className="w-10 h-10 rounded bg-zinc-800 object-cover"/>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-white truncate">{track.title}</div>
                                                            <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                                                        </div>
                                                        <button 
                                                            onClick={() => addToQueue(track)}
                                                            className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700 transition"
                                                        >
                                                            <Plus size={16}/>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* B. Scan Mode */}
                                    {inputMode === 'scan' && (
                                        <div onClick={() => fileInputRef.current?.click()} className="h-32 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-zinc-800/30 transition">
                                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                            {analyzing ? <Loader2 className="animate-spin text-cyan-500"/> : <ImageIcon className="text-zinc-500 mb-2"/>}
                                            <p className="text-xs text-zinc-400">{analyzing ? 'AI Extracting songs...' : 'Upload Playlist Screenshot'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Queue List */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 min-h-[200px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            <ListChecks size={18} className="text-cyan-400"/> Mining Queue ({miningQueue.length})
                                        </h3>
                                        {miningQueue.length > 0 && (
                                            <button onClick={() => setMiningQueue([])} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
                                        )}
                                    </div>
                                    
                                    {miningQueue.length === 0 ? (
                                        <div className="text-center py-8 text-zinc-600 text-sm">Queue is empty. Add songs to mine.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {miningQueue.map((track, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-black border border-zinc-800 rounded-xl group hover:border-zinc-700 transition">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <img src={track.coverUrl} className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"/>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-white truncate">{track.title}</div>
                                                            <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <button 
                                                            onClick={() => setWorkingTrack(track)} 
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition"
                                                        >
                                                            <PlayCircle size={14}/> Mine
                                                        </button>
                                                        <button 
                                                            onClick={() => removeFromQueue(idx)}
                                                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400"
                                                        >
                                                            <X size={14}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* --- 2. Working Mode (Tagging Form) --- */}
                        <AnimatePresence>
                            {workingTrack && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    exit={{ opacity: 0, y: 20 }}
                                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                                        <div className="flex items-center gap-4">
                                            <img src={workingTrack.coverUrl} className="w-14 h-14 rounded-xl shadow-lg object-cover"/>
                                            <div>
                                                <h2 className="text-lg font-bold text-white">{workingTrack.title}</h2>
                                                <p className="text-sm text-cyan-400">{workingTrack.artist}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setWorkingTrack(null)} className="px-4 py-2 bg-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition">
                                            Cancel
                                        </button>
                                    </div>
                                    
                                    {/* Form Content */}
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Genre */}
                                            <div className="bg-black/50 border border-zinc-800 rounded-2xl p-5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block">Genres (Max 3)</label>
                                                <div className="relative mb-3">
                                                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-500"/>
                                                    <input type="text" value={genreSearch} onChange={(e) => setGenreSearch(e.target.value)} placeholder="Search..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-cyan-500 outline-none"/>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {filteredGenres.map(g => (
                                                        <button key={g} onClick={() => toggleSelection(selectedGenres, setSelectedGenres, g)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${selectedGenres.includes(g) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Mood */}
                                            <div className="bg-black/50 border border-zinc-800 rounded-2xl p-5">
                                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block">Moods (Max 3)</label>
                                                <div className="relative mb-3">
                                                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-500"/>
                                                    <input type="text" value={moodSearch} onChange={(e) => setMoodSearch(e.target.value)} placeholder="Search..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-cyan-500 outline-none"/>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                    {filteredMoods.map(m => (
                                                        <button key={m} onClick={() => toggleSelection(selectedMoods, setSelectedMoods, m)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${selectedMoods.includes(m) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="bg-black/50 border border-zinc-800 rounded-2xl p-6">
                                            <div className="flex justify-between items-end mb-4">
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Context Tags (Min 3)</label>
                                                <span className={`text-xs font-bold ${selectedTags.length >= 3 ? 'text-green-500' : 'text-red-500'}`}>{selectedTags.length} / 3 selected</span>
                                            </div>
                                            <div className="relative mb-4">
                                                <Search size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                                <input type="text" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search tags..." className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:border-cyan-500 outline-none"/>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                {filteredTags.map(t => (
                                                    <button key={t} onClick={() => toggleTag(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedTags.includes(t) ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                                                        #{t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <button onClick={handleSubmit} disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-white shadow-[0_10px_40px_rgba(6,182,212,0.2)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                            {loading ? <Loader2 className="animate-spin"/> : <Zap size={20} fill="currentColor"/>}
                                            Submit & Mine 10 pMLD
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>

            {/* Right Sidebar (Recent History) */}
            <div className="lg:col-span-3 space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 min-h-[400px]">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2"><History size={14}/> Recent Submissions</h3>
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {history.map(item => (
                                <div key={item.id} className="flex gap-3 items-start group">
                                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500"><Music size={14}/></div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-white truncate">{item.track_title}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">{item.track_artist}</div>
                                        <div className="text-[10px] text-green-500 font-mono mt-0.5">+{item.reward_amount} pMLD</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10"><Database size={24} className="mx-auto text-zinc-700 mb-2"/><p className="text-xs text-zinc-500">No mining history yet.</p></div>
                    )}
                </div>
            </div>
        </main>
    </div>
  );
}