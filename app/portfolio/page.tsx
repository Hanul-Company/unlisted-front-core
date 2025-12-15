'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, TrendingUp, DollarSign, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import HeaderProfile from '../components/HeaderProfile';
import { Link } from "@/lib/i18n";
import toast from 'react-hot-toast';
import { formatEther } from 'viem';

// [Thirdweb Imports]
import { getContract, prepareContractCall } from "thirdweb";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants';

// Contract Definition
const stockContract = getContract({
  client,
  chain,
  address: UNLISTED_STOCK_ADDRESS,
  abi: UNLISTED_STOCK_ABI as any
});

type Track = {
  id: number;
  title: string;
  artist_name: string;
  token_id: number;
  cover_image_url: string | null;
};

type Asset = Track & {
  sharesOwned: bigint;
  currentValue: bigint;
};

export default function PortfolioPage() {
  // [Change] Wagmi -> Thirdweb Account
  const account = useActiveAccount();
  const address = account?.address;

  // [Change] Transaction Hook
  const { mutate: sendTransaction, isPending } = useSendTransaction();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. 데이터 로딩 로직
  useEffect(() => {
    const loadPortfolio = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      // A. 모든 민팅된 트랙 가져오기
      const { data: tracks } = await supabase
        .from('tracks')
        .select('*')
        .eq('is_minted', true);

      if (!tracks || tracks.length === 0) {
        setIsLoading(false);
        return;
      }

      // 편의상 상위 컴포넌트에서는 트랙 리스트만 넘겨줍니다.
      // (각 AssetRow가 자신의 잔고를 직접 조회하도록 설계됨)
      setAssets(tracks.map(t => ({ ...t, sharesOwned: BigInt(0), currentValue: BigInt(0) })));
      setIsLoading(false);
    };

    loadPortfolio();
  }, [address]);

  // [Change] Sell Handler (Thirdweb)
  const handleSell = (tokenId: number, amount: bigint) => {
    const transaction = prepareContractCall({
        contract: stockContract,
        method: "sellShares",
        params: [BigInt(tokenId), amount]
    });

    sendTransaction(transaction, {
        onSuccess: () => {
            toast.success("Sell successful! Profit realized.");
            window.location.reload(); // 잔고 갱신을 위해 리로드
        },
        onError: (err) => {
            console.error(err);
            toast.error("Sell failed.");
        }
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-10">
        <div>
           <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-2 block">← Back to Market</Link>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
             My Portfolio
           </h1>
        </div>
        <HeaderProfile/>
      </header>

      {/* Asset List Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden min-h-[300px]">
         <table className="w-full text-left">
            <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase tracking-wider">
               <tr>
                  <th className="p-4">Track</th>
                  <th className="p-4 text-right">Shares Owned</th>
                  <th className="p-4 text-right">Sell Price (Est.)</th>
                  <th className="p-4 text-center">Action</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
               {isLoading ? (
                  <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin inline"/> Loading assets...</td></tr>
               ) : assets.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-zinc-500">No assets found. Go invest!</td></tr>
               ) : (
                  assets.map((track) => (
                    <AssetRow
                      key={track.id}
                      track={track}
                      address={address!}
                      isPending={isPending}
                      onSell={handleSell}
                    />
                  ))
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

// [개별 트랙 컴포넌트] Thirdweb Hooks로 교체
function AssetRow({ track, address, isPending, onSell }: { track: any, address: string, isPending: boolean, onSell: (id:number, amt:bigint)=>void }) {

  const tokenIdBigInt = BigInt(track.token_id || track.id);

  // 1. 내 지분 읽기
  const { data: balanceVal } = useReadContract({
    contract: stockContract,
    method: "sharesBalance",
    params: [tokenIdBigInt, address]
  });

  const myBalance = balanceVal || BigInt(0);

  // 2. 현재 매도 가능 가격 조회 (지분이 있을 때만)
  const { data: sellPriceVal } = useReadContract({
    contract: stockContract,
    method: "getSellPrice",
    params: [tokenIdBigInt, myBalance],
    queryOptions: { enabled: myBalance > BigInt(0) } // 잔고가 0이면 호출 안 함 (최적화)
  });

  const sellValue = sellPriceVal || BigInt(0);

  // 지분이 없으면 안 보여줌 (Hidden)
  if (!myBalance || myBalance === BigInt(0)) return null;

  return (
    <>
      {/* [PC View] 진짜 테이블 행 */}
      <tr className="hidden md:table-row hover:bg-zinc-800/50 transition">
        <td className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center text-lg overflow-hidden">
            {track.cover_image_url ? (
              <img
                src={track.cover_image_url}
                className="w-full h-full object-cover"
              />
            ) : (
              "🎵"
            )}
          </div>
          <div>
            <div className="font-bold">{track.title}</div>
            <div className="text-xs text-zinc-500">{track.artist_name}</div>
          </div>
        </td>
        <td className="p-4 text-right font-mono text-zinc-300">
          {Number(formatEther(myBalance)).toFixed(2)} Shares
        </td>
        <td className="p-4 text-right font-mono text-green-400 font-bold">
          {Number(formatEther(sellValue)).toFixed(4)} MLD
        </td>
        <td className="p-4 text-center">
          <button
            disabled={isPending}
            onClick={() =>
              onSell(track.token_id || track.id, myBalance)
            }
            className="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white text-xs font-bold px-4 py-2 rounded transition"
          >
            Sell
          </button>
        </td>
      </tr>

      {/* [Mobile View] 한 칸짜리 테이블 행 + 카드 레이아웃 */}
      <tr className="md:hidden border-t border-zinc-800/50">
        <td className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                {track.cover_image_url ? (
                  <img
                    src={track.cover_image_url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "🎵"
                )}
              </div>
              <div>
                <div className="font-bold text-sm">{track.title}</div>
                <div className="text-xs text-zinc-500 mb-1">
                  {track.artist_name}
                </div>
                <div className="text-xs text-purple-400 font-mono">
                  {Number(formatEther(myBalance)).toFixed(2)} Shares
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-400 mb-2">
                {Number(formatEther(sellValue)).toFixed(2)} MLD
              </div>
              <button
                disabled={isPending}
                onClick={() =>
                  onSell(track.token_id || track.id, myBalance)
                }
                className="bg-red-900/30 text-red-400 border border-red-900 px-3 py-1.5 rounded-lg text-xs"
              >
                Sell
              </button>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
};
