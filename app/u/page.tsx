'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther } from 'viem';
import { ListMusic, Loader2, User, UserPlus, UserCheck, Disc, Zap, Share2, Instagram, Twitter, Youtube, Music as MusicIcon, Copy, Play, Pause, Heart } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import MobileSidebar from '../components/MobileSidebar';
// MobilePlayer 삭제 (Global 사용)
import TradeModal from '../components/TradeModal';
import RentalModal from '../components/RentalModal';
import PlaylistSelectionModal from '../components/PlaylistSelectionModal';
import ShareButton from '../components/ui/ShareButton'; 

// ✅ [NEW] Global Player Hook
import { usePlayer, Track } from '../context/PlayerContext';

const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-blue-500"/></div>}>
      <ProfileContent />
    </Suspense>
  );
}

// ... (DonateModal 컴포넌트는 기존 코드와 동일하므로 그대로 유지) ...
function DonateModal({ isOpen, onClose, recipientAddress, recipientName }: { isOpen: boolean, onClose: () => void, recipientAddress: string, recipientName: string }) {
    // (기존 DonateModal 코드 그대로 사용 - 생략)
    const { mutate: sendTransaction } = useSendTransaction();
    const [amount, setAmount] = useState("");
    const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [progress, setProgress] = useState(0);
    const [loadingMsg, setLoadingMsg] = useState("Initializing...");

    useEffect(() => {
        if (status === 'processing') {
            setProgress(0);
            setLoadingMsg("Requesting wallet signature...");
            const interval = setInterval(() => { setProgress((prev) => { const next = prev + Math.random() * 5; return next > 90 ? 90 : next; }); }, 800);
            return () => clearInterval(interval);
        } else { setProgress(0); }
    }, [status]);

    const handleDonate = () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return toast.error("Enter a valid amount");
        setStatus('processing'); 
        try {
            const transaction = prepareContractCall({ contract: tokenContract, method: "transfer", params: [recipientAddress, parseEther(amount)] });
            sendTransaction(transaction, {
                onSuccess: () => { setProgress(100); setLoadingMsg("Transfer Complete! 🎉"); setStatus('success'); toast.success(`Sent ${amount} MLD!`); setTimeout(() => { onClose(); setStatus('idle'); setAmount(""); }, 1500); },
                onError: () => { toast.error("Transaction failed."); setStatus('idle'); }
            });
        } catch (e) { toast.error("Error preparing transaction."); setStatus('idle'); } 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"/>
                <h3 className="text-xl font-bold mb-1 flex items-center gap-2 text-white relative z-10">🎁 Support Creator</h3>
                <p className="text-xs text-zinc-500 mb-6 relative z-10">Send MLD tokens to <span className="text-zinc-300 font-bold">{recipientName}</span></p>
                {status === 'idle' ? (
                    <>
                        <div className="relative mb-6"> <input autoFocus type="number" placeholder="0" className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white text-2xl font-mono focus:border-blue-500 outline-none text-right transition-colors" value={amount} onChange={e => setAmount(e.target.value)} /> <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none">MLD</span> </div>
                        <div className="flex gap-3"> <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold hover:bg-zinc-700 text-white transition">Cancel</button> <button onClick={handleDonate} className="flex-1 py-3 rounded-xl bg-blue-500 text-black font-bold hover:bg-blue-400 transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.4)]"><Zap size={18} fill="black"/> Send</button> </div>
                    </>
                ) : (
                    <div className="py-4 flex flex-col items-center justify-center text-center space-y-4"> <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center animate-bounce"><UserCheck className="text-black w-6 h-6" /></div> <div className="space-y-1 w-full"><h4 className="font-bold text-lg text-white animate-pulse">{status === 'success' ? 'Sent Successfully!' : 'Processing...'}</h4><p className="text-xs text-zinc-400 font-mono h-4">{loadingMsg}</p></div> <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}/></div> </div>
                )}
            </div>
        </div>
    );
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const targetWallet = searchParams.get('wallet') || ""; 

  const account = useActiveAccount();
  const myAddress = account?.address;
  const { mutate: sendTransaction } = useSendTransaction();

  // ✅ [NEW] Use Global Player
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks' | 'likes' | 'playlists'>('tracks');
  const [showDonate, setShowDonate] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal States
  const [trackToInvest, setTrackToInvest] = useState<Track | null>(null);
  const [pendingRentalTrack, setPendingRentalTrack] = useState<Track | null>(null);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set());
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set());
  const [rentedTracksExpiry, setRentedTracksExpiry] = useState<Map<number, string>>(new Map());

  // 1. Fetch Profile & Follow Status
  useEffect(() => {
    if (targetWallet) fetchProfileData();
  }, [targetWallet, myAddress]);

  // 2. Fetch User's Rented/Liked Tracks (UI 표시용)
  useEffect(() => {
      const fetchUserData = async () => {
          if (!myAddress) return;
          const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', myAddress).single();
          if (profile) {
              const now = new Date().toISOString();
              const { data: rentals } = await supabase.from('collections').select('track_id, expires_at').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
              if (rentals) {
                  setRentedTrackIds(new Set(rentals.map((r:any) => r.track_id)));
                  const expiryMap = new Map<number, string>();
                  rentals.forEach((item: any) => {
                        const dateStr = item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "Lifetime";
                        expiryMap.set(item.track_id, dateStr);
                  });
                  setRentedTracksExpiry(expiryMap);
              }
          }
          const { data: likes } = await supabase.from('likes').select('track_id').eq('wallet_address', myAddress);
          if (likes) setLikedTrackIds(new Set(likes.map((l:any) => l.track_id)));
      };
      fetchUserData();
  }, [myAddress]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('wallet_address', targetWallet).maybeSingle();
      setProfile(prof || { username: 'Unknown User', wallet_address: targetWallet });

      if (myAddress) {
        const { data: follow } = await supabase.from('creator_follows').select('*').match({ follower_address: myAddress, creator_address: targetWallet }).maybeSingle();
        setIsFollowing(!!follow);
      }
      await fetchTabContent('tracks');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchTabContent = async (tab: 'tracks'|'likes'|'playlists') => {
    setActiveTab(tab);
    setLoading(true);
    try {
        if (tab === 'tracks') {
            const res = await supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)').eq('uploader_address', targetWallet).order('created_at', { ascending: false });
            setTracks(res.data || []);
        } else if (tab === 'likes') {
            const res = await supabase.from('likes').select('tracks(*)').eq('wallet_address', targetWallet);
            setTracks(res.data?.map((d:any) => d.tracks) || []);
        } else if (tab === 'playlists') {
            if (profile?.id) {
                const { data } = await supabase.from('playlists').select(`id, name, created_at, is_public, fork_count, playlist_items (tracks (cover_image_url))`).eq('profile_id', profile.id).order('created_at', { ascending: false });
                setPlaylists(data || []);
            }
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- Handlers ---
  const handleInvest = (track: any) => {
      if (!myAddress) { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;}
      setTrackToInvest(track); 
  };

  const handleLike = async (track: any) => {
      if (!myAddress)  { 
                      const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                      if (headerBtn) {
                          headerBtn.click(); 
                          // toast("Join unlisted now { icon: '👆' });
                      } else {
                          // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                          toast.error("Please Join unlisted first.");
                      }
                      return;}
      // Global Player 로직과 동일하게 항상 렌탈 모달 (연장) 유도
      setPendingRentalTrack(track);
      setIsRentalModalOpen(true);
  };

  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', myAddress).single();
      if(profile) {
          const { data: pls } = await supabase.from('playlists').select('*').eq('profile_id', profile.id);
          setMyPlaylists(pls || []);
      }
      setIsRentalModalOpen(false);
      setShowPlaylistModal(true);
  };

  const processCollect = async (playlistId: string | 'liked') => {
      if (!pendingRentalTrack || !myAddress || !tempRentalTerms) return;
      const { months, price } = tempRentalTerms;
      const toastId = toast.loading("Processing...");
      setShowPlaylistModal(false);

      try {
          const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', { p_wallet_address: myAddress, p_track_id: pendingRentalTrack.id, p_duration_months: months });

          if (rpcResult === 'OK') {
              toast.success("Collected with Points!", { id: toastId });
          } else if (rpcResult === 'INSUFFICIENT_PMLD') {
              if (price > 0) {
                  const tx = prepareContractCall({ contract: tokenContract, method: "transfer", params: ["0x0000000000000000000000000000000000000000", parseEther(price.toString())] });
                  await sendTransaction(tx);
              }
              await supabase.rpc('add_to_collection_using_mld_by_wallet', { p_wallet_address: myAddress, p_track_id: pendingRentalTrack.id, p_duration_months: months, p_amount_mld: price });
              toast.success("Collected with MLD!", { id: toastId });
          }

          if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: pendingRentalTrack.id });
          await supabase.from('likes').upsert({ wallet_address: myAddress, track_id: pendingRentalTrack.id }, { onConflict: 'wallet_address, track_id' });

          setRentedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setLikedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setPendingRentalTrack(null); setTempRentalTerms(null);

      } catch (e:any) { toast.error(e.message, { id: toastId }); }
  };

  // ✅ [NEW] Play Helper
  const handlePlay = (track: Track) => {
      // 현재 리스트(tracks)를 큐로 설정
      playTrack(track, tracks);
  };

  const toggleFollow = async () => {
    if (!myAddress)  { 
                const headerBtn = document.querySelector('#header-connect-wrapper button') as HTMLElement;
                if (headerBtn) {
                    headerBtn.click(); 
                    // toast("Join unlisted now { icon: '👆' });
                } else {
                    // 만약 헤더 버튼을 못 찾았을 경우 대비 (Fallback)
                    toast.error("Please Join unlisted first.");
                }
                return;}
    if (myAddress === targetWallet) return toast.error("You can not follow yourself.");
    if (isFollowing) {
        await supabase.from('creator_follows').delete().match({ follower_address: myAddress, creator_address: targetWallet });
        setIsFollowing(false); toast.success("Unfollowed");
    } else {
        await supabase.from('creator_follows').insert({ follower_address: myAddress, creator_address: targetWallet });
        setIsFollowing(true); toast.success("Followed!");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      
      {/* ⚠️ Local <audio> removed */}
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="p-6 md:p-8">
         <Link href="/market" className="text-zinc-500 hover:text-white text-sm font-bold transition inline-flex items-center gap-2">← Back to Market</Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Profile Header (기존과 동일) */}
          <div className="flex flex-col md:flex-row items-end gap-8 mb-12 pb-12 border-b border-zinc-900">
             <div className="relative group flex-shrink-0 mx-auto md:mx-0">
                 <div className="w-40 h-40 md:w-56 md:h-56 rounded-full bg-zinc-800 border-4 border-black shadow-2xl overflow-hidden relative z-10">
                    {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover"/> : <User size={64} className="text-zinc-600 w-full h-full p-12"/>}
                 </div>
             </div>
             <div className="flex-1 w-full text-center md:text-left space-y-4">
                 <div className="space-y-1">
                     <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                        <span>Artist</span>
                        <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                        <button onClick={() => { navigator.clipboard.writeText(targetWallet); toast.success("Copied"); }} className="hover:text-white flex items-center gap-1 transition">
                            {targetWallet.slice(0,6)}...{targetWallet.slice(-4)} <Copy size={10}/>
                        </button>
                     </div>
                     <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white">{profile?.username || 'Unnamed'}</h1>
                 </div>
                 <p className="text-zinc-400 max-w-2xl text-sm md:text-base leading-relaxed mx-auto md:mx-0">{profile?.bio || "No bio yet."}</p>
                 <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-center md:justify-start">
                     <div className="flex flex-wrap gap-2 justify-center">
                        {profile?.genres?.map((g:string) => (<span key={g} className="px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-zinc-300 bg-zinc-900/50">{g}</span>))}
                     </div>
                     {profile?.social_links && (
                        <div className="flex items-center gap-4 text-zinc-500">
                            {profile.social_links.instagram && <a href={`https://instagram.com/${profile.social_links.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition p-1"><Instagram size={20}/></a>}
                            {profile.social_links.twitter && <a href={`https://twitter.com/${profile.social_links.twitter}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition p-1"><Twitter size={20}/></a>}
                            {profile.social_links.youtube && <a href={`https://youtube.com/@${profile.social_links.youtube}`} target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition p-1"><Youtube size={20}/></a>}
                            {profile.social_links.spotify && <a href={`http://open.spotify.com/artist/${profile.social_links.spotify}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition p-1"><MusicIcon size={20}/></a>}
                        </div>
                     )}
                 </div>
                 <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                    <button onClick={toggleFollow} className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition border ${isFollowing ? 'bg-black text-white border-zinc-700' : 'bg-white text-black border-white hover:scale-105'}`}>
                        {isFollowing ? <><UserCheck size={18}/> Following</> : <><UserPlus size={18}/> Follow</>}
                    </button>
                    <button onClick={() => setShowDonate(true)} className="px-6 py-3 rounded-full bg-zinc-900 text-blue-400 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800/80 transition font-bold flex items-center gap-2">
                        <Zap size={18} fill="currentColor"/> Donate
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="p-3 rounded-full border border-zinc-800 text-zinc-400 hover:text-white hover:border-white transition"><Share2 size={18}/></button>
                 </div>
             </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 border-b border-zinc-800 mb-8 sticky top-0 bg-black/95 backdrop-blur z-20 pt-4">
            <button onClick={() => fetchTabContent('tracks')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='tracks' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Uploaded Tracks</button>
            <button onClick={() => fetchTabContent('likes')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='likes' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Liked Collection</button>
            <button onClick={() => fetchTabContent('playlists')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='playlists' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Playlists</button>
          </div>

          {/* Grid Layout */}
          {loading ? ( <div className="col-span-full text-center py-32 text-zinc-500"><Loader2 className="animate-spin mb-2 text-blue-500 inline"/> Loading...</div> ) : (
            
            // Playlist Grid
            activeTab === 'playlists' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {playlists.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"><p className="text-zinc-500 font-bold">No playlists found.</p></div>
                    ) : (
                        playlists.map(pl => {
                            const coverImages = pl.playlist_items?.map((item: any) => item.tracks?.cover_image_url).filter(Boolean).slice(0, 4) || [];
                            return (
                                <Link href={`/playlists/${pl.id}`} key={pl.id} className="group relative bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition cursor-pointer hover:-translate-y-1 duration-300 block border border-zinc-800 hover:border-zinc-700">
                                    <div className="aspect-square bg-zinc-800 border-b border-zinc-800 overflow-hidden">
                                        {coverImages.length > 0 ? (
                                            coverImages.length === 1 ? ( <img src={coverImages[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/> ) : (
                                                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                                    {[0, 1, 2, 3].map(i => (
                                                        <div key={i} className="w-full h-full bg-zinc-800 overflow-hidden relative border-[0.5px] border-black/10">
                                                            {coverImages[i] ? <img src={coverImages[i]} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-zinc-700/50 flex items-center justify-center"><Disc size={12} className="text-zinc-600"/></div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        ) : ( <div className="w-full h-full flex items-center justify-center bg-zinc-800"><ListMusic size={48} className="text-zinc-700"/></div> )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold truncate text-sm mb-1 text-white group-hover:text-blue-500 transition">{pl.name}</h3>
                                        <div className="flex justify-between items-center text-xs text-zinc-500">
                                            <span>{pl.playlist_items?.length || 0} songs</span>
                                            <span className="flex items-center gap-1"><Copy size={10}/> {pl.fork_count || 0}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            ) : (
                // Tracks Grid
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {tracks.length === 0 ? ( <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"><p className="text-zinc-500 font-bold">No tracks found.</p></div> ) : (
                        tracks.map(track => {
                            const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;
                            return (
                                <div key={track.id} onClick={() => handlePlay(track)} className="group relative bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition cursor-pointer hover:-translate-y-1 duration-300">
                                    <div className="aspect-square bg-black relative overflow-hidden">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover transition duration-500 group-hover:scale-105"/> : <Disc className="text-zinc-700 w-full h-full p-10"/>}
                                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition duration-300 ${isThisTrackPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-lg">
                                                {isThisTrackPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className={`font-bold truncate text-sm mb-1 ${isThisTrackPlaying ? 'text-blue-500' : 'text-white'}`}>{track.title}</h3>
                                        <div className="flex justify-between items-center text-xs text-zinc-500">
                                            {track.genre && <span className="border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] uppercase">{Array.isArray(track?.genre) ? track.genre.join(' ') : (track?.genre || 'Unknown')}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )
          )}
      </div>

      <DonateModal isOpen={showDonate} onClose={() => setShowDonate(false)} recipientAddress={targetWallet} recipientName={profile?.username || "Creator"} />

      {/* ⚠️ Local Player UI Removed (Handled by GlobalPlayer) */}

      {/* Modals */}
      {trackToInvest && (
          <TradeModal 
              isOpen={!!trackToInvest} 
              onClose={() => setTrackToInvest(null)} 
              track={{...trackToInvest, token_id: trackToInvest.token_id ?? null}} 
          />
      )}
      
      {isRentalModalOpen && (
          <RentalModal 
              isOpen={isRentalModalOpen} 
              onClose={() => { setIsRentalModalOpen(false); setPendingRentalTrack(null); }} 
              onConfirm={handleRentalConfirm} 
              isLoading={false}
              isExtension={pendingRentalTrack ? rentedTrackIds.has(pendingRentalTrack.id) : false}
              currentExpiryDate={pendingRentalTrack ? rentedTracksExpiry.get(pendingRentalTrack.id) : null}
              targetTitle={pendingRentalTrack?.title}
          />
      )}
      
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
    </div>
  );
}