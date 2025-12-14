'use client';

import React from 'react';
import { Link } from "@/lib/i18n";
import { motion } from 'framer-motion';
import { Play, TrendingUp, Mic2, Radio, ArrowRight, Sparkles } from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* [수정] Background Gradients (Blue/Cyan Theme) */}
      <div className="fixed inset-0 pointer-events-none">
          {/* 왼쪽 위: 깊은 블루 */}
          <div className="absolute top-[-10%] left-[-20%] w-[70%] h-[70%] rounded-full bg-blue-900/20 blur-[120px] animate-pulse-slow"/>
          {/* 오른쪽 아래: 밝은 시안(Cyan) */}
          <div className="absolute bottom-[-10%] right-[-20%] w-[70%] h-[70%] rounded-full bg-cyan-900/20 blur-[150px] animate-pulse-slow delay-1000"/>
      </div>

      {/* Header Nav */}
      <header className="fixed top-0 w-full z-50 p-6 backdrop-blur-sm border-b border-white/5 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Sparkles className="text-cyan-400" size={24}/>
            {/* [수정] 로고 그라데이션 */}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500">
              UNLISTED
            </span>
        </div>
        <div className="flex gap-4">
            <Link href="/login">
                <button className="px-6 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 transition text-sm font-bold border border-white/10 text-zinc-300 hover:text-white">
                    Sign In
                </button>
            </Link>
            <Link href="/market">
                <button className="px-6 py-2.5 rounded-full bg-white text-black hover:scale-105 transition text-sm font-bold shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                    Launch App
                </button>
            </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 pt-20">
        <motion.div variants={stagger} initial="initial" animate="animate" className="text-center max-w-4xl mx-auto space-y-8 z-10">
            
            {/* [수정] Badge Color */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-500/30 backdrop-blur-md text-sm font-medium text-blue-300 mb-4">
                <Radio size={16} className="animate-pulse"/> The Music Never Existed
            </motion.div>

            {/* [수정] Headline Gradient */}
            <motion.h1 variants={fadeInUp} className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] bg-clip-text text-transparent bg-gradient-to-br from-white via-cyan-100 to-blue-600">
                Discover the <br/> Undiscovered.
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                아직 세상에 공개되지 않은 음악을 가장 먼저 듣고, 그 가능성에 투자하세요. <br className="hidden md:block"/>
                Unlisted는 미발매 음원과 금융이 만나는 새로운 시장입니다.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                {/* [수정] Main Button Gradient */}
                <Link href="/radio">
                    <button className="group relative px-10 py-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg font-bold overflow-hidden hover:scale-105 transition-all shadow-xl shadow-blue-900/30 w-full sm:w-auto text-white">
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Start Listening <Play fill="currentColor" size={20}/>
                        </span>
                        <div className="absolute inset-0 bg-white/20 blur-md group-hover:animate-shine"/>
                    </button>
                </Link>
                <Link href="/login">
                    <button className="px-10 py-5 rounded-full bg-zinc-900 border border-zinc-800 text-lg font-bold hover:bg-zinc-800 transition w-full sm:w-auto flex items-center justify-center gap-2 text-zinc-300 hover:text-white">
                        Create Profile
                    </button>
                </Link>
            </motion.div>
        </motion.div>

        {/* [수정] Visual Graph Color */}
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none z-0 opacity-60">
             <div className="w-full h-full bg-cover bg-center opacity-50 animate-pulse-slow" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%233B82F6' fill-opacity='0.2' d='M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`}}></div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
            <motion.h2 
                initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}}
                className="text-4xl md:text-5xl font-bold text-center mb-16"
            >
                More than streaming. <br/> It's <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Ownership.</span>
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[400px]">
                {/* Radio Card */}
                <motion.div initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.1}} className="md:col-span-2 rounded-[3rem] bg-zinc-900/50 border border-white/10 overflow-hidden relative group hover:border-blue-500/50 transition-all duration-500">
                    <Link href="/radio" className="absolute inset-0 z-20"></Link>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"/>
                    <div className="p-10 h-full flex flex-col justify-between relative z-10">
                        <Radio size={48} className="text-blue-400 mb-6"/>
                        <div><h3 className="text-3xl font-bold mb-4">Unlisted FM</h3><p className="text-zinc-400 text-lg max-w-sm">당신의 무드에 맞춰 AI가 엄선한 미발매 트랙을 디깅하세요.</p></div>
                        <div className="bg-black/50 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-white/5 group-hover:border-blue-500/30 transition"><div className="w-16 h-16 bg-zinc-800 rounded-xl animate-pulse"></div><div className="flex-1 space-y-2"><div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse"></div><div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse"></div></div><Play fill="white" size={32}/></div>
                    </div>
                </motion.div>

                {/* Invest Card */}
                <motion.div initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.2}} className="rounded-[3rem] bg-zinc-900/50 border border-white/10 overflow-hidden relative group hover:border-emerald-500/50 transition-all duration-500">
                    <Link href="/investing" className="absolute inset-0 z-20"></Link>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"/>
                    <div className="p-10 h-full flex flex-col justify-between relative z-10">
                        <TrendingUp size={48} className="text-emerald-400 mb-6"/>
                        <div><h3 className="text-3xl font-bold mb-4">Trade Melody</h3><p className="text-zinc-400 text-lg">멜로디의 가능성을 주식처럼 사고파세요.</p></div>
                        <div className="mt-8 flex items-center gap-2 text-emerald-400 font-bold"><TrendingUp size={20}/> +124.5% Growth</div>
                    </div>
                </motion.div>
                
                {/* Creator Card */}
                 <motion.div initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.3}} className="rounded-[3rem] bg-zinc-900/50 border border-white/10 overflow-hidden relative group hover:border-cyan-500/50 transition-all duration-500">
                    <Link href="/upload" className="absolute inset-0 z-20"></Link>
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"/>
                    <div className="p-10 h-full flex flex-col justify-between relative z-10">
                        <Mic2 size={48} className="text-cyan-400 mb-6"/>
                        <div><h3 className="text-3xl font-bold mb-4">For Creators</h3><p className="text-zinc-400 text-lg">복잡한 계약 없이 즉시 업로드하고 수익을 창출하세요.</p></div>
                        <div className="mt-8 inline-flex items-center gap-2 text-cyan-400 font-bold group-hover:translate-x-2 transition-transform">Start Uploading <ArrowRight size={20}/></div>
                    </div>
                </motion.div>

                 {/* Join Card */}
                 <motion.div initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}} transition={{delay:0.4}} className="md:col-span-2 rounded-[3rem] bg-gradient-to-r from-blue-600 to-indigo-800 border border-white/10 overflow-hidden relative p-10 flex items-center justify-between">
                    <div><h3 className="text-3xl font-bold mb-2">Join the hidden scene.</h3><p className="text-blue-100 text-lg">지금 가장 혁신적인 음악 커뮤니티의 일원이 되세요.</p></div>
                    <Link href="/login"><button className="px-8 py-4 bg-white text-black rounded-full font-bold hover:scale-105 transition shadow-xl">Get Started Now</button></Link>
                </motion.div>
            </div>
        </div>
      </section>

      <footer className="py-10 text-center text-zinc-600 text-sm border-t border-white/5 relative z-10 bg-black"><p>© 2024 UNLISTED. The Future of Sound Investment.</p></footer>
    </div>
  );
}