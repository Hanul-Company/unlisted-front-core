'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Search, Loader2, Edit, Trash2, X, Plus, Save,
  Music, Disc, Bot, Hash, Download, Play, Pause
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MUSIC_GENRES, MUSIC_MOODS, MUSIC_TAGS } from '@/app/constants';

// ✅ 트랙 타입 정의 (genre: string[] 로 변경)
type Track = {
  id: number;
  title: string;
  audio_url: string | null; // ✅ added
  artist_name: string;
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
  } | null;
  cover_image_url: string;
  created_at: string;
  artist?: { 
    username: string | null;
    wallet_address: string | null;
    avatar_url: string | null;
  } | null;
};

export default function AdminTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Audio Playback State
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      let query = supabase.from('tracks').select('*,artist:profiles (username,wallet_address,avatar_url)', { count: 'exact' }).order('created_at', { ascending: false });
      if (search) query = query.or(`title.ilike.%${search}%,artist_name.ilike.%${search}%`);

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) throw error;

      // ✅ 혹시 마이그레이션 전 데이터/타입 섞임 대비: genre normalize
      const normalized = (data || []).map((t: any) => ({
        ...t,
        genre: Array.isArray(t.genre) ? t.genre : (typeof t.genre === 'string' && t.genre.trim() ? [t.genre.trim()] : []),
        moods: Array.isArray(t.moods) ? t.moods : [],
        context_tags: Array.isArray(t.context_tags) ? t.context_tags : [],
      }));

      setTracks(normalized as Track[]);
      if (count) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTracks(); }, [page]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setPage(1); fetchTracks(); }
  };

  // 2. Actions
  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from('tracks').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success("삭제됨"); fetchTracks(); }
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
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-950 text-zinc-500 uppercase font-bold border-b border-zinc-800">
            <tr>
              <th className="p-4 w-16">Cover</th>
              <th className="p-4">Track Info</th>
              <th className="p-4">Genres / Moods</th>
              <th className="p-4 hidden md:table-cell">AI Tags (Summary)</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
            ) : tracks.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No tracks found.</td></tr>
            ) : tracks.map(track => {
              const genres = Array.isArray(track.genre) ? track.genre : [];
              const topGenres = genres.slice(0, 2);
              const extraGenreCount = Math.max(0, genres.length - topGenres.length);

              return (
                <tr key={track.id} className="hover:bg-zinc-800/50 transition group">
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
                        <button onClick={() => openEditModal(track)} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-white transition"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(track.id)} className="p-2 bg-red-900/20 rounded-lg hover:bg-red-900/40 text-red-500 transition"><Trash2 size={16} /></button>
                      </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="p-4 border-t border-zinc-800 flex justify-center gap-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-zinc-700">Prev</button>
          <span className="text-sm self-center text-zinc-500">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-zinc-700">Next</button>
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
    </div>
  );
}
