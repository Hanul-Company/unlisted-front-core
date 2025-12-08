'use client';

import React, { useState, useEffect } from 'react';
import { client, chain } from '@/utils/thirdweb';
import { 
  ConnectButton, 
  useActiveAccount, 
  useActiveWallet, 
  useDisconnect, 
  useReadContract,
  useSendTransaction // [추가] 트랜잭션 전송 훅
} from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getContract, prepareContractCall } from "thirdweb"; // [추가]
import { formatEther } from "viem";

import { supabase } from '@/utils/supabase';
import { User, LogOut, Wallet, ChevronDown, Settings, ShieldCheck, Link as LinkIcon, Coins, Zap, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, UNLISTED_STOCK_ADDRESS } from '@/app/constants';

// [지갑 설정]
const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "apple"] },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

// [핵심 수정 1] ABI를 포함하여 컨트랙트 정의 (method 오류 해결)
const mldContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any, // ABI 필수!
});

type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
  p_mld_balance: number;
};

export default function HeaderProfile() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  
  // [핵심 수정 2] Thirdweb 트랜잭션 훅 사용 (writeContract 대체)
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // MLD 잔고 조회
  const { data: mldBalanceVal, refetch: refetchMld } = useReadContract({
    contract: mldContract,
    method: "balanceOf",
    params: [account?.address || "0x0000000000000000000000000000000000000000"]
  });

    // 프로필 동기화
    useEffect(() => {
    const syncProfile = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        const currentAddress = account?.address;

        // 1) 기존 Supabase Auth 유저
        if (authUser) {
        const { data } = await supabase.rpc('get_my_profile_with_balances');
        if (data && data.length > 0) setProfile(data[0]);
        return;
        }

        // 2) thirdweb 전용 (지갑 기반 유저)
        if (currentAddress) {
        // (1) 프로필 upsert
        let { data: profileRow, error: profileError } =
            await supabase
            .from('profiles')
            .select('*')
            .eq('wallet_address', currentAddress)
            .maybeSingle();

        if (!profileRow) {
            const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .insert({
                wallet_address: currentAddress,
                username: `User_${currentAddress.slice(0, 4)}`,
            })
            .select('*')
            .single();

            if (insertErr) {
            console.error('profile insert error', insertErr);
            setProfile(null);
            return;
            }
            profileRow = inserted;

            // (2) 여기서 100 pMLD 웰컴 보너스 지급
            const { error: pmldInsertErr } = await supabase
            .from('p_mld_balances')
            .insert({
                profile_id: profileRow.id,
                balance: 100,
            });

            if (pmldInsertErr) {
            console.error('p_mld_balances insert error', pmldInsertErr);
            // 여기서 바로 return 하진 말고, 아래에서 다시 읽게 둠
            }
        }

        // (3) p_mld 잔고 읽기 (없으면 0)
        const { data: balRow, error: balError } = await supabase
            .from('p_mld_balances')
            .select('balance')
            .eq('profile_id', profileRow.id)
            .maybeSingle();

        if (balError) {
            console.error('p_mld_balances select error', balError);
        }

        const balance = balRow?.balance ?? 0;
        setProfile({
            ...(profileRow as any),
            p_mld_balance: balance,
        });
        } else {
        setProfile(null);
        }
    };

    syncProfile();
    }, [account?.address]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (wallet) disconnect(wallet);
    window.location.reload();
  };

  const handleLinkWallet = async () => {
    if (!account?.address) return;
    const toastId = toast.loading("지갑 연동 중...");
    const { data, error } = await supabase.rpc('link_wallet_to_profile', { p_wallet_address: account.address });
    if (error) { toast.error(error.message, { id: toastId }); return; }
    if (data === 'WALLET_IN_USE') { toast.error("이미 사용 중인 지갑입니다.", { id: toastId }); } 
    else { toast.success("연동 완료!", { id: toastId }); window.location.reload(); }
  };

  // [핵심 수정 3] Faucet 핸들러 (Thirdweb 방식)
  const handleMintTokens = () => {
      if (!account?.address) return toast.error("지갑을 연결해주세요.");
      
      const toastId = toast.loading("1000 MLD 발행 요청 중...");
      
      // 트랜잭션 준비
      const transaction = prepareContractCall({
        contract: mldContract,
        method: "mint",
        params: [account.address, BigInt(1000 * 1e18)], // account.address 사용
      });

      // 트랜잭션 전송
      sendTransaction(transaction, {
        onSuccess: () => {
            toast.success("1000 MLD가 지갑으로 전송되었습니다!", { id: toastId });
            setTimeout(() => refetchMld(), 1000); 
        },
        onError: (err) => {
            console.error("Mint Error:", err);
            toast.error("발행 실패", { id: toastId });
        }
      });
  };

  // [핵심 수정 4] Approve 핸들러 (Thirdweb 방식)
  const handleApprove = () => {
      if (!account?.address) return toast.error("지갑을 연결해주세요.");
      
      const toastId = toast.loading("컨트랙트 승인 요청 중...");
      
      const transaction = prepareContractCall({
        contract: mldContract,
        method: "approve",
        params: [UNLISTED_STOCK_ADDRESS, BigInt(100000 * 1e18)],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
            toast.success("승인 완료! 이제 투자할 수 있습니다.", { id: toastId });
        },
        onError: (err) => {
            console.error("Approve Error:", err);
            toast.error("승인 실패", { id: toastId });
        }
      });
  };

  // 1. 비로그인 상태
  if (!user && !account) {
    return (
        <>
          <ConnectButton
            client={client}
            wallets={wallets}
            chain={chain}
            accountAbstraction={{ chain: chain, sponsorGas: true }}
            connectButton={{
                label: "Sign in / Connect",
                style: {
                    backgroundColor: "#18181b",
                    color: "white",
                    border: "1px solid #3f3f46",
                    borderRadius: "99px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    padding: "10px 20px",
                }
            }}
            connectModal={{
                size: "compact",
                title: "Join Unlisted",
                welcomeScreen: { title: "Your Music Assets", subtitle: "Login to start collecting & investing" }
            }}
          />
        </>
    );
  }

  // 2. 로그인 후
  return (
    <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 pr-4 pl-2 py-1.5 rounded-full hover:border-zinc-600 transition">
            <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-zinc-900 overflow-hidden">
                {profile?.avatar_url ? ( <img src={profile.avatar_url} className="w-full h-full object-cover"/> ) : ( (profile?.username || user?.email || account?.address)?.slice(0,2).toUpperCase() )}
            </div>
            <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-none mb-0.5">{profile?.username || "Investor"}</div>
                <div className="text-[10px] text-zinc-500 font-mono leading-none">pMLD: {profile?.p_mld_balance ?? 0}</div>
            </div>
            <ChevronDown size={14} className="text-zinc-500"/>
        </button>

        {showMenu && (
            <div className="absolute right-0 top-14 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-3 border-b border-zinc-800 mb-2 space-y-3">
                    <div>
                        <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Account</p>
                        <p className="text-sm font-bold truncate text-zinc-300">{user?.email || account?.address}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/40 p-2 rounded-lg border border-zinc-800">
                            <div className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1"><Coins size={10}/> Points</div>
                            <div className="text-sm font-mono font-bold text-cyan-400">{profile?.p_mld_balance ?? 0} <span className="text-[10px]">pMLD</span></div>
                        </div>
                        <div className="bg-black/40 p-2 rounded-lg border border-zinc-800">
                            <div className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1"><Zap size={10}/> Token</div>
                            <div className="text-sm font-mono font-bold text-green-400">
                                {mldBalanceVal ? Number(formatEther(mldBalanceVal)).toLocaleString(undefined, {maximumFractionDigits:0}) : 0} <span className="text-[10px]">MLD</span>
                            </div>
                        </div>
                    </div>
                </div>

                <Link href="/settings" className="flex items-center gap-3 p-3 hover:bg-zinc-800 rounded-xl text-sm transition text-zinc-300 hover:text-white">
                    <Settings size={16}/> Profile
                </Link>
                
                <div className="bg-zinc-950 rounded-xl p-3 mt-2 mb-2 border border-zinc-800">
                     <div className="flex items-center justify-between text-xs text-zinc-500 font-bold uppercase mb-2">
                        <span className="flex items-center gap-1"><Wallet size={12}/> Connection</span>
                        
                        {/* Disconnect */}
                        {account && (
                            <button 
                                onClick={() => { if(wallet) disconnect(wallet); window.location.reload(); }} 
                                className="text-[10px] text-red-400 hover:text-red-300 underline"
                            >
                                Disconnect
                            </button>
                        )}
                    </div>
                    
                    {account ? (
                        <div className="space-y-2">
                            <div className="text-xs text-green-400 flex items-center gap-2 bg-green-400/10 p-2 rounded-lg border border-green-400/20">
                                <ShieldCheck size={14}/> 
                                <span className="truncate flex-1 font-mono">{account.address.slice(0,6)}...{account.address.slice(-4)}</span>
                            </div>

                            {/* Faucet & Approve Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <button 
                                    onClick={handleMintTokens} 
                                    disabled={isPending}
                                    className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-700 transition"
                                >
                                    {isPending ? <Loader2 size={12} className="animate-spin"/> : <><Coins size={12}/> Get MLD</>}
                                </button>
                                <button 
                                    onClick={handleApprove} 
                                    disabled={isPending}
                                    className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-blue-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-700 transition"
                                >
                                    {isPending ? <Loader2 size={12} className="animate-spin"/> : <><CheckCircle size={12}/> Approve</>}
                                </button>
                            </div>

                            {profile && !profile.wallet_address && (
                                <button onClick={handleLinkWallet} className="mt-2 w-full text-xs bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 transition"><LinkIcon size={12}/> Link Account</button>
                            )}
                        </div>
                    ) : (
                        <ConnectButton 
                            client={client}
                            wallets={wallets}
                            chain={chain}
                            accountAbstraction={{ chain: chain, sponsorGas: true }}
                            connectButton={{ label: "Connect Wallet", style: { width: "100%", fontSize: "12px", padding: "8px" } }}
                        />
                    )}
                </div>

                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-sm transition text-zinc-400 mt-1"><LogOut size={16}/> Sign Out</button>
            </div>
        )}
        {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}/>}
    </div>
  );
}