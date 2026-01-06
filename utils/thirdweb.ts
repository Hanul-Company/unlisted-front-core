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
export const chain = defineChain({id:80002,rpc: "https://polygon-amoy-bor-rpc.publicnode.com"});

