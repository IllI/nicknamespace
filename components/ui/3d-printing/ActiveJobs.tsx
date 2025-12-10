'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { DirectPrintJob } from '@/lib/types/direct-print-jobs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ActiveJobsProps {
  userId: string;
}

const ActiveJobs: React.FC<ActiveJobsProps> = ({ userId }) => {
  const [jobs, setJobs] = useState<DirectPrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  
  const MIN_FETCH_INTERVAL = 5000; // 5 seconds minimum between fetches

  const fetchActiveJobs = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
      console.log('Skipping fetch due to rate limiting');
      return;
    }

    try {
      setLoading(true);
      setLastFetchTime(now);
      
      // Query print_jobs table directly using Supabase client
      // For now, return empty array if table doesn't exist
      let jobs = null;
      let error = null;
      
      try {
        const result = await supabase
          .from('print_jobs')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['pending', 'downloading', 'slicing', 'uploading', 'printing'])
          .order('created_at', { ascending: false })
          .limit(10);
        
        jobs = result.data;
        error = result.error;
      } catch (queryError) {
        console.warn('Query failed:', queryError);
        jobs = [];
        error = null; // Don't show error for missing table
      }
        
      if (error) {
        if (error.message.includes('rate limit')) {
          setError('Too many requests. Please wait a moment and try again.');
          setLastFetchTime(now + 10000); // Add 10 second penalty
        } else if (error.message.includes('does not exist')) {
          setError('Database table not set up yet. Please create the print_jobs table.');
        } else {
          setError(error.message || 'Failed to fetch active jobs');
        }
        setJobs([]);
      } else {
        setJobs(jobs || []);
        setError(null);
      }
    } catch (err) {
      setError('Network error while fetching jobs');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, lastFetchTime]);

  useEffect(() => {
    fetchActiveJobs();

    // Set up real-time subscription for user's jobs (with rate limiting)
    let subscription: any = null;
    
    try {
      subscription = supabase
        .channel(`user_print_jobs_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'print_jobs',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('Real-time job update:', payload);
            // Debounce real-time updates
            setTimeout(() => fetchActiveJobs(), 1000);
          }
        )
        .subscribe();
    } catch (subscriptionError) {
      console.warn('Real-time subscription failed:', subscriptionError);
      // Continue without real-time updates
    }

    return () => {
      if (subscription) {
        try {
          supabase.removeChannel(subscription);
        } catch (error) {
          console.warn('Error removing channel:', error);
        }
      }
    };
  }, [userId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'printing':
        return <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <div className="w-4 h-4 bg-zinc-400 rounded-full animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'printing':
        return 'text-blue-400';
      case 'pending':
        return 'text-yellow-400';
      default:
        return 'text-zinc-400';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-zinc-400">Loading active jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="flex items-center space-x-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">Error Loading Jobs</p>
            <p className="text-sm text-red-400 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchActiveJobs}
          className="mt-4 flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400 mb-2">No active print jobs</p>
          <p className="text-sm text-zinc-500">Upload a model to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700">
      <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
        <h3 className="font-medium text-white">Active Jobs ({jobs.length})</h3>
        <button
          onClick={fetchActiveJobs}
          className="text-zinc-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      <div className="divide-y divide-zinc-700">
        {jobs.map((job) => (
          <div key={job.id} className="p-4 hover:bg-zinc-800 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {getStatusIcon(job.status)}
                  <span className="font-medium text-white truncate">
                    {job.filename}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-zinc-400">
                  <span className={getStatusColor(job.status)}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                  <span>{formatTimeAgo(job.created_at)}</span>
                  <span>{(job.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>

                {job.error_message && (
                  <p className="text-sm text-red-400 mt-1 truncate">
                    {job.error_message}
                  </p>
                )}
              </div>

              <a
                href={`/3d-printing/job/${job.id}`}
                className="ml-4 flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors text-sm"
              >
                <span>View</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Progress indicator for active jobs */}
            {['downloading', 'slicing', 'uploading', 'printing'].includes(job.status) && (
              <div className="mt-3">
                <div className="w-full bg-zinc-700 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
                    style={{ 
                      width: job.status === 'downloading' ? '25%' : 
                             job.status === 'slicing' ? '50%' : 
                             job.status === 'uploading' ? '75%' : '90%' 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-700">
        <a
          href="/3d-printing/history"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View all jobs →
        </a>
      </div>
    </div>
  );
};

export default ActiveJobs;