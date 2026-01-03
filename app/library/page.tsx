'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ArrowLeft, Pencil, Check, ArrowUpToLine, Mic2, Loader2, Heart, Play, Pause, Plus, Trash2, 
  Music, ListMusic, MoreHorizontal, Search, X, Shuffle, SkipForward, SkipBack, 
  Repeat, Repeat1, Disc, Volume2, VolumeX, Menu, Clock, AlertTriangle, Zap, 
  MoreVertical, Calendar, Share2
} from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
import MobilePlayer from '../components/MobilePlayer'; 
import RentalModal from '../components/RentalModal';
import TradeModal from '../components/TradeModal';
import ShareButton from '../components/ui/ShareButton'; 

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
  token_id: number | null; 
  uploader_address?: string;
  mint_error?: string | null;
  duplicate_of_track_id?: number | null;
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
  
  const [activeMobileTrack, setActiveMobileTrack] = useState<Track | null>(null);

  // Player States
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all'); 
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [trackToExtend, setTrackToExtend] = useState<Track | null>(null);
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);


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


  const handleRegister = async (track: Track) => {
    // 여기에 등록 모달을 띄우거나 등록 페이지로 이동하는 로직 구현
    // 예: router.push(`/publish/${track.id}`); 또는 setShowRegisterModal(true);
    toast("Register logic here (Open Modal or Redirect)");
  };

  const handleCheckDuplicate = async (originalTrackId: number) => {
      // 중복 원본 트랙 정보를 가져와서 모달을 띄우는 로직
      // 기존 Market 페이지에 있던 로직을 가져오거나, 간단히 알림 처리
      toast.error(`This is a duplicate of track ID: ${originalTrackId}`);
      // 실제 구현 시에는 setDuplicateOriginalTrack 등의 state와 모달이 필요합니다.
  };

  const handleDeleteTrack = async (trackId: number) => {
      if(!confirm("Are you sure you want to delete this track?")) return;
      
      const { error } = await supabase.from('tracks').delete().eq('id', trackId);
      if (error) toast.error("Failed to delete");
      else {
          toast.success("Deleted");
          fetchTracks(selectedPlaylist);
      }
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
        const { data } = await supabase
            .from('playlist_items')
            .select('tracks(*)')
            .eq('playlist_id', playlistId)
            .order('added_at', { ascending: false });
        
        const rawTracks = data?.map((d: any) => d.tracks).filter(Boolean) || [];

        if (rawTracks.length > 0) {
            const trackIds = rawTracks.map((t: any) => t.id);
            const { data: rentalData } = await supabase
                .from('collections')
                .select('track_id, expires_at')
                .eq('profile_id', profileId)
                .in('track_id', trackIds);

            const rentalMap = new Map();
            rentalData?.forEach((r: any) => {
                rentalMap.set(r.track_id, r.expires_at);
            });

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
    // 시스템 플레이리스트 수정 방지
    if (selectedPlaylist === 'liked' || selectedPlaylist === 'my_songs') return;
    
    // ✅ [수정됨] 직접 update 대신 RPC 호출로 변경 (RLS 문제 원천 차단)
    const { data, error } = await supabase.rpc('update_playlist_name_by_wallet', { 
        p_playlist_id: selectedPlaylist, 
        p_new_name: renameValue, 
        p_wallet_address: address 
    });

    if (error) {
        console.error(error);
        toast.error("Error updating playlist.");
    } else if (data === 'OK') {
        toast.success("Renamed successfully!");
        setIsRenaming(false);
        fetchPlaylists(); // 목록 새로고침
    } else {
        // data가 'NO_PERMISSION_OR_NOT_FOUND' 인 경우
        toast.error("Update failed. You may not be the owner.");
    }
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

  const handleMobileCreatePlaylist = () => {
      const name = window.prompt("Enter new playlist name:");
      if (name) { handleCreatePlaylist(name); }
  };
  
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
    setShowAddModal(true); setModalSearchQuery("");
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
    toast.success("Added!"); fetchTracks(selectedPlaylist); setShowAddModal(false);
  };

  const filteredTracks = tracks.filter(t => t && t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredModalTracks = likedTracks.filter(t => t && t.title && t.title.toLowerCase().includes(modalSearchQuery.toLowerCase()));

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (!isNaN(d) && d !== Infinity) setDuration(d); }}
        onEnded={handleTrackEnd}
        preload="auto"
        crossOrigin="anonymous"
      />

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
                {p.id === 'liked' ? <Heart size={16} className="text-indigo-500 fill-indigo-500" /> : p.id === 'my_songs' ? <Mic2 size={16} className="text-green-500" /> : <ListMusic size={16} />}
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
                {/* ✅ [수정됨] 햄버거 메뉴 대신 'Back to Market' 버튼으로 교체 */}
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
                    <button onClick={() => { setCurrentTrack(filteredTracks[0]); setIsPlaying(true); setMobilePlayerOpen(true); }} className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 text-black active:scale-95 transition"><Play fill="black" className="ml-1"/></button>
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
                
                {/* ✅ [수정된 부분] 이름 변경 UI 복구 */}
                <div className="mb-1 w-full flex-1">
                    <span className="text-xs font-bold uppercase text-white/80">Playlist</span>
                    
                    {isRenaming ? (
                        <div className="flex items-center gap-2 mt-2">
                            <input 
                                autoFocus 
                                className="text-4xl font-black bg-transparent border-b border-white text-white focus:outline-none w-full max-w-xl" 
                                value={renameValue} 
                                onChange={(e) => setRenameValue(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && handleRenamePlaylist()} 
                            />
                            <button onClick={handleRenamePlaylist} className="p-2 bg-green-500 rounded-full text-black hover:scale-110 transition"><Check size={20} /></button>
                            <button onClick={() => setIsRenaming(false)} className="p-2 bg-zinc-800 rounded-full text-white hover:bg-zinc-700 transition"><X size={20} /></button>
                        </div>
                    ) : (
                        <h1 className="text-5xl font-black tracking-tight truncate max-w-3xl flex items-center gap-4 group">
                            {playlists.find(p => p.id === selectedPlaylist)?.name}
                            
                            {/* Rename Button (Only for custom playlists) */}
                            {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                                <button 
                                    onClick={() => { 
                                        setRenameValue(playlists.find(p => p.id === selectedPlaylist)?.name || ""); 
                                        setIsRenaming(true); 
                                    }} 
                                    className="opacity-0 group-hover:opacity-100 transition text-zinc-500 hover:text-white"
                                >
                                    <Pencil size={24} />
                                </button>
                            )}
                        </h1>
                    )}
                    
                    <p className="text-zinc-400 text-sm mt-2">{filteredTracks.length} songs</p>
                </div>
            </div>
            
            {/* Desktop Actions */}
            <div className="flex items-center gap-3 mb-2">
                 <button onClick={() => { if(tracks.length > 0) { setCurrentTrack(tracks[0]); setIsPlaying(true); } }} className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition shadow-lg"><Play fill="black" className="ml-1" /></button>
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
                            {/* ✅ [수정] text-center로 명시하여 가운데 정렬 */}
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

                            return (
                                <tr key={track.id} className={`group hover:bg-zinc-900/60 rounded-lg transition ${currentTrack?.id === track.id ? 'text-green-400' : 'text-zinc-300'}`} onDoubleClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                    {/* 1. # Column */}
                                    <td className="p-3 w-12 text-center text-sm">
                                        <span className={`group-hover:hidden ${currentTrack?.id === track.id ? 'hidden' : 'block'}`}>{idx + 1}</span>
                                        <button onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }} className={`hidden group-hover:inline-block ${currentTrack?.id === track.id ? '!inline-block' : ''}`}>{currentTrack?.id === track.id && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
                                    </td>

                                    {/* 2. Title Column */}
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                                                {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <Music className="p-2 text-zinc-500" />}
                                            </div>
                                            <div><div className="font-bold text-sm">{track.title}</div><div className="text-xs text-zinc-500">{track.artist_name}</div></div>
                                        </div>
                                    </td>

                                    {/* 3. Expires Column */}
                                    <td className="p-3 text-sm w-60 group/expires">
                                        {/* ✅ [수정] justify-between 제거 -> items-center gap-4 로 변경 (날짜 옆에 버튼 붙이기) */}
                                        <div className="flex items-center gap-4 h-8"> 
                                            {track.expires_at ? (
                                                <div className={`flex items-center gap-2 whitespace-nowrap ${isUrgent ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                                                    <Clock size={14} /><span>{expiryLabel}</span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 text-xs flex items-center gap-1 whitespace-nowrap">
                                                    <Zap size={12} className="text-yellow-500"/> Owned
                                                </span>
                                            )}
                                            
                                            {track.expires_at && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openExtendModal(track); }} 
                                                    className="opacity-0 group-hover/expires:opacity-100 transition-opacity duration-200 text-[10px] font-bold border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 py-1 rounded hover:border-green-400 hover:text-white"
                                                >
                                                    Extend
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* 4. Action Buttons Column */}
                                    <td className="p-3 w-32">
                                        {/* ✅ [수정] justify-end -> justify-center (가운데 정렬) */}
                                        <div className="flex items-center justify-center gap-3">
                                            
                                            {/* Custom Playlist */}
                                            {isCustomPlaylist && (
                                                <>
                                                    {track.is_minted && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="text-zinc-500 hover:text-yellow-400 transition" title="Invest">
                                                            <Zap size={16} />
                                                        </button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); handleMoveToTop(track.id); }} className="text-zinc-500 hover:text-white transition" title="Move to Top">
                                                        <ArrowUpToLine size={16} />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id); }} className="text-zinc-500 hover:text-red-500 transition" title="Remove">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}

                                            {/* Liked Songs */}
                                            {isLikedSongs && track.is_minted && (
                                                <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="text-zinc-500 hover:text-yellow-400 transition" title="Invest">
                                                    <Zap size={16} />
                                                </button>
                                            )}

                                            {/* My Songs */}
                                            {isMySongs && (() => {
                                                if (isDuplicateError) {
                                                    return (
                                                        <div className="flex gap-2">
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id); }} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); if (track.duplicate_of_track_id) handleCheckDuplicate(track.duplicate_of_track_id); }} 
                                                                className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition flex items-center gap-1"
                                                            >
                                                                <AlertTriangle size={12}/> Rejected
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                                if (track.is_minted) {
                                                    return (
                                                        <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white hover:text-black transition">
                                                            Invest
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <div className="flex gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id); }} className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRegister(track); }} 
                                                            className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-cyan-500 hover:text-white transition"
                                                            disabled={isProcessingThis}
                                                        >
                                                            {isProcessingThis ? <Loader2 className="animate-spin" size={12}/> : 'Register'}
                                                        </button>
                                                    </div>
                                                );
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
                        return (
                            <div 
                                key={track.id} 
                                onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}
                                className={`w-full max-w-full flex items-center justify-between p-2 rounded-xl active:bg-zinc-900 transition ${currentTrack?.id === track.id ? 'bg-zinc-900' : ''}`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                    <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative shadow-sm">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover" /> : <Music className="p-3 text-zinc-500" />}
                                        {isExpired ? (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><AlertTriangle size={16} className="text-red-500"/></div>
                                        ) : !track.expires_at ? (
                                            <div className="absolute top-0 right-0 p-0.5 bg-yellow-500/80 rounded-bl-md"><Zap size={8} className="text-black fill-black"/></div>
                                        ) : null}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${currentTrack?.id === track.id ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
                                        <div className="text-xs text-zinc-500 truncate">{track.artist_name}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveMobileTrack(track); }} 
                                    className="p-3 text-zinc-500 hover:text-white flex-shrink-0"
                                >
                                    <MoreVertical size={20}/>
                                </button>
                            </div>
                        );
                    })}
                </div>
                </>
            )}
        </div>

        {/* Mobile Bottom Sheet */}
        {activeMobileTrack && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setActiveMobileTrack(null)}>
                <div className="bg-zinc-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-zinc-800 p-6 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
                        <div className="w-14 h-14 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                            {activeMobileTrack.cover_image_url ? <img src={activeMobileTrack.cover_image_url} className="w-full h-full object-cover" /> : <Music size={24}/>}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white line-clamp-1">{activeMobileTrack.title}</h3>
                            <p className="text-zinc-500 text-sm">{activeMobileTrack.artist_name}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        {(() => {
                            // My Songs 탭일 때만 적용
                            if (selectedPlaylist === 'my_songs') {
                                const errorString = activeMobileTrack.mint_error ? String(activeMobileTrack.mint_error).trim() : '';
                                const isDuplicateError = errorString.includes('duplicate_melody_hash') || !!activeMobileTrack.duplicate_of_track_id;

                                // [1순위] Rejected
                                if (isDuplicateError) {
                                    return (
                                        <>
                                            <button onClick={() => { if (activeMobileTrack.duplicate_of_track_id) handleCheckDuplicate(activeMobileTrack.duplicate_of_track_id); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-red-500">
                                                <AlertTriangle size={20}/>
                                                <div>
                                                    <div className="font-bold text-sm">Rejected (Check Reason)</div>
                                                    <div className="text-xs opacity-70">Duplicate Melody Detected</div>
                                                </div>
                                            </button>
                                            <button onClick={() => { handleDeleteTrack(activeMobileTrack.id); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-zinc-400">
                                                <Trash2 size={20}/> <span className="text-sm font-bold">Delete Track</span>
                                            </button>
                                        </>
                                    );
                                }
                                
                                // [2순위] Invest (기존 코드에 이미 있지만 여기로 통합 가능, 혹은 아래 로직과 병행)
                                // [3순위] Register
                                if (!activeMobileTrack.is_minted) {
                                    return (
                                        <>
                                            <button onClick={() => { handleRegister(activeMobileTrack); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-cyan-500">
                                                <Zap size={20}/> 
                                                <div>
                                                    <div className="font-bold text-sm">Register Song</div>
                                                    <div className="text-xs text-zinc-500">Publish to Market</div>
                                                </div>
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
                                <div>
                                    <div className="font-bold text-sm text-white">Invest in Song</div>
                                    <div className="text-xs text-zinc-500">Buy shares & earn royalties</div>
                                </div>
                            </button>
                        )}
                        
                        {activeMobileTrack.expires_at && (
                            <button onClick={() => { openExtendModal(activeMobileTrack); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left">
                                <Clock className="text-green-500" size={20}/>
                                <div>
                                    <div className="font-bold text-sm text-white">Extend Collection</div>
                                    <div className="text-xs text-zinc-500">Expires: {new Date(activeMobileTrack.expires_at).toLocaleDateString()}</div>
                                </div>
                            </button>
                        )}

                        {selectedPlaylist !== 'liked' && selectedPlaylist !== 'my_songs' && (
                            <>
                                <button onClick={() => { handleMoveToTop(activeMobileTrack.id); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left">
                                    <ArrowUpToLine className="text-zinc-400" size={20}/> <span className="text-sm font-bold">Move to Top</span>
                                </button>
                                <button onClick={() => { handleRemoveFromPlaylist(activeMobileTrack.id); setActiveMobileTrack(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800 rounded-xl transition text-left text-red-500">
                                    <Trash2 size={20}/> <span className="text-sm font-bold">Remove from Playlist</span>
                                </button>
                            </>
                        )}                        
                        <div className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition">
                            <div className="flex items-center gap-4">
                                <Share2 className="text-zinc-400" size={20}/>
                                <div>
                                    <div className="font-bold text-sm text-white">Share</div>
                                    <div className="text-xs text-zinc-500">Instagram & Link</div>
                                </div>
                            </div>
                            <ShareButton assetId={activeMobileTrack.id.toString()} trackData={{ title: activeMobileTrack.title, artist: activeMobileTrack.artist_name, coverUrl: activeMobileTrack.cover_image_url || "" }} className="bg-zinc-700 hover:bg-zinc-600 border-zinc-600 text-white" />
                        </div>
                    </div>

                    <button onClick={() => setActiveMobileTrack(null)} className="w-full mt-4 py-3 bg-black rounded-xl font-bold text-zinc-500">Cancel</button>
                </div>
            </div>
        )}

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