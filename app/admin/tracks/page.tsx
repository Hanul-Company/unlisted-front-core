'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Search, Loader2, Edit, Trash2, X, Plus, Save,
  Music, Disc, Bot, Hash, Download, Play, Pause,
  Share2, FileVideo, UploadCloud, RefreshCw, CheckCircle,
  Settings2, ChevronDown, User, Sparkles, Mic2, Wand2, Youtube, ListPlus,
  ArrowUp, ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '@/app/constants';
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import { Link } from "@/lib/i18n";
import Cropper from 'react-easy-crop';
import { getCroppedImg, resizeImageBlob } from '@/utils/image';
import { useActiveAccount } from "thirdweb/react";
import HeaderProfile from '@/app/components/HeaderProfile';

import { generateBulkVariants } from '@/app/actions/generate-bulk-variants';
import { generateSunoPrompt } from '@/app/actions/generate-suno-prompt';
import { analyzeTrackMetadata } from '@/app/actions/analyze-music';

let _ffmpeg: FFmpeg | null = null;
let _ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (_ffmpegLoading) return _ffmpegLoading;
  const ffmpeg = new FFmpeg();
  _ffmpegLoading = (async () => {
    await ffmpeg.load();
    _ffmpeg = ffmpeg;
    return ffmpeg;
  })();
  return _ffmpegLoading;
}

// ✅ 트랙 타입 정의 (genre: string[] 로 변경)
type Track = {
  id: number;
  title: string;
  audio_url: string | null; // ✅ added
  artist_name: string;
  uploader_address: string;
  genre: string[]; // ✅ changed
  moods: string[];
  context_tags: string[];
  ai_metadata: {
    ref_artists?: string[];
    ref_tracks?: string[];
    vibe_tags?: string[];
    voice_style?: string[];
    analyzed_genres?: string[];
    analyzed_moods?: string[];
    similar_artists?: string[];
  } | null;
  cover_image_url: string;
  high_res_cover_url?: string | null;
  lyrics?: string | null;
  created_at: string;
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
};

type MusicSearchResult = {
  id: string; title: string; artist: string; album: string; artwork: string; artworkHD: string;
  genre?: string; releaseYear?: string; country?: string; isExplicit?: boolean; durationMs?: number;
};

type ArtistSearchResult = { id: string; name: string; artwork?: string; genre?: string; };

const SegTab = ({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5 border border-white/[0.05]">
    {options.map(o => (
      <button key={o.key} onClick={() => onChange(o.key)}
        className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold tracking-wide transition-all duration-200 ${value === o.key ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-300'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export default function AdminTracksPage() {
  const account = useActiveAccount();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState<'created_at_desc' | 'created_at_asc' | 'title_asc' | 'title_desc'>('created_at_desc');

  // --- Multi-select ---
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // SNS Upload Modal State
  const [snsModalTrack, setSnsModalTrack] = useState<Track | null>(null);
  const [customSnsImage, setCustomSnsImage] = useState<File | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Audio Playback State
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Bulk Generate State ---
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Search
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<MusicSearchResult[]>([]);
  const [isSongSearching, setIsSongSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<MusicSearchResult | null>(null);

  const [artistQuery, setArtistQuery] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [isArtistSearching, setIsArtistSearching] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null);

  const songSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artistSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bulkRefTitle, setBulkRefTitle] = useState('');
  const [bulkRefArtist, setBulkRefArtist] = useState('');
  const [bulkTargetVoice, setBulkTargetVoice] = useState('');
  const [vocalMode, setVocalMode] = useState<'tags' | 'artist'>('tags');
  const [vocalTags, setVocalTags] = useState<any>({});
  const [showDetailVox, setShowDetailVox] = useState(false);
  const [bulkBaseTitle, setBulkBaseTitle] = useState('');
  const [bulkBaseLyrics, setBulkBaseLyrics] = useState('');
  const [etcInfo, setEtcInfo] = useState('');
  const [bulkCoverImage, setBulkCoverImage] = useState<File | null>(null);
  const [coverImageMode, setCoverImageMode] = useState<'single' | 'individual'>('single');
  const [bulkIndividualCovers, setBulkIndividualCovers] = useState<(File | null)[]>([]);
  const [bulkCount, setBulkCount] = useState<number>(3);
  const [bulkStatusText, setBulkStatusText] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // --- Bulk Queue Tracking ---
  const [bulkJobsList, setBulkJobsList] = useState<any[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

  // --- Playlist Modal State ---
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistIdInput, setPlaylistIdInput] = useState('');
  const [existingPlaylistIds, setExistingPlaylistIds] = useState<string[]>([]);
  const [isSubmittingPlaylist, setIsSubmittingPlaylist] = useState(false);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);

  const fetchBulkJobs = async () => {
    setIsJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from('suno_jobs')
        .select('*')
        .neq('status', 'published')   // status가 published이면 제외
        .is('published_track_id', null) // published_track_id가 있으면 이미 퍼블리시 완료 → 제외
        .eq('discarded', false)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;

      // Filter to only 'bulk_batch'
      const filtered = (data || []).filter(j => {
        try {
          const parsed = JSON.parse(j.etc_info || '{}');
          return parsed.bulk_batch === true;
        } catch { return false; }
      });

      setBulkJobsList(filtered);
    } catch(e) {
      console.error(e);
    } finally {
      setIsJobsLoading(false);
    }
  };

  useEffect(() => {
    fetchBulkJobs();
    const interval = setInterval(() => {
      fetchBulkJobs();
    }, 120000); // Check every 2 minutes

    return () => clearInterval(interval);
  }, []);

  const searchSongs = async (query: string) => {
    if (!query.trim() || query.length < 2) { setSongResults([]); return; }
    setIsSongSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=6`);
      const data = await res.json();
      setSongResults((data.results ?? []).map((item: any) => ({
        id: String(item.trackId), title: item.trackName ?? '', artist: item.artistName ?? '', album: item.collectionName ?? '',
        artwork: (item.artworkUrl100 ?? '').replace('100x100bb', '120x120bb'),
        artworkHD: (item.artworkUrl100 ?? '').replace('100x100bb', '400x400bb'),
        genre: item.primaryGenreName ?? undefined,
        releaseYear: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
        country: item.country ?? undefined, isExplicit: item.trackExplicitness === 'explicit',
        durationMs: item.trackTimeMillis ?? undefined,
      })));
    } catch { setSongResults([]); } finally { setIsSongSearching(false); }
  };

  const searchArtists = async (query: string) => {
    if (!query.trim() || query.length < 2) { setArtistResults([]); return; }
    setIsArtistSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=musicArtist&limit=5`);
      const data = await res.json();
      setArtistResults((data.results ?? []).map((item: any) => ({
        id: String(item.artistId), name: item.artistName ?? '', artwork: '', genre: item.primaryGenreName ?? undefined,
      })));
    } catch { setArtistResults([]); } finally { setIsArtistSearching(false); }
  };

  const handleSongQueryChange = (val: string) => {
    setSongQuery(val); setSelectedSong(null);
    if (songSearchRef.current) clearTimeout(songSearchRef.current);
    songSearchRef.current = setTimeout(() => searchSongs(val), 350);
  };

  const handleArtistQueryChange = (val: string) => {
    setArtistQuery(val); setSelectedArtist(null);
    if (artistSearchRef.current) clearTimeout(artistSearchRef.current);
    artistSearchRef.current = setTimeout(() => searchArtists(val), 350);
  };

  const selectSong = (song: MusicSearchResult) => {
    setSelectedSong(song); setBulkRefTitle(song.title); setBulkRefArtist(song.artist);
    setSongQuery(song.title); setSongResults([]);
  };

  const selectArtist = (artist: ArtistSearchResult) => {
    setSelectedArtist(artist); setBulkTargetVoice(artist.name);
    setArtistQuery(artist.name); setArtistResults([]);
  };

  // --- Playlist ---
  const handleOpenPlaylistModal = async () => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size > 20) {
      toast.error('최대 20개의 트랙만 선택 가능합니다.');
      return;
    }

    try {
      const { data, error } = await supabase.from('playlist_jobs')
        .select('playlist_id')
        .not('playlist_id', 'is', null);
      if (!error && data) {
        const ids = Array.from(new Set(data.map(d => d.playlist_id).filter(Boolean)));
        setExistingPlaylistIds(ids as string[]);
      }
    } catch(e) {
      console.warn('Failed to fetch existing playlist ids', e);
    }

    let selectedTracksForPlaylist = tracks.filter(t => selectedIds.has(t.id));
    if (selectedTracksForPlaylist.length !== selectedIds.size) {
      const toastId = toast.loading('선택된 트랙을 확인 중...');
      const { data, error } = await supabase.from('tracks').select('id, title, artist_name, audio_url, cover_image_url').in('id', Array.from(selectedIds));
      toast.dismiss(toastId);
      if (error) {
         toast.error('정보 확인 실패');
         return;
      }
      selectedTracksForPlaylist = data as any[];
    }
    
    setPlaylistTracks(selectedTracksForPlaylist);
    
    // tracklist는 worker가 실제 타임스탬프로 교체 — 트랙명만 플레이스홀더로 넣음
    let trackListStr = '';
    selectedTracksForPlaylist.forEach((t) => {
      const trackName = t.title || 'Untitled';
      const artistName = t.artist_name || 'Anonymous';
      trackListStr += `00:00 ${artistName} - ${trackName}\n`;
    });

    const defaultDesc = `🎧 unlisted — The music never existed\n\nMusic Stream Platform : 💙 || Only on Unlisted → https://unlisted.music\n\n[Tracklist]\n${trackListStr}\nThe songs in this playlist are all original creations by creators of 'unlisted', created using AI. The copyright is owned by unlisted and creators.\n\n© 2026 unlisted. All rights reserved.\n\n#emotionalhiphop #rnb #playlist #popmusic #chillmusic #emotional #hiphop #lofi #lofimusic #chillvibes #moodmusic #koreanrnb #chillplaylist #studywithme #플레이리스트 #카페음악 #aestheticmusic #backgroundmusic #bedroomrnb #cafemusic #cafévibes #cafeplaylist #calmflow #calmrnb #calmvibes #changeyourmood #chillatmosphere #chillbgm #chillhop #chillplaylist #chillvibes #cozymusic #cozynight #cozycafe #dailyplaylist #dailymusic #deeprnb #dreamyrnb #drivingmusic #easylistening #emotionalmusic #emotionalpop #emotionalrnb #eveningchill #eveningplaylist #focusbeats #focusmusic #focusplaylist #focusstudy #gentlernb #goodvibes #groovemusic #healingmusic #hiphopmusic #hiphopplaylist #hiphoppop #hiphoprnb #hiphoprnbemotions #kplaylist #koreanhiphop #koreanplaylist #koreanrb #koreanrnb #latenightvibes #lofibeats #lofimusic #lovesongs #moodmusic #morningplaylist #musicforyou #musicplaylist #musicrecommendation #nightplaylist #nightvibe #officemusic #peacefulmusic #quietbeats #quieteveningmusic #rbmusic #rbplaylist #rbpop #recommendplaylist #relaxbeats #relaxingbgm #relaxingmusic #relaxmusic #relaxplaylist #rhythmandblues #rnbchill #rnbfocus #rnbmix #rnbplaylist #rnbvibes #shareplaylist #slowjam #smoothmix #smoothrnb #softbeats #softlove #softmood #softrnb #softvibes #songoftheday #soulmusic #studybeats #studybgm #studyhiphop #studymusic #studyplaylist #studyvibes #studywithme #therapymusic #travelmusic #urbanmusic #vibesplaylist #warmrnb #workmusic #workplaylist #감성플리 #감성힙합 #나만의플리 #달달한플리 #노래 #느좋 #느좋플리 #알앤비 #짝사랑 #짝사랑플리 #플리 #플레이리스트`;

    const defaultTitle = `𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭 ${selectedTracksForPlaylist.map(t => t.artist_name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(' & ')} | Emotional HipHop・Pop R&B | Ultimate BGM | Chill Groove Vibe`;
    setPlaylistTitle(defaultTitle);
    setPlaylistDescription(defaultDesc);
    setPlaylistIdInput('');
    setIsPlaylistModalOpen(true);
  };

  const updateDescriptionTracklist = (newTracks: any[]) => {
    let newTrackListStr = '';
    newTracks.forEach((t) => {
      newTrackListStr += `00:00 ${t.artist_name || 'Anonymous'} - ${t.title || 'Untitled'}\n`;
    });
    setPlaylistDescription(prev => {
      const parts = prev.split('[Tracklist]\n');
      if (parts.length === 2) {
         const bottomParts = parts[1].split('\nThe songs in this playlist');
         if (bottomParts.length === 2) {
            return `${parts[0]}[Tracklist]\n${newTrackListStr}The songs in this playlist${bottomParts[1]}`;
         }
      }
      return prev;
    });
  };

  const movePlaylistTrack = (index: number, direction: 'up' | 'down') => {
    const newTracks = [...playlistTracks];
    if (direction === 'up' && index > 0) {
      [newTracks[index - 1], newTracks[index]] = [newTracks[index], newTracks[index - 1]];
    } else if (direction === 'down' && index < newTracks.length - 1) {
      [newTracks[index + 1], newTracks[index]] = [newTracks[index], newTracks[index + 1]];
    } else {
      return;
    }
    setPlaylistTracks(newTracks);
    updateDescriptionTracklist(newTracks);
  };

  const handleSubmitPlaylist = async () => {
    if (!playlistTitle.trim() || !playlistDescription.trim()) {
      return toast.error('제목과 설명을 입력해주세요.');
    }
    if (playlistTracks.length === 0) {
      return toast.error('선택된 트랙이 없습니다.');
    }
    
    setIsSubmittingPlaylist(true);
    try {
      const trackIds = playlistTracks.map(t => t.id);
      const trackData = playlistTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist_name, audio_url: t.audio_url, cover_image_url: t.cover_image_url }));

      const { error } = await supabase.from('playlist_jobs').insert({
        title: playlistTitle,
        description: playlistDescription,
        track_ids: trackIds,
        tracks_data: trackData,
        playlist_id: playlistIdInput.trim() || null,
        status: 'pending'
      });

      if (error) throw error;
      
      toast.success('플레이리스트 업로드 요청이 등록되었습니다.');
      setIsPlaylistModalOpen(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error('요청 실패: ' + err.message);
    } finally {
      setIsSubmittingPlaylist(false);
    }
  };

  // --- Bulk Publish State ---
  const [bulkPublishStatusText, setBulkPublishStatusText] = useState('');
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);

  const handleDiscardBulkJob = async (id: number) => {
    if (!confirm("Discard this job from bulk queue?")) return;
    try {
      // Just mark it as discarded so it won't be processed or published
      await supabase.from('suno_jobs').update({ discarded: true }).eq('id', id);
      toast.success("Job removed from bulk queue");
      fetchBulkJobs();
    } catch(e:any) {
      toast.error("Failed to discard job: " + e.message);
    }
  };

  const handleDiscardAllBulkJobs = async () => {
    if (bulkJobsList.length === 0) return;
    if (!confirm("현재 리스트에 보이는 모든 작업을 큐에서 삭제하시겠습니까? (이미 발행/완료된 트랙들엔 영향이 없습니다)")) return;
    
    try {
      const ids = bulkJobsList.map(j => j.id);
      await supabase.from('suno_jobs').update({ discarded: true }).in('id', ids);
      toast.success("모든 잡이 목록에서 지워졌습니다.");
      fetchBulkJobs();
    } catch(e:any) {
      toast.error("Failed to discard all jobs: " + e.message);
    }
  };


  const handleBulkGenerate = async () => {
    if (!bulkBaseTitle || !bulkBaseLyrics || !bulkCount || !bulkRefArtist || !bulkRefTitle) {
      return toast.error("Please fill all required fields.");
    }
    
    // Validate individual covers
    if (coverImageMode === 'individual') {
      const missingCount = Array.from({ length: bulkCount }).filter((_, i) => !bulkIndividualCovers[i]).length;
      if (missingCount > 0) {
        return toast.error(`개별 커버 모드: ${missingCount}개 이미지가 누락되었습니다.`);
      }
    }

    setIsBulkProcessing(true);
    try {
      // Upload single cover if needed
      let sharedCoverUrl = '';
      if (coverImageMode === 'single' && bulkCoverImage) {
        setBulkStatusText('Uploading cover image...');
        const ts = Date.now();
        const ext = bulkCoverImage.name.split('.').pop() || 'jpg';
        const fname = `bulk_cover_${ts}.${ext}`;
        const { error: imgErr } = await supabase.storage.from('music_assets').upload(fname, bulkCoverImage);
        if (imgErr) throw imgErr;
        sharedCoverUrl = supabase.storage.from('music_assets').getPublicUrl(fname).data.publicUrl;
      }

      // Upload all individual covers up-front
      const individualCoverUrls: string[] = [];
      if (coverImageMode === 'individual') {
        for (let i = 0; i < bulkCount; i++) {
          setBulkStatusText(`Uploading cover ${i + 1} of ${bulkCount}...`);
          const file = bulkIndividualCovers[i];
          if (file) {
            const ts = Date.now();
            const ext = file.name.split('.').pop() || 'jpg';
            const fname = `bulk_cover_${ts}_${i}.${ext}`;
            const { error: imgErr } = await supabase.storage.from('music_assets').upload(fname, file);
            if (imgErr) throw imgErr;
            individualCoverUrls.push(supabase.storage.from('music_assets').getPublicUrl(fname).data.publicUrl);
          } else {
            individualCoverUrls.push('');
          }
        }
      }

      setBulkStatusText('Requesting GPT for variants...');
      const variantsData = await generateBulkVariants(bulkBaseTitle, bulkBaseLyrics, bulkCount);
      const variants = variantsData?.variants || [];
      if (variants.length === 0) throw new Error("No variants generated");

      setBulkStatusText('Extracting AI Metadata...');
      let aiMetadataResult = {
        ref_artists: bulkRefArtist ? [bulkRefArtist] : [],
        ref_tracks: bulkRefTitle ? [bulkRefTitle] : [],
        similar_artists: [] as string[],
        voice_style: bulkTargetVoice ? [bulkTargetVoice] : [] as string[],
        vibe_tags: [] as string[],
        analyzed_genres: [] as string[],
        analyzed_moods: [] as string[]
      };

      try {
        const analysis = await analyzeTrackMetadata(bulkRefArtist, bulkRefTitle, selectedSong?.genre ? [selectedSong.genre] : [], []);
        if (analysis) {
          aiMetadataResult = { ...aiMetadataResult, ...analysis };
          // Keep target voice if provided, append AI suggestions
          if (bulkTargetVoice) {
            aiMetadataResult.voice_style = [...new Set([bulkTargetVoice, ...(analysis.voice_style || [])])];
          }
        }
      } catch (err) {
        console.warn("AI Metadata extraction failed, using defaults", err);
      }

      for (let i = 0; i < variants.length; i++) {
        setBulkStatusText(`Queueing job ${i + 1} of ${variants.length}...`);
        const item = variants[i];
        
        let voiceDesc = "";
        if (vocalMode === 'artist') {
          voiceDesc = `Target Voice Artist: ${bulkTargetVoice}`;
        } else {
          voiceDesc = `Target Vox Strategy: ${vocalTags.gender || ''} ${vocalTags.race || ''} ${vocalTags.texture || ''} ${vocalTags.emotion || ''} ${vocalTags.ageFeel || ''} ${vocalTags.accent || ''}`.trim();
        }
        
        const promptParams = await generateSunoPrompt(
          bulkRefTitle,
          bulkRefArtist,
          bulkTargetVoice,
          item.title,
          vocalMode === 'tags' ? vocalTags : {},
          item.lyrics,
          `${etcInfo} (Bulk Batch Create. ${voiceDesc})`,
          selectedSong ? {
            genre: selectedSong.genre, releaseYear: selectedSong.releaseYear,
            country: selectedSong.country, isExplicit: selectedSong.isExplicit, durationMs: selectedSong.durationMs,
          } : undefined
        );

        if (!promptParams) throw new Error(`Failed to map prompt parameters for variant ${i+1}.`);

        const coverUrl = coverImageMode === 'individual'
          ? (individualCoverUrls[i] || '')
          : sharedCoverUrl;

        const jobEtcInfo = JSON.stringify({
          bulk_batch: true,
          cover_image_url: coverUrl,
          cover_mode: coverImageMode,
          ref_artist: bulkRefArtist,
          ref_track: bulkRefTitle,
          ai_metadata_result: aiMetadataResult
        });

        const activeWallet = account?.address || '0xadmin_fallback';

        const { error: jobErr } = await supabase.from('suno_jobs').insert({
          user_wallet: activeWallet,
          ref_track: `${bulkRefTitle} - ${bulkRefArtist}`,
          ref_artist: vocalMode === 'artist' && bulkTargetVoice ? bulkTargetVoice : voiceDesc || "AI Custom Vocal",
          target_title: promptParams.title,
          lyrics: promptParams.lyrics,
          creation_type: 'simple',
          etc_info: jobEtcInfo,
          gpt_prompt: promptParams.prompt,
          genres: promptParams.genres,
          moods: promptParams.moods,
          tags: promptParams.tags,
          status: 'pending'
        });
        if (jobErr) throw jobErr;
      }
      toast.success("All jobs queued successfully!");
      setIsBulkModalOpen(false);
      fetchBulkJobs();
    } catch(e:any) {
      toast.error("Bulk process failed: " + e.message);
    } finally {
      setIsBulkProcessing(false);
      setBulkStatusText('');
    }
  };

  const handleBulkPublish = async () => {
    if (!account?.address) return toast.error("Connect wallet to publish");
    setIsBulkPublishing(true);
    setBulkPublishStatusText('Fetching ready bulk jobs...');
    
    try {
      const { data: jobs, error } = await supabase.from('suno_jobs')
        .select('*')
        .eq('status', 'done')
        .is('published_track_id', null)
        .eq('discarded', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const bulkJobs = (jobs || []).filter(j => {
        try {
           const parsed = JSON.parse(j.etc_info || '{}');
           return parsed.bulk_batch === true;
        } catch(e) { return false; }
      });

      if (bulkJobs.length === 0) {
        toast.error("No completed bulk jobs found to publish.");
        setIsBulkPublishing(false);
        setBulkPublishStatusText('');
        return;
      }

      let publishedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < bulkJobs.length; i++) {
        const job = bulkJobs[i];
        setBulkPublishStatusText(`Publishing ${i+1}/${bulkJobs.length}: ${job.target_title}`);

        const tracks = job.result_data?.tracks || [];
        if (tracks.length === 0) {
          // Suno 결과가 아직 없는 job — 건너뜀 (큐에 계속 표시)
          console.log("No track outputs for job", job.id, "— skipped");
          skippedCount++;
          continue;
        }

        const selectedTrack = tracks[0]; // 무조건 1번 선택
        const parsedEtcInfo = JSON.parse(job.etc_info || '{}');
        const coverUrl = parsedEtcInfo.cover_image_url || '/images/default_cover.jpg';
        const refArtist = parsedEtcInfo.ref_artist || job.ref_artist;
        const refTrack = parsedEtcInfo.ref_track || job.ref_track;

        let audioUrl = selectedTrack.audio_cdn_url;
        setBulkPublishStatusText(`Downloading audio & re-uploading ${i+1}/${bulkJobs.length}...`);

        try {
          const res = await fetch(selectedTrack.audio_cdn_url);
          const blob = await res.blob();
          const fname = `${Date.now()}_bulk_${job.id}.mp3`;
          await supabase.storage.from('music_assets').upload(fname, blob);
          audioUrl = supabase.storage.from('music_assets').getPublicUrl(fname).data.publicUrl;
        } catch(e) {
          console.warn("Re-upload audio failed, keeping original cdn URL", e);
        }

        const { data: profile } = await supabase.from('profiles').select('id, username').eq('wallet_address', account.address).single();
        const artistName = profile?.username || 'Unlisted AI';
        const artistId = profile?.id;

        const { data: newTrack, error: trackErr } = await supabase.from('tracks').insert({
          title: job.target_title,
          lyrics: job.lyrics || selectedTrack.lyrics_from_api,
          audio_url: audioUrl,
          cover_image_url: coverUrl,
          genre: job.genres || [],
          moods: job.moods || [],
          context_tags: job.tags || [],
          uploader_address: account.address,
          artist_name: artistName,
          artist_id: artistId,
          creation_type: 'ai',
          ai_metadata: parsedEtcInfo.ai_metadata_result || {
            ref_artists: [refArtist],
            ref_tracks: [refTrack],
            voice_style: [job.ref_artist]
          }
        }).select().single();

        if (trackErr) throw trackErr;

        // ✅ 퍼블리시 후 반드시 status 업데이트 — 실패 시 에러 로그
        const { error: updateErr } = await supabase.from('suno_jobs').update({
          status: 'published',
          published_track_id: newTrack.id,
          uploaded_track_id: newTrack.id
        }).eq('id', job.id);

        if (updateErr) {
          console.error(`suno_jobs status update failed for job ${job.id}:`, updateErr.message);
          // 실패해도 트랙은 생성됐으므로 계속 진행
        }

        publishedCount++;
      }

      const msg = skippedCount > 0
        ? `${publishedCount}개 퍼블리시 완료 (${skippedCount}개는 Suno 처리 미완료로 건너뜀)`
        : `${publishedCount}개 트랙이 성공적으로 퍼블리시되었습니다!`;
      toast.success(msg);
      fetchTracks();
      fetchBulkJobs();
    } catch(e:any) {
      toast.error("Publishing error: " + e.message);
    } finally {
      setIsBulkPublishing(false);
      setBulkPublishStatusText('');
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = (track: Track) => {
    if (!track.audio_url) return;

    if (playingTrackId === track.id) {
      // Toggle current
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(track.audio_url);
      audio.onended = () => {
        setIsPlaying(false);
        setPlayingTrackId(null);
      };
      audioRef.current = audio;
      audio.play().catch(e => toast.error("Playback failed: " + e.message));
      setPlayingTrackId(track.id);
      setIsPlaying(true);
    }
  };

  // 1. Data Fetching
  const fetchTracks = async () => {
    setLoading(true);
    try {
      const [sortCol, sortDir] = sortOrder === 'created_at_desc' ? ['created_at', false]
        : sortOrder === 'created_at_asc' ? ['created_at', true]
        : sortOrder === 'title_asc' ? ['title', true]
        : ['title', false];

      let query = supabase
        .from('tracks')
        .select('*,artist:profiles (username,wallet_address,avatar_url)', { count: 'exact' })
        .order(sortCol as string, { ascending: sortDir as boolean });

      if (search) query = query.or(`title.ilike.%${search}%,artist_name.ilike.%${search}%`);

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) throw error;

      const normalized = (data || []).map((t: any) => ({
        ...t,
        genre: Array.isArray(t.genre) ? t.genre : (typeof t.genre === 'string' && t.genre.trim() ? [t.genre.trim()] : []),
        moods: Array.isArray(t.moods) ? t.moods : [],
        context_tags: Array.isArray(t.context_tags) ? t.context_tags : [],
      }));

      setTracks(normalized as Track[]);
      // setSelectedIds(new Set()); // Removed to persist selection on fetch
      if (count !== null) setTotalPages(Math.ceil(count / itemsPerPage));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTracks(); }, [page, itemsPerPage, sortOrder]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setPage(1); fetchTracks(); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 트랙을 모두 삭제하시겠습니까?\n\n연계된 revenue_logs, suno_jobs, storage 파일도 모두 삭제됩니다.`)) return;
    setIsBulkDeleting(true);
    let succeeded = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const { data: track } = await supabase.from('tracks').select('audio_url, cover_image_url, high_res_cover_url').eq('id', id).single();
        await supabase.from('revenue_logs').delete().eq('track_id', id);
        await supabase.from('suno_jobs').delete().or(`published_track_id.eq.${id},uploaded_track_id.eq.${id}`);
        const extractPath = (url: string | null | undefined) => {
          if (!url) return null;
          const m = url.match(/\/music_assets\/(.+?)(\?.*)?$/);
          return m ? m[1] : null;
        };
        const files = [extractPath(track?.audio_url), extractPath(track?.cover_image_url), extractPath(track?.high_res_cover_url)].filter(Boolean) as string[];
        if (files.length > 0) await supabase.storage.from('music_assets').remove(files);
        await supabase.from('tracks').delete().eq('id', id);
        succeeded++;
      } catch (e: any) {
        console.error(`Failed to delete track ${id}:`, e.message);
      }
    }
    toast.success(`${succeeded}개 트랙 삭제 완료`);
    setSelectedIds(new Set());
    setIsBulkDeleting(false);
    fetchTracks();
  };

  // 2. Actions
  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?\n\n연계된 revenue_logs, suno_jobs, storage 파일도 모두 삭제됩니다.")) return;

    try {
      // 1) Fetch track data first so we can delete storage files
      const { data: track } = await supabase
        .from('tracks')
        .select('audio_url, cover_image_url, high_res_cover_url')
        .eq('id', id)
        .single();

      // 2) Delete revenue_logs (FK constraint on tracks.id)
      await supabase.from('revenue_logs').delete().eq('track_id', id);

      // 3) Delete suno_jobs referencing this track
      await supabase.from('suno_jobs')
        .delete()
        .or(`published_track_id.eq.${id},uploaded_track_id.eq.${id}`);

      // 4) Delete storage files
      const extractStoragePath = (url: string | null | undefined): string | null => {
        if (!url) return null;
        // Extract path after /music_assets/ from public URL
        const match = url.match(/\/music_assets\/(.+?)(\?.*)?$/);
        return match ? match[1] : null;
      };

      const filesToDelete = [
        extractStoragePath(track?.audio_url),
        extractStoragePath(track?.cover_image_url),
        extractStoragePath(track?.high_res_cover_url),
      ].filter(Boolean) as string[];

      if (filesToDelete.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('music_assets')
          .remove(filesToDelete);
        if (storageErr) console.warn('Storage delete warning:', storageErr.message);
      }

      // 5) Finally delete the track row
      const { error: trackErr } = await supabase.from('tracks').delete().eq('id', id);
      if (trackErr) throw trackErr;

      toast.success("트랙 및 연계 데이터가 모두 삭제되었습니다.");
      fetchTracks();
    } catch (e: any) {
      toast.error("삭제 실패: " + e.message);
    }
  };

  const openEditModal = (track: Track) => {
    const trackCopy: any = JSON.parse(JSON.stringify(track));

    // ✅ genre normalize (string -> [string], null -> [])
    trackCopy.genre = Array.isArray(trackCopy.genre)
      ? trackCopy.genre
      : (typeof trackCopy.genre === 'string' && trackCopy.genre.trim() ? [trackCopy.genre.trim()] : []);

    // ✅ moods/tags도 혹시 null이면 방어
    trackCopy.moods = Array.isArray(trackCopy.moods) ? trackCopy.moods : [];
    trackCopy.context_tags = Array.isArray(trackCopy.context_tags) ? trackCopy.context_tags : [];

    // ✅ ai_metadata default 보강
    if (!trackCopy.ai_metadata) {
      trackCopy.ai_metadata = {
        ref_artists: [],
        ref_tracks: [],
        vibe_tags: [],
        voice_style: [],
        analyzed_genres: [],
        analyzed_moods: [],
      };
    } else {
      trackCopy.ai_metadata = {
        ref_artists: trackCopy.ai_metadata.ref_artists || [],
        ref_tracks: trackCopy.ai_metadata.ref_tracks || [],
        vibe_tags: trackCopy.ai_metadata.vibe_tags || [],
        voice_style: trackCopy.ai_metadata.voice_style || [],
        analyzed_genres: trackCopy.ai_metadata.analyzed_genres || [],
        analyzed_moods: trackCopy.ai_metadata.analyzed_moods || [],
      };
    }

    setEditingTrack(trackCopy as Track);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingTrack) return;
    const toastId = toast.loading("저장 중...");
    try {
      const { error } = await supabase
        .from('tracks')
        .update({
          title: editingTrack.title,
          genre: editingTrack.genre, // ✅ string[] 저장
          moods: editingTrack.moods,
          context_tags: editingTrack.context_tags,
          ai_metadata: editingTrack.ai_metadata
        })
        .eq('id', editingTrack.id);

      if (error) throw error;
      toast.success("수정 완료!", { id: toastId });
      setIsModalOpen(false);
      setEditingTrack(null);
      fetchTracks();
    } catch (e: any) {
      toast.error("실패: " + e.message, { id: toastId });
    }
  };

  // SNS Generation Logic
  const handleGenerateSnsVideo = async (track: Track) => {
    const targetImageUrl = track.high_res_cover_url || track.cover_image_url;
    if (!track.audio_url || (!targetImageUrl && !customSnsImage)) {
      toast.error('Missing audio or image.');
      return;
    }
    
    let ffmpeg: FFmpeg | null = null;
    const onProgress = ({ progress }: any) => {
      setVideoProgress(Math.min(100, Math.round(progress * 100)));
    };

    try {
      setVideoGenerating(true);
      setVideoProgress(0);
      ffmpeg = await getFFmpeg();
      ffmpeg.on('progress', onProgress);

      const imageExt = customSnsImage ? (customSnsImage.name.split('.').pop() || 'png') : (targetImageUrl.split('.').pop()?.split('?')[0] || 'png');
      const audioExt = track.audio_url.split('.').pop()?.split('?')[0] || 'mp3';

      const inImage = `image.${imageExt}`;
      const inAudio = `audio.${audioExt}`;
      const outVideo = `out.mp4`;

      if (customSnsImage) {
        await ffmpeg.writeFile(inImage, await fetchFile(customSnsImage));
      } else {
        await ffmpeg.writeFile(inImage, await fetchFile(targetImageUrl));
      }
      await ffmpeg.writeFile(inAudio, await fetchFile(track.audio_url));

      await ffmpeg.exec([
        '-loop', '1',
        '-framerate', '1',
        '-i', inImage,
        '-i', inAudio,
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // 추가: 인코딩 속도 극대화
        '-tune', 'stillimage',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-r', '15', // 기존 30fps에서 15fps로 낮춰 렌더링 프레임 절반 감소
        '-shortest',
        outVideo
      ]);

      const data = await ffmpeg.readFile(outVideo);
      const blob = new Blob([data as any], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title}_SNS.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      // cleanup
      await ffmpeg.deleteFile(inImage).catch(() => {});
      await ffmpeg.deleteFile(inAudio).catch(() => {});
      await ffmpeg.deleteFile(outVideo).catch(() => {});

      toast.success("Video successfully generated!");
    } catch (e: any) {
      toast.error("Video Generation Failed: " + e.message);
    } finally {
      if (ffmpeg) ffmpeg.off('progress', onProgress);
      setVideoGenerating(false);
      setVideoProgress(0);
    }
  };

  const formatSnsText = (track: Track) => {
    const dateObj = new Date(track.created_at);
    // Convert UTC to KST
    const kstObj = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);

    const yyyy = kstObj.getUTCFullYear();
    const mm = String(kstObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kstObj.getUTCDate()).padStart(2, '0');
    let h = kstObj.getUTCHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    const dateStr = `${yyyy}-${mm}-${dd} ${h} ${ampm} KST`;
    const songTitle = track.title || 'Untitled';
    const artistName = track.artist_name || 'Anonymous';
    const uploaderAddress = track.uploader_address || '';

    // 가사 첫 줄 추출 (비어있거나 공백만인 줄은 건너뜀)
    const firstLyricLine = track.lyrics
      ? track.lyrics.split('\n').map(l => l.trim()).find(l => l.length > 0 && !l.startsWith('['))
      : null;

    // ── 해시태그 풍부화 ──
    const toTag = (v: string) => `#${v.replace(/[^\w가-힣]/g, '').replace(/\s+/g, '')}`;

    const titleTag = toTag(songTitle.replace(/\s+/g, ''));
    const artistTag = toTag(artistName.replace(/\s+/g, ''));

    const refArtistTags = (track.ai_metadata?.ref_artists || []).map(toTag);
    const similarArtistTags = (track.ai_metadata?.similar_artists || []).map(toTag);
    const refTrackTags = (track.ai_metadata?.ref_tracks || []).map(toTag);
    const vibeTags = (track.ai_metadata?.vibe_tags || []).map(toTag);
    const genreTags = (track.genre || []).map(toTag);
    const moodTags = (track.moods || []).slice(0, 4).map(toTag);

    const baseTags = ['#UnlistedMusic', '#AIMusic', '#NewMusic', '#IndieMusic', '#StreamNow'];

    // 중복 제거 후 합치기
    const allTags = [
      titleTag,
      artistTag,
      ...refArtistTags,
      ...similarArtistTags,
      ...refTrackTags,
      ...vibeTags,
      ...genreTags,
      ...moodTags,
      ...baseTags,
    ].filter((t, i, arr) => t !== '#' && arr.indexOf(t) === i);

    const hashtagLine = allTags.join(' ');

    const lyricQuote = firstLyricLine ? `\n"${firstLyricLine}"\n` : '';

    return `🎵 Listen to '${songTitle}'
Visit ${artistName} on Unlisted 👀${lyricQuote}
https://unlisted.music/u?wallet=${uploaderAddress}

RELEASE
DATE: ${dateStr}

℗ ${yyyy} ${artistName} © ${yyyy} Unlisted Music
(unlisted.music) All rights reserved. unlisted.music & ${artistName}. The music never existed. ⚡

${hashtagLine}`.trim();
  };

  // ------------------------------------------------------------------
  // ✅ ArrayInput Component with Dropdown
  // ------------------------------------------------------------------
  const ArrayInput = ({
    label,
    values,
    onChange,
    options = []
  }: {
    label: string,
    values: string[] | undefined,
    onChange: (newValues: string[]) => void,
    options?: string[]
  }) => {
    const [input, setInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const safeValues = values || [];
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt =>
      opt.toLowerCase().includes(input.toLowerCase()) &&
      !safeValues.includes(opt)
    );

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const add = (val: string) => {
      const v = val.trim();
      if (!v) return;
      if (safeValues.includes(v)) {
        toast.error("이미 존재하는 항목입니다.");
        return;
      }
      onChange([...safeValues, v]);
      setInput('');
      setShowDropdown(false);
    };

    const remove = (idx: number) => {
      const newArr = [...safeValues];
      newArr.splice(idx, 1);
      onChange(newArr);
    };

    return (
      <div className="mb-4 relative" ref={wrapperRef}>
        <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">{label}</label>

        <div className="flex flex-wrap gap-2 mb-2 min-h-[32px] bg-black/20 p-2 rounded-lg border border-zinc-800">
          {safeValues.length === 0 && <span className="text-xs text-zinc-600 self-center">No items</span>}
          {safeValues.map((v, i) => (
            <span key={`${v}-${i}`} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs flex items-center gap-1 border border-zinc-700 animate-in zoom-in duration-200">
              {v}
              <X size={12} className="cursor-pointer hover:text-white" onClick={() => remove(i)} />
            </span>
          ))}
        </div>

        <div className="relative">
          <div className="flex gap-2">
            <input
              value={input}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
              onKeyDown={(e) => e.key === 'Enter' && add(input)}
              placeholder={options.length > 0 ? "Select or type..." : "Add item..."}
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none"
            />
            <button onClick={() => add(input)} className="bg-zinc-800 px-3 rounded-lg hover:bg-zinc-700 transition">
              <Plus size={16} />
            </button>
          </div>

          {showDropdown && filteredOptions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
              {filteredOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => add(opt)}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition flex items-center justify-between group"
                >
                  {opt}
                  <Plus size={12} className="opacity-0 group-hover:opacity-100 text-blue-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3. Render
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Track Management</h1>
          <p className="text-zinc-500">Edit metadata, genres, and AI analysis data.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Search title or artist..."
              className="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 w-64 text-sm focus:border-blue-500 outline-none"
            />
            <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
          </div>
          <button onClick={fetchTracks} className="bg-zinc-800 px-4 py-2 rounded-lg hover:bg-zinc-700 text-sm font-bold">Search</button>

          {/* Sort */}
          <select
            value={sortOrder}
            onChange={e => { setSortOrder(e.target.value as any); setPage(1); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500"
          >
            <option value="created_at_desc">최신순</option>
            <option value="created_at_asc">오래된순</option>
            <option value="title_asc">제목 A→Z</option>
            <option value="title_desc">제목 Z→A</option>
          </select>

          {/* Items per page */}
          <select
            value={itemsPerPage}
            onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}개씩</option>)}
          </select>
          
          {/* Bulk Action Buttons */}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-red-600/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-600/40 text-sm font-bold flex items-center gap-2 transition"
              >
                {isBulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {isBulkDeleting ? '삭제 중...' : `${selectedIds.size}개 삭제`}
              </button>

              <button
                onClick={handleOpenPlaylistModal}
                className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-600/40 text-sm font-bold flex items-center gap-2 transition ml-4"
              >
                <Youtube size={16} /> Playlist
              </button>
            </>
          )}
          <button onClick={() => setIsBulkModalOpen(true)} className="bg-purple-600/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg hover:bg-purple-600/40 text-sm font-bold flex items-center gap-2 transition ml-4">
            <Bot size={16} /> Bulk Queue
          </button>
          <button onClick={handleBulkPublish} disabled={isBulkPublishing} className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg hover:bg-emerald-600/40 text-sm font-bold flex items-center gap-2 transition min-w-[140px] justify-center">
            {isBulkPublishing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {isBulkPublishing ? 'Publishing...' : 'Bulk Publish'}
          </button>
          <div className="ml-4 pl-4 border-l border-zinc-800 flex items-center">
            <HeaderProfile />
          </div>
        </div>
      </div>
      
      {bulkPublishStatusText && (
        <div className="mb-4 bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 p-3 rounded-lg text-sm flex items-center gap-2 animate-pulse font-mono tracking-wide">
          <Loader2 size={15} className="animate-spin" /> {bulkPublishStatusText}
        </div>
      )}

      {/* Bulk Jobs Queue Info Area */}
      {bulkJobsList.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-sm text-purple-400">
              <Bot size={16} /> Bulk Queue Jobs ({bulkJobsList.filter(j=>j.status==='done').length} / {bulkJobsList.length} ready)
            </h3>
            <div className="flex items-center gap-4">
              <button onClick={handleDiscardAllBulkJobs} disabled={isJobsLoading || bulkJobsList.length === 0} className="text-xs flex items-center gap-1.5 text-zinc-500 hover:text-red-400 transition font-bold uppercase tracking-wider">
                <Trash2 size={13} /> Clear All
              </button>
              <button onClick={fetchBulkJobs} disabled={isJobsLoading} className="text-zinc-500 hover:text-white transition">
                <RefreshCw size={14} className={isJobsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {bulkJobsList.map(job => (
              <div key={job.id} className="bg-black border border-zinc-800 rounded-lg p-3 relative overflow-hidden flex flex-col justify-between group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800 overflow-hidden">
                    {job.status === 'pending' && <div className="h-full bg-purple-500 w-1/3 animate-pulse"></div>}
                    {job.status === 'processing' && <div className="h-full bg-blue-500 w-2/3 animate-pulse"></div>}
                    {job.status === 'done' && <div className="h-full bg-emerald-500 w-full"></div>}
                 </div>
                 <div>
                   <p className="text-xs font-bold text-white truncate mb-1 mt-1">{job.target_title}</p>
                   <p className="text-[10px] text-zinc-500 truncate">{job.ref_track}</p>
                 </div>
                 
                 <div className="mt-3 flex items-center justify-between">
                   <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase flex items-center gap-1">
                     {job.status} {job.status === 'done' && <CheckCircle size={10} className="text-emerald-500" />}
                   </div>
                   <button 
                     onClick={() => handleDiscardBulkJob(job.id)}
                     className="text-zinc-500 hover:text-red-500 transition p-1"
                     title="Discard from queue"
                   >
                     <Trash2 size={12} />
                   </button>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-zinc-950 text-zinc-500 uppercase font-bold border-b border-zinc-800">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                    checked={tracks.length > 0 && tracks.every(t => selectedIds.has(t.id))}
                    onChange={e => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) {
                        tracks.forEach(t => next.add(t.id));
                      } else {
                        tracks.forEach(t => next.delete(t.id));
                      }
                      setSelectedIds(next);
                    }}
                  />
                </th>
                <th className="p-4 w-16">Cover</th>
                <th className="p-4">Track Info</th>
                <th className="p-4">Genres / Moods</th>
                <th className="p-4 hidden md:table-cell">AI Tags (Summary)</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
              ) : tracks.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No tracks found.</td></tr>
              ) : tracks.map(track => {
                const genres = Array.isArray(track.genre) ? track.genre : [];
                const topGenres = genres.slice(0, 2);
                const extraGenreCount = Math.max(0, genres.length - topGenres.length);

                return (
                  <tr key={track.id} className={`hover:bg-zinc-800/50 transition group ${selectedIds.has(track.id) ? 'bg-blue-900/10' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="accent-blue-500 w-4 h-4 cursor-pointer"
                        checked={selectedIds.has(track.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(track.id);
                          else next.delete(track.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="p-4">
                      <div 
                        className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 relative group cursor-pointer"
                        onClick={() => togglePlay(track)}
                      >
                        {track.cover_image_url && <img src={track.cover_image_url} className="w-full h-full object-cover" />}
                        
                        {/* Overlay */}
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                          playingTrackId === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                           {playingTrackId === track.id && isPlaying ? (
                             <Pause size={20} className="text-white fill-white" />
                           ) : (
                             <Play size={20} className="text-white fill-white ml-0.5" />
                           )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-white text-base">{track.title}</div>
                      <div className="text-zinc-500">{track.artist?.username}</div>
                    </td>

                    <td className="p-4">
                      {/* ✅ genres chips */}
                      <div className="flex flex-wrap gap-2 mb-1">
                        {topGenres.length === 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-bold">No genre</span>
                        ) : (
                          <>
                            {topGenres.map(g => (
                              <span key={g} className="inline-block px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">
                                {g}
                              </span>
                            ))}
                            {extraGenreCount > 0 && (
                              <span className="text-[10px] text-zinc-600 self-center">+{extraGenreCount}</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* moods */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {track.moods?.slice(0, 3).map(m => (
                          <span key={m} className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{m}</span>
                        ))}
                        {(track.moods?.length || 0) > 3 && (
                          <span className="text-[10px] text-zinc-600">+{track.moods.length - 3}</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 hidden md:table-cell">
                      <div className="text-xs text-zinc-400 space-y-1">
                        {track.ai_metadata?.ref_artists?.length ? (
                          <div className="flex items-center gap-1">
                            <Bot size={12} className="text-purple-400" /> {track.ai_metadata.ref_artists[0]}
                          </div>
                        ) : <span className="text-zinc-700">-</span>}
                        {track.ai_metadata?.vibe_tags?.length ? (
                          <div className="flex items-center gap-1">
                            <Hash size={12} className="text-blue-400" /> {track.ai_metadata.vibe_tags.slice(0, 2).join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {track.audio_url && (
                            <a 
                              href={track.audio_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              download 
                              className="p-2 bg-blue-900/20 rounded-lg hover:bg-blue-900/40 text-blue-500 transition"
                              title="Download MP3"
                            >
                              <Download size={16} />
                            </a>
                          )}
                          <button onClick={() => { setSnsModalTrack(track); setCustomSnsImage(null); }} className="p-2 bg-pink-900/20 rounded-lg hover:bg-pink-900/40 text-pink-500 transition" title="SNS 업로드용 생성"><Share2 size={16} /></button>
                          <button onClick={() => openEditModal(track)} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-white transition"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(track.id)} className="p-2 bg-red-900/20 rounded-lg hover:bg-red-900/40 text-red-500 transition"><Trash2 size={16} /></button>
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-between items-center gap-4">
          <span className="text-xs text-zinc-500">
            {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : `총 ${totalPages * itemsPerPage > 0 ? totalPages : 0} 페이지`}
          </span>
          <div className="flex items-center gap-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-zinc-700">Prev</button>
            <span className="text-sm self-center text-zinc-500">Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-zinc-700">Next</button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingTrack && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><Music className="text-blue-500" /> Edit Track Metadata</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Basic Info */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2"><Disc size={16} /> Basic Info</h3>

                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Title</label>
                  <input
                    value={editingTrack.title}
                    onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                  />
                </div>

                {/* ✅ Genres: text[] 편집 */}
                <ArrayInput
                  label="Genres"
                  values={editingTrack.genre}
                  onChange={(newVals) => setEditingTrack({ ...editingTrack, genre: newVals })}
                  options={MUSIC_GENRES}
                />

                <ArrayInput
                  label="Moods"
                  values={editingTrack.moods}
                  onChange={(newVals) => setEditingTrack({ ...editingTrack, moods: newVals })}
                  options={MUSIC_MOODS}
                />

                <ArrayInput
                  label="Context Tags"
                  values={editingTrack.context_tags}
                  onChange={(newVals) => setEditingTrack({ ...editingTrack, context_tags: newVals })}
                  options={MUSIC_TAGS}
                />
              </div>

              {/* Right: AI Metadata */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-purple-400 border-b border-zinc-800 pb-2 flex items-center gap-2"><Bot size={16} /> AI Metadata</h3>
                <div className="bg-purple-900/10 p-4 rounded-xl border border-purple-500/20 space-y-4">
                  <ArrayInput
                    label="Reference Artists"
                    values={editingTrack.ai_metadata?.ref_artists}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, ref_artists: newVals } })}
                  />
                  <ArrayInput
                    label="Reference Tracks"
                    values={editingTrack.ai_metadata?.ref_tracks}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, ref_tracks: newVals } })}
                  />

                  <ArrayInput
                    label="AI Vibe Tags"
                    values={editingTrack.ai_metadata?.vibe_tags}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, vibe_tags: newVals } })}
                    options={MUSIC_TAGS}
                  />

                  <ArrayInput
                    label="Analyzed Genres"
                    values={editingTrack.ai_metadata?.analyzed_genres}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, analyzed_genres: newVals } })}
                    options={MUSIC_GENRES}
                  />

                  <ArrayInput
                    label="Analyzed Moods"
                    values={editingTrack.ai_metadata?.analyzed_moods}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, analyzed_moods: newVals } })}
                    options={MUSIC_MOODS}
                  />

                  <ArrayInput
                    label="Voice Style"
                    values={editingTrack.ai_metadata?.voice_style}
                    onChange={(newVals) => setEditingTrack({ ...editingTrack, ai_metadata: { ...editingTrack.ai_metadata!, voice_style: newVals } })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 bg-zinc-900 sticky bottom-0 flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition">Cancel</button>
              <button onClick={handleSave} className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-black rounded-xl font-black shadow-lg shadow-blue-900/20 flex items-center gap-2 transition"><Save size={18} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* SNS Upload Modal */}
      {snsModalTrack && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><Share2 className="text-pink-500" /> SNS 업로드용 생성</h2>
              <button disabled={videoGenerating} onClick={() => setSnsModalTrack(null)} className="p-2 hover:bg-zinc-800 rounded-full disabled:opacity-50 transition"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-500 font-bold uppercase block">Custom Background Image (Optional)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCustomSnsImage(e.target.files[0]);
                      }
                    }}
                    className="text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 hover:file:text-white cursor-pointer"
                  />
                  {customSnsImage && (
                    <button 
                      onClick={() => setCustomSnsImage(null)}
                      className="text-xs text-red-400 hover:text-red-300 font-bold transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">
                  If not provided, the default track cover image will be used.
                </p>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Caption Text</label>
                <div className="relative">
                  <textarea
                    readOnly
                    value={formatSnsText(snsModalTrack)}
                    className="w-full h-64 bg-black border border-zinc-800 rounded-xl p-4 text-sm font-medium text-zinc-300 resize-none outline-none focus:border-pink-500 transition-colors"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(formatSnsText(snsModalTrack));
                      toast.success("Copied to clipboard!");
                    }}
                    className="absolute bottom-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg"
                  >
                    Copy Text
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  disabled={videoGenerating || !snsModalTrack.audio_url || (!snsModalTrack.cover_image_url && !customSnsImage)}
                  onClick={() => handleGenerateSnsVideo(snsModalTrack)}
                  className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-xl font-black shadow-lg shadow-pink-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
                >
                  {videoGenerating ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Generating Video... {videoProgress}%
                    </>
                  ) : (
                    <>
                      <FileVideo size={18} /> 
                      Download MP4 Video
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><Bot className="text-purple-500" /> Bulk Generate Jobs</h2>
              <button disabled={isBulkProcessing} onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full disabled:opacity-50"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="space-y-4">
                <h3 className="text-sm border-b border-white/[0.05] pb-2 font-bold text-zinc-300">1. Reference Track</h3>
                
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Search Reference</label>
                  <div className="relative">
                    <div className={`flex items-center gap-3 border-b pb-1 transition-colors duration-200 ${selectedSong ? 'border-indigo-500/50' : 'border-zinc-800 focus-within:border-zinc-500'}`}>
                      {selectedSong?.artwork
                        ? <img src={selectedSong.artwork} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                        : <Music size={14} className="text-zinc-500 flex-shrink-0" />
                      }
                      <input value={songQuery} onChange={e => handleSongQueryChange(e.target.value)}
                        placeholder={"Search or type song name..."}
                        className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
                      {isSongSearching && <Loader2 size={13} className="animate-spin text-zinc-500" />}
                      {selectedSong && !isSongSearching && (
                        <button onClick={() => { setSelectedSong(null); setSongQuery(''); setBulkRefTitle(''); setBulkRefArtist(''); }}
                          className="text-zinc-500 hover:text-white transition"><X size={13} /></button>
                      )}
                    </div>
                    {/* Dropdown */}
                    {songResults.length > 0 && !selectedSong && (
                      <div className="absolute z-50 top-[calc(100%+8px)] left-0 right-0 bg-[#131313] border border-white/[0.07] rounded-xl overflow-hidden shadow-2xl">
                        {songResults.map(song => (
                          <button key={song.id} onClick={() => selectSong(song)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.03] last:border-0 group">
                            {song.artwork
                              ? <img src={song.artwork} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                              : <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0"><Music size={12} className="text-zinc-500" /></div>
                            }
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-white truncate">{song.title}</div>
                              <div className="text-[10px] text-zinc-500 truncate">{song.artist}{song.releaseYear && ` · ${song.releaseYear}`}</div>
                            </div>
                            {song.genre && <span className="text-[9px] text-zinc-600 uppercase">{song.genre}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 hidden">
                  <div>
                    <input value={bulkRefArtist} onChange={e => setBulkRefArtist(e.target.value)} placeholder="e.g. Ariana Grande" className="hidden" />
                  </div>
                  <div>
                    <input value={bulkRefTitle} onChange={e => setBulkRefTitle(e.target.value)} placeholder="e.g. positions" className="hidden" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                  <h3 className="text-sm font-bold text-zinc-300">2. Vocal Persona</h3>
                  <SegTab
                    options={[{ key: 'tags', label: 'Tags' }, { key: 'artist', label: 'Artist' }]}
                    value={vocalMode} onChange={v => setVocalMode(v as 'tags' | 'artist')}
                  />
                </div>

                {vocalMode === 'tags' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Gender *</label>
                      <div className="flex gap-2">
                        {(['Male', 'Female'] as const).map(g => (
                          <button key={g}
                            onClick={() => setVocalTags((prev: any) => ({ ...prev, gender: prev.gender === g ? undefined : g }))}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                              vocalTags.gender === g
                                ? g === 'Male' ? 'bg-blue-500/10 text-blue-300 border-blue-500/35' : 'bg-pink-500/10 text-pink-300 border-pink-500/35'
                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                            }`}>
                            {g === 'Male' ? '♂ Male' : '♀ Female'}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <button onClick={() => setShowDetailVox(!showDetailVox)}
                        className="w-full flex items-center justify-between group py-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                          <Settings2 size={11} /> Detail Vox Options
                        </span>
                        <ChevronDown size={13} className={`text-zinc-500 transition-transform ${showDetailVox ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showDetailVox && (
                        <div className="space-y-4 pt-4 border-l border-zinc-700 pl-2 mt-2 ml-1">
                          
                          {/* Race */}
                          <div>
                            <label className="text-[9px] font-bold text-zinc-600 uppercase block mb-1">Race</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['Asian', 'Black', 'White'] as const).map(r => (
                                <button key={r} onClick={() => setVocalTags((prev:any) => ({ ...prev, race: prev.race === r ? undefined : r }))}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${vocalTags.race === r ? 'bg-violet-500/20 text-violet-300 border-violet-500/50' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Texture */}
                          <div>
                            <label className="text-[9px] font-bold text-zinc-600 uppercase block mb-1">Texture</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['Clean', 'Raspy', 'Breathy', 'Belting', 'Whisper'] as const).map(tex => (
                                <button key={tex} onClick={() => setVocalTags((prev:any) => ({ ...prev, texture: prev.texture === tex ? undefined : tex }))}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${vocalTags.texture === tex ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                                  {tex}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Emotion */}
                          <div>
                            <label className="text-[9px] font-bold text-zinc-600 uppercase block mb-1">Emotion</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['Sexy', 'Cute', 'Sad', 'Energetic'] as const).map(val => (
                                <button key={val} onClick={() => setVocalTags((prev:any) => ({ ...prev, emotion: prev.emotion === val ? undefined : val }))}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${vocalTags.emotion === val ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Age Feel */}
                          <div>
                            <label className="text-[9px] font-bold text-zinc-600 uppercase block mb-1">Age Feel</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['Youthful', 'Mature', 'Aged'] as const).map(val => (
                                <button key={val} onClick={() => setVocalTags((prev:any) => ({ ...prev, ageFeel: prev.ageFeel === val ? undefined : val }))}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${vocalTags.ageFeel === val ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Accent */}
                          <div>
                            <label className="text-[9px] font-bold text-zinc-600 uppercase block mb-1">Accent</label>
                            <div className="flex gap-1.5 flex-wrap">
                              {(['American', 'British', 'Korean', 'Japanese', 'Spanish', 'African'] as const).map(val => (
                                <button key={val} onClick={() => setVocalTags((prev:any) => ({ ...prev, accent: prev.accent === val ? undefined : val }))}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border ${vocalTags.accent === val ? 'bg-orange-500/20 text-orange-300 border-orange-500/50' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                        </div>
                      )}
                    </div>

                    {/* Selected tag preview pills */}
                    {Object.values(vocalTags).some(Boolean) && (
                      <div className="flex flex-wrap gap-1.5 pt-2 animate-in fade-in duration-200">
                        {vocalTags.gender && (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white border border-white/[0.08]">
                            {vocalTags.gender === 'Male' ? '♂' : '♀'} {vocalTags.gender} Vox
                          </span>
                        )}
                        {vocalTags.race    && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-violet-300 border border-white/[0.06]">{vocalTags.race}</span>}
                        {vocalTags.texture && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-cyan-300 border border-white/[0.06]">{vocalTags.texture}</span>}
                        {vocalTags.emotion && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-amber-300 border border-white/[0.06]">{vocalTags.emotion}</span>}
                        {vocalTags.ageFeel && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-emerald-300 border border-white/[0.06]">{vocalTags.ageFeel}</span>}
                        {vocalTags.accent  && <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] font-bold text-orange-300 border border-white/[0.06]">{vocalTags.accent}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Target Voice (Artist)</label>
                    <div className="relative">
                      <div className={`flex items-center gap-3 border-b pb-1 transition-colors duration-200 ${selectedArtist ? 'border-pink-500/50' : 'border-zinc-800 focus-within:border-zinc-500'}`}>
                        <Mic2 size={14} className="text-zinc-500 flex-shrink-0" />
                        <input value={artistQuery} onChange={e => handleArtistQueryChange(e.target.value)}
                          placeholder={"Search artist..."}
                          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder-zinc-600 outline-none" />
                        {isArtistSearching && <Loader2 size={13} className="animate-spin text-zinc-500" />}
                        {selectedArtist && !isArtistSearching && (
                          <button onClick={() => { setSelectedArtist(null); setArtistQuery(''); setBulkTargetVoice(''); }}
                            className="text-zinc-500 hover:text-white transition"><X size={13} /></button>
                        )}
                      </div>

                      {artistResults.length > 0 && !selectedArtist && (
                        <div className="absolute z-50 top-[calc(100%+8px)] left-0 right-0 bg-[#131313] border border-white/[0.07] rounded-xl overflow-hidden shadow-2xl">
                          {artistResults.map(artist => (
                            <button key={artist.id} onClick={() => selectArtist(artist)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.03] last:border-0">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                                <User size={12} className="text-zinc-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-white truncate">{artist.name}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm border-b border-white/[0.05] pb-2 font-bold text-zinc-300">3. Generation Info</h3>

                {/* Count row */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Count (1-8)</label>
                  <input type="number" min={1} max={8} value={bulkCount} onChange={e => {
                    const n = Math.max(1, Math.min(8, Number(e.target.value)));
                    setBulkCount(n);
                    setBulkIndividualCovers(prev => Array.from({ length: n }, (_, i) => prev[i] ?? null));
                  }} className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-purple-500 outline-none" />
                </div>

                {/* Cover mode toggle */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Cover Image Mode</label>
                  <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5 border border-white/[0.05] w-fit">
                    {([{ key: 'single', label: '🖼 단일 커버' }, { key: 'individual', label: '🎨 개별 커버' }] as const).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setCoverImageMode(opt.key);
                          if (opt.key === 'individual') {
                            setBulkIndividualCovers(Array.from({ length: bulkCount }, (_, i) => bulkIndividualCovers[i] ?? null));
                          }
                        }}
                        className={`px-4 py-2 rounded-md text-xs font-bold tracking-wide transition-all duration-200 ${
                          coverImageMode === opt.key
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Single cover upload */}
                {coverImageMode === 'single' && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Album Art (공통 커버)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBulkCoverImage(e.target.files?.[0] || null)}
                      className="w-full text-xs text-zinc-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 cursor-pointer"
                    />
                    {bulkCoverImage && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={URL.createObjectURL(bulkCoverImage)}
                          className="w-14 h-14 rounded-lg object-cover border border-zinc-700"
                          alt="preview"
                        />
                        <div>
                          <p className="text-xs text-zinc-300 font-bold truncate max-w-[180px]">{bulkCoverImage.name}</p>
                          <button onClick={() => setBulkCoverImage(null)} className="text-[10px] text-red-400 hover:text-red-300 mt-1">Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Individual cover uploads */}
                {coverImageMode === 'individual' && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 block">
                      개별 커버 이미지 ({bulkCount}개)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Array.from({ length: bulkCount }).map((_, i) => {
                        const file = bulkIndividualCovers[i] ?? null;
                        const previewUrl = file ? URL.createObjectURL(file) : null;
                        return (
                          <label
                            key={i}
                            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 overflow-hidden aspect-square ${
                              file
                                ? 'border-purple-500/50 bg-purple-900/10'
                                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/50'
                            }`}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                setBulkIndividualCovers(prev => {
                                  const next = [...prev];
                                  next[i] = f;
                                  return next;
                                });
                              }}
                            />
                            {previewUrl ? (
                              <>
                                <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover" alt={`cover ${i+1}`} />
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <span className="text-[10px] text-white font-bold">변경</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    setBulkIndividualCovers(prev => { const next = [...prev]; next[i] = null; return next; });
                                  }}
                                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:text-red-400 z-10"
                                >
                                  <X size={10} />
                                </button>
                                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white bg-black/50 py-0.5">#{i+1}</span>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-1 p-2">
                                <span className="text-xl">🖼</span>
                                <span className="text-[9px] text-zinc-500 font-bold">#{i+1} 커버</span>
                                <span className="text-[8px] text-zinc-600">클릭하여 업로드</span>
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2">각 트랙에 서로 다른 커버 이미지가 적용됩니다.</p>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Baseline Title</label>
                  <input value={bulkBaseTitle} onChange={e => setBulkBaseTitle(e.target.value)} placeholder="e.g. Midnight Whispers" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-purple-500 outline-none" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Baseline Lyrics Concept</label>
                  <textarea value={bulkBaseLyrics} onChange={e => setBulkBaseLyrics(e.target.value)} placeholder="Concept for lyrics generation via GPT..." className="w-full h-24 bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-purple-500 outline-none resize-none" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Vibe & Info (etcInfo)</label>
                  <input value={etcInfo} onChange={e => setEtcInfo(e.target.value)} placeholder="e.g. Dreamy, Reverb heavy" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-purple-500 outline-none" />
                </div>
              </div>

              {bulkStatusText && (
                <div className="bg-purple-900/20 text-purple-300 border border-purple-500/20 rounded-lg p-4 font-mono text-xs flex items-center gap-2 animate-pulse">
                  <Loader2 size={14} className="animate-spin" /> {bulkStatusText}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-800 bg-zinc-900 sticky bottom-0 flex justify-end gap-4">
              <button disabled={isBulkProcessing} onClick={handleBulkGenerate} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center justify-center gap-2 transition">
                {isBulkProcessing ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                Generate & Queue {bulkCount} Variants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Modal */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2"><Youtube className="text-red-500" /> Create YouTube Playlist</h2>
              <button disabled={isSubmittingPlaylist} onClick={() => setIsPlaylistModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full disabled:opacity-50 transition"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Playlist ID (Optional)</label>
                <div className="space-y-3">
                  <input
                    value={playlistIdInput}
                    onChange={e => setPlaylistIdInput(e.target.value)}
                    placeholder="Enter or paste Playlist ID..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-red-500 outline-none transition"
                  />
                  {existingPlaylistIds.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                       <span className="text-[10px] text-zinc-500 self-center font-bold">Existing:</span>
                       {existingPlaylistIds.map(id => (
                         <button
                           key={id}
                           onClick={() => setPlaylistIdInput(id)}
                           className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${playlistIdInput === id ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                         >
                           {id}
                         </button>
                       ))}
                     </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Playlist Title</label>
                <input
                  value={playlistTitle}
                  onChange={e => setPlaylistTitle(e.target.value)}
                  placeholder="e.g. My Awesome Playlist"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm focus:border-red-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Track Order ({playlistTracks.length})</label>
                <div className="bg-black border border-zinc-800 rounded-lg p-2 max-h-60 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {playlistTracks.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-md border border-zinc-800/50 group hover:border-zinc-700 transition">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-[10px] text-zinc-600 font-mono w-4 text-center">{idx + 1}</span>
                        {t.cover_image_url && <img src={t.cover_image_url} alt="" className="w-8 h-8 rounded-sm object-cover" />}
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-zinc-200 truncate">{t.title || 'Untitled'}</span>
                          <span className="text-[10px] text-zinc-500 truncate">{t.artist_name || 'Anonymous'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                        <button onClick={() => movePlaylistTrack(idx, 'up')} disabled={idx === 0} className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 p-0.5">
                           <ArrowUp size={14} />
                        </button>
                        <button onClick={() => movePlaylistTrack(idx, 'down')} disabled={idx === playlistTracks.length - 1} className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 p-0.5">
                           <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Caption & Timestamps (Description)</label>
                <textarea
                  value={playlistDescription}
                  onChange={e => setPlaylistDescription(e.target.value)}
                  className="w-full h-64 bg-black border border-zinc-800 rounded-lg p-4 text-sm font-medium text-zinc-300 resize-none outline-none focus:border-red-500 transition-colors"
                />
                <p className="text-[10px] text-zinc-500 mt-2">
                  (Note: The '00:00' placeholders will act as starting markers. The background AI worker can adjust timestamps if needed, or just use these as is.)
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 bg-zinc-900 sticky bottom-0 flex justify-end gap-4">
              <button onClick={() => setIsPlaylistModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition">Cancel</button>
              <button
                disabled={isSubmittingPlaylist}
                onClick={handleSubmitPlaylist}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black shadow-lg shadow-red-900/20 flex items-center gap-2 transition disabled:opacity-50"
              >
                {isSubmittingPlaylist ? <Loader2 size={18} className="animate-spin" /> : <ListPlus size={18} />}
                Submit to Worker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
