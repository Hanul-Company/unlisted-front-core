'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/utils/supabase';
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb";
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants';
import { parseEther } from 'viem';
import { ChevronUp, ListMusic, Loader2, User, UserPlus, UserCheck, Disc, Zap, Share2, Instagram, Twitter, Youtube, Music as MusicIcon, Copy, Play, Pause, Shuffle, SkipBack, SkipForward, Repeat, Repeat1, Volume2, VolumeX, Heart, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import MobileSidebar from '../components/MobileSidebar';
import MobilePlayer from '../components/MobilePlayer'; 
import TradeModal from '../components/TradeModal';   // ✅ [추가] 투자 모달
import RentalModal from '../components/RentalModal'; // ✅ [추가] 렌탈 모달
import PlaylistSelectionModal from '../components/PlaylistSelectionModal'; // ✅ [추가] 플레이리스트 선택 모달

// 토큰 컨트랙트
const tokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-green-500"/></div>}>
      <ProfileContent />
    </Suspense>
  );
}

// [Sub Component] Donate Modal
// [Sub Component] Donate Modal (UX Improved)
function DonateModal({ isOpen, onClose, recipientAddress, recipientName }: { isOpen: boolean, onClose: () => void, recipientAddress: string, recipientName: string }) {
    const { mutate: sendTransaction } = useSendTransaction();
    const [amount, setAmount] = useState("");
    
    // UI States
    const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [progress, setProgress] = useState(0);
    const [loadingMsg, setLoadingMsg] = useState("Initializing...");

    // 자연스러운 로딩 멘트 및 프로그레스 바 시뮬레이션
    useEffect(() => {
        if (status === 'processing') {
            setProgress(0);
            setLoadingMsg("Requesting wallet signature...");
            
            const interval = setInterval(() => {
                setProgress((prev) => {
                    // 90%까지만 천천히 증가 (완료 시 100%로 점프)
                    const next = prev + Math.random() * 5;
                    return next > 90 ? 90 : next;
                });
            }, 800);

            // 시간 경과에 따른 멘트 변경
            const timer1 = setTimeout(() => setLoadingMsg("Broadcasting transaction..."), 3000);
            const timer2 = setTimeout(() => setLoadingMsg("Waiting for block confirmation..."), 8000);
            const timer3 = setTimeout(() => setLoadingMsg("Almost there... securing assets."), 15000);

            return () => {
                clearInterval(interval);
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        } else {
            setProgress(0);
        }
    }, [status]);

    const handleDonate = () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return toast.error("Enter a valid amount");
        
        setStatus('processing'); // 로딩 UI 시작
        try {
            const transaction = prepareContractCall({
                contract: tokenContract,
                method: "transfer",
                params: [recipientAddress, parseEther(amount)]
            });

            sendTransaction(transaction, {
                onSuccess: () => { 
                    setProgress(100);
                    setLoadingMsg("Transfer Complete! 🎉");
                    setStatus('success');
                    toast.success(`Sent ${amount} MLD to ${recipientName}!`); 
                    
                    // 성공 메시지 보여준 뒤 닫기
                    setTimeout(() => {
                        onClose();
                        setStatus('idle');
                        setAmount("");
                    }, 1500);
                },
                onError: (e) => { 
                    console.error(e); 
                    toast.error("Transaction failed or rejected."); 
                    setStatus('idle'); // 실패 시 다시 입력 화면으로
                }
            });
        } catch (e) { 
            toast.error("Error preparing transaction."); 
            setStatus('idle'); 
        } 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 relative overflow-hidden">
                
                {/* 배경 장식 (옵션) */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none"/>

                <h3 className="text-xl font-bold mb-1 flex items-center gap-2 text-white relative z-10">
                    🎁 Support Creator
                </h3>
                <p className="text-xs text-zinc-500 mb-6 relative z-10">
                    Send MLD tokens to <span className="text-zinc-300 font-bold">{recipientName}</span>
                </p>
                
                {status === 'idle' ? (
                    /* 1. 입력 화면 */
                    <>
                        <div className="relative mb-6">
                            <input 
                                autoFocus 
                                type="number" 
                                placeholder="0" 
                                className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white text-2xl font-mono focus:border-green-500 outline-none text-right transition-colors" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none">MLD</span>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-zinc-800 font-bold hover:bg-zinc-700 text-white transition">
                                Cancel
                            </button>
                            <button onClick={handleDonate} className="flex-1 py-3 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                                <Zap size={18} fill="black"/> Send
                            </button>
                        </div>
                    </>
                ) : (
                    /* 2. 로딩/진행 화면 */
                    <div className="py-4 flex flex-col items-center justify-center text-center space-y-4">
                        {status === 'processing' ? (
                            <div className="relative">
                                <Loader2 className="animate-spin text-green-500 w-12 h-12" />
                                <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white fill-white" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                                <UserCheck className="text-black w-6 h-6" />
                            </div>
                        )}
                        
                        <div className="space-y-1 w-full">
                            <h4 className="font-bold text-lg text-white animate-pulse">
                                {status === 'success' ? 'Sent Successfully!' : 'Processing...'}
                            </h4>
                            <p className="text-xs text-zinc-400 font-mono h-4">
                                {loadingMsg}
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                            <div 
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        
                        <p className="text-[10px] text-zinc-600 pt-2">
                            Do not close this window.
                        </p>
                    </div>
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

  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]); // ✅ [New] Playlists State
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tracks' | 'likes' | 'playlists'>('tracks');
  const [showDonate, setShowDonate] = useState(false);
  

  // ✅ [추가] Modal & Logic States
  const [trackToInvest, setTrackToInvest] = useState<any>(null); // 투자할 트랙
  const [pendingRentalTrack, setPendingRentalTrack] = useState<any>(null); // 렌탈할 트랙
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false); // 플레이리스트 선택 모달
  const [tempRentalTerms, setTempRentalTerms] = useState<{ months: number, price: number } | null>(null);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]); // 내 플레이리스트 목록
  const [rentedTrackIds, setRentedTrackIds] = useState<Set<number>>(new Set()); // 렌탈한 트랙 ID (미리듣기 제한용)
  const [likedTrackIds, setLikedTrackIds] = useState<Set<number>>(new Set()); // 좋아요한 트랙 ID

  // Player States
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const toastShownRef = useRef(false);

  // 1. Fetch Profile & Follow Status
  useEffect(() => {
    if (targetWallet) fetchProfileData();
  }, [targetWallet, myAddress]);

  // 2. Fetch User's Rented/Liked Tracks (to check preview limit & heart icon)
  useEffect(() => {
      const fetchUserData = async () => {
          if (!myAddress) return;
          // Rented Tracks
          const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', myAddress).single();
          if (profile) {
              const now = new Date().toISOString();
              const { data: rentals } = await supabase.from('collections').select('track_id').eq('profile_id', profile.id).or(`expires_at.gt.${now},expires_at.is.null`);
              if (rentals) setRentedTrackIds(new Set(rentals.map((r:any) => r.track_id)));
          }
          // Liked Tracks
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

// ✅ [Updated] Fetch Content based on Tab
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
                // 🔻 [수정] playlist_items 안에서 tracks의 cover_image_url을 가져오도록 쿼리 변경
                const { data } = await supabase
                    .from('playlists')
                    .select(`
                        id, name, created_at, is_public, fork_count,
                        playlist_items (
                            tracks (cover_image_url)
                        )
                    `)
                    .eq('profile_id', profile.id)
                    .order('created_at', { ascending: false });
                
                setPlaylists(data || []);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  // --- Handlers (Invest & Like & Rental) ---
  
  // 1. 투자 버튼 클릭
  const handleInvest = (track: any) => {
      if (!myAddress) return toast.error("Connect Wallet first");
      setTrackToInvest(track); 
  };

  // 2. 좋아요(하트) 버튼 클릭 -> 렌탈 안했으면 렌탈 모달, 했으면 좋아요 토글
  const handleLike = async (track: any) => {
      if (!myAddress) return toast.error("Connect Wallet first");

      // 이미 렌탈했으면 그냥 좋아요 토글
      if (rentedTrackIds.has(track.id)) {
          const isLiked = likedTrackIds.has(track.id);
          const nextSet = new Set(likedTrackIds);
          if (isLiked) nextSet.delete(track.id); else nextSet.add(track.id);
          setLikedTrackIds(nextSet);

          if (isLiked) await supabase.from('likes').delete().match({ wallet_address: myAddress, track_id: track.id });
          else await supabase.from('likes').insert({ wallet_address: myAddress, track_id: track.id });
          return;
      }

      // 렌탈 안했으면 렌탈 모달 오픈
      setPendingRentalTrack(track);
      setIsRentalModalOpen(true);
  };

  // 3. 렌탈 기간 선택 후 -> 플레이리스트 선택 모달로 이동 (Market과 동일 흐름)
  const handleRentalConfirm = async (months: number, price: number) => {
      setTempRentalTerms({ months, price });
      
      // 내 플레이리스트 로드
      const { data: profile } = await supabase.from('profiles').select('id').eq('wallet_address', myAddress).single();
      if(profile) {
          const { data: pls } = await supabase.from('playlists').select('*').eq('profile_id', profile.id);
          setMyPlaylists(pls || []);
      }
      
      setIsRentalModalOpen(false);
      setShowPlaylistModal(true);
  };

  // 4. 최종 결제 및 추가 (Market과 동일 로직)
  const processCollect = async (playlistId: string | 'liked') => {
      if (!pendingRentalTrack || !myAddress || !tempRentalTerms) return;
      
      const { months, price } = tempRentalTerms;
      const toastId = toast.loading("Processing...");
      setShowPlaylistModal(false);

      try {
          // pMLD(포인트) 결제 시도 -> 실패 시 MLD(토큰) 결제
          const { data: rpcResult } = await supabase.rpc('add_to_collection_using_p_mld_by_wallet', {
              p_wallet_address: myAddress, p_track_id: pendingRentalTrack.id, p_duration_months: months
          });

          if (rpcResult === 'OK') {
              toast.success("Collected with Points!", { id: toastId });
          } else if (rpcResult === 'INSUFFICIENT_PMLD') {
              // MLD 결제
              if (price > 0) {
                  const tx = prepareContractCall({ contract: tokenContract, method: "transfer", params: ["0x0000000000000000000000000000000000000000", parseEther(price.toString())] });
                  await sendTransaction(tx);
              }
              await supabase.rpc('add_to_collection_using_mld_by_wallet', {
                  p_wallet_address: myAddress, p_track_id: pendingRentalTrack.id, p_duration_months: months, p_amount_mld: price
              });
              toast.success("Collected with MLD!", { id: toastId });
          }

          // 플레이리스트 추가 로직
          if (playlistId !== 'liked') await supabase.from('playlist_items').insert({ playlist_id: parseInt(playlistId), track_id: pendingRentalTrack.id });
          await supabase.from('likes').upsert({ wallet_address: myAddress, track_id: pendingRentalTrack.id }, { onConflict: 'wallet_address, track_id' });

          // 상태 업데이트
          setRentedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setLikedTrackIds(prev => new Set(prev).add(pendingRentalTrack.id));
          setPendingRentalTrack(null); setTempRentalTerms(null);

      } catch (e:any) { toast.error(e.message, { id: toastId }); }
  };

  // --- Player Logic ---
  const isCurrentTrackRented = currentTrack ? rentedTrackIds.has(currentTrack.id) : false;

  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack && audio) {
        if (audio.src !== currentTrack.audio_url) {
            audio.src = currentTrack.audio_url;
            audio.load();
            setCurrentTime(0);
            toastShownRef.current = false;
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

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const time = e.currentTarget.currentTime;
    // 렌탈 안했으면 1분 제한
    if (!isCurrentTrackRented && time >= 60) {
        e.currentTarget.pause();
        setIsPlaying(false);
        if (!toastShownRef.current) {
            toast("Preview ended. Like or Invest to own!", { icon: "🔒", id: "preview-end-toast", style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            toastShownRef.current = true;
        }
    } else {
        setCurrentTime(time);
        if (time < 59) toastShownRef.current = false;
    }
  };

  const playTrack = (track: any) => {
    if (currentTrack?.id === track.id) setIsPlaying(!isPlaying);
    else { setCurrentTrack(track); setIsPlaying(true); }
    setMobilePlayerOpen(true);
  };

  const handleNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const nextIdx = isShuffle ? Math.floor(Math.random() * tracks.length) : (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]); setIsPlaying(true);
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIdx]); setIsPlaying(true);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const toggleFollow = async () => {
    if (!myAddress) return toast.error("Connect Wallet Required");
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
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (!isNaN(d)) setDuration(d); }}
        onEnded={() => { if(repeatMode === 'one') { if(audioRef.current){audioRef.current.currentTime=0; audioRef.current.play();} } else { handleNext(); } }}
        preload="auto"
        crossOrigin="anonymous"
      />

      <div className="p-6 md:p-8">
         <Link href="/market" className="text-zinc-500 hover:text-white text-sm font-bold transition inline-flex items-center gap-2">← Back to Market</Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Profile Header (기존 동일) */}
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
                            {profile.social_links.spotify && <a href={`http://open.spotify.com/artist/${profile.social_links.spotify}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-500 transition p-1"><MusicIcon size={20}/></a>}
                        </div>
                     )}
                 </div>
                 <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                    <button onClick={toggleFollow} className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition border ${isFollowing ? 'bg-black text-white border-zinc-700' : 'bg-white text-black border-white hover:scale-105'}`}>
                        {isFollowing ? <><UserCheck size={18}/> Following</> : <><UserPlus size={18}/> Follow</>}
                    </button>
                    <button onClick={() => setShowDonate(true)} className="px-6 py-3 rounded-full bg-zinc-900 text-green-400 border border-zinc-800 hover:border-green-500/50 hover:bg-zinc-800/80 transition font-bold flex items-center gap-2">
                        <Zap size={18} fill="currentColor"/> Donate
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="p-3 rounded-full border border-zinc-800 text-zinc-400 hover:text-white hover:border-white transition"><Share2 size={18}/></button>
                 </div>
             </div>
          </div>

          {/* ✅ Tabs (Playlists Added) */}
          <div className="flex gap-8 border-b border-zinc-800 mb-8 sticky top-0 bg-black/95 backdrop-blur z-20 pt-4">
            <button onClick={() => fetchTabContent('tracks')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='tracks' ? 'border-green-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Uploaded Tracks</button>
            <button onClick={() => fetchTabContent('likes')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='likes' ? 'border-green-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Liked Collection</button>
            <button onClick={() => fetchTabContent('playlists')} className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab==='playlists' ? 'border-green-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Playlists</button>
          </div>

          {/* Grid Layout */}
          {loading ? ( <div className="col-span-full text-center py-32 text-zinc-500"><Loader2 className="animate-spin mb-2 text-green-500 inline"/> Loading...</div> ) : (
            
            // ✅ Playlist Grid (Playlists 탭일 때)
            activeTab === 'playlists' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {playlists.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"><p className="text-zinc-500 font-bold">No playlists found.</p></div>
                    ) : (
                        playlists.map(pl => {
                            // 1. 커버 이미지 추출 (최대 4개)
                            const coverImages = pl.playlist_items
                                ?.map((item: any) => item.tracks?.cover_image_url)
                                .filter(Boolean)
                                .slice(0, 4) || [];

                            return (
                                <Link href={`/playlists/${pl.id}`} key={pl.id} className="group relative bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition cursor-pointer hover:-translate-y-1 duration-300 block border border-zinc-800 hover:border-zinc-700">
                                    {/* 2. 정사각형 비율 유지 (aspect-square) */}
                                    <div className="aspect-square bg-zinc-800 border-b border-zinc-800 overflow-hidden">
                                        {/* 3. 그리드 로직 적용 */}
                                        {coverImages.length > 0 ? (
                                            coverImages.length === 1 ? (
                                                // 이미지가 1개일 때
                                                <img src={coverImages[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                                            ) : (
                                                // 이미지가 2개 이상일 때 (4분할 그리드)
                                                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                                    {[0, 1, 2, 3].map(i => (
                                                        <div key={i} className="w-full h-full bg-zinc-800 overflow-hidden relative border-[0.5px] border-black/10">
                                                            {coverImages[i] ? (
                                                                <img src={coverImages[i]} className="w-full h-full object-cover"/>
                                                            ) : (
                                                                // 4개가 안 채워졌을 때 빈칸 처리
                                                                <div className="w-full h-full bg-zinc-700/50 flex items-center justify-center">
                                                                    <Disc size={12} className="text-zinc-600"/>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        ) : (
                                            // 이미지가 아예 없을 때 (기본 아이콘)
                                            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                                <ListMusic size={48} className="text-zinc-700"/>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-4">
                                        <h3 className="font-bold truncate text-sm mb-1 text-white group-hover:text-green-500 transition">{pl.name}</h3>
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
                // ✅ Tracks Grid (기존 트랙/좋아요 목록)
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {tracks.length === 0 ? ( <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 rounded-3xl"><p className="text-zinc-500 font-bold">No tracks found.</p></div> ) : (
                        tracks.map(track => (
                            <div key={track.id} onClick={() => playTrack(track)} className="group relative bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition cursor-pointer hover:-translate-y-1 duration-300">
                                <div className="aspect-square bg-black relative overflow-hidden">
                                    {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover transition duration-500 group-hover:scale-105"/> : <Disc className="text-zinc-700 w-full h-full p-10"/>}
                                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition duration-300 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-lg">
                                            {currentTrack?.id === track.id && isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className={`font-bold truncate text-sm mb-1 ${currentTrack?.id === track.id ? 'text-green-500' : 'text-white'}`}>{track.title}</h3>
                                    <div className="flex justify-between items-center text-xs text-zinc-500">
                                        <span className="truncate max-w-[80px]">{new Date(track.created_at).toLocaleDateString()}</span>
                                        {track.genre && <span className="border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] uppercase">{Array.isArray(track?.genre) ? track.genre.join(' ') : (track?.genre || 'Unknown')}</span>}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )
          )}
      </div>

      <DonateModal isOpen={showDonate} onClose={() => setShowDonate(false)} recipientAddress={targetWallet} recipientName={profile?.username || "Creator"} />

      {/* ✅ Mobile Player (with Like & Invest) */}
      {currentTrack && mobilePlayerOpen && (
          <MobilePlayer
              track={currentTrack}
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onNext={handleNext}
              onPrev={handlePrev}
              onClose={() => setMobilePlayerOpen(false)}
              repeatMode={repeatMode}
              onToggleRepeat={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              currentTime={currentTime}
              duration={duration}
              onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }}
              // 렌탈 여부 반영
              isLiked={likedTrackIds.has(currentTrack.id)}
              isRented={rentedTrackIds.has(currentTrack.id)}
              onToggleLike={() => handleLike(currentTrack)} 
              onInvest={currentTrack.is_minted ? () => handleInvest(currentTrack) : undefined}
          />
      )}

      {/* Mobile Mini Player */}
      {currentTrack && !mobilePlayerOpen && (
          <div className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" onClick={() => setMobilePlayerOpen(true)}>
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                      {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <Disc size={20} className="text-zinc-500 m-auto" />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                      <div className="text-xs text-zinc-500 truncate">{currentTrack.artist?.username}</div>
                  </div>
              </div>
              <div className="flex items-center gap-3 pr-1">
                  <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black">
                      {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
                  </button>
              </div>
          </div>
      )}

      {/* ✅ Desktop Footer Player (with Like & Invest) */}
      {currentTrack && (
          <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
              <div className="flex items-center gap-4 w-1/3">
                    <button
                        onClick={() => setMobilePlayerOpen(true)}
                        className="ml-2 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition"
                        title="Open Full Player"
                        aria-label="Open Full Player"
                    >
                        <ChevronUp size={20} />
                    </button>
                  <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                      {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700" /></div>}
                  </div>
                  <div className="overflow-hidden">
                      <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                      <Link href={`/u?wallet=${currentTrack.artist?.wallet_address}`} className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist?.username}</Link>
                  </div>
                  {/* Like Button */}
                  <button 
                      onClick={() => handleLike(currentTrack)} 
                      className={`ml-2 hover:scale-110 transition ${likedTrackIds.has(currentTrack.id) ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}
                  >
                      <Heart size={20} fill={likedTrackIds.has(currentTrack.id) ? "currentColor" : "none"} />
                  </button>
              </div>

              <div className="flex flex-col items-center gap-2 w-1/3">
                  <div className="flex items-center gap-6">
                      <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20} /></button>
                      <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">
                          {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                      </button>
                      <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20} /></button>
                  </div>
                  <div className="w-full max-w-sm flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                      {/* 타임바 (렌탈 여부에 따라 미리듣기 제한 표시) */}
                      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group" 
                           onClick={(e) => { 
                               if (audioRef.current) { 
                                   const rect = e.currentTarget.getBoundingClientRect(); 
                                   const newTime = ((e.clientX - rect.left) / rect.width) * duration;
                                   if(!isCurrentTrackRented && newTime > 60) { toast.error("Preview limited to 1min"); audioRef.current.currentTime = 60; } 
                                   else audioRef.current.currentTime = newTime; 
                               } 
                           }}>
                          {!isCurrentTrackRented && duration > 60 && <div className="absolute top-0 left-0 h-full bg-purple-500/20 z-0" style={{ width: `${Math.min((60/duration)*100, 100)}%` }} />}
                          <div className="h-full bg-white rounded-full relative z-10 group-hover:bg-green-500 transition-colors" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                      </div>
                      <span className={`text-[10px] font-mono w-8 ${!isCurrentTrackRented ? 'text-purple-400' : 'text-zinc-500'}`}>
                          {!isCurrentTrackRented ? '1:00' : formatTime(duration)}
                      </span>
                  </div>
              </div>

              <div className="w-1/3 flex justify-end items-center gap-4">
                  {/* Invest Button */}
                  {currentTrack.is_minted && (
                      <button onClick={() => handleInvest(currentTrack)} className="bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center gap-1.5">
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

      {/* Modals */}
      {trackToInvest && <TradeModal isOpen={!!trackToInvest} onClose={() => setTrackToInvest(null)} track={trackToInvest} />}
      {isRentalModalOpen && <RentalModal isOpen={isRentalModalOpen} onClose={() => setIsRentalModalOpen(false)} onConfirm={handleRentalConfirm} isLoading={false} />}
      {/* 렌탈 모달 다음 -> 플레이리스트 선택 모달 */}
      <PlaylistSelectionModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} playlists={myPlaylists} onSelect={processCollect} />
    </div>
  );
}