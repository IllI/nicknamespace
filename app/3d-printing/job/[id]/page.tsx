import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import JobTracker from '@/components/ui/3d-printing/JobTracker';

interface JobPageProps {
  params: {
    id: string;
  };
}

export default async function JobTrackingPage({ params }: JobPageProps) {
  const supabase = createClient();
  const user = await getUser(supabase);

  if (!user) {
    return redirect('/signin');
  }

  const jobId = params.id;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a
              href="/3d-printing"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </a>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Print Job Tracking
          </h1>
          <p className="text-zinc-400">
            Monitor your print job progress in real-time
          </p>
        </div>

        {/* Job Tracker Component */}
        <JobTracker jobId={jobId} userId={user.id} />

        {/* Additional Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
            <h3 className="text-lg font-medium text-white mb-4">Need Help?</h3>
            <div className="space-y-3 text-sm text-zinc-400">
              <p>• Print jobs typically take 1-4 hours depending on size and complexity</p>
              <p>• You'll receive real-time updates as your job progresses</p>
              <p>• Failed jobs can often be resubmitted with different settings</p>
              <p>• Contact support if your job is stuck for more than 30 minutes</p>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
            <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a
                href="/3d-printing"
                className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white"
              >
                Upload Another Model
              </a>
              <a
                href="/3d-printing/history"
                className="block w-full text-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-white"
              >
                View Job History
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}