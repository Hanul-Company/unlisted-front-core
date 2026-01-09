'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Upload, Loader2, Plus, Save, Trash2, Edit2, Image as ImageIcon, Link as LinkIcon, Eye, EyeOff, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';

// DB 데이터 타입 정의
type Banner = {
  id: number;
  image_url: string;
  title: string;
  subtitle: string | null;
  btn1_text: string | null;
  btn1_link: string | null;
  btn2_text: string | null;
  btn2_link: string | null;
  sort_order: number;
  is_active: boolean;
};

// 입력 폼 초기값
const initialForm = {
  image_url: '',
  title: '',
  subtitle: '',
  btn1_text: '',
  btn1_link: '',
  btn2_text: '',
  btn2_link: '',
  is_active: true,
  sort_order: 0,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ✅ [New] 이미지 업로드 로딩 상태
  const [uploading, setUploading] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('market_banners')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load banners');
      console.error(error);
    } else {
      setBanners(data || []);
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setFormData({
      image_url: banner.image_url,
      title: banner.title,
      subtitle: banner.subtitle || '',
      btn1_text: banner.btn1_text || '',
      btn1_link: banner.btn1_link || '',
      btn2_text: banner.btn2_text || '',
      btn2_link: banner.btn2_link || '',
      is_active: banner.is_active,
      sort_order: banner.sort_order,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    const { error } = await supabase.from('market_banners').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Banner deleted');
      fetchBanners();
      if (editingId === id) resetForm();
    }
  };

  // ✅ [New] 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `banners/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Storage에 업로드 (버킷 이름: images)
      const { error: uploadError } = await supabase.storage
        .from('images') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Public URL 가져오기
      const { data } = supabase.storage.from('images').getPublicUrl(filePath);

      // 3. 폼 데이터 업데이트
      setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
      toast.success("Image uploaded!");

    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url || !formData.title) {
      toast.error('Image URL and Title are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        image_url: formData.image_url,
        title: formData.title,
        subtitle: formData.subtitle || null,
        btn1_text: formData.btn1_text || null,
        btn1_link: formData.btn1_link || null,
        btn2_text: formData.btn2_text || null,
        btn2_link: formData.btn2_link || null,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('market_banners')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Banner updated successfully');
      } else {
        // Create
        const { error } = await supabase
          .from('market_banners')
          .insert(payload);
        if (error) throw error;
        toast.success('Banner created successfully');
      }

      resetForm();
      fetchBanners();
    } catch (error) {
      console.error(error);
      toast.error('Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8 border-b border-zinc-800 pb-6">
          <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl">
            <LayoutTemplate size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Market Banners</h1>
            <p className="text-zinc-500">Manage the top carousel on the Market page</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* LEFT: Input Form & Preview */}
          <div className="space-y-8">
            
            {/* Live Preview Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-cyan-400 border border-cyan-500/30 z-20">
                LIVE PREVIEW
              </div>
              
              <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden bg-black border border-zinc-700 shadow-2xl">
                {formData.image_url ? (
                  <>
                    {/* ✅ [수정됨] 이미지 어둡게 처리: opacity-50 */}
                    <img src={formData.image_url} className="w-full h-full object-cover opacity-50" alt="Preview" />
                    {/* ✅ [추가됨] 전체적으로 어둡게 한 겹 더 */}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <ImageIcon className="text-zinc-600" size={48} />
                  </div>
                )}

                <div className="absolute inset-0 flex flex-col justify-center px-8">
                  <h2 className="text-2xl font-black text-white tracking-tight mb-2 drop-shadow-lg leading-none">
                    {formData.title || 'Banner Title'}
                  </h2>
                  <p className="text-zinc-300 text-sm font-medium drop-shadow-md mb-6">
                    {formData.subtitle || 'Banner subtitle goes here...'}
                  </p>

                  <div className="flex items-center gap-3">
                    {/* Button 1 Preview */}
                    {formData.btn1_text && (
                      <div className="px-5 py-2 rounded-full font-bold text-xs text-white bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-lg">
                        {formData.btn1_text}
                      </div>
                    )}
                    {/* Button 2 Preview */}
                    {formData.btn2_text && (
                      <div className="p-[1px] rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600">
                        <div className="px-5 py-[7px] rounded-full bg-black/80 text-white font-bold text-xs">
                          {formData.btn2_text}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                {editingId ? <Edit2 size={18} className="text-yellow-500"/> : <Plus size={18} className="text-green-500"/>}
                {editingId ? 'Edit Banner' : 'Create New Banner'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Image & Active */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Image URL (Wide)</label>
                    <div className="flex gap-2">
                        {/* URL 직접 입력 */}
                        <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-700 rounded-lg px-3 py-2 focus-within:border-cyan-500 transition">
                            <ImageIcon size={16} className="text-zinc-500 shrink-0"/>
                            <input 
                                name="image_url" value={formData.image_url} onChange={handleInputChange} 
                                className="bg-transparent w-full text-sm outline-none placeholder-zinc-700 truncate"
                                placeholder="https://... or Upload ->"
                                required
                            />
                        </div>
                        
                        {/* 파일 업로드 버튼 */}
                        <label className={`cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white px-3 rounded-lg flex items-center justify-center transition border border-zinc-700 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {uploading ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18}/>}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                        </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-zinc-500 uppercase">Status</label>
                     <div className="flex items-center gap-2 bg-black border border-zinc-700 rounded-lg px-3 py-2 h-[38px]">
                        <input 
                          type="checkbox" 
                          name="is_active" 
                          checked={formData.is_active} 
                          onChange={handleInputChange}
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <span className="text-sm text-zinc-300">Active</span>
                     </div>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Main Title</label>
                  <input 
                    name="title" value={formData.title} onChange={handleInputChange} 
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-lg font-bold outline-none focus:border-cyan-500 transition"
                    placeholder="e.g., New Season Arrival"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Subtitle</label>
                  <input 
                    name="subtitle" value={formData.subtitle} onChange={handleInputChange} 
                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 transition"
                    placeholder="Optional description"
                  />
                </div>

                <div className="h-px bg-zinc-800 my-4"></div>

                {/* Button 1 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-cyan-500 uppercase">Button 1 Text (Filled)</label>
                    <input 
                      name="btn1_text" value={formData.btn1_text} onChange={handleInputChange} 
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 transition"
                      placeholder="e.g. Explore"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-cyan-500 uppercase">Button 1 Link</label>
                    <div className="flex items-center gap-2 bg-black border border-zinc-700 rounded-lg px-3 py-2">
                       <LinkIcon size={14} className="text-zinc-500"/>
                       <input 
                        name="btn1_link" value={formData.btn1_link} onChange={handleInputChange} 
                        className="bg-transparent w-full text-sm outline-none"
                        placeholder="/market"
                      />
                    </div>
                  </div>
                </div>

                {/* Button 2 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Button 2 Text (Outline)</label>
                    <input 
                      name="btn2_text" value={formData.btn2_text} onChange={handleInputChange} 
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition"
                      placeholder="e.g. View Details"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Button 2 Link</label>
                    <div className="flex items-center gap-2 bg-black border border-zinc-700 rounded-lg px-3 py-2">
                       <LinkIcon size={14} className="text-zinc-500"/>
                       <input 
                        name="btn2_link" value={formData.btn2_link} onChange={handleInputChange} 
                        className="bg-transparent w-full text-sm outline-none"
                        placeholder="/invest"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Sort Order */}
                <div className="space-y-1 w-1/3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Sort Order</label>
                    <input 
                      type="number"
                      name="sort_order" value={formData.sort_order} onChange={handleInputChange} 
                      className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500 transition"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
                    {editingId ? 'Update Banner' : 'Create Banner'}
                  </button>
                  
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={resetForm}
                      className="px-6 py-3 bg-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-zinc-700 hover:text-white transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>

              </form>
            </div>
          </div>

          {/* RIGHT: List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-fit max-h-[800px] overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>Current Banners</span>
              <span className="text-xs bg-zinc-800 px-2 py-1 rounded-md text-zinc-400">{banners.length} Items</span>
            </h2>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-cyan-500"/></div>
            ) : banners.length === 0 ? (
              <div className="text-zinc-500 text-center py-10 text-sm">No banners created yet.</div>
            ) : (
              <div className="space-y-4">
                {banners.map((banner) => (
                  <div key={banner.id} className={`group relative bg-black border ${editingId === banner.id ? 'border-cyan-500' : 'border-zinc-800'} rounded-xl overflow-hidden hover:border-zinc-600 transition`}>
                    
                    {/* Background Preview (Tiny) */}
                    <div className="h-20 w-full relative">
                      <img src={banner.image_url} className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent"/>
                      <div className="absolute inset-0 flex items-center px-4">
                         <div>
                            <div className="font-bold text-white line-clamp-1">{banner.title}</div>
                            {banner.subtitle && <div className="text-xs text-zinc-400 line-clamp-1">{banner.subtitle}</div>}
                         </div>
                      </div>
                      
                      {/* Active Status Badge */}
                      <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${banner.is_active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {banner.is_active ? 'Active' : 'Hidden'}
                      </div>
                    </div>

                    {/* Actions Overlay */}
                    <div className="bg-zinc-900/90 p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                           <span>Order: {banner.sort_order}</span>
                           {banner.btn1_text && <span className="text-cyan-500 border border-cyan-900 px-1 rounded">Btn1</span>}
                           {banner.btn2_text && <span className="text-indigo-500 border border-indigo-900 px-1 rounded">Btn2</span>}
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleEdit(banner)}
                             className="p-2 bg-zinc-800 hover:bg-cyan-500 hover:text-white rounded-lg transition text-zinc-400"
                             title="Edit"
                           >
                             <Edit2 size={14}/>
                           </button>
                           <button 
                             onClick={() => handleDelete(banner.id)}
                             className="p-2 bg-zinc-800 hover:bg-red-500 hover:text-white rounded-lg transition text-zinc-400"
                             title="Delete"
                           >
                             <Trash2 size={14}/>
                           </button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}