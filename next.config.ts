// [수정 후: 깔끔해진 코드]
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
    exclude: [/_redirects/, /_headers/, /netlify.toml/], 
  },
});

const nextConfig: NextConfig = {
  // output: 'export', // (필요하면 주석 해제)
  reactStrictMode: true,
  
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