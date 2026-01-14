'use client';
import { useReadContract } from "thirdweb/react";
import { formatEther } from 'viem';
import { MELODY_TOKEN_ADDRESS, MELODY_TOKEN_ABI } from '../constants'; // 경로 확인
import { getContract } from "thirdweb";
import { client, chain } from "@/utils/thirdweb"; // 경로 확인

const melodyTokenContract = getContract({ client, chain, address: MELODY_TOKEN_ADDRESS, abi: MELODY_TOKEN_ABI as any });

export default function TokenBalance({ address }: { address?: string }) {
  // 이 훅은 이제 이 컴포넌트 안에서만 돕니다.
  const { data: balanceData } = useReadContract({
    contract: melodyTokenContract,
    method: "balanceOf",
    params: [address || "0x0000000000000000000000000000000000000000"]
  });

  if (!address) return null;

  return (
    <div className="hidden sm:block text-xs font-mono text-blue-400 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 shadow-inner">
      {balanceData ? Number(formatEther(balanceData as bigint)).toLocaleString(undefined, {maximumFractionDigits:0}) : 0} MLD
    </div>
  );
}