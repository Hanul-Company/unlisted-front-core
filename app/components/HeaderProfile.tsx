'use client';

import React, { useState, useEffect } from 'react';
import { client, chain } from '@/utils/thirdweb';
import { 
  ConnectButton, 
  useActiveAccount, 
  useActiveWallet, 
  useDisconnect, 
  useReadContract,
  useSendTransaction 
} from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getContract, prepareContractCall } from "thirdweb";
import { formatEther } from "viem";

import { supabase } from '@/utils/supabase';
import { Wallet, ChevronDown, Settings, ShieldCheck, Link as LinkIcon, Coins, Zap, LogOut, CheckCircle, Loader2 } from 'lucide-react';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI, UNLISTED_STOCK_ADDRESS } from '@/app/constants';

const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "apple"] },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

const mldContract = getContract({
  client,
  chain,
  address: MELODY_TOKEN_ADDRESS,
  abi: MELODY_TOKEN_ABI as any,
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
  
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // MLD 토큰 잔액 조회 (실시간 갱신을 위해 refetch 가져옴)
  const { data: mldBalanceVal, refetch: refetchMld } = useReadContract({
    contract: mldContract,
    method: "balanceOf",
    params: [account?.address || "0x0000000000000000000000000000000000000000"]
  });

  useEffect(() => {
    const syncProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      const currentAddress = account?.address;
      if (currentAddress) {
        let { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', currentAddress)
          .maybeSingle();

        if (!profileRow) {
          // 프로필이 없으면 생성
          const randomAvatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${currentAddress}`;
          const defaultUsername = `User_${currentAddress.slice(0, 4)}`;

          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              wallet_address: currentAddress,
              username: defaultUsername,
              avatar_url: randomAvatarUrl,
            })
            .select('*')
            .single();

          if (!insertErr && inserted) {
             profileRow = inserted;
             // 초기 포인트 지급
             await supabase.from('p_mld_balances').insert({ profile_id: profileRow.id, balance: 100 });
          }
        } 
        
        // pMLD 잔액 조회
        const { data: balRow } = await supabase
          .from('p_mld_balances')
          .select('balance')
          .eq('profile_id', profileRow.id)
          .maybeSingle();

        setProfile({
          ...(profileRow as any),
          p_mld_balance: balRow?.balance ?? 0,
        });
      } else {
        setProfile(null);
      }
    };

    syncProfile();
    
    // 1초마다 잔액 갱신 시도 (구매 후 반영을 위해)
    // 실제로는 Webhook이나 Global State가 좋지만, 간단한 해결책으로 Polling 사용
    const interval = setInterval(() => {
        if(account?.address) {
            refetchMld();
            syncProfile();
        }
    }, 5000);

    return () => clearInterval(interval);
  }, [account?.address]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (wallet) disconnect(wallet);
    window.location.reload();
  };

  const handleLinkWallet = async () => {
    if (!account?.address) return;
    const toastId = toast.loading("Linking wallet...");
    const { data, error } = await supabase.rpc('link_wallet_to_profile', { p_wallet_address: account.address });
    if (error) { toast.error(error.message, { id: toastId }); return; }
    if (data === 'WALLET_IN_USE') { toast.error("This wallet is already in use.", { id: toastId }); } 
    else { toast.success("Wallet linked!", { id: toastId }); window.location.reload(); }
  };

  const handleMintTokens = () => {
    if (!account?.address) return toast.error("Please connect your wallet.");
    const toastId = toast.loading("Requesting 1000 MLD mint...");
    const transaction = prepareContractCall({
      contract: mldContract,
      method: "mint",
      params: [account.address, BigInt(1000 * 1e18)],
    });
    sendTransaction(transaction, {
      onSuccess: () => {
        toast.success("1000 MLD has been sent!", { id: toastId });
        setTimeout(() => refetchMld(), 1000); 
      },
      onError: () => toast.error("Mint failed.", { id: toastId })
    });
  };

  const handleApprove = () => {
    if (!account?.address) return toast.error("Please connect your wallet.");
    const toastId = toast.loading("Approving contract...");
    const transaction = prepareContractCall({
      contract: mldContract,
      method: "approve",
      params: [UNLISTED_STOCK_ADDRESS, BigInt(100000 * 1e18)],
    });
    sendTransaction(transaction, {
      onSuccess: () => toast.success("Approved!", { id: toastId }),
      onError: () => toast.error("Approval failed.", { id: toastId })
    });
  };

  if (!user && !account) {
    return (
      <div id="header-connect-wrapper">
      <ConnectButton
        client={client}
        wallets={wallets}
        chain={chain}
        accountAbstraction={{ chain: chain, sponsorGas: true }}
        connectButton={{
          label: "Sign in / Connect",
          style: { backgroundColor: "#18181b", color: "white", border: "1px solid #3f3f46", borderRadius: "99px", fontSize: "14px", fontWeight: "bold", padding: "10px 20px" }
        }}
        connectModal={{ size: "compact", title: "Join Unlisted", welcomeScreen: { title: "Your Music Assets", subtitle: "Login to start collecting & investing" } }}
      />
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-0 md:gap-3 bg-zinc-900 border border-zinc-800 p-1.5 md:pr-4 md:pl-2 rounded-full hover:border-zinc-600 transition">
        <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-zinc-900 overflow-hidden">
          {profile?.avatar_url ? ( <img src={profile.avatar_url} className="w-full h-full object-cover"/> ) : ( (profile?.username || user?.email || account?.address)?.slice(0,2).toUpperCase() )}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-xs font-bold text-white leading-none mb-0.5">{profile?.username || "Investor"}</div>
          <div className="text-[10px] text-zinc-500 font-mono leading-none">pMLD: {profile?.p_mld_balance ?? 0}</div>
        </div>
        <ChevronDown size={14} className="text-zinc-500 hidden md:block"/>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-14 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-3 border-b border-zinc-800 mb-2 space-y-3">
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Balance</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 p-2 rounded-lg border border-zinc-800">
                <div className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1"><Coins size={10}/> Points</div>
                <div className="text-sm font-mono font-bold text-cyan-400">{profile?.p_mld_balance ?? 0} <span className="text-[10px]">pMLD</span></div>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-zinc-800">
                <div className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1"><Zap size={10}/> Token</div>
                <div className="text-sm font-mono font-bold text-blue-400">
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
              <span className="flex items-center gap-1"><Wallet size={12}/> Wallet Info</span>
              {/* {account && <button onClick={() => { if(wallet) disconnect(wallet); window.location.reload(); }} className="text-[10px] text-red-400 hover:text-red-300 underline">Disconnect</button>} */}
            </div>
            
            {account ? (
              <div className="space-y-2">
                <div className="text-xs text-blue-400 flex items-center gap-2 bg-blue-400/10 p-2 rounded-lg border border-blue-400/20">
                  <ShieldCheck size={14}/> 
                  <span className="truncate flex-1 font-mono">{account.address.slice(0,6)}...{account.address.slice(-4)}</span>
                </div>
                {/* <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={handleMintTokens} disabled={isPending} className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-700 transition"> {isPending ? <Loader2 size={12} className="animate-spin"/> : <><Coins size={12}/> Get MLD</>} </button>
                  <button onClick={handleApprove} disabled={isPending} className="flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-blue-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-700 transition"> {isPending ? <Loader2 size={12} className="animate-spin"/> : <><CheckCircle size={12}/> Initiate</>} </button>
                </div> */}
                {profile && !profile.wallet_address && ( <button onClick={handleLinkWallet} className="mt-2 w-full text-xs bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 transition"><LinkIcon size={12}/> Link Account</button> )}
              </div>
            ) : (
              <ConnectButton client={client} wallets={wallets} chain={chain} accountAbstraction={{ chain: chain, sponsorGas: true }} connectButton={{ label: "Connect Wallet", style: { width: "100%", fontSize: "12px", padding: "8px" } }} />
            )}
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 hover:text-red-500 rounded-xl text-sm transition text-zinc-400 mt-1"><LogOut size={16}/> Sign Out</button>
        </div>
      )}
      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}/>}
    </div>
  );
}