"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function TikTokCallbackContent() {
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");

    if (!code) return;

    // 서버로 authorization code 전달
    fetch("/api/tiktok/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("TikTok auth success", data);
        window.close(); // 또는 redirect
      })
      .catch(console.error);
  }, [params]);

  return (
    <div style={{ padding: 40 }}>
      Connecting your TikTok account...
    </div>
  );
}

export default function TikTokCallback() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading...</div>}>
      <TikTokCallbackContent />
    </Suspense>
  );
}
