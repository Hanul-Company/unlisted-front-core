'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Radio, Download, ArrowRight, Coins, Headphones, Sparkles, TrendingUp, Gift } from 'lucide-react';
import { usePWA } from './context/PWAContext';
import { motion, Variants } from 'framer-motion';

// ✅ [수정] Variant 선언을 컴포넌트 바깥 최상단으로 이동 (오류 해결 핵심)
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
};

// 2. 여기에 : Variants 타입 명시
const cardVariant: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export default function LandingPage() {
  // PWA 설치 기능 가져오기
  const { isInstallable, installApp } = usePWA();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[70%] rounded-full bg-blue-900/10 blur-[120px] animate-pulse-slow"/>
          <div className="absolute bottom-[-10%] right-[-20%] w-[70%] h-[70%] rounded-full bg-cyan-900/10 blur-[150px] animate-pulse-slow delay-1000"/>
      </div>

      {/* Header Nav */}
      <header className="fixed top-0 w-full z-50 p-6 backdrop-blur-md border-b border-white/5 flex justify-between items-center bg-black/50">
        <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 lowercase">
              unlisted
            </span>
        </div>
        
        <div className="flex gap-4">
            {/* ✅ [수정] PC(md 이상)에서는 Install 버튼 숨김 (모바일에서만 노출) */}
            <button 
                onClick={installApp}
                className="flex md:hidden items-center gap-2 px-5 py-2 rounded-full bg-white text-black hover:scale-105 transition text-sm font-bold shadow-[0_0_20px_rgba(56,189,248,0.3)]"
            >
                <Download size={16} /> Install App
            </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 pt-20">
        <motion.div variants={stagger} initial="initial" animate="animate" className="text-center max-w-4xl mx-auto space-y-6 z-10">
            
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-500/30 backdrop-blur-md text-xs font-medium text-blue-300 mb-2">
                <Radio size={14} className="animate-pulse"/> The music never existed
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-6xl md:text-8xl font-light tracking-tighter leading-[0.9] bg-clip-text text-transparent bg-gradient-to-br from-white via-cyan-100 to-blue-600 font-heading">
                For the music <br/> <span className="font-semibold">unlisted.</span>
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-lg font-light text-zinc-400 max-w-xl mx-auto leading-relaxed tracking-wide">
                Stream for free, Invest for fun. <br className="hidden md:block"/>
                <span className="text-cyan-200">unlisted</span> is a music market never existed.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 w-full">
                <Link href="/radio" className="w-full sm:w-auto">
                    <button className="group relative px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold overflow-hidden hover:scale-105 transition-all shadow-lg shadow-blue-900/30 text-white w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2">
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Start Streaming <Play fill="currentColor" size={14}/>
                        </span>
                        <div className="absolute inset-0 bg-white/20 blur-md group-hover:animate-shine"/>
                    </button>
                </Link>

                <Link href="/market" className="w-full sm:w-auto">
                    <button className="px-6 py-3 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-bold hover:bg-zinc-800 transition w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2 text-zinc-300 hover:text-white group">
                        Launch Market <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                    </button>
                </Link>
            </motion.div>
        </motion.div>

        {/* Hero Visual Graph */}
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none z-0 opacity-60">
             <div className="w-full h-full bg-cover bg-center opacity-50 animate-pulse-slow" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%233B82F6' fill-opacity='0.2' d='M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`}}></div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-24 px-6 z-10 bg-black/80 backdrop-blur-sm border-t border-white/5">
        <div className="max-w-6xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mb-16 text-center space-y-4"
            >
                <h2 className="text-3xl md:text-5xl font-light tracking-tighter">
                    How to <span className="text-blue-500 font-semibold">Play</span> & <span className="text-cyan-400 font-semibold">Earn</span>
                </h2>
                <p className="text-zinc-400 max-w-2xl mx-auto">
                    unlisted는 음악을 듣는 행위가 투자가 되는 새로운 시장입니다.<br/>
                    리스너에서 투자자로 성장하는 과정을 확인하세요.
                </p>
            </motion.div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Card 1: Radio & pMLD */}
                <motion.div 
                    variants={cardVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="col-span-1 md:col-span-1 bg-zinc-900/50 border border-white/10 p-8 rounded-3xl hover:border-blue-500/50 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Headphones size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400">
                            <Headphones size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white">1. Upload & Earn</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            <span className="text-blue-300 font-semibold">unlisted Player</span>에 음악을 등록하면 
                            <span className="text-white font-bold mx-1">MLD</span>가 자동으로 쌓입니다. 
                            지금 당신의 곡을 공유하고 포인트를 채굴하세요.
                        </p>
                        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-zinc-500">Reward</span>
                                <span className="text-blue-400 font-bold">+10 MLD / hour</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full w-2/3 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Card 2: Rental & Collection */}
                <motion.div 
                    variants={cardVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="col-span-1 md:col-span-1 bg-zinc-900/50 border border-white/10 p-8 rounded-3xl hover:border-cyan-500/50 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                         <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-6 text-cyan-400">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white">2. Rent to Own</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            광고 시청으로 모은 <span className="text-white font-bold mx-1">MLD</span>로 좋아하는 곡을 
                            <span className="text-cyan-300 font-semibold mx-1">Rental</span>하세요.
                            나만의 컬렉션을 완성하고 더 높은 등급의 투자 자격을 얻으세요.
                        </p>
                        <ul className="space-y-2 text-xs text-zinc-400">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                                <span>곡을 렌탈하면 내 컬렉션에 추가됩니다.</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                                <span>pMLD가 부족하면 MLD로도 결제 가능!</span>
                            </li>
                        </ul>
                    </div>
                </motion.div>

                 {/* Card 3: Investment (Wide) */}
                 <motion.div 
                    variants={cardVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="col-span-1 md:col-span-1 bg-gradient-to-br from-zinc-900/80 to-blue-900/20 border border-white/10 p-8 rounded-3xl hover:border-indigo-500/50 transition-colors group relative overflow-hidden"
                >
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white">3. Invest & Trade</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            이제 <span className="text-indigo-300 font-bold mx-1">MLD 토큰</span>으로 
                            음악의 지분(Shares)을 실제로 구매하세요. 주식처럼 거래하고 시세 차익을 노리세요.
                        </p>
                        <Link href="/market">
                            <button className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition flex items-center justify-center gap-2">
                                Go to Market <ArrowRight size={12}/>
                            </button>
                        </Link>
                    </div>
                </motion.div>

                {/* Card 4: Token Economy Guide (Full Width) */}
                <motion.div 
                    variants={cardVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="col-span-1 md:col-span-3 bg-zinc-900/30 border border-white/10 p-8 rounded-3xl relative overflow-hidden"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                             <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <Coins className="text-yellow-400"/> Token System
                             </h3>
                             <p className="text-zinc-400 text-sm mb-6">
                                unlisted는 두 가지 토큰이 하이브리드로 움직입니다.
                             </p>
                             
                             <div className="space-y-4">
                                {/* pMLD Info */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-blue-400 font-bold text-xs">P</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-blue-400 text-sm">pMLD (Points)</h4>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            음악 감상으로 무료 채굴. 렌탈에 사용되는 포인트. (Web2 Off-chain)
                                        </p>
                                    </div>
                                </div>

                                {/* MLD Info */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-indigo-400 font-bold text-xs">M</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-indigo-400 text-sm">MLD (Token)</h4>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            거래소에서 구매하거나 에어드랍으로 획득. 실제 투자는 이걸로! (ERC20 On-chain)
                                        </p>
                                    </div>
                                </div>
                             </div>
                        </div>

                        {/* Free Faucet Banner */}
                        <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 rounded-2xl p-6 border border-blue-500/30 text-center relative overflow-hidden">
                             <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-45 animate-shine pointer-events-none"/>
                             
                             <Gift size={48} className="mx-auto text-yellow-400 mb-4 animate-bounce-slow"/>
                             <h4 className="text-xl font-bold text-white mb-2">Want Free Tokens?</h4>
                             <p className="text-zinc-300 text-xs mb-6">
                                처음 오셨나요? Faucet에서 무료 pMLD와 테스트용 MLD를 받아보세요.
                             </p>
                             <Link href="/earn">
                                <button className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition shadow-lg shadow-blue-500/20 text-sm">
                                    Get Free Tokens
                                </button>
                             </Link>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
      </section>

      <footer className="py-8 text-center text-zinc-600 text-xs border-t border-white/5 relative z-10 bg-black">
        <p>© 2026 unlisted. The Future of Sound Investment.</p>
      </footer>
    </div>
  );
}