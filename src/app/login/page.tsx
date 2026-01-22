'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';
import Image from 'next/image';
import Typewriter from '@/components/common/TypeWriter';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const TAGLINES = [
    'Banh Mi 🥖 – your VietJet Thailand Employee Support AI',
    'Ask Banh Mi about policies, SOPs, and internal processes',
    'Banh Mi helps you find answers faster, my colleague',
    'Designed for TVJ employees only – secure and internal',
  ];

  // Parse error param from query string
  useEffect(() => {
    if (auth.isAuthenticated()) {
      router.push('/botChat');
      return;
    }
    const e = params.get('error');
    if (!e) return;

    // Check if there's a custom error message in the query params
    const errorMessage = params.get('message');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
      return;
    }

    const map: Record<string, string> = {
      oauth_error: 'OAuth authentication failed.',
      no_code: 'No authorization code received.',
      auth_failed: 'Authentication failed.',
      token_exchange_failed: 'Token exchange failed.',
      callback_error: 'Callback error occurred.',
      token_expired: 'Your session has expired. Please log in again.',
      no_token: 'No authentication token found. Please log in.',
      invalid_token: 'Invalid authentication token. Please log in again.',
      user_creation_failed: 'Failed to create user account. Please try again or contact support.',
    };
    setError(map[e] ?? 'An unknown error occurred.');
  }, [params, router]);

  const handleLogin = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      window.location.href = '/api/auth/login'; // server-side redirect to IdP
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate login.');
      setIsLoading(false);
    }
  }, [isLoading]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* ===== Subtle grid background ===== */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_0)] [background-size:22px_22px] opacity-60" />

      {/* ===== Animated background blobs ===== */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-neutral-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-floatPulse animation-delay-4000" />
      </div>

      {/* ===== Login Card ===== */}
      <div className="relative w-full max-w-md">
        {/* Outer animated border – conic gradient + rotate */}
        <div
          className="
            animate-rotate-border-dynamic
            w-full max-w-md rounded-3xl p-[1px]
            shadow-[0_18px_60px_rgba(0,0,0,0.25)]
            bg-conic/[from_var(--border-angle)]
            from-[#ed1823] via-[#ffd234] to-[#e5e7eb]
            transition-all duration-500 ease-out
            hover:scale-[1.02]
          "
        >
          {/* Inner card with moving glow */}
          <div className="relative rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/60 px-8 py-10 text-xs overflow-hidden">
            {/* Soft moving glow layer */}
            <div className="tvj-animated-card-glow pointer-events-none" />

            {/* Content wrapper (above glow) */}
            <div className="relative z-10">

              <div className="text-center">
                {/* Logo row */}
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

                {/* Status pill */}
                <div className="mb-3 flex justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 text-[10px] text-gray-100 shadow-md">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="uppercase tracking-[0.16em]">
                      Banh Mi • Employee Support AI
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1 mb-1 mt-8">
                  <h1 className="text-3xl font-bold text-gray-900 text-left leading-tight">
                    Meet <span className="text-[#d62323]">Banh Mi</span>
                  </h1>
                  <h2 className="text-sm font-medium text-gray-500 text-right tracking-wide">
                    VietJet Thailand Employee Support AI
                  </h2>
                </div>

                {/* Animated tagline (typewriter) */}
                <div className="mt-8 h-5 text-left">
                  <Typewriter
                    texts={TAGLINES}
                    typingSpeed={70}
                    deletingSpeed={35}
                    pauseTime={1000}
                  >
                    {(text: string) => (
                      <p className="text-[11px] font-mono text-gray-500 tracking-tight flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        <span>{text}</span>
                      </p>
                    )}
                  </Typewriter>
                </div>
              </div>

              {/* Error box */}
              {error && (
                <div
                  role="alert"
                  className="mt-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-[11px] text-left"
                >
                  {error}
                </div>
              )}

              {/* Divider line */}
              <div className="mt-1 mb-6 h-px bg-gradient-to-r from-transparent via-[#d62323] to-transparent" />

              {/* Description + button */}
              <p className="text-sm text-gray-600 text-left">
                Sign in with your VietJet email to chat with Banh Mi and get internal support.
              </p>

              <div className="mt-3">
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#ed1823] hover:bg-[#c71218] hover:cursor-pointer shadow-lg shadow-rose-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ed1823]/60 disabled:opacity-60 transition"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 fill-current"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Zm2 .5v.382l8 5.333 8-5.333V7H4Zm16 2.118-7.35 4.893a1.5 1.5 0 0 1-1.3 0L4 9.118V17.5A.5.5 0 0 0 4.5 18h15a.5.5 0 0 0 .5-.5V9.118Z" />
                      </svg>
                      Sign in with VietJet Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}