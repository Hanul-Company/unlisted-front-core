'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Radius, Book, PlayCircle, Play, Pause, TrendingUp, Loader2, UploadCloud, Music as MusicIcon, Trash2, ExternalLink, Coins, CheckCircle, User, Heart, Mic2, LayoutGrid, Disc, SkipForward, SkipBack, Volume2, Star, Zap, ArrowRight, Search, Menu } from 'lucide-react';
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI, MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, MELODY_IP_ADDRESS, MELODY_IP_ABI } from '../constants';
import { supabase } from '@/utils/supabase'; 
import Link from 'next/link';
import toast from 'react-hot-toast';
import HeaderProfile from '../components/HeaderProfile';
import MobileSidebar from '../components/MobileSidebar';
import MobilePlayer from '../components/MobilePlayer'; // [필수] 모바일 플레이어 임포트
import TradeModal from '../components/TradeModal';
import { formatEther } from 'viem';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb"; // 우리가 만든 설정

// --- Contract Definitions ---
// Thirdweb은 이렇게 계약 객체를 먼저 정의하고 씁니다.
const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });
const unlistedStockContract = getContract({ client, chain, address: UNLISTED_STOCK_ADDRESS, abi: UNLISTED_STOCK_ABI as any });
const melodyIpContract = getContract({ client, chain, address: MELODY_IP_ADDRESS, abi: MELODY_IP_ABI as any });

type Track = {
  id: number;
  title: string;
  artist_name: string; 
  audio_url: string;
  cover_image_url: string | null;
  is_minted: boolean;
  token_id: number | null;
  melody_hash: string | null;
  uploader_address: string | null;
  created_at: string;
};

type Profile = { wallet_address: string; username: string; avatar_url: string | null; };
const PAGE_SIZE = 15; 

export default function MarketPage() {
  // [Web3 Hook 교체] Wagmi useAccount -> Thirdweb useActiveAccount
  const account = useActiveAccount();
  const address = account?.address;

  // [Transaction Hook] Thirdweb은 이거 하나로 모든 쓰기 작업 처리 가능
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  // Player & Data States (기존 유지)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [newTracks, setNewTracks] = useState<Track[]>([]);
  const [investTracks, setInvestTracks] = useState<Track[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [browseTracks, setBrowseTracks] = useState<Track[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const [loadingTop, setLoadingTop] = useState(true);
  const [processingTrackId, setProcessingTrackId] = useState<number | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  
  // Mobile UI States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off'|'all'|'one'>('all');
  const [isShuffle, setIsShuffle] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);

  // [Read Hook] MLD 잔고 조회
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract: melodyTokenContract,
    method: "balanceOf",
    params: [address || "0x0000000000000000000000000000000000000000"]
  });

  // --- Initial Data Loading ---
  useEffect(() => {
    const fetchTopData = async () => {
      setLoadingTop(true);
      const { data: newData } = await supabase.from('tracks').select('*').order('created_at', { ascending: false }).limit(5);
      setNewTracks(newData || []);
      const { data: allData } = await supabase.from('tracks').select('*').eq('is_minted', true).limit(20);
      setInvestTracks((allData || []).slice(0, 5));
      const { data: creatorData } = await supabase.from('profiles').select('*').limit(8);
      setCreators(creatorData || []);
      setLoadingTop(false);
    };
    fetchTopData();
  }, []);

  // --- Browse Data ---
  useEffect(() => {
    setPage(0); setBrowseTracks([]); setHasMore(true);
    fetchBrowseData(0, searchQuery, true);
  }, [searchQuery]);

  const fetchBrowseData = async (pageIndex: number, query: string, isReset: boolean = false) => {
    setIsBrowseLoading(true);
    try {
      let queryBuilder = supabase.from('tracks').select('*').order('created_at', { ascending: false }).range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
      if (query) queryBuilder = queryBuilder.ilike('title', `%${query}%`);
      const { data, error } = await queryBuilder;
      if (!error && data) {
        if (data.length < PAGE_SIZE) setHasMore(false);
        setBrowseTracks(prev => isReset ? data : [...prev, ...data]);
      }
    } catch (e) { console.error(e); } finally { setIsBrowseLoading(false); }
  };

  const handleScroll = () => {
    if (mainRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50 && !isBrowseLoading && hasMore) {
            const nextPage = page + 1; setPage(nextPage); fetchBrowseData(nextPage, searchQuery);
        }
    }
  };

  // --- Handlers (Thirdweb 전환 핵심) ---

  const handleRegister = async (track: Track) => {
    if (!address) return toast.error("지갑 연결 필요");
    if (processingTrackId) return; // 중복 방지

    setProcessingTrackId(track.id);
    const uniqueHash = `${track.melody_hash || 'hash'}_${track.id}_${Date.now()}`; 

    try {
      toast.loading("서명 요청 중...", { id: 'register-toast' });
      
      const { data: contributors } = await supabase.from('track_contributors').select('*').eq('track_id', track.id);
      let payees: string[] = [address]; let shares: bigint[] = [BigInt(10000)];
      
      if (contributors && contributors.length > 0) {
        const valid = contributors.filter(c => c.wallet_address && c.wallet_address.startsWith('0x'));
        if (valid.length > 0) {
            payees = valid.map(c => c.wallet_address);
            const raw = valid.map(c => Math.round(Number(c.share_percentage) * 100));
            const sum = raw.reduce((a, b) => a + b, 0);
            if (raw.length > 0) raw[0] += (10000 - sum);
            shares = raw.map(s => BigInt(s));
        }
      }

      // [Thirdweb] 트랜잭션 준비
      const transaction = prepareContractCall({
        contract: melodyIpContract,
        method: "registerMusic",
        params: [uniqueHash, payees, shares, BigInt(500), true, track.audio_url]
      });

      // [Thirdweb] 전송
      sendTransaction(transaction, {
        onSuccess: async () => {
            // 성공 시 DB 업데이트
            const { error } = await supabase.from('tracks').update({ is_minted: true, token_id: track.id }).eq('id', track.id); // token_id 임시 매핑
            if (!error) {
                toast.success("등록 완료!", { id: 'register-toast' });
                setBrowseTracks(prev => prev.map(t => t.id === track.id ? { ...t, is_minted: true } : t));
                setNewTracks(prev => prev.map(t => t.id === track.id ? { ...t, is_minted: true } : t));
            } else {
                toast.error("DB 업데이트 실패", { id: 'register-toast' });
            }
            setProcessingTrackId(null);
        },
        onError: (err) => {
            console.error(err);
            toast.error("트랜잭션 실패", { id: 'register-toast' });
            setProcessingTrackId(null);
        }
      });

    } catch (e) { 
        console.error(e); 
        toast.error("오류 발생", { id: 'register-toast' });
        setProcessingTrackId(null); 
    }
  };

  const handleInvest = (track: Track) => {
    if (!address) return toast.error("지갑을 연결해주세요.");
    setSelectedTrack(track);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (!error) { toast.success("삭제됨"); setBrowseTracks(prev => prev.filter(t => t.id !== id)); setNewTracks(prev => prev.filter(t => t.id !== id)); }
    else toast.error(error.message);
  };

  // --- Audio Control & Utils (기존 동일) ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack) {
        if (audio.src !== currentTrack.audio_url) { audio.src = currentTrack.audio_url; setCurrentTime(0); }
        if (isPlaying) { const p = audio.play(); if(p !== undefined) p.catch(console.error); } 
        else audio.pause();
    } else audio.pause();
  }, [currentTrack, isPlaying]);

  const handleNext = () => {
    if (!currentTrack) return;
    const list = browseTracks.length > 0 ? browseTracks : newTracks;
    const idx = list.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1 && idx < list.length - 1) setCurrentTrack(list[idx + 1]);
  };
  
  const handlePrev = () => {
    if (!currentTrack) return;
    const list = browseTracks.length > 0 ? browseTracks : newTracks;
    const idx = list.findIndex(t => t.id === currentTrack.id);
    if (idx > 0) setCurrentTrack(list[idx - 1]);
  };

  const formatTime = (time: number) => { if(isNaN(time)) return "0:00"; const min = Math.floor(time / 60); const sec = Math.floor(time % 60); return `${min}:${sec < 10 ? '0' : ''}${sec}`; };


  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <audio ref={audioRef} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => setIsPlaying(false)} preload="auto" crossOrigin="anonymous"/>

      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 hidden md:flex flex-col p-6">
         <div className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-8 cursor-pointer">UNLISTED</div>
         <Link href="/upload"><button className="w-full bg-white text-black font-bold py-3 rounded-xl mb-8 flex items-center justify-center gap-2 hover:scale-105 transition"><UploadCloud size={20}/> Upload</button></Link>
         <nav className="space-y-6">
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Discover</h3>
                 <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800 text-white cursor-pointer hover:bg-zinc-700 transition"><Disc size={18}/><span className="text-sm font-medium"> Explore</span></div>
                 <Link href="/radio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Radius size={18}/><span className="text-sm font-medium"> unlisted Player</span></div></Link>
                 
                 <Link href="/investing"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><TrendingUp size={18}/><span className="text-sm font-medium"> Charts</span></div></Link>
             </div>
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Rewards</h3>
                 {/* [추가] Earn 메뉴 */}
                 <Link href="/earn">
                     <div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer">
                         <Zap size={18} className="text-yellow-500"/>
                         <span className="text-sm font-medium text-yellow-500">Free Faucet</span>
                     </div>
                 </Link>
                 <Link href="/studio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Coins size={18}/> <span className="text-sm font-medium"> Revenue</span></div></Link>
             </div>
             <div>
                 <h3 className="text-[10px] text-zinc-500 font-bold uppercase mb-2">My Studio</h3>
                 <Link href="/portfolio"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><Book size={18}/><span className="text-sm font-medium"> Portoflio</span></div></Link>
                 <Link href="/library"><div className="flex gap-3 p-2 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"><PlayCircle size={18}/><span className="text-sm font-medium"> Playlists</span></div></Link>
             </div>
         </nav>
      </aside>

      <main ref={mainRef} onScroll={handleScroll} className="flex-1 flex flex-col overflow-y-auto pb-24 scroll-smooth relative">
        {/* Header */}
        <header className="flex justify-between items-center p-6 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 border-b border-zinc-800">
          <div className="flex items-center gap-4">
             <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-white"><Menu/></button>
             <h1 className="text-xl font-bold">Discover</h1>
          </div>
          <div className="flex items-center gap-3">
             {address && <div className="hidden sm:block text-xs font-mono text-green-400 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 shadow-inner">{balanceData ? Number(formatEther(balanceData as bigint)).toLocaleString(undefined, {maximumFractionDigits:0}) : 0} MLD</div>}
             <HeaderProfile />
          </div>
        </header>

        {loadingTop ? (
            <div className="flex justify-center pt-40"><Loader2 className="animate-spin text-cyan-500" size={32}/></div>
        ) : (
            <div className="pb-10 pt-4">
                {/* 1. Fresh Drops */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><Star className="text-yellow-400" size={20}/> Fresh Drops</h2></div>
                    <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide">
                        {newTracks.map((t) => (
                            <div key={t.id} className="min-w-[160px] w-[160px] group cursor-pointer" onClick={() => { setCurrentTrack(t); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 mb-3 shadow-lg group-hover:border-white/20 transition">
                                    {t.cover_image_url ? <img src={t.cover_image_url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/> : <MusicIcon className="w-full h-full p-10 text-zinc-600"/>}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Play fill="white"/></div>
                                </div>
                                <h3 className="font-bold text-sm truncate">{t.title}</h3>
                                <p className="text-xs text-zinc-500 truncate">{t.artist_name}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 2. Popular Creators */}
                <section className="py-6 border-b border-zinc-800/50 bg-zinc-900/20">
                    <div className="px-6 mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><User className="text-cyan-400" size={20}/> Trending Artists</h2></div>
                    <div className="flex gap-6 overflow-x-auto px-6 pb-2 scrollbar-hide">
                        {creators.map((c:any) => (
                            <Link href={`/u?wallet=${c.wallet_address}`} key={c.id}>
                                <div className="flex flex-col items-center gap-2 cursor-pointer group min-w-[80px]">
                                    <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 group-hover:border-cyan-500 transition">
                                        {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover"/> : <User className="w-full h-full p-5 text-zinc-500"/>}
                                    </div>
                                    <span className="text-xs font-bold truncate w-20 text-center">{c.username || 'User'}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* 3. Blue Chip */}
                <section className="py-6 border-b border-zinc-800/50">
                    <div className="px-6 mb-4 flex justify-between items-end">
                        <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="text-green-400" size={20}/> Top Investment</h2>
                        <Link href="/investing" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">View Chart <ArrowRight size={12}/></Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide">
                        {investTracks.map((t) => (
                            <div key={t.id} className="min-w-[200px] w-[200px] group bg-zinc-900 border border-zinc-800 p-3 rounded-xl hover:border-green-500/50 transition cursor-pointer" onClick={() => { setCurrentTrack(t); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                                        {t.cover_image_url ? <img src={t.cover_image_url} className="w-full h-full object-cover"/> : <MusicIcon className="p-3 text-zinc-600"/>}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="font-bold text-sm truncate">{t.title}</div>
                                        <div className="text-xs text-zinc-500 truncate">{t.artist_name}</div>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleInvest(t); }} className="w-full bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"><Zap size={14} fill="currentColor"/> Invest</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Browse All */}
                <section className="p-6 min-h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Disc className="text-zinc-400" size={20}/> Browse</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-zinc-500" size={14}/>
                            <input type="text" placeholder="Search..." className="w-64 bg-zinc-900 rounded-full py-1.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500 border border-zinc-800" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {browseTracks.map((track) => {
                            const isOwner = address && track.uploader_address && address.toLowerCase() === track.uploader_address.toLowerCase();
                            const isProcessingThis = processingTrackId === track.id && (isPending);

                            return (
                                <div key={track.id} className={`group flex items-center justify-between p-3 rounded-xl transition-all border cursor-pointer ${currentTrack?.id === track.id ? 'bg-zinc-900 border-cyan-500/50' : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`} onClick={() => { setCurrentTrack(track); setIsPlaying(true); setMobilePlayerOpen(true); }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 relative">
                                        {track.cover_image_url ? <img src={track.cover_image_url} className="w-full h-full object-cover"/> : <MusicIcon size={16} className="text-zinc-700"/>}
                                        {currentTrack?.id === track.id && isPlaying && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"/></div>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{track.title}</div>
                                        <Link href={track.uploader_address ? `/u?wallet=${track.uploader_address}` : '#'} onClick={(e)=>e.stopPropagation()} className="text-xs text-zinc-500 hover:text-white hover:underline transition-colors">{track.artist_name || 'Unlisted Artist'}</Link>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {track.is_minted ? (
                                        <button onClick={(e) => { e.stopPropagation(); handleInvest(track); }} className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white hover:text-black transition">Invest</button>
                                    ) : (
                                        isOwner ? (
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 rounded"><Trash2 size={14}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleRegister(track); }} className="bg-zinc-900 text-cyan-500 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-cyan-500 hover:text-white transition" disabled={isProcessingThis}>{isProcessingThis ? <Loader2 className="animate-spin" size={12}/> : 'Register'}</button>
                                            </div>
                                        ) : <span className="text-[10px] text-zinc-600 font-mono">PREPARING</span>
                                    )}
                                </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        )}
      </main>
      
      {/* 5. Mobile Full Player */}
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
            />
      )}
      
      {/* 6. Mobile Mini Player */}
      {currentTrack && !mobilePlayerOpen && (
             <div 
                className="md:hidden fixed bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3 flex items-center justify-between shadow-2xl z-40" 
                onClick={() => setMobilePlayerOpen(true)}
             >
                 <div className="flex items-center gap-3 overflow-hidden">
                     <div className="w-10 h-10 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                        {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <Disc size={20} className="text-zinc-500 m-auto"/>}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate text-white">{currentTrack.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{currentTrack.artist_name}</div>
                     </div>
                 </div>
                 <div className="flex items-center gap-3 pr-1">
                     <button 
                        onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} 
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black"
                     >
                        {isPlaying ? <Pause size={16} fill="black"/> : <Play size={16} fill="black" className="ml-0.5"/>}
                     </button>
                 </div>
             </div>
      )}

      {/* 7. Desktop Footer Player */}
      {currentTrack && (
            <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-zinc-950/90 border-t border-zinc-800 backdrop-blur-xl items-center justify-between px-6 z-50 shadow-2xl">
                <div className="flex items-center gap-4 w-1/3">
                    <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 shadow-lg relative">
                         {currentTrack.cover_image_url ? <img src={currentTrack.cover_image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Disc size={24} className="text-zinc-700 animate-spin-slow"/></div>}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-sm font-bold truncate text-white">{currentTrack.title}</div>
                        <div className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artist_name || 'Unlisted Artist'}</div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2 w-1/3">
                    <div className="flex items-center gap-6">
                        <button className="text-zinc-400 hover:text-white transition" onClick={handlePrev}><SkipBack size={20}/></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-lg shadow-white/10">{isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}</button>
                        <button className="text-zinc-400 hover:text-white transition" onClick={handleNext}><SkipForward size={20}/></button>
                    </div>
                    <div className="w-full max-w-sm flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(currentTime)}</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer"><div className="h-full bg-white rounded-full" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }}/></div>
                        <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(duration)}</span>
                    </div>
                </div>
                <div className="w-1/3 flex justify-end items-center gap-4">
                    <Volume2 size={18} className="text-zinc-500"/>
                    <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="w-2/3 h-full bg-zinc-500 rounded-full"></div></div>
                </div>
            </div>
      )}

      {selectedTrack && (
        <TradeModal 
            isOpen={!!selectedTrack} 
            onClose={() => setSelectedTrack(null)} 
            track={selectedTrack} 
        />
      )}
    </div>
  );
}