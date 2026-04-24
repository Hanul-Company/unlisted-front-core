import { NextRequest, NextResponse } from "next/server";

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!;
const CHAIN_ID = 80002; // Polygon Amoy

// RPC 엔드포인트 우선순위 (thirdweb → drpc.org fallback)
const RPC_ENDPOINTS = [
  `https://${CHAIN_ID}.rpc.thirdweb.com/${THIRDWEB_CLIENT_ID}`,
  "https://polygon-amoy.drpc.org",
];

export async function POST(req: NextRequest) {
  const body = await req.text();

  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = RPC_ENDPOINTS[i];
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      // 성공 또는 정상적인 JSON-RPC 에러 응답
      if (res.ok) {
        const data = await res.json();

        // JSON-RPC 레벨에서 "freetier" 관련 차단인지 확인
        const hasFreeTierBlock =
          Array.isArray(data)
            ? data.some((r: any) => r.error?.message?.includes("freetier"))
            : data?.error?.message?.includes("freetier");

        if (hasFreeTierBlock && i < RPC_ENDPOINTS.length - 1) {
          // 무료 티어 차단 → 다음 RPC로 폴백
          console.warn(`[RPC Proxy] Free-tier block on ${rpcUrl}, falling back...`);
          continue;
        }

        return NextResponse.json(data);
      }

      // HTTP 에러 (429 rate-limit, 5xx 등) → 다음 RPC로 폴백
      if (i < RPC_ENDPOINTS.length - 1) {
        console.warn(`[RPC Proxy] ${rpcUrl} returned ${res.status}, falling back...`);
        continue;
      }

      // 마지막 RPC도 실패 → 그대로 반환
      return new NextResponse(await res.text(), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      // 네트워크 에러 → 다음 RPC로 폴백
      if (i < RPC_ENDPOINTS.length - 1) {
        console.warn(`[RPC Proxy] ${rpcUrl} network error, falling back...`);
        continue;
      }

      return NextResponse.json(
        { error: "All RPC endpoints failed" },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    { error: "No RPC endpoints configured" },
    { status: 500 }
  );
}
