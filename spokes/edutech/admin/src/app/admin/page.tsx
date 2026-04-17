'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('tenant_session');
    if (sessionData) {
      // User is logged in, redirect to dashboard
      router.push('/admin/dashboard');
    } else {
      // User is not logged in, redirect to login
      router.push('/admin/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}