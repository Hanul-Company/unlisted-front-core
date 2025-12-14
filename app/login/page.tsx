'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from "@/lib/i18n";
import { Mail, Lock, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // --- 회원가입 로직 ---
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // 이메일 인증 후 돌아올 주소 (중요!)
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });

        if (error) throw error;

        // [핵심] 세션이 바로 생기면(인증 불필요 설정 시) -> 바로 이동
        if (data.session) {
            toast.success("가입 성공! 환영합니다.");
            router.push('/onboarding');
        } 
        // [핵심] 세션이 없으면(이메일 인증 필요 시) -> 토스트 띄우고 대기
        else if (data.user && !data.session) {
            toast.success("인증 메일을 발송했습니다! 메일함을 확인해주세요.", {
                duration: 6000,
                icon: '📧',
            });
            // 폼 초기화는 선택사항
        }

      } else {
        // --- 로그인 로직 ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success("로그인되었습니다!");
        
        // 프로필이 있는지 확인 후 없으면 온보딩, 있으면 마켓으로
        const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', data.user.id).maybeSingle();
        
        if (profile) {
            router.push('/market');
        } else {
            router.push('/onboarding');
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
            UNLISTED
          </h1>
          <p className="text-zinc-400">The Future of Music Investment</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-zinc-500" size={18}/>
              <input 
                type="email" placeholder="Email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-zinc-500" size={18}/>
              <input 
                type="password" placeholder="Password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded-xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none transition"
              />
            </div>

            <button disabled={loading} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:scale-[1.02] transition flex justify-center items-center gap-2">
              {loading ? <Loader2 className="animate-spin"/> : (isSignUp ? 'Sign Up' : 'Log In')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            {isSignUp ? "Already have an account?" : "New to Unlisted?"}
            <button onClick={() => setIsSignUp(!isSignUp)} className="ml-2 text-blue-400 hover:underline">
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </div>
        </div>
        
        <div className="text-center">
            <Link href="/market" className="text-zinc-600 text-sm hover:text-zinc-400 transition">
                Skip to Market (Guest) →
            </Link>
        </div>
      </div>
    </div>
  );
}