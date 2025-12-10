/**
 * Authentication hook with built-in rate limiting to prevent Supabase rate limit errors
 */
import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/utils/supabase-client';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

const AUTH_CACHE_DURATION = 30000; // 30 seconds
let authCache: { data: AuthState; timestamp: number } | null = null;

export function useAuthWithRateLimit() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const getAuth = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (authCache && (now - authCache.timestamp) < AUTH_CACHE_DURATION) {
      setAuthState(authCache.data);
      return authCache.data;
    }

    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        if (error.message.includes('rate limit')) {
          // Use cached data if available during rate limit
          if (authCache) {
            setAuthState(authCache.data);
            return authCache.data;
          }
          throw new Error('Authentication rate limited. Please wait a moment.');
        }
        throw error;
      }

      const newAuthState: AuthState = {
        user: session?.user || null,
        session,
        loading: false,
        error: null,
      };

      // Update cache
      authCache = {
        data: newAuthState,
        timestamp: now,
      };

      setAuthState(newAuthState);
      return newAuthState;

    } catch (error) {
      const errorState: AuthState = {
        user: null,
        session: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };

      setAuthState(errorState);
      return errorState;
    }
  }, []);

  useEffect(() => {
    getAuth();

    // Listen for auth changes (but with debouncing)
    let timeoutId: NodeJS.Timeout;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newAuthState: AuthState = {
          user: session?.user || null,
          session,
          loading: false,
          error: null,
        };

        // Update cache
        authCache = {
          data: newAuthState,
          timestamp: Date.now(),
        };

        setAuthState(newAuthState);
      }, 500); // 500ms debounce
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [getAuth]);

  return {
    ...authState,
    refresh: getAuth,
  };
}