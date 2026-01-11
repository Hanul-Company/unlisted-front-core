'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  DatabaseZap, Crown, ArrowLeft, Pencil, Check, ArrowUpToLine, Mic2, Loader2, Heart, Play, Pause, Plus, Trash2, 
  Music, ListMusic, MoreHorizontal, Search, X, AlertTriangle, Zap, 
  MoreVertical, Clock, Share2
} from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
// MobilePlayer, RentalModal, TradeModal import 삭제 (GlobalPlayer가 처리함)
// 단, 페이지 고유 기능인 'Extend'(연장), 'Invest', 'Register' 등의 로직을 위해 Modal을 쓸 수도 있지만,
// 여기서는 GlobalPlayer가 아닌 "페이지 로직용" 모달만 남기거나, GlobalPlayer의 함수를 씁니다.
// 대표님의 요청대로 "전역 플레이어"가 떴을 때 제어권을 넘깁니다.

import RentalModal from '../components/RentalModal'; // Extend용으로 유지
import TradeModal from '../components/TradeModal';   // Invest용으로 유지
import ShareButton from '../components/ui/ShareButton'; 

import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants'; 
import { parseEther } from 'viem';

// ✅ [NEW] Global Player Hook Import
import { usePlayer, Track } from '../context/PlayerContext';

type Playlist = { id: string; name: string; is_custom: boolean; };

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function LibraryPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();

  // ✅ [NEW] Global Player Hook 사용
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Data States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('liked');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [isAddingSongs, setIsAddingSongs] = useState(false);

  // UI States
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]); 
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const [activeMobileTrack, setActiveMobileTrack] = useState<Track | null>(null);

  // Modals (페이지 전용 로직)
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [trackToExtend, setTrackToExtend] = useState<Track | null>(null);
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);

  // --- Data Fetching Logic (기존 유지) ---
  useEffect(() => {
    const getProfileId = async () => {
      if (address) {
        const { data } = await supabase.from('profiles').select('id').eq('wallet_address', address).maybeSingle();
        if (data) setProfileId(data.id);
      }
    };
    getProfileId();
  }, [address]);

  useEffect(() => { if (profileId) fetchPlaylists(); }, [profileId]);
  useEffect(() => { if (profileId || (selectedPlaylist === 'my_songs' && address)) fetchTracks(selectedPlaylist); }, [profileId, selectedPlaylist, address]);

  // --- 기존 Audio Ref, useEffect, Player Handler 삭제됨 ---
  // (handleNext, handlePrev, toggleRepeat, formatTime, useMediaSession 등 삭제)

  // --- Business Logic (기존 유지) ---
  const handleRegister = async (track: Track) => {
    toast("Register logic here (Open Modal or Redirect)");
  };

  const handleCheckDuplicate = async (originalTrackId: number) => {
      toast.error(`This is a duplicate of track ID: ${originalTrackId}`);
  };

  const handleDeleteTrack = async (trackId: number) => {
      if(!confirm("Are you sure you want to delete this track?")) return;
      const { error } = await supabase.from('tracks').delete().eq('id', trackId);
      if (error) toast.error("Failed to delete");
      else { toast.success("Deleted"); fetchTracks(selectedPlaylist); }
  };

  const fetchPlaylists = async () => {
    if (!profileId) return;
    const systemPlaylists: Playlist[] = [
      { id: 'liked', name: 'Liked Songs', is_custom: false },
      { id: 'my_songs', name: 'My Songs', is_custom: false }
    ];
    const { data } = await supabase.from('playlists').select('*').eq('profile_id', profileId).order('created_at', { ascending: true });
    setPlaylists([...systemPlaylists, ...(data?.map((p: any) => ({ id: p.id, name: p.name, is_custom: true })) || [])]);
  };

  const fetchTracks = async (playlistId: string) => {
    setLoading(true);
    setTracks([]);
    setSearchQuery("");
    
    // ✅ 공통적으로 가져와야 할 아티스트 정보 쿼리 (Inner Join)
    // tracks 테이블과 연결된 artist(profiles 테이블) 정보를 같이 가져옵니다.
    const trackSelectQuery = `
      *,
      artist:profiles (
        username,
        wallet_address,
        avatar_url
      )
    `;

    try {
      if (playlistId === 'liked') {
        if (!profileId) return;
        // ✅ tracks(*) -> tracks(${trackSelectQuery}) 로 변경
        const { data } = await supabase
          .from('collections')
          .select(`expires_at, tracks(${trackSelectQuery})`) 
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false });
          
        if (data) setTracks(data.map((d: any) => ({ ...d.tracks, expires_at: d.expires_at })).filter(t => t && t.id)); 

      } else if (playlistId === 'my_songs') {
        if (!address) return;
        // ✅ 여기도 동일하게 변경
        const { data } = await supabase
          .from('track_contributors')
          .select(`tracks(${trackSelectQuery})`)
          .eq('wallet_address', address)
          .order('created_at', { ascending: false });

        if (data) {
          const myTracks = data.map((d: any) => d.tracks).filter(Boolean);
          // 중복 제거
          const uniqueTracks = Array.from(new Map(myTracks.map((item: any) => [item.id, item])).values());
          setTracks(uniqueTracks);
        }

      } else {
        // 커스텀 플레이리스트
        if (!profileId) return;
        
        // 1. 플레이리스트 아이템 가져오기 (아티스트 정보 포함)
        const { data } = await supabase
          .from('playlist_items')
          .select(`tracks(${trackSelectQuery})`)
          .eq('playlist_id', playlistId)
          .order('added_at', { ascending: false });
          
        const rawTracks = data?.map((d: any) => d.tracks).filter(Boolean) || [];

        // 2. 렌탈 정보(만료일) 병합하기
        if (rawTracks.length > 0) {
            const trackIds = rawTracks.map((t: any) => t.id);
            const { data: rentalData } = await supabase
              .from('collections')
              .select('track_id, expires_at')
              .eq('profile_id', profileId)
              .in('track_id', trackIds);
              
            const rentalMap = new Map();
            rentalData?.forEach((r: any) => { rentalMap.set(r.track_id, r.expires_at); });
            
            const mergedTracks = rawTracks.map((t: any) => ({ 
              ...t, 
              expires_at: rentalMap.get(t.id) || null 
            }));
            setTracks(mergedTracks);
        } else { 
            setTracks([]); 
        }
      }
    } catch (e) { 
        console.error(e); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleRenamePlaylist = async () => {
    if (!renameValue.trim()) return;
    if (!address) return toast.error("Wallet not connected.");
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;
    const { data, error } = await supabase.rpc('update_playlist_name_by_wallet', { p_playlist_id: selectedPlaylist, p_new_name: renameValue, p_wallet_address: address });
    if (error) { console.error(error); toast.error("Error updating playlist."); } 
    else if (data === 'OK') { toast.success("Renamed successfully!"); setIsRenaming(false); fetchPlaylists(); } 
    else { toast.error("Update failed. You may not be the owner."); }
  };

  const handleRemoveFromPlaylist = async (trackId: number) => {
    if (!address) return toast.error("Wallet not connected.");
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;
    const { data, error } = await supabase.rpc('remove_playlist_item_by_wallet', { p_playlist_id: selectedPlaylist, p_track_id: trackId, p_wallet_address: address });
    if (error || data !== 'OK') toast.error("Failed to remove.");
    else { toast.success("Removed."); fetchTracks(selectedPlaylist); setActiveMobileTrack(null); }
  };

  const handleMoveToTop = async (trackId: number) => {
    if (!address) return toast.error("Wallet not connected.");
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;
    const { data, error } = await supabase.rpc('move_playlist_item_top_by_wallet', { p_playlist_id: selectedPlaylist, p_track_id: trackId, p_wallet_address: address });
    if (error || data !== 'OK') toast.error("Failed to move.");
    else { toast.success("Moved to top!"); fetchTracks(selectedPlaylist); setActiveMobileTrack(null); }
  };

  const handleCreatePlaylist = async (nameOverride?: string) => {
    const nameToUse = nameOverride || newPlaylistName;
    if (!nameToUse.trim()) return;
    if (!profileId) return toast.error("Login required.");
    const { error } = await supabase.from('playlists').insert({ profile_id: profileId, name: nameToUse });
    if (!error) { toast.success("Created!"); fetchPlaylists(); setIsCreating(false); setNewPlaylistName(""); } 
    else { toast.error(error.message); }
  };

  const handleMobileCreatePlaylist = () => { const name = window.prompt("Enter new playlist name:"); if (name) { handleCreatePlaylist(name); } };
  
  const handleDeletePlaylist = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from('playlists').delete().eq('id', id);
    fetchPlaylists(); setSelectedPlaylist('liked');
  };

  const openExtendModal = (track: Track) => { setTrackToExtend(track); setShowRentalModal(true); setActiveMobileTrack(null); };
  const handleInvest = (track: Track) => { if (!address) return toast.error("Wallet not connected."); setTrackToInvest(track); setActiveMobileTrack(null); };

  const handleExtendConfirm = async (months: number, price: number) => {
    if (!trackToExtend || !address) return;
    const toastId = toast.loading("Processing extension...");
    try {
       if (price > 0) {
            let recipient = trackToExtend.uploader_address || "0x0000000000000000000000000000000000000000";
            const transaction = prepareContractCall({ contract: melodyTokenContract, method: "transfer", params: [recipient, parseEther(price.toString())] });
            await sendTransaction(transaction);
       }
       const { error } = await supabase.rpc('rent_track_via_wallet', { p_wallet_address: address, p_track_id: trackToExtend.id, p_months: months, p_price: price });
       if (error) throw error;
       toast.success(`Extended for ${months === 999 ? 'Forever' : months + ' Months'}!`, { id: toastId });
       setShowRentalModal(false); setTrackToExtend(null); fetchTracks(selectedPlaylist); 
    } catch (e: any) { console.error(e); toast.error("Extension failed: " + e.message, { id: toastId }); }
  };

  const getExpiryInfo = (dateStr?: string | null) => {
    if (!dateStr) return { label: "Forever", isUrgent: false, isExpired: false };
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { label: expiry.toLocaleDateString(), isUrgent: diffDays <= 7 && diffDays >= 0, isExpired: diffDays < 0 };
  };

  const openAddSongModal = async () => {
    if (!profileId) return;
    setSelectedTrackIds(new Set()); setModalSearchQuery(""); setShowAddModal(true); 
    const { data: likedData } = await supabase.from('collections').select('tracks(*)').eq('profile_id', profileId);
    const likedList = likedData?.map((d: any) => d.tracks).filter(Boolean) || [];
    let myList: Track[] = [];
    if (address) {
      const { data: myData } = await supabase.from('track_contributors').select('tracks(*)').eq('wallet_address', address);
      myList = myData?.map((d: any) => d.tracks).filter(Boolean) || [];
    }
    const combinedTracks = [...likedList, ...myList];
    const uniqueAllTracks = Array.from(new Map(combinedTracks.map(t => [t.id, t])).values());
    const currentPlaylistTrackIds = new Set(tracks.map(t => t.id));
    const filteredTracks = uniqueAllTracks.filter(track => !currentPlaylistTrackIds.has(track.id));
    setLikedTracks(filteredTracks);
  };

  const toggleTrackSelection = (trackId: number) => {
    const newSet = new Set(selectedTrackIds);
    if (newSet.has(trackId)) newSet.delete(trackId); else newSet.add(trackId);
    setSelectedTrackIds(newSet);
  };

  const handleAddSelectedTracks = async () => {
    if (typeof selectedPlaylist !== 'number') return;
    if (selectedTrackIds.size === 0) return;
    setIsAddingSongs(true);
    const toastId = toast.loading(`Adding ${selectedTrackIds.size} songs...`);
    try {
      const itemsToInsert = Array.from(selectedTrackIds).map(trackId => ({ playlist_id: selectedPlaylist, track_id: trackId }));
      const { error } = await supabase.from('playlist_items').upsert(itemsToInsert, { onConflict: 'playlist_id, track_id', ignoreDuplicates: true });
      if (error) throw error;
      toast.success("Songs added successfully!", { id: toastId });
      setShowAddModal(false); setSelectedTrackIds(new Set()); fetchTracks(selectedPlaylist); 
    } catch (e: any) { console.error(e); toast.error("Failed to add songs.", { id: toastId }); } finally { setIsAddingSongs(false); }
  };


  const filteredTracks = tracks.filter(t => t && t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const handlePlay = (track: Track) => {
      // track 데이터 안에 artist 객체가 이제 포함되어 있으므로 안전합니다.
      playTrack(track, filteredTracks);
  };
  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* Sidebar Mobile */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-zinc-950 border-r border-zinc-800 flex-col p-4">
        <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-6 flex items-center gap-2">← Back to Market</Link>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xs font-bold text-zinc-500 uppercase">My Library</h2>
          <button onClick={() => setIsCreating(true)} className="text-zinc-400 hover:text-white"><Plus size={18} /></button>
        </div>
        {isCreating && (
          <input autoFocus className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white mb-2" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); if (e.key === 'Escape') setIsCreating(false); }} />
        )}
        <div className="space-y-1 flex-1 overflow-y-auto">
          {playlists.map((p) => (
            <div key={p.id} className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${selectedPlaylist === p.id ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`} onClick={() => setSelectedPlaylist(p.id)}>
              <div className="flex items-center gap-3 overflow-hidden">
                {p.id === 'liked' ? <Heart size={16} className="text-indigo-500 fill-indigo-500" /> : p.id === 'my_songs' ? <DatabaseZap size={16} className="text-green-500" /> : <ListMusic size={16} />}
                <span className="truncate">{p.name}</span>
              </div>
              {p.is_custom && <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(p.id); }} className="text-zinc-500 hover:text-red-500"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-zinc-800"><HeaderProfile /></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-black relative w-full overflow-x-hidden">
        
        {/* Mobile Header */}
        <div className="md:hidden pt-4 px-4 bg-gradient-to-b from-zinc-900 to-black sticky top-0 z-20">
            <div className="flex items-center justify-between mb-4">
                <Link href="/market" className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-full text-white text-sm font-bold hover:bg-zinc-700 transition pr-4">
                    <ArrowLeft size={18}/> Back
                </Link>
                <HeaderProfile />
            </div>
            
            <div className="flex items-center gap-4 mb-6">
                 <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-2">
                     {playlists.map(p => (
                         <button key={p.id} onClick={() => setSelectedPlaylist(p.id)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border ${selectedPlaylist === p.id ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>{p.name}</button>
                     ))}
                     <button onClick={handleMobileCreatePlaylist} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 flex-shrink-0 active:scale-95 transition"><Plus size={16}/></button>                 
                 </div>
            </div>

            <div className="flex items-end justify-between mb-4 px-1">
                <div>
                     <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">PLAYLIST</span>
                     <h1 className="text-2xl font-black text-white leading-tight">
                         {playlists.find(p => p.id === selectedPlaylist)?.name || "Library"}
                     </h1>
                </div>
                {filteredTracks.length > 0 && (
                    <button onClick={() => handlePlay(filteredTracks[0])} className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 text-black active:scale-95 transition"><Play fill="black" className="ml-1"/></button>
                )}
            </div>
            
            <div className="relative mb-2">
                 <Search className="absolute left-3 top-2.5 text-zinc-500" size={14}/>
                 <input type="text" placeholder="Search songs..." className="w-full bg-zinc-900 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-700" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
            </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex h-64 bg-gradient-to-b from-zinc-800 to-black p-8 items-end justify-between">
            <div className="flex items-end gap-6 w-full">
                <div className="w-40 h-40 bg-zinc-800 shadow-2xl rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {tracks.length > 0 && tracks[0].cover_image_url ? (
                        <img src={tracks[0].cover_image_url} className="w-full h-full object-cover" />
                    ) : (
                        selectedPlaylist === 'liked' ? <Heart size={48} className="text-indigo-500 fill-indigo-500" /> : selectedPlaylist === 'my_songs' ? <Mic2 size={48} className="text-green-500" /> : <Music size={48} className="text-zinc-600" />
                    )}
                </div>
                
                <div className="mb-1 w-full flex-1">
                    <span className="text-xs font-bold uppercase text-white/80">Playlist</span>
                    {isRenaming ? (
                        <div className="flex items-center gap-2 mt-2">
                            <input autoFocus className="text-4xl font-black bg-transparent border-b border-white text-white focus:outline-none w-full max-w-xl" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenamePlaylist()} />
                            <button onClick={handleRenamePlaylist} className="p-2 bg-green-500 rounded-full text-black hover:scale-110 transition"><Check size={20} /></button>
                            <button onClick={() => setIsRenaming(false)} className="p-2 bg-zinc-800 rounded-full text-white hover:bg-zinc-700 transition"><X size={20} /></button>
                        </div>
                    ) : (
                        <h1 className="text-5xl font-black tracking-tight truncate max-w-3xl flex items-center gap-4 group pb-1">
                            {playlists.find(p => p.id === selectedPlaylist)?.name}
                            {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                                <button onClick={() => { setRenameValue(playlists.find(p => p.id === selectedPlaylist)?.name || ""); setIsRenaming(true); }} className="opacity-0 group-hover:opacity-100 transition text-zinc-500 hover:text-white"><Pencil size={24} /></button>
                            )}
                        </h1>
                    )}
                    <p className="text-zinc-400 text-sm mt-2">{filteredTracks.length} songs</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 mb-2">
                 <button onClick={() => { if(tracks.length > 0) handlePlay(tracks[0]); }} className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg"><Play fill="black" className="ml-1" /></button>
                 {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                    <button onClick={openAddSongModal} className="w-10 h-10 rounded-full border border-zinc-600 text-zinc-400 flex items-center justify-center hover:border-white hover:text-white transition"><Plus size={20} /></button>
                 )}
            </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-0 md:p-6 pb-32">
            {loading ? <div className="text-center pt-20 text-zinc-500"><Loader2 className="animate-spin mr-2 inline" /> Loading...</div> : filteredTracks.length === 0 ? <div className="text-center pt-20 text-zinc-500">No tracks.</div> : (
                <>
                {/* Desktop Table View */}
                <table className="w-full text-left border-collapse hidden md:table">
                    <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                        <tr>
                            <th className="font-normal p-3 w-12 text-center">#</th>
                            <th className="font-normal p-3">Title</th>
                            <th className="font-normal p-3 w-60">Expires</th>
                            <th className="font-normal p-3 w-32 text-center"><MoreHorizontal size={16} className="mx-auto"/></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTracks.map((track, idx) => {
                            const { label: expiryLabel, isUrgent } = getExpiryInfo(track.expires_at);
                            const isLikedSongs = selectedPlaylist === 'liked';
                            const isMySongs = selectedPlaylist === 'my_songs';
                            const isCustomPlaylist = !isLikedSongs && !isMySongs;
                            const isProcessingThis = processingTrackId === track.id;
                            const errorString = track.mint_error ? String(track.mint_error).trim() : '';
                            const isDuplicateError = errorString.includes('duplicate_melody_hash') || !!track.duplicate_of_track_id;
                            
                            // ✅ Global Player State Check
                            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
                            const isThisTrackActive = currentTrack?.id === track.id;

                            return (
                                <tr key={track.id} className={`group hover:bg-zinc-900/60 rounded-lg transition ${isThisTrackActive ? 'text-green-400' : 'text-zinc-300'}`} onDoubleClick={() => handlePlay(track)}>
                                    <td className="p-3 w-12 text-center text-sm">
                                        <span className={`group-hover:hidden ${isThisTrackActive ? 'hidden' : 'block'}`}>{idx + 1}</span>
                                        <button onClick={() => isThisTrackActive ? togglePlay() : handlePlay(track)} className={`hidden group-hover:inline-block ${isThisTrackActive ? '!inline-block' : ''}`}>
                                            {isThisTrackPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                                                {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <Music className="p-2 text-zinc-500" />}
                                            </div>
                                            <div><div className="font-bold text-sm">{track.title}</div><div className="text-xs text-zinc-500">{track.artist?.username}</div></div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-sm w-60 group/expires">
                                        <div className="flex items-center gap-4 h-8"> 
                                            {track.expires_at ? (
                                                <div className={`flex items-center gap-2 whitespace-nowrap ${isUrgent ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                                                    <Clock size={14} /><span>{expiryLabel}</span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 text-xs flex items-center gap-1 whitespace-nowrap"><Crown size={12} className="text-yellow-500"/> Owned</span>
                                            )}
                                            {track.expires_at && (
                                                <button onClick={(e) => { e.stopPropagation(); openExtendModal(track); }} className="opacity-0 group-hover/expires:opacity-100 transition-opacity duration-200 text-[10px] font-bold border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 py-1 rounded hover:border-green-400 hover:text-white">Extend</button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 w-32">
                                        <div className="flex items-center justify-center gap-3">
                                            {isCustomPlaylist && (
                                                <>
                                                    {track.is_minted && ( <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="text-zinc-500 hover:text-yellow-400 transition" title="Invest"><Zap size={16} /></button> )}
                                                    <button onClick={(e) => { e.stopPropagation(); handleMoveToTop(track.id); }} className="text-zinc-500 hover:text-white transition" title="Move to Top"><ArrowUpToLine size={16} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id); }} className="text-zinc-500 hover:text-red-500 transition" title="Remove"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                            {isLikedSongs && track.is_minted && ( <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="text-zinc-500 hover:text-yellow-400 transition" title="Invest"><Zap size={16} /></button> )}
                                            {isMySongs && (() => {
                                                if (isDuplicateError) {
                                                    return ( <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id); }} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button><button onClick={(e) => { e.stopPropagation(); if (track.duplicate_of_track_id) handleCheckDuplicate(track.duplicate_of_track_id); }} className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition flex items-center gap-1"><AlertTriangle size={12}/> Rejected</button></div> );
                                                }
                                                if (track.is_minted) {
                                                    return ( <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white hover:text-black transition">Invest</button> );
                                                }
                                                return ( <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id); }} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button><button onClick={(e) => { e.stopPropagation(); handleRegister(track); }} className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-cyan-500 hover:text-white transition" disabled={isProcessingThis}>{isProcessingThis ? <Loader2 className="animate-spin" size={12}/> : 'Register'}</button></div> );
                                            })()}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Mobile List View */}
                <div className="md:hidden space-y-2 px-4">
                    {filteredTracks.map((track) => {
                        const { isExpired } = getExpiryInfo(track.expires_at);
                        const isThisTrackActive = currentTrack?.id === track.id;
                        return (
                            <div key={track.id} onClick={() => handlePlay(track)} className={`w-full max-w-full flex items-center justify-between p-2 rounded-xl active:bg-zinc-900 transition ${isThisTrackActive ? 'bg-zinc-900' : ''}`}>
                                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative shadow-sm">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <Music className="p-3 text-zinc-500" />}
                                        {isExpired ? ( <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><AlertTriangle size={16} className="text-red-500"/></div> ) : !track.expires_at ? ( <div className="absolute top-0 right-0 p-0.5 bg-yellow-500/80 rounded-bl-md"><Zap size={8} className="text-black fill-black"/></div> ) : null}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isThisTrackActive ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
                                        <div className="text-xs text-zinc-500 truncate">{track.artist?.username}</div>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setActiveMobileTrack(track); }} className="p-3 text-zinc-500 hover:text-white flex-shrink-0"><MoreVertical size={20}/></button>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>

        {/* Mobile Bottom Sheet (Local logic only) */}
        {activeMobileTrack && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setActiveMobileTrack(null)}>
                <div className="bg-zinc-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
                        <div className="w-14 h-14 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                            {activeMobileTrack.cover_image_url ? <img src={activeMobileTrack.cover_image_url} className="w-full h-full object-cover" /> : <Music size={24}/>}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white line-clamp-1">{activeMobileTrack.title}</h3>
                            <p className="text-zinc-500 text-sm">{activeMobileTrack.artist?.username}</p>
                        </div>
                    </div>
                    <div className="space-y-1">
                        {/* Mobile Actions Logic (Register, Invest etc.) */}
                        {(() => {
                            if (selectedPlaylist === 'my_songs') {
                                // ... (기존 Mobile Bottom Sheet 로직 유지)
                                if (!activeMobileTrack.is_minted) {
                                    return (
                                        <>
                                            <button onClick={() => { handleRegister(activeMobileTrack); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-cyan-500">
                                                <Zap size={20}/> 
                                                <div><div className="font-bold text-sm">Register Song</div><div className="text-xs text-zinc-500">Publish to Market</div></div>
                                            </button>
                                            <button onClick={() => { handleDeleteTrack(activeMobileTrack.id); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-zinc-400">
                                                <Trash2 size={20}/> <span className="text-sm font-bold">Delete Track</span>
                                            </button>
                                        </>
                                    );
                                }
                            }
                            return null;
                        })()}
                        {activeMobileTrack.is_minted && (
                            <button onClick={() => { handleInvest(activeMobileTrack); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left">
                                <Zap className="text-yellow-500" size={20}/>
                                <div><div className="font-bold text-sm text-white">Invest in Song</div><div className="text-xs text-zinc-500">Buy shares & earn royalties</div></div>
                            </button>
                        )}
                        {activeMobileTrack.expires_at && (
                            <button onClick={() => { openExtendModal(activeMobileTrack); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left">
                                <Clock className="text-green-500" size={20}/>
                                <div><div className="font-bold text-sm text-white">Extend Collection</div><div className="text-xs text-zinc-500">Expires: {new Date(activeMobileTrack.expires_at).toLocaleDateString()}</div></div>
                            </button>
                        )}
                        <div className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition">
                            <div className="flex items-center gap-4"><Share2 className="text-zinc-400" size={20}/><div><div className="font-bold text-sm text-white">Share</div><div className="text-xs text-zinc-500">Instagram & Link</div></div></div>
                            <ShareButton assetId={activeMobileTrack.id.toString()} trackData={{ title: activeMobileTrack.title, artist: activeMobileTrack.artist?.username || activeMobileTrack.artist_name || "Unknown", coverUrl: activeMobileTrack.cover_image_url || "" }} className="bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-white" />
                        </div>
                    </div>
                    <button onClick={() => setActiveMobileTrack(null)} className="w-full mt-4 py-3 bg-black rounded-xl font-bold text-zinc-500">Cancel</button>
                </div>
            </div>
        )}

        {/* Global Player, Mobile Player, Desktop Footer Code Removed Here (Handled by GlobalPlayer in layout) */}

        {/* Add Song Modal (Local Logic) */}
        {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-white">Add Songs</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition"><X size={20}/></button>
            </div>
            <div className="p-4 border-b border-zinc-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-zinc-500" size={18}/>
                <input type="text" placeholder="Search your library..." value={modalSearchQuery} onChange={(e) => setModalSearchQuery(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-green-500 transition"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {likedTracks.filter(t => t.title.toLowerCase().includes(modalSearchQuery.toLowerCase())).map(track => {
                  const isSelected = selectedTrackIds.has(track.id);
                  return (
                    <div key={track.id} onClick={() => toggleTrackSelection(track.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition group border ${isSelected ? 'bg-green-500/10 border-green-500/30' : 'bg-transparent border-transparent hover:bg-zinc-800'}`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${isSelected ? 'bg-green-500 border-green-500 text-black' : 'border-zinc-600 group-hover:border-zinc-400'}`}>{isSelected && <Check size={14} strokeWidth={4} />}</div>
                      <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden shrink-0">{track.cover_image_url && <img src={track.cover_image_url} className="w-full h-full object-cover"/>}</div>
                      <div className="flex-1 min-w-0"><div className={`font-bold text-sm truncate ${isSelected ? 'text-green-400' : 'text-white'}`}>{track.title}</div><div className="text-xs text-zinc-500 truncate">{track.artist?.username}</div></div>
                    </div>
                  );
                })}
                {likedTracks.length === 0 && (<div className="text-center text-zinc-500 py-10 text-sm">No songs in your library.</div>)}
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 rounded-b-2xl shrink-0">
              <button onClick={handleAddSelectedTracks} disabled={selectedTrackIds.size === 0 || isAddingSongs} className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isAddingSongs ? <Loader2 className="animate-spin" /> : <>Add {selectedTrackIds.size > 0 ? `${selectedTrackIds.size} Songs` : ''}<Plus size={18} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Local Page Modals (Extend / Invest) */}
        {showRentalModal && trackToExtend &&(
        <RentalModal
            isOpen={showRentalModal}
            onClose={() => { setShowRentalModal(false); setTrackToExtend(null); }}
            onConfirm={handleExtendConfirm}
            isLoading={false}
            isExtension={true}
            currentExpiryDate={trackToExtend.expires_at ? new Date(trackToExtend.expires_at).toLocaleDateString() : null}
            targetTitle={trackToExtend.title}
        />
        )}
        
        {trackToInvest && (
            <TradeModal
                isOpen={!!trackToInvest}
                onClose={() => setTrackToInvest(null)}
                // ✅ [Fix] GlobalPlayer와 동일한 타입 에러 방지
                track={{
                    ...trackToInvest,
                    token_id: trackToInvest.token_id ?? null
                }}
            />
        )}
      </div>
    </div>
  );
}