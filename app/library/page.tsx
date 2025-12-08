'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, Heart, Play, Pause, Plus, Trash2, Music, ListMusic, MoreHorizontal, Search, X, Shuffle, SkipForward, SkipBack, Repeat, Repeat1, Disc, Volume2, VolumeX, Menu } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar'; 
import MobilePlayer from '../components/MobilePlayer';   

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants'; // 라이브러리에선 Stock 컨트랙트는 당장 안 쓰지만 import 유지

type Track = { id: number; title: string; artist_name: string; audio_url: string; cover_image_url: string | null; };
type Playlist = { id: string; name: string; is_custom: boolean; };

export default function LibraryPage() {
  const account = useActiveAccount();
  const address = account?.address;

  // [변경] Transaction Hook
  const { mutate: sendTransaction } = useSendTransaction();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // UI States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('liked'); 
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Mobile UX States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); 
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false); 

  // Search & Modal
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]); 
  const [modalSearchQuery, setModalSearchQuery] = useState(""); 
  
  // Playlist Creation
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Player States
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off'|'all'|'one'>('all'); 
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // --- Initial Loading ---
  useEffect(() => {
    const getProfileId = async () => {
        // Web2 User
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
             const { data } = await supabase.from('profiles').select('id').eq('auth_user_id', session.user.id).maybeSingle();
             if (data) setProfileId(data.id);
             return;
        }
        // Web3 User
        if (address) {
            const { data } = await supabase.from('profiles').select('id').eq('wallet_address', address).maybeSingle();
            if (data) setProfileId(data.id);
        }
    };
    getProfileId();
  }, [address]);

  useEffect(() => { if (profileId) fetchPlaylists(); }, [profileId]);
  useEffect(() => { if (profileId) fetchTracks(selectedPlaylist); }, [profileId, selectedPlaylist]);
  
  // --- Audio Logic ---
  useEffect(() => { 
    const audio = audioRef.current;
    if (currentTrack && audio) { 
        if (audio.src !== currentTrack.audio_url) {
            audio.src = currentTrack.audio_url;
            audio.load();
            setCurrentTime(0);
            if(isPlaying) audio.play().catch(console.error);
        }
    } 
  }, [currentTrack]);
  useEffect(() => { const audio = audioRef.current; if (audio && currentTrack) { if (isPlaying) { if (audio.paused) audio.play().catch(console.error); } else { audio.pause(); } } }, [isPlaying]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  // --- Handlers ---
  const handleTrackEnd = () => {
    if (repeatMode === 'one') { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } return; }
    handleNext();
  };
  const handleNext = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return setIsPlaying(false);
    let nextIndex = 0;
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    if (isShuffle) { nextIndex = Math.floor(Math.random() * list.length); } 
    else { if (currentIndex === list.length - 1 && repeatMode === 'off') { setIsPlaying(false); return; } nextIndex = (currentIndex + 1) % list.length; }
    setCurrentTrack(list[nextIndex]); setIsPlaying(true);
  };
  const handlePrev = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return;
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    if (currentTime > 3) { if(audioRef.current) audioRef.current.currentTime = 0; return; }
    let prevIndex = (currentIndex - 1 + list.length) % list.length;
    setCurrentTrack(list[prevIndex]); setIsPlaying(true);
  };
  const toggleRepeat = () => { if (repeatMode === 'off') setRepeatMode('all'); else if (repeatMode === 'all') setRepeatMode('one'); else setRepeatMode('off'); };
  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; setVolume(Math.min(Math.max(x / rect.width, 0), 1)); setIsMuted(false); };
  const formatTime = (time: number) => { if(isNaN(time)) return "0:00"; const min = Math.floor(time / 60); const sec = Math.floor(time % 60); return `${min}:${sec < 10 ? '0' : ''}${sec}`; };

  // --- Fetchers ---
  const fetchPlaylists = async () => {
    if (!profileId) return;
    const defaultList: Playlist = { id: 'liked', name: 'Liked Songs', is_custom: false };
    const { data } = await supabase.from('playlists').select('*').eq('profile_id', profileId).order('created_at', { ascending: true });
    setPlaylists([defaultList, ...(data?.map((p: any) => ({ id: p.id, name: p.name, is_custom: true })) || [])]);
  };
  const fetchTracks = async (playlistId: string) => {
    if (!profileId) return;
    setLoading(true); setTracks([]); setSearchQuery(""); 
    try {
        if (playlistId === 'liked') {
            const { data } = await supabase.from('collections').select('tracks(*)').eq('profile_id', profileId).order('created_at', { ascending: false });
            if (data) setTracks(data.map((d: any) => d.tracks).filter(Boolean));
        } else {
            const { data } = await supabase.from('playlist_items').select('tracks(*)').eq('playlist_id', playlistId).order('added_at', { ascending: false });
            if (data) setTracks(data.map((d: any) => d.tracks).filter(Boolean));
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- Actions ---
  const handleCreatePlaylist = async () => { 
      if (!newPlaylistName.trim()) return;
      if (!profileId) return toast.error("로그인 필요");
      const { error } = await supabase.from('playlists').insert({ profile_id: profileId, name: newPlaylistName }); 
      if(!error) { toast.success("Created!"); fetchPlaylists(); setIsCreating(false); setNewPlaylistName(""); } else { toast.error(error.message); }
  };
  const handleDeletePlaylist = async (id: string) => { if(!confirm("Delete?")) return; await supabase.from('playlists').delete().eq('id', id); fetchPlaylists(); setSelectedPlaylist('liked'); };
  const playTrack = (track: Track) => { if (currentTrack?.id === track.id) { setIsPlaying(!isPlaying); } else { setCurrentTrack(track); setIsPlaying(true); } setMobilePlayerOpen(true); };
  const handlePlayAll = () => { const list = filteredTracks.length > 0 ? filteredTracks : tracks; if (list.length === 0) return toast.error("No tracks."); setCurrentTrack(isShuffle ? list[Math.floor(Math.random() * list.length)] : list[0]); setIsPlaying(true); setMobilePlayerOpen(true); };

  // --- Modal Logic ---
  const openAddSongModal = async () => { if (!profileId) return; setShowAddModal(true); setModalSearchQuery(""); const { data } = await supabase.from('collections').select('tracks(*)').eq('profile_id', profileId); if (data) setLikedTracks(data.map((d: any) => d.tracks).filter(Boolean)); };
  const addToPlaylist = async (trackId: number) => {
    const { data } = await supabase.from('playlist_items').select('*').match({ playlist_id: selectedPlaylist, track_id: trackId }).maybeSingle();
    if (data) return toast.error("Already in playlist.");
    await supabase.from('playlist_items').insert({ playlist_id: selectedPlaylist, track_id: trackId });
    toast.success("Added!"); fetchTracks(selectedPlaylist); setShowAddModal(false);
  };
  
  const filteredTracks = tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || (t.artist_name && t.artist_name.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredModalTracks = likedTracks.filter(t => t.title.toLowerCase().includes(modalSearchQuery.toLowerCase()) || (t.artist_name && t.artist_name.toLowerCase().includes(modalSearchQuery.toLowerCase())));
  const playlistCoverImage = tracks.length > 0 && tracks[0].cover_image_url ? tracks[0].cover_image_url : null;


  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <audio ref={audioRef} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (!isNaN(d) && d !== Infinity) setDuration(d); }} onEnded={handleTrackEnd} preload="auto" crossOrigin="anonymous"/>
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Desktop Sidebar (기존 동일) */}
      <div className="hidden md:flex w-64 bg-zinc-950 border-r border-zinc-800 flex-col p-4">
        <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-6 flex items-center gap-2">← Back to Market</Link>
        <div className="flex items-center justify-between mb-4 px-2"><h2 className="text-xs font-bold text-zinc-500 uppercase">My Library</h2><button onClick={() => setIsCreating(true)} className="text-zinc-400 hover:text-white"><Plus size={18}/></button></div>
        {isCreating && <input autoFocus className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white mb-2" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); if(e.key==='Escape') setIsCreating(false); }} />}
        <div className="space-y-1 flex-1 overflow-y-auto">
            {playlists.map((p) => (
                <div key={p.id} className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${selectedPlaylist === p.id ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`} onClick={() => setSelectedPlaylist(p.id)}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        {p.id === 'liked' ? <Heart size={16} className="text-indigo-500 fill-indigo-500"/> : <ListMusic size={16}/>}
                        <span className="truncate">{p.name}</span>
                    </div>
                    {p.is_custom && <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(p.id); }} className="text-zinc-500 hover:text-red-500"><Trash2 size={14}/></button>}
                </div>
            ))}
        </div>
        <div className="pt-4 border-t border-zinc-800"><HeaderProfile/></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-black relative">
        
        {/* [Mobile] Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
            <button onClick={() => setMobileMenuOpen(true)}><Menu/></button>
            <span className="font-bold text-lg">Library</span>
            <HeaderProfile/>
        </div>

{/* [Mobile] Playlist Tabs (Horizontal Scroll) */}
        {/* [수정] 버튼들을 감싸는 div를 만들고, 탭 영역만 overflow-x-auto 적용 */}
        <div className="md:hidden border-b border-zinc-800 bg-black">
            
            {/* 1. 플레이리스트 탭 (가로 스크롤) */}
            <div className="flex overflow-x-auto p-4 gap-2 scrollbar-hide w-full">
                {/* Create Button */}
                <button 
                    onClick={() => setIsCreating(true)} 
                    className="px-3 py-2 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-700 flex-shrink-0"
                >
                    <Plus size={16}/>
                </button>
                
                {/* Playlist Creation Input (조건부) */}
                {isCreating && (
                    <input 
                        autoFocus 
                        className="w-32 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none flex-shrink-0" 
                        value={newPlaylistName} 
                        onChange={(e) => setNewPlaylistName(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }} 
                        onBlur={() => setIsCreating(false)}
                        placeholder="Name..."
                    />
                )}

                {/* Playlist Items */}
                {playlists.map(p => (
                    <button 
                        key={p.id} 
                        onClick={() => setSelectedPlaylist(p.id)} 
                        className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border flex-shrink-0 transition ${
                            selectedPlaylist === p.id 
                            ? 'bg-white text-black font-bold border-white' 
                            : 'bg-black text-zinc-400 border-zinc-800'
                        }`}
                    >
                        {p.name}
                    </button>
                ))}
            </div>

            {/* 2. Add Songs Button (별도 줄) */}
            {/* 커스텀 플레이리스트일 때만 표시 */}
            {selectedPlaylist !== 'liked' && (
                <div className="px-4 pb-4 w-full">
                    <button 
                        onClick={openAddSongModal} 
                        className="w-full bg-zinc-900 border border-zinc-700 text-cyan-400 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                    >
                        <Plus size={16}/> Add Songs to Playlist
                    </button>
                </div>
            )}
        </div>
        
        {/* 모바일에서 플레이리스트 생성 입력창 */}
        {isCreating && (
            <div className="md:hidden px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                <input autoFocus className="w-full bg-black border border-zinc-700 rounded p-2 text-sm text-white" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }} placeholder="New Playlist Name" />
            </div>
        )}

        {/* Desktop Header */}
        <div className="hidden md:flex h-64 bg-gradient-to-b from-zinc-800 to-black p-8 items-end justify-between">
            <div className="flex items-end gap-6">
                <div className="w-40 h-40 bg-zinc-800 shadow-2xl rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {playlistCoverImage ? <img src={playlistCoverImage} className="w-full h-full object-cover"/> : (selectedPlaylist === 'liked' ? <Heart size={48} className="text-indigo-500 fill-indigo-500"/> : <Music size={48} className="text-zinc-600"/>)}
                </div>
                <div className="mb-1">
                    <span className="text-xs font-bold uppercase text-white/80">Playlist</span>
                    <h1 className="text-5xl font-black mt-1 mb-2 tracking-tight">{playlists.find(p => p.id === selectedPlaylist)?.name}</h1>
                    <p className="text-zinc-400 text-sm">{filteredTracks.length} songs</p>
                </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
                <button onClick={handlePlayAll} className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg">{isPlaying && tracks.some(t => t.id === currentTrack?.id) ? <Pause fill="black"/> : <Play fill="black" className="ml-1"/>}</button>
                <button onClick={() => setIsShuffle(!isShuffle)} className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${isShuffle ? 'bg-zinc-800 border-green-500 text-green-500' : 'border-zinc-600 text-zinc-400 hover:border-white hover:text-white'}`} title="Shuffle"><Shuffle size={18}/></button>
                {selectedPlaylist !== 'liked' && <button onClick={openAddSongModal} className="w-10 h-10 rounded-full border border-zinc-600 text-zinc-400 flex items-center justify-center hover:border-white hover:text-white transition" title="Add Songs"><Plus size={20}/></button>}
            </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black/95 backdrop-blur z-10 flex items-center justify-between gap-4">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-zinc-500" size={14}/>
                <input type="text" placeholder="Search..." className="w-full bg-zinc-900 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>
            {/* Desktop Add Button (기존) */}
            <div className="hidden md:block">
             {selectedPlaylist !== 'liked' && <button onClick={openAddSongModal} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 border border-zinc-700"><Plus size={14}/> Add Songs</button>}
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {loading ? <div className="text-center pt-20 text-zinc-500"><Loader2 className="animate-spin mr-2 inline"/> Loading tracks...</div> : filteredTracks.length === 0 ? <div className="text-center pt-20 text-zinc-500">{searchQuery ? "No search results." : "No tracks found."}</div> : (
                <table className="w-full text-left border-collapse">
                    <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800 hidden md:table-header-group">
                        <tr><th className="font-normal p-3 w-12 text-center">#</th><th className="font-normal p-3">Title</th><th className="font-normal p-3 hidden md:table-cell">Album</th><th className="font-normal p-3 w-16 text-center"><MoreHorizontal size={16}/></th></tr>
                    </thead>
                    <tbody>
                        {filteredTracks.map((track, idx) => (
                            <tr key={track.id} className={`group hover:bg-zinc-900/60 rounded-lg transition ${currentTrack?.id === track.id ? 'text-green-400' : 'text-zinc-300'}`} onDoubleClick={() => playTrack(track)}>
                                <td className="p-3 w-12 text-center text-sm hidden md:table-cell">
                                    <span className={`group-hover:hidden ${currentTrack?.id === track.id ? 'hidden' : 'block'}`}>{idx + 1}</span>
                                    <button onClick={() => playTrack(track)} className={`hidden group-hover:inline-block ${currentTrack?.id === track.id ? '!inline-block' : ''}`}>{currentTrack?.id === track.id && isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}</button>
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                                            {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <Music className="p-2 text-zinc-500"/>}
                                            {/* Mobile Play Overlay */}
                                            <div className="absolute inset-0 flex md:hidden items-center justify-center" onClick={() => playTrack(track)}></div>
                                        </div>
                                        <div onClick={() => playTrack(track)} className="cursor-pointer md:cursor-default">
                                            <div className="font-bold text-sm">{track.title}</div>
                                            <div className="text-xs text-zinc-500">{track.artist_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 hidden md:table-cell text-sm text-zinc-500">Unlisted Single</td>
                                <td className="p-3 text-center hidden md:table-cell"><Heart size={16} className="text-pink-500 fill-pink-500 inline"/></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        {/* Desktop Footer Player */}
        {currentTrack && (
            <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
                {/* ... (기존 PC 푸터 코드 동일) ... */}
                <div className="flex items-center gap-4 w-1/3">
                    <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">{currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700 animate-spin-slow"/></div>}</div>
                    <div className="overflow-hidden"><div className="text-sm font-bold truncate text-white">{currentTrack.title}</div><div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist_name || 'Unlisted Artist'}</div></div>
                </div>
                <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="flex items-center gap-6">
                        <button className="text-zinc-400 hover:text-white transition" onClick={() => setIsShuffle(!isShuffle)}><Shuffle size={16} className={isShuffle?'text-green-500':''}/></button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20}/></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">{isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}</button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20}/></button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={toggleRepeat}>{repeatMode === 'one' ? <Repeat1 size={16} className="text-green-500"/> : <Repeat size={16} className={repeatMode==='all'?'text-green-500':''}/>}</button>
                    </div>
                    <div className="w-full max-w-sm flex items-center gap-3"><span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span><div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer"><div className="h-full bg-white rounded-full" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }}/></div><span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span></div>
                </div>
                <div className="w-1/3 flex justify-end items-center gap-4">
                    <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-white transition">{isMuted || volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative group" onClick={handleVolumeClick}><div className="absolute inset-0 group-hover:bg-zinc-700 transition"/><div className="h-full bg-zinc-400 group-hover:bg-cyan-500 rounded-full relative transition-all" style={{ width: `${(isMuted?0:volume)*100}%` }}/></div>
                </div>
            </div>
        )}

        {/* Mobile Full Player (Visible when playing on mobile) */}
        {currentTrack && mobilePlayerOpen && (
            <MobilePlayer 
                track={currentTrack}
                isPlaying={isPlaying}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                onNext={handleNext}
                onPrev={handlePrev}
                onClose={() => setMobilePlayerOpen(false)}
                repeatMode={repeatMode}
                onToggleRepeat={toggleRepeat}
                isShuffle={isShuffle}
                onToggleShuffle={() => setIsShuffle(!isShuffle)}
                currentTime={currentTime}
                duration={duration}
                onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }}
            />
        )}
        
        {/* Mobile Mini Player Bar (When minimized) */}
        {currentTrack && !mobilePlayerOpen && (
             <div className="md:hidden fixed bottom-16 left-2 right-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center justify-between shadow-2xl z-50" onClick={() => setMobilePlayerOpen(true)}>
                 <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden"><img src={currentTrack.cover_image_url || ''} className="w-full h-full object-cover"/></div>
                     <div><div className="font-bold text-sm truncate w-40">{currentTrack.title}</div><div className="text-xs text-zinc-500">{currentTrack.artist_name}</div></div>
                 </div>
                 <div className="flex items-center gap-3 pr-2">
                     <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}>{isPlaying ? <Pause size={24} fill="white"/> : <Play size={24} fill="white"/>}</button>
                 </div>
             </div>
        )}

        {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-zinc-900 w-full max-w-md h-[600px] rounded-2xl flex flex-col shadow-2xl border border-zinc-800">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold">Add from Liked Songs</h3><button onClick={() => setShowAddModal(false)}><X size={20} className="text-zinc-500 hover:text-white"/></button></div>
                    <div className="p-3 border-b border-zinc-800/50 relative"><Search className="absolute left-6 top-5 text-zinc-500" size={14}/><input type="text" placeholder="Find a song..." className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500" value={modalSearchQuery} onChange={(e) => setModalSearchQuery(e.target.value)} autoFocus /></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredModalTracks.length === 0 ? <div className="p-10 text-center text-zinc-500 text-xs">No results.</div> : filteredModalTracks.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-lg group transition"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0"><img src={t.cover_image_url || ''} className="w-full h-full object-cover"/></div><div className="overflow-hidden"><div className="font-bold text-sm truncate w-40">{t.title}</div><div className="text-xs text-zinc-500 truncate">{t.artist_name}</div></div></div><button onClick={() => addToPlaylist(t.id)} className="bg-zinc-700 hover:bg-green-600 hover:text-white text-zinc-400 p-1.5 rounded-full transition"><Plus size={16}/></button></div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}