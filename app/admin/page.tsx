'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Users, Disc, Coins, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, tracks: 0, total_pmld: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: trackCount } = await supabase.from('tracks').select('*', { count: 'exact', head: true });
      const { data: pmldData } = await supabase.from('p_mld_balances').select('balance');
      
      const totalPmld = pmldData?.reduce((sum, row) => sum + (row.balance || 0), 0) || 0;
      setStats({ users: userCount || 0, tracks: trackCount || 0, total_pmld: totalPmld });
    };
    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Users/>} title="Total Users" value={stats.users} />
        <StatCard icon={<Disc/>} title="Total Tracks" value={stats.tracks} />
        <StatCard icon={<Coins/>} title="Circulating pMLD" value={stats.total_pmld} color="text-cyan-400" />
      </div>
      
      <div className="mt-12 bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h2 className="text-xl font-bold mb-4">Recent Activity (Placeholder)</h2>
        <div className="text-zinc-500">Activity graph will be here...</div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color="text-white" }: any) {
  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex items-center gap-4">
      <div className={`p-4 rounded-xl bg-zinc-800 ${color}`}>{icon}</div>
      <div>
        <div className="text-zinc-500 text-sm">{title}</div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </div>
    </div>
  );
}