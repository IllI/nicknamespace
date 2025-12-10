'use client';

import React, { useState, useEffect } from 'react';

interface SimpleActiveJobsProps {
  userId: string;
}

export default function SimpleActiveJobs({ userId }: SimpleActiveJobsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchJobs() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/3d-printing/jobs?user_id=${userId}&status=active`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(result.error || 'Failed to load jobs');
        } else {
          setJobs(result.jobs || []);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load jobs');
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-zinc-700 rounded"></div>
            <div className="h-3 bg-zinc-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <h3 className="text-lg font-medium text-white mb-4">Active Jobs</h3>
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">Error loading jobs</div>
          <div className="text-sm text-zinc-500">{error}</div>
          <div className="text-xs text-zinc-500 mt-2">
            Make sure the direct_print_jobs table exists in Supabase
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
      <h3 className="text-lg font-medium text-white mb-4">Active Jobs</h3>
      
      {jobs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-zinc-400 mb-2">No active print jobs</div>
          <div className="text-sm text-zinc-500">
            Upload a model to start your first print job
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-zinc-800 rounded-lg p-4 border border-zinc-600">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-white truncate">{job.filename}</div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  job.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                  job.status === 'printing' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-900 text-gray-300'
                }`}>
                  {job.status}
                </div>
              </div>
              <div className="text-sm text-zinc-400">
                {Math.round(job.file_size_bytes / 1024)} KB • {new Date(job.created_at).toLocaleDateString()}
              </div>
              {job.error_message && (
                <div className="text-xs text-red-400 mt-2">{job.error_message}</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 text-xs text-zinc-500">
        <p>Jobs are tracked in the direct_print_jobs table</p>
        <p>Status updates in real-time as jobs progress</p>
      </div>
    </div>
  );
}