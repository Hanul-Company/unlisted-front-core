'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Pencil, Check, ArrowUpToLine, Mic2, Loader2, Heart, Play, Pause, Plus, Trash2, Music, ListMusic, MoreHorizontal, Search, X, Shuffle, SkipForward, SkipBack, Repeat, Repeat1, Disc, Volume2, VolumeX, Menu, Clock, AlertTriangle, Zap } from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
import MobilePlayer from '../components/MobilePlayer'; 
import RentalModal from '../components/RentalModal';
import TradeModal from '../components/TradeModal'; // ✅ [추가] 투자 모달 Import

import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants'; 
import { parseEther } from 'viem'; 

type Track = { 
  id: number; 
  title: string; 
  artist_name: string; 
  audio_url: string; 
  cover_image_url: string | null;
  expires_at?: string | null; 
  is_minted?: boolean;
  token_id: number | null; // 투자 시 필요
  uploader_address?: string;
};

type Playlist = { id: string; name: string; is_custom: boolean; };

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function LibraryPage() {
  const account = useActiveAccount();
  const address = account?.address;

  const { mutate: sendTransaction } = useSendTransaction();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Data States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('liked');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  // UI States
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]); 
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Player States
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all'); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // Rental Extension States
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [trackToExtend, setTrackToExtend] = useState<Track | null>(null);

  // ✅ [추가] Invest States
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
      if (audio.src !== currentTrack.audio_url) {
        audio.src = currentTrack.audio_url;
        audio.load();
        setCurrentTime(0);
        if (isPlaying) audio.play().catch(console.error);
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack) {
      isPlaying ? audio.play().catch(console.error) : audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleTrackEnd = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    handleNext();
  };

  const handleNext = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return setIsPlaying(false);
    let nextIndex = 0;
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    
    if (isShuffle) {
        nextIndex = Math.floor(Math.random() * list.length);
    } else {
      if (currentIndex === list.length - 1 && repeatMode === 'off') { setIsPlaying(false); return; }
      nextIndex = (currentIndex + 1) % list.length;
    }
    setCurrentTrack(list[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return;
    const currentIndex = list.findIndex(t => t.id === currentTrack?.id);
    if (currentTime > 3) { if (audioRef.current) audioRef.current.currentTime = 0; return; }
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    setCurrentTrack(list[prevIndex]);
    setIsPlaying(true);
  };

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
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

    try {
      if (playlistId === 'liked') {
        if (!profileId) return;
        const { data } = await supabase
            .from('collections')
            .select('expires_at, tracks(*)')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false });
            
        if (data) {
            setTracks(data.map((d: any) => ({
                ...d.tracks,
                expires_at: d.expires_at 
            })).filter(t => t && t.id)); 
        }

      } else if (playlistId === 'my_songs') {
        if (!address) return;
        const { data } = await supabase
          .from('track_contributors')
          .select('tracks(*)')
          .eq('wallet_address', address)
          .order('created_at', { ascending: false });

        if (data) {
          const myTracks = data.map((d: any) => d.tracks).filter(Boolean);
          const uniqueTracks = Array.from(new Map(myTracks.map(item => [item.id, item])).values());
          setTracks(uniqueTracks);
        }

      } else {
        if (!profileId) return;
        const { data } = await supabase.from('playlist_items').select('tracks(*)').eq('playlist_id', playlistId).order('added_at', { ascending: false });
        if (data) setTracks(data.map((d: any) => d.tracks).filter(Boolean));
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

    const { data, error } = await supabase.rpc('update_playlist_name_by_wallet', {
      p_playlist_id: selectedPlaylist,
      p_new_name: renameValue,
      p_wallet_address: address
    });

    if (error || data !== 'OK') {
      toast.error("Failed to rename.");
    } else {
      toast.success("Renamed!");
      setIsRenaming(false);
      fetchPlaylists(); 
    }
  };

  const handleRemoveFromPlaylist = async (trackId: number) => {
    if (!address) return toast.error("Wallet not connected.");
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;
    if (!confirm("Remove this song?")) return;

    const { data, error } = await supabase.rpc('remove_playlist_item_by_wallet', {
      p_playlist_id: selectedPlaylist,
      p_track_id: trackId,
      p_wallet_address: address
    });

    if (error || data !== 'OK') toast.error("Failed to remove.");
    else {
        toast.success("Removed.");
        fetchTracks(selectedPlaylist);
    }
  };

  const handleMoveToTop = async (trackId: number) => {
    if (!address) return toast.error("Wallet not connected.");
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;

    const { data, error } = await supabase.rpc('move_playlist_item_top_by_wallet', {
      p_playlist_id: selectedPlaylist,
      p_track_id: trackId,
      p_wallet_address: address
    });

    if (error || data !== 'OK') toast.error("Failed to move.");
    else {
        toast.success("Moved to top!");
        fetchTracks(selectedPlaylist);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    if (!profileId) return toast.error("Login required.");
    const { error } = await supabase.from('playlists').insert({ profile_id: profileId, name: newPlaylistName });
    if (!error) {
      toast.success("Created!");
      fetchPlaylists();
      setIsCreating(false);
      setNewPlaylistName("");
    } else {
      toast.error(error.message);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from('playlists').delete().eq('id', id);
    fetchPlaylists();
    setSelectedPlaylist('liked');
  };

  const openExtendModal = (track: Track) => {
    setTrackToExtend(track);
    setShowRentalModal(true);
  };

  // ✅ [추가] 투자 핸들러
  const handleInvest = (track: Track) => {
    if (!address) return toast.error("Wallet not connected.");
    setTrackToInvest(track);
  };

  const handleExtendConfirm = async (months: number, price: number) => {
    if (!trackToExtend || !address) return;
    
    const toastId = toast.loading("Processing extension...");
    
    try {
       if (price > 0) {
            let recipient = trackToExtend.uploader_address || "0x0000000000000000000000000000000000000000";
            const transaction = prepareContractCall({
                contract: melodyTokenContract,
                method: "transfer",
                params: [recipient, parseEther(price.toString())]
            });
            await sendTransaction(transaction);
       }
       
       const { error } = await supabase.rpc('rent_track_via_wallet', {
            p_wallet_address: address,
            p_track_id: trackToExtend.id,
            p_months: months,
            p_price: price
       });

       if (error) throw error;

       toast.success(`Extended for ${months === 999 ? 'Forever' : months + ' Months'}!`, { id: toastId });
       setShowRentalModal(false);
       setTrackToExtend(null);
       fetchTracks(selectedPlaylist); 

    } catch (e: any) {
        console.error(e);
        toast.error("Extension failed: " + e.message, { id: toastId });
    }
  };

  const getExpiryInfo = (dateStr?: string | null) => {
    if (!dateStr) return { label: "Forever", isUrgent: false, isExpired: false };
    
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
        label: expiry.toLocaleDateString(),
        isUrgent: diffDays <= 7 && diffDays >= 0,
        isExpired: diffDays < 0
    };
  };

  const openAddSongModal = async () => {
    if (!profileId) return;
    setShowAddModal(true);
    setModalSearchQuery("");

    const { data: likedData } = await supabase.from('collections').select('tracks(*)').eq('profile_id', profileId);
    const likedList = likedData?.map((d: any) => d.tracks).filter(Boolean) || [];

    let myList: Track[] = [];
    if (address) {
      const { data: myData } = await supabase.from('track_contributors').select('tracks(*)').eq('wallet_address', address);
      myList = myData?.map((d: any) => d.tracks).filter(Boolean) || [];
    }

    const combinedTracks = [...likedList, ...myList];
    const uniqueTracks = Array.from(new Map(combinedTracks.map(t => [t.id, t])).values());
    setLikedTracks(uniqueTracks);
  };

  const addToPlaylist = async (trackId: number) => {
    const { data } = await supabase.from('playlist_items').select('*').match({ playlist_id: selectedPlaylist, track_id: trackId }).maybeSingle();
    if (data) return toast.error("Already in playlist.");
    await supabase.from('playlist_items').insert({ playlist_id: selectedPlaylist, track_id: trackId });
    toast.success("Added!");
    fetchTracks(selectedPlaylist);
    setShowAddModal(false);
  };

  const filteredTracks = tracks.filter(t => t && t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredModalTracks = likedTracks.filter(t => t && t.title && t.title.toLowerCase().includes(modalSearchQuery.toLowerCase()));
  const playlistCoverImage = tracks.length > 0 && tracks[0].cover_image_url ? tracks[0].cover_image_url : null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (!isNaN(d) && d !== Infinity) setDuration(d);
        }}
        onEnded={handleTrackEnd}
        preload="auto"
        crossOrigin="anonymous"
      />

      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-zinc-950 border-r border-zinc-800 flex-col p-4">
        <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-6 flex items-center gap-2">
          ← Back to Market
        </Link>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xs font-bold text-zinc-500 uppercase">My Library</h2>
          <button onClick={() => setIsCreating(true)} className="text-zinc-400 hover:text-white"><Plus size={18} /></button>
        </div>
        {isCreating && (
          <input
            autoFocus
            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white mb-2"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); if (e.key === 'Escape') setIsCreating(false); }}
          />
        )}
        <div className="space-y-1 flex-1 overflow-y-auto">
          {playlists.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${selectedPlaylist === p.id ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
              onClick={() => setSelectedPlaylist(p.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {p.id === 'liked' ? <Heart size={16} className="text-indigo-500 fill-indigo-500" /> : p.id === 'my_songs' ? <Mic2 size={16} className="text-green-500" /> : <ListMusic size={16} />}
                <span className="truncate">{p.name}</span>
              </div>
              {p.is_custom && (
                <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(p.id); }} className="text-zinc-500 hover:text-red-500"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-zinc-800"><HeaderProfile /></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-black relative">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
          <button onClick={() => setMobileMenuOpen(true)}><Menu /></button>
          <span className="font-bold text-lg">Library</span>
          <HeaderProfile />
        </div>
        <div className="md:hidden border-b border-zinc-800 bg-black">
          <div className="flex overflow-x-auto p-4 gap-2 scrollbar-hide w-full">
            <button onClick={() => setIsCreating(true)} className="px-3 py-2 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-700 flex-shrink-0"><Plus size={16} /></button>
            {isCreating && (
              <input autoFocus className="w-32 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-2 text-sm text-white" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }} onBlur={() => setIsCreating(false)} placeholder="Name..." />
            )}
            {playlists.map(p => (
              <button key={p.id} onClick={() => setSelectedPlaylist(p.id)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border flex-shrink-0 transition ${selectedPlaylist === p.id ? 'bg-white text-black font-bold border-white' : 'bg-black text-zinc-400 border-zinc-800'}`}>{p.name}</button>
            ))}
          </div>
          {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
            <div className="px-4 pb-4 w-full">
              <button onClick={openAddSongModal} className="w-full bg-zinc-900 border border-zinc-700 text-cyan-400 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Plus size={16} /> Add Songs</button>
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex h-64 bg-gradient-to-b from-zinc-800 to-black p-8 items-end justify-between">
            <div className="flex items-end gap-6">
                <div className="w-40 h-40 bg-zinc-800 shadow-2xl rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {playlistCoverImage ? (
                        <img src={playlistCoverImage} className="w-full h-full object-cover" />
                    ) : (
                        selectedPlaylist === 'liked' ? <Heart size={48} className="text-indigo-500 fill-indigo-500" /> : selectedPlaylist === 'my_songs' ? <Mic2 size={48} className="text-green-500" /> : <Music size={48} className="text-zinc-600" />
                    )}
                </div>
                <div className="mb-1 w-full">
                    <span className="text-xs font-bold uppercase text-white/80">Playlist</span>
                    <div className="flex items-center gap-3 mt-1 mb-2">
                        {isRenaming ? (
                            <div className="flex items-center gap-2">
                                <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleRenamePlaylist(); if(e.key === 'Escape') setIsRenaming(false); }} className="text-4xl font-black bg-zinc-800 text-white border-b-2 border-cyan-500 focus:outline-none w-auto min-w-[300px]" />
                                <button onClick={handleRenamePlaylist} className="p-2 bg-green-500 text-black rounded-full"><Check size={20} /></button>
                                <button onClick={() => setIsRenaming(false)} className="p-2 bg-zinc-700 text-white rounded-full"><X size={20} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 group">
                                <h1 className="text-5xl font-black tracking-tight truncate max-w-3xl">{playlists.find(p => p.id === selectedPlaylist)?.name}</h1>
                                {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                                    <button onClick={() => setIsRenaming(true)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition"><Pencil size={24} /></button>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-zinc-400 text-sm">{filteredTracks.length} songs</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => { if(tracks.length > 0) { setCurrentTrack(tracks[0]); setIsPlaying(true); } }} className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg">
                    {isPlaying ? <Pause fill="black" /> : <Play fill="black" className="ml-1" />}
                </button>
                <button onClick={() => setIsShuffle(!isShuffle)} className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${isShuffle ? 'bg-zinc-800 border-green-500 text-green-500' : 'border-zinc-600 text-zinc-400 hover:border-white hover:text-white'}`}><Shuffle size={18} /></button>
                {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                    <button onClick={openAddSongModal} className="w-10 h-10 rounded-full border border-zinc-600 text-zinc-400 flex items-center justify-center hover:border-white hover:text-white transition"><Plus size={20} /></button>
                )}
            </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black/95 backdrop-blur z-10 flex items-center justify-between gap-4">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                <input type="text" placeholder="Search..." className="w-full bg-zinc-900 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
            {loading ? <div className="text-center pt-20 text-zinc-500"><Loader2 className="animate-spin mr-2 inline" /> Loading...</div> : filteredTracks.length === 0 ? <div className="text-center pt-20 text-zinc-500">No tracks.</div> : (
                <table className="w-full text-left border-collapse">
                    <thead className="text-zinc-500 text-xs uppercase border-b border-zinc-800 hidden md:table-header-group">
                        <tr>
                            <th className="font-normal p-3 w-12 text-center">#</th>
                            <th className="font-normal p-3">Title</th>
                            <th className="font-normal p-3 w-40">Expires</th>
                            <th className="font-normal p-3 w-16 text-center"><MoreHorizontal size={16} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTracks.map((track, idx) => {
                            const { label: expiryLabel, isUrgent, isExpired } = getExpiryInfo(track.expires_at);
                            
                            return (
                                <tr key={track.id} className={`group hover:bg-zinc-900/60 rounded-lg transition ${currentTrack?.id === track.id ? 'text-green-400' : 'text-zinc-300'}`} onDoubleClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                    <td className="p-3 w-12 text-center text-sm hidden md:table-cell">
                                        <span className={`group-hover:hidden ${currentTrack?.id === track.id ? 'hidden' : 'block'}`}>{idx + 1}</span>
                                        <button onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }} className={`hidden group-hover:inline-block ${currentTrack?.id === track.id ? '!inline-block' : ''}`}>
                                            {currentTrack?.id === track.id && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                        </button>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                                                {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <Music className="p-2 text-zinc-500" />}
                                                {isExpired && <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-red-500 text-[10px] font-bold">EXP</div>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{track.title}</div>
                                                <div className="text-xs text-zinc-500">{track.artist_name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 text-sm hidden md:table-cell">
                                        {track.expires_at ? (
                                            <div className={`flex items-center gap-2 ${isUrgent ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                                                <Clock size={14} />
                                                <span>{expiryLabel}</span>
                                                {isUrgent && <span className="text-[10px] bg-red-500/20 px-1.5 rounded border border-red-500/30">SOON</span>}
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600 text-xs flex items-center gap-1"><Zap size={12} className="text-yellow-500"/> Owned</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-3 text-center hidden md:table-cell">
                                        <div className="flex items-center justify-center gap-3">
                                            {/* ✅ [추가] 리스트에서 바로 투자/연장 */}
                                            {track.expires_at && (
                                                <button onClick={(e) => { e.stopPropagation(); openExtendModal(track); }} className="text-zinc-500 hover:text-green-400 text-xs font-bold border border-zinc-700 px-2 py-1 rounded hover:border-green-400 transition">
                                                    Extend
                                                </button>
                                            )}
                                            {track.is_minted && (
                                                <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} title="Invest" className="text-zinc-500 hover:text-yellow-400"><Zap size={16} /></button>
                                            )}
                                            
                                            {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' ? (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); handleMoveToTop(track.id); }} className="text-zinc-500 hover:text-white"><ArrowUpToLine size={16} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id); }} className="text-zinc-500 hover:text-red-500"><Trash2 size={16} /></button>
                                                </>
                                            ) : null }
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>

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
                isLiked={true} 
                isRented={true} 
                onToggleLike={() => {}} 
                // ✅ [추가] 모바일 플레이어 투자 버튼 연결
                onInvest={currentTrack.is_minted ? () => handleInvest(currentTrack) : undefined}
            />
        )}

        {currentTrack && !mobilePlayerOpen && (
            <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{currentTrack.artist_name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 pr-1">
                    <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                        {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
                    </button>
                </div>
            </div>
        )}

        {currentTrack && (
            <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
                <div className="flex items-center gap-4 w-1/3">
                    <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                        {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700" /></div>}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                        <div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist_name}</div>
                    </div>
                    <button className="ml-2 text-pink-500 hover:scale-110 transition"><Heart size={20} fill="currentColor" /></button>
                </div>

                <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setIsShuffle(!isShuffle)} className={`text-zinc-400 hover:text-white transition ${isShuffle ? 'text-green-500' : ''}`}><Shuffle size={16} /></button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20} /></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                            {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                        </button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20} /></button>
                        <button onClick={toggleRepeat} className={`text-zinc-400 hover:text-white transition ${repeatMode !== 'off' ? 'text-green-500' : ''}`}>
                            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                        </button>
                    </div>
                    <div className="w-full max-w-sm flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group" onClick={(e) => { if (audioRef.current) { const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration; } }}>
                            <div className="h-full bg-white rounded-full relative z-10 group-hover:bg-green-500 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="w-1/3 flex justify-end items-center gap-4">
                    {currentTrack.expires_at && (
                        <button onClick={() => openExtendModal(currentTrack)} className="text-xs font-bold text-zinc-400 hover:text-white border border-zinc-700 px-3 py-1.5 rounded-full hover:border-white transition">
                            Extend
                        </button>
                    )}
                    {/* ✅ [추가] Desktop Footer Player Invest Button */}
                    {currentTrack.is_minted && (
                         <button
                            onClick={() => handleInvest(currentTrack)}
                            className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5"
                        >
                            <Zap size={14} fill="currentColor"/> Invest
                        </button>
                    )}
                                        <div className="w-px h-6 bg-zinc-800 mx-1"></div>
                    <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-500 hover:text-white">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                    <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setVolume(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)); setIsMuted(false); }}>
                        <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }}></div>
                    </div>
                </div>
            </div>
        )}

        {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-zinc-900 w-full max-w-md h-[600px] rounded-2xl flex flex-col shadow-2xl border border-zinc-800">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="font-bold">Add from Library</h3>
                        <button onClick={() => setShowAddModal(false)}><X size={20} className="text-zinc-500 hover:text-white" /></button>
                    </div>
                    <div className="p-3 border-b border-zinc-800/50 relative">
                        <Search className="absolute left-6 top-5 text-zinc-500" size={14} />
                        <input type="text" placeholder="Find a song..." className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500" value={modalSearchQuery} onChange={(e) => setModalSearchQuery(e.target.value)} autoFocus />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredModalTracks.length === 0 ? <div className="p-10 text-center text-zinc-500 text-xs">No results.</div> : filteredModalTracks.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-lg group transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0"><img src={t.cover_image_url || ''} className="w-full h-full object-cover" /></div>
                                    <div className="overflow-hidden"><div className="font-bold text-sm truncate w-40">{t.title}</div><div className="text-xs text-zinc-500 truncate">{t.artist_name}</div></div>
                                </div>
                                <button onClick={() => addToPlaylist(t.id)} className="bg-zinc-700 hover:bg-green-600 hover:text-white text-zinc-400 p-1.5 rounded-full transition"><Plus size={16} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {showRentalModal && (
            <RentalModal
                isOpen={showRentalModal}
                onClose={() => setShowRentalModal(false)}
                onConfirm={handleExtendConfirm}
                isLoading={false}
            />
        )}
        
        {/* ✅ [추가] Trade Modal 렌더링 */}
        {trackToInvest && (
            <TradeModal
                isOpen={!!trackToInvest}
                onClose={() => setTrackToInvest(null)}
                track={trackToInvest}
            />
        )}
      </div>
    </div>
  );
}