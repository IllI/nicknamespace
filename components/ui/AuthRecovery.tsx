'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthRecovery() {
  const [isRecovering, setIsRecovering] = useState(false);
  const router = useRouter();

  const handleAuthRecovery = async () => {
    setIsRecovering(true);
    
    try {
      // Clear any corrupted session data
      await supabase.auth.signOut();
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to sign in
      router.push('/signin');
      
    } catch (error) {
      console.error('Auth recovery failed:', error);
      // Force page reload as last resort
      window.location.href = '/signin';
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Authentication Issue</h1>
        <p className="text-zinc-400">
          There seems to be an authentication problem. Let's get you signed back in.
        </p>
        <button
          onClick={handleAuthRecovery}
          disabled={isRecovering}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg font-medium transition-colors"
        >
          {isRecovering ? 'Recovering...' : 'Sign In Again'}
        </button>
        <p className="text-sm text-zinc-500">
          This will clear your session and redirect you to the sign-in page.
        </p>
      </div>
    </div>
  );
}