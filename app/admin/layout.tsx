'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from "@/lib/i18n";
import { Loader2, ShieldAlert, Menu, X } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('auth_user_id', user.id)
        .single();

      if (profile?.is_admin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        toast.error("접근 권한이 없습니다.");
        router.push('/market');
      }
    };
    checkAdmin();
  }, []);

  if (isAdmin === null) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48}/></div>;
  if (isAdmin === false) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col md:flex-row">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-red-500" />
          <span className="text-lg font-bold tracking-tighter">unlisted Admin</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-white">
          <Menu size={24} />
        </button>
      </div>

      {/* Admin Sidebar */}
      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 p-6 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:block
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-red-500" />
            <span className="text-xl font-bold tracking-tighter">unlisted Admin</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <nav className="space-y-2">
          <Link href="/admin" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Dashboard</div></Link>
          <Link href="/admin/users" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Users</div></Link>
          <Link href="/admin/tracks" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Tracks</div></Link>
          <Link href="/admin/banner" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Banners</div></Link>
          <Link href="/admin/scenarios" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Scenarios</div></Link>
          <Link href="/admin/tutorial" onClick={() => setIsSidebarOpen(false)}><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Tutorial</div></Link>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';