'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, p_mld_balances(balance)')
      .order('created_at', { ascending: false });
    setUsers(data || []);
  };

  const adjustPmld = async (profileId: string, currentBalance: number) => {
    const amount = prompt("추가할 pMLD 양을 입력하세요 (음수는 차감):");
    if (!amount) return;
    const num = parseInt(amount);
    if (isNaN(num)) return;

    const { error } = await supabase
      .from('p_mld_balances')
      .update({ balance: currentBalance + num })
      .eq('profile_id', profileId);

    if (error) toast.error("수정 실패");
    else { toast.success("수정 완료"); fetchUsers(); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">User Management</h1>
      <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-800 text-zinc-400 text-sm">
            <tr>
              <th className="p-4">Email / User</th>
              <th className="p-4">Wallet</th>
              <th className="p-4">pMLD</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-zinc-800">
                <td className="p-4">
                  <div>{user.email || 'N/A'}</div>
                  <div className="text-xs text-zinc-500">@{user.username}</div>
                </td>
                <td className="p-4 text-xs font-mono">{user.wallet_address || 'Not Connected'}</td>
                <td className="p-4">{user.p_mld_balances?.[0]?.balance || 0}</td>
                <td className="p-4">
                  <button onClick={() => adjustPmld(user.id, user.p_mld_balances?.[0]?.balance || 0)} className="text-xs bg-blue-600 px-2 py-1 rounded">Adjust pMLD</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}