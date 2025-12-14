'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from "@/lib/i18n";
import { Loader2, ShieldAlert } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
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
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-10">
          <ShieldAlert className="text-red-500" />
          <span className="text-xl font-bold tracking-tighter">unlisted Admin</span>
        </div>
        <nav className="space-y-2">
          <Link href="/admin"><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Dashboard</div></Link>
          <Link href="/admin/users"><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Users</div></Link>
          <Link href="/admin/tracks"><div className="p-3 hover:bg-zinc-800 rounded-lg cursor-pointer">Tracks</div></Link>
        </nav>
      </aside>
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';