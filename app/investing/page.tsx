'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Loader2, TrendingUp, ArrowUpRight, Play } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Link } from "@/lib/i18n";
import { formatEther } from 'viem';
import TradeModal from '../components/TradeModal';

// [Thirdweb Imports]
import { getContract } from "thirdweb";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { client, chain } from "@/utils/thirdweb";
import { UNLISTED_STOCK_ADDRESS, UNLISTED_STOCK_ABI } from '../constants';

// Contract Definition
const stockContract = getContract({
  client,
  chain,
  address: UNLISTED_STOCK_ADDRESS,
  abi: UNLISTED_STOCK_ABI as any
});

// Bonding curve helper (for chart visualization)
const generateCurveData = (currentSupply: number) => {
  const data = [];
  const max = Math.max(currentSupply * 1.5, 100);
  for (let i = 0; i <= max; i += Math.max(1, Math.floor(max / 20))) {
    data.push({ x: i, y: 0.001 * i });
  }
  return data;
};

export default function InvestingPage() {
  const account = useActiveAccount();
  const address = account?.address;

  const [marketItems, setMarketItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: tracks } = await supabase
        .from('tracks')
        .select('*')
        .eq('is_minted', true)
        .order('created_at', { ascending: false });
      setMarketItems(tracks || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans p-8">
      <header className="mb-12">
        <Link href="/market" className="text-zinc-500 hover:text-white text-sm mb-4 inline-block transition">
          ← Back to Market
        </Link>
        <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-2">
          MARKET MOVERS
        </h1>
        <p className="text-zinc-400">Live bonding curve status and portfolio tracking.</p>
      </header>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-sm">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
          <div className="col-span-4">Asset</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">My Shares</div>
          <div className="col-span-3 text-center">Curve Position</div>
          <div className="col-span-1 text-center">Action</div>
        </div>

        <div className="divide-y divide-zinc-800/50">
          {loading ? (
            <div className="p-20 text-center">
              <Loader2 className="animate-spin inline" />
            </div>
          ) : (
            marketItems.map((item, idx) => (
              <MarketRow key={item.id} item={item} rank={idx + 1} address={address} onTrade={() => setSelectedTrack(item)} />
            ))
          )}
        </div>
      </div>

      {/* Trade Modal */}
      {selectedTrack && (
        <TradeModal
          isOpen={!!selectedTrack}
          onClose={() => setSelectedTrack(null)}
          track={selectedTrack}
        />
      )}
    </div>
  );
}

function MarketRow({ item, rank, address, onTrade }: any) {
  const tokenIdBigInt = BigInt(item.token_id || item.id);

  const { data: priceVal } = useReadContract({
    contract: stockContract,
    method: "getBuyPrice",
    params: [tokenIdBigInt, BigInt(1 * 1e18)]
  });

  const { data: stockInfo } = useReadContract({
    contract: stockContract,
    method: "stocks",
    params: [tokenIdBigInt]
  });

  const { data: mySharesVal } = useReadContract({
    contract: stockContract,
    method: "sharesBalance",
    params: [tokenIdBigInt, address || "0x0000000000000000000000000000000000000000"]
  });

  const price = priceVal ? Number(formatEther(priceVal)) : 0;

  const supplyBigInt = Array.isArray(stockInfo) ? stockInfo[0] : undefined;
  const supply = supplyBigInt ? Number(formatEther(supplyBigInt)) : 0;

  const myShares = mySharesVal ? Number(formatEther(mySharesVal)) : 0;

  const chartData = generateCurveData(supply);

  return (
    <div className="p-4 hover:bg-zinc-800/40 transition group border-b border-zinc-800/50 last:border-0">
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-12 gap-4 items-center">
        <div className="col-span-4 flex items-center gap-4">
          <span className={`font-mono text-zinc-600 w-6 text-center ${rank <= 3 && 'text-yellow-500'}`}>{rank}</span>
          <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden">
            <img src={item.cover_image_url} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-bold text-white">{item.title}</div>
            <div className="text-xs text-zinc-500">{item.artist_name}</div>
          </div>
        </div>

        <div className="col-span-2 text-right">
          <div className="font-mono text-white font-bold">{price.toFixed(4)} MLD</div>
          <div className="text-[10px] text-green-500">Buy Now</div>
        </div>

        <div className="col-span-2 text-right">
          <div className={`font-mono font-bold ${myShares > 0 ? 'text-purple-400' : 'text-zinc-600'}`}>
            {myShares.toFixed(2)}
          </div>
        </div>

        <div className="col-span-3 h-12 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="y" stroke="#8884d8" fill={`url(#grad-${item.id})`} strokeWidth={2} isAnimationActive={false} />
              <ReferenceLine x={Math.floor(supply)} stroke="white" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 right-0 text-[9px] text-zinc-500 font-mono">
            Supply: {supply.toFixed(0)}
          </div>
        </div>

        <div className="col-span-1 text-center">
          <button onClick={onTrade} className="bg-white text-black p-2 rounded-full hover:scale-110 transition shadow-lg">
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between" onClick={onTrade}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
            <img src={item.cover_image_url} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${rank <= 3 ? 'text-yellow-500' : 'text-zinc-600'}`}>#{rank}</span>
              <div className="font-bold text-sm text-white truncate w-32">{item.title}</div>
            </div>
            <div className="text-xs text-zinc-500">{item.artist_name}</div>
            <div className="text-xs text-green-400 font-mono mt-0.5">{price.toFixed(4)} MLD</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="w-16 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="y" stroke="#8884d8" strokeWidth={2} fill="none" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <button className="bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-700">
            Trade
          </button>
        </div>
      </div>
    </div>
  );
}
