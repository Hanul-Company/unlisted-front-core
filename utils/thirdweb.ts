import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
    throw new Error("No Thirdweb Client ID found in .env.local");
}

export const client = createThirdwebClient({
  clientId: clientId,
});

// Polygon Amoy Testnet 설정
// RPC 폴백 전략: thirdweb RPC (기본) → drpc.org (폴백)
// /api/rpc 프록시를 통해 자동 폴백 처리
const FALLBACK_RPC_PROXY =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc`
    : `https://80002.rpc.thirdweb.com/${clientId}`;

export const chain = defineChain({ id: 80002, rpc: FALLBACK_RPC_PROXY });

