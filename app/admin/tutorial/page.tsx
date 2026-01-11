'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Trash2, Plus, Save, Loader2, ArrowUp, ArrowDown, Edit2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

// 언어 목록 정의
const LANGS = [
  { code: 'kr', label: '🇰🇷 Korean' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'cn', label: '🇨🇳 Chinese' },
  { code: 'jp', label: '🇯🇵 Japanese' },
];

export default function AdminTutorialPage() {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Form State ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  
  // 다국어 입력 상태 관리
  const [content, setContent] = useState<any>({
    kr: { title: '', desc: '' },
    en: { title: '', desc: '' },
    cn: { title: '', desc: '' },
    jp: { title: '', desc: '' },
  });
  
  const [activeTab, setActiveTab] = useState('kr'); // 현재 입력 중인 언어 탭

  // 1. 목록 불러오기
  const fetchSteps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tutorial_steps')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) toast.error(error.message);
    else setSteps(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  // 2. 저장 (생성/수정)
  const handleSave = async () => {
    // DB 컬럼에 맞게 데이터 변환
    const payload = {
      image_url: imageUrl,
      title_kr: content.kr.title, desc_kr: content.kr.desc,
      title_en: content.en.title, desc_en: content.en.desc,
      title_cn: content.cn.title, desc_cn: content.cn.desc,
      title_jp: content.jp.title, desc_jp: content.jp.desc,
    };

    if (editingId) {
      const { error } = await supabase.from('tutorial_steps').update(payload).eq('id', editingId);
      if (error) toast.error(error.message);
      else { toast.success("Updated!"); resetForm(); fetchSteps(); }
    } else {
      const { error } = await supabase.from('tutorial_steps').insert({ ...payload, sort_order: steps.length });
      if (error) toast.error(error.message);
      else { toast.success("Created!"); resetForm(); fetchSteps(); }
    }
  };

  // 3. 수정 모드 진입
  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setImageUrl(item.image_url || '');
    setContent({
      kr: { title: item.title_kr || '', desc: item.desc_kr || '' },
      en: { title: item.title_en || '', desc: item.desc_en || '' },
      cn: { title: item.title_cn || '', desc: item.desc_cn || '' },
      jp: { title: item.title_jp || '', desc: item.desc_jp || '' },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 4. 삭제 및 순서 변경
  const handleDelete = async (id: string) => {
    if(!confirm("Delete?")) return;
    await supabase.from('tutorial_steps').delete().eq('id', id);
    fetchSteps();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap sort_order
    const tempOrder = newSteps[index].sort_order;
    newSteps[index].sort_order = newSteps[targetIndex].sort_order;
    newSteps[targetIndex].sort_order = tempOrder;

    // Swap in array
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);

    // Update DB
    await supabase.from('tutorial_steps').upsert([
        { id: newSteps[index].id, sort_order: newSteps[index].sort_order },
        { id: newSteps[targetIndex].id, sort_order: newSteps[targetIndex].sort_order }
    ]);
  };

  const resetForm = () => {
    setEditingId(null);
    setImageUrl('');
    setContent({
        kr: { title: '', desc: '' },
        en: { title: '', desc: '' },
        cn: { title: '', desc: '' },
        jp: { title: '', desc: '' },
    });
    setActiveTab('kr');
  };

  const handleInputChange = (field: 'title' | 'desc', value: string) => {
    setContent((prev: any) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], [field]: value }
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 pl-24 pt-24">
      <h1 className="text-3xl font-black mb-8 flex items-center gap-2">📘 Tutorial Manager</h1>

      {/* Editor */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 max-w-3xl">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            {editingId ? <Edit2 size={18} className="text-yellow-500"/> : <Plus size={18} className="text-green-500"/>}
            {editingId ? "Edit Step" : "Add New Step"}
        </h2>

        {/* Image URL */}
        <div className="mb-6">
            <label className="text-xs text-zinc-500 font-bold block mb-1">Image URL</label>
            <input 
                type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none"
                placeholder="https://..."
            />
        </div>

        {/* Language Tabs */}
        <div className="flex gap-2 mb-4 border-b border-zinc-800 pb-2 overflow-x-auto">
            {LANGS.map(lang => (
                <button 
                    key={lang.code}
                    onClick={() => setActiveTab(lang.code)}
                    className={`px-4 py-2 rounded-t-lg text-sm font-bold transition ${activeTab === lang.code ? 'bg-zinc-800 text-white border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    {lang.label}
                </button>
            ))}
        </div>

        {/* Title & Desc Input (Active Tab) */}
        <div className="space-y-4 mb-6">
            <div>
                <label className="text-xs text-zinc-500 font-bold block mb-1">Title ({LANGS.find(l=>l.code===activeTab)?.label})</label>
                <input 
                    type="text" 
                    value={content[activeTab].title} 
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 font-bold focus:border-blue-500 outline-none"
                    placeholder="Step Title..."
                />
            </div>
            <div>
                <label className="text-xs text-zinc-500 font-bold block mb-1">Description ({LANGS.find(l=>l.code===activeTab)?.label})</label>
                <textarea 
                    value={content[activeTab].desc} 
                    onChange={(e) => handleInputChange('desc', e.target.value)}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 h-24 resize-none focus:border-blue-500 outline-none text-sm leading-relaxed"
                    placeholder="Explain detail..."
                />
            </div>
        </div>

        <div className="flex gap-3">
             {editingId && <button onClick={resetForm} className="px-6 py-3 rounded-xl font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700">Cancel</button>}
             <button onClick={handleSave} className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2">
                <Save size={18}/> Save Step
             </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4 max-w-3xl pb-20">
        {loading ? <div className="text-center py-10"><Loader2 className="animate-spin inline"/></div> : steps.map((step, idx) => (
            <div key={step.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-center group">
                {/* Image Preview */}
                <div className="w-20 h-20 bg-black rounded-lg overflow-hidden shrink-0 border border-zinc-800">
                    {step.image_url ? <img src={step.image_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No Img</div>}
                </div>

                {/* Info (Show KR default) */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-lg truncate">{step.title_kr || step.title_en || "No Title"}</h3>
                    <p className="text-zinc-500 text-sm truncate">{step.desc_kr || step.desc_en || "No Desc"}</p>
                    <div className="flex gap-2 mt-2">
                        {LANGS.map(l => (
                            <span key={l.code} className={`text-[10px] px-1.5 py-0.5 rounded border ${step[`title_${l.code}`] ? 'bg-green-900/30 border-green-500/30 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-600'}`}>
                                {l.code.toUpperCase()}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                    <button onClick={() => handleMove(idx, 'up')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white"><ArrowUp size={14}/></button>
                    <button onClick={() => handleMove(idx, 'down')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white"><ArrowDown size={14}/></button>
                </div>
                <div className="w-px h-10 bg-zinc-800 mx-1"/>
                <div className="flex flex-col gap-2">
                    <button onClick={() => handleEdit(step)} className="p-2 bg-zinc-800 hover:bg-yellow-500/20 hover:text-yellow-500 rounded-lg text-zinc-400 transition"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(step.id)} className="p-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-500 rounded-lg text-zinc-400 transition"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}