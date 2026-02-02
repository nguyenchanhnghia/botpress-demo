'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginUatClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError('Please enter your email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/uat-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: value, password }),
      });

      if (!res.ok) {
        let msg = `Login failed (${res.status})`;
        try {
          const data = await res.json();
          msg = data?.error || data?.message || msg;
        } catch {
          // ignore
        }
        setError(msg);
        return;
      }

      router.push('/botChat');
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isLoading, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_0)] [background-size:22px_22px] opacity-60" />

      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-neutral-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse animation-delay-4000" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="w-full rounded-3xl p-[1px] shadow-[0_18px_60px_rgba(0,0,0,0.25)] bg-gradient-to-r from-[#ed1823] via-[#ffd234] to-[#e5e7eb]">
          <div className="relative rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/60 px-8 py-10 text-xs overflow-hidden">
            <div className="relative z-10">
              <div className="text-center">
                <div className="flex justify-center items-center mb-6 gap-3">
                  <Image
                    src="/images/logo_vietjetair.png"
                    alt="VietJet Logo"
                    width={130}
                    height={40}
                    className="object-contain"
                  />
                  <div className="w-px h-8 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
                  <Image
                    src="https://chatbotcdn.socialenable.co/vietjet-air/assets/images/amy-full-body.png"
                    alt="Amy"
                    width={40}
                    height={40}
                    className="object-cover rounded-full shadow-md shadow-red-200"
                  />
                </div>

                <div className="mb-3 flex justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 text-[10px] text-gray-100 shadow-md">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="uppercase tracking-[0.16em]">UAT • Email Login</span>
                  </div>
                </div>

                <div className="space-y-1 mb-6 mt-6">
                  <h1 className="text-2xl font-bold text-gray-900 text-left leading-tight">
                    Sign in (UAT)
                  </h1>
                  <p className="text-sm text-gray-600 text-left">
                    Enter your email. We’ll look it up in DynamoDB and start a session.
                  </p>
                </div>
              </div>

              {error && (
                <div role="alert" className="mt-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-[11px] text-left">
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <label className="block text-[11px] font-semibold text-gray-700">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@vietjetthai.com"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ed1823]/40"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </label>

                <label className="block text-[11px] font-semibold text-gray-700">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ed1823]/40"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#ed1823] hover:bg-[#c71218] hover:cursor-pointer shadow-lg shadow-rose-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ed1823]/60 disabled:opacity-60 transition"
                >
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full py-2 text-xs text-gray-600 hover:text-gray-900"
                  disabled={isLoading}
                >
                  Back to SSO login
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

