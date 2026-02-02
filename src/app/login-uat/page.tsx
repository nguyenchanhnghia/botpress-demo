import { serverRuntimeConfig } from '@/lib/runtime-config/server';
import { redirect } from 'next/navigation';
import LoginUatClient from '@/app/login-uat/LoginUatClient';

export default function LoginUatPage() {
  const isUat = (serverRuntimeConfig.appEnv || '').toLowerCase() === 'uat';
  if (!isUat) {
    redirect('/login');
  }

  return <LoginUatClient />;
}

