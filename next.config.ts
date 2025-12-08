import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // [추가] 이 파일들은 캐싱하지 마라 (404 에러 방지)
    exclude: [/_redirects/, /_headers/, /netlify.toml/], 
  },
});

const nextConfig: NextConfig = {
  output: 'export',
  
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false 
    };
    
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };

    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    return config;
  },
  
  images: { unoptimized: true },
};

export default withPWA(nextConfig);