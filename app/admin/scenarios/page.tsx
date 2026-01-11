'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Trash2, Plus, Save, Loader2, Tag, X, Edit2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

// ✅ constants에서 전체 태그 목록 가져오기
import { MUSIC_TAGS } from '@/app/constants'; 

// DB 타입 정의
type Scenario = {
  id: string;
  emoji: string;
  title: string;
  tags: string[];
  sort_order: number;
};

export default function AdminScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Form State ---
  const [editingId, setEditingId] = useState<string | null>(null); // 수정 모드 여부 (ID가 있으면 수정)
  const [newEmoji, setNewEmoji] = useState('🎵');
  const [newTitle, setNewTitle] = useState('');
  
  // Tag Autocomplete State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- 1. 목록 불러오기 ---
  const fetchScenarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('radio_scenarios')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) toast.error(error.message);
    else setScenarios(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  // --- 2. 저장 (생성 또는 수정) ---
  const handleSave = async () => {
    if (!newTitle.trim()) return toast.error("Title is required");
    if (selectedTags.length === 0) return toast.error("At least one tag is required");

    if (editingId) {
      // [수정 모드] Update
      const { error } = await supabase
        .from('radio_scenarios')
        .update({
          emoji: newEmoji,
          title: newTitle,
          tags: selectedTags,
        })
        .eq('id', editingId);

      if (error) {
        toast.error("Failed to update: " + error.message);
      } else {
        toast.success("Scenario updated!");
        resetForm();
        fetchScenarios();
      }

    } else {
      // [생성 모드] Insert
      const { error } = await supabase.from('radio_scenarios').insert({
        emoji: newEmoji,
        title: newTitle,
        tags: selectedTags,
        sort_order: scenarios.length + 1
      });

      if (error) {
        toast.error("Failed to create: " + error.message);
      } else {
        toast.success("Scenario created!");
        resetForm();
        fetchScenarios();
      }
    }
  };

  // --- 3. 삭제 ---
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scenario?")) return;
    const { error } = await supabase.from('radio_scenarios').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      fetchScenarios();
    }
  };

  // --- 4. 수정 버튼 클릭 시 폼 채우기 ---
  const handleEditClick = (scenario: Scenario) => {
    setEditingId(scenario.id);
    setNewEmoji(scenario.emoji);
    setNewTitle(scenario.title);
    setSelectedTags(scenario.tags || []);
    setTagSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 맨 위로 스크롤
  };

  // --- Helper: 폼 초기화 ---
  const resetForm = () => {
    setEditingId(null);
    setNewEmoji('🎵');
    setNewTitle('');
    setSelectedTags([]);
    setTagSearch('');
    setIsTagDropdownOpen(false);
  };

  // --- Helper: 태그 관리 ---
  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagSearch(''); // 검색어 초기화
    // setIsTagDropdownOpen(false); // 계속 추가할 수 있게 닫지는 않음
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  // 검색어에 맞는 추천 태그 필터링
  const filteredTags = MUSIC_TAGS.filter(tag => 
    tag.toLowerCase().includes(tagSearch.toLowerCase()) && 
    !selectedTags.includes(tag) // 이미 선택된 건 제외
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 pl-24 pt-24" onClick={() => { if(isTagDropdownOpen) setIsTagDropdownOpen(false); }}>
      <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
        🎭 Radio Scenarios Manager
      </h1>

      {/* --- Editor Form --- */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 max-w-3xl shadow-xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
                {editingId ? <Edit2 size={18} className="text-yellow-500"/> : <Plus size={18} className="text-green-500"/>}
                {editingId ? "Edit Scenario" : "Create New Scenario"}
            </h2>
            {editingId && (
                <button onClick={resetForm} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-800 px-3 py-1 rounded-full">
                    <RotateCcw size={12}/> Cancel Edit
                </button>
            )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
            
            {/* 1. Emoji Picker */}
            <div className="md:col-span-2 relative">
                <label className="text-xs text-zinc-500 font-bold block mb-1">Emoji</label>
                <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-center text-3xl hover:border-zinc-500 transition"
                >
                    {newEmoji}
                </button>
                {/* 이모지 팝업 */}
                {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl">
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)}/> {/* 백그라운드 클릭 시 닫기 */}
                        <div className="relative z-50">
                            <EmojiPicker 
                                onEmojiClick={(emojiData) => {
                                    setNewEmoji(emojiData.emoji);
                                    setShowEmojiPicker(false);
                                }}
                                //@ts-ignore 
                                theme="dark" as any // Type issue prevention
                                width={300}
                                height={400}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Title Input */}
            <div className="md:col-span-10">
                <label className="text-xs text-zinc-500 font-bold block mb-1">Title</label>
                <input 
                    type="text" 
                    value={newTitle} 
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3.5 focus:border-green-500 outline-none font-bold"
                    placeholder="e.g. Midnight Coding"
                />
            </div>
        </div>

        {/* 3. Tag Autocomplete */}
        <div className="mb-6 relative">
            <label className="text-xs text-zinc-500 font-bold block mb-2">Tags (Select from constants)</label>
            
            {/* Selected Tags Chips */}
            <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map(tag => (
                    <span key={tag} className="bg-zinc-800 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 animate-in zoom-in duration-200">
                        #{tag}
                        <button onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-white"><X size={12}/></button>
                    </span>
                ))}
            </div>

            {/* Input & Dropdown */}
            <div className="relative">
                <Tag size={16} className="absolute left-3 top-3.5 text-zinc-500"/>
                <input 
                    type="text" 
                    value={tagSearch} 
                    onFocus={() => setIsTagDropdownOpen(true)}
                    onChange={(e) => {
                        setTagSearch(e.target.value);
                        setIsTagDropdownOpen(true);
                    }}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 pl-10 focus:border-green-500 outline-none text-sm"
                    placeholder="Type to search tags (e.g. coding, jazz...)"
                />
                
                {/* Autocomplete Dropdown */}
                {isTagDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-30 custom-scrollbar">
                        {filteredTags.length > 0 ? (
                            filteredTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => addTag(tag)}
                                    className="w-full text-left px-4 py-2 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white border-b border-zinc-800 last:border-0"
                                >
                                    #{tag}
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-zinc-500">No tags found</div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Save Button */}
        <button 
            onClick={handleSave}
            className={`w-full font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 ${
                editingId 
                ? 'bg-yellow-500 text-black hover:bg-yellow-400' 
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
        >
            <Save size={18}/> {editingId ? "Update Scenario" : "Create Scenario"}
        </button>
      </div>

      {/* --- List View --- */}
      <h3 className="text-xl font-bold mb-4 px-1">Existing Scenarios ({scenarios.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {loading ? (
            <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-zinc-500"/></div>
        ) : scenarios.map((item) => (
            <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex items-start justify-between group hover:border-zinc-600 transition hover:bg-zinc-900">
                <div className="flex gap-4">
                    <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center text-3xl border border-zinc-800 shadow-lg">
                        {item.emoji}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{item.title}</h3>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            {item.tags?.map((t: string) => (
                                <span key={t} className="text-[10px] font-bold bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-400 border border-zinc-700/50">#{t}</span>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => handleEditClick(item)}
                        className="w-8 h-8 flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition"
                        title="Edit"
                    >
                        <Edit2 size={14}/>
                    </button>
                    <button 
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete"
                    >
                        <Trash2 size={14}/>
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}