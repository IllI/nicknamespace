'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import SimpleModelUpload from '@/components/ui/3d-printing/SimpleModelUpload';
import SimpleActiveJobs from '@/components/ui/3d-printing/SimpleActiveJobs';
import FileFormatGuide from '@/components/ui/3d-printing/FileFormatGuide';

interface PrintingDashboardClientProps {
  userId: string;
}

export default function PrintingDashboardClient({ userId }: PrintingDashboardClientProps) {
  const router = useRouter();

  const handleUploadComplete = (jobId: string, modelInfo: any) => {
    // Redirect to job tracking page
    router.push(`/3d-printing/job/${jobId}`);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Error is already displayed by the ModelUpload component
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            3D Printing Service
          </h1>
          <p className="text-zinc-400">
            Upload your 3D models and manage print jobs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Upload New Model
              </h2>
              <SimpleModelUpload
                userId={userId}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </div>
          </div>

          {/* Active Jobs Section */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Active Jobs
              </h2>
              <SimpleActiveJobs userId={userId} />
            </div>

            {/* Quick Actions */}
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
              <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/3d-printing/history')}
                  className="block w-full text-left px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-white">View Job History</div>
                  <div className="text-sm text-zinc-400">See all your past print jobs</div>
                </button>
                <button
                  onClick={() => router.push('/account')}
                  className="block w-full text-left px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-white">Account Settings</div>
                  <div className="text-sm text-zinc-400">Manage your account and storage</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* File Format Guide */}
        <div className="mt-12">
          <FileFormatGuide />
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-zinc-900 rounded-lg p-6 border border-zinc-700">
          <h3 className="text-lg font-medium text-white mb-4">Getting Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-blue-400 font-medium mb-2">1. Upload Model</div>
              <p className="text-sm text-zinc-400">
                Upload your 3D model in any supported format. Files are validated automatically.
              </p>
            </div>
            <div>
              <div className="text-blue-400 font-medium mb-2">2. Configure Settings</div>
              <p className="text-sm text-zinc-400">
                Choose material, quality, and other print settings for your model.
              </p>
            </div>
            <div>
              <div className="text-blue-400 font-medium mb-2">3. Track Progress</div>
              <p className="text-sm text-zinc-400">
                Monitor your print job in real-time from upload to completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}