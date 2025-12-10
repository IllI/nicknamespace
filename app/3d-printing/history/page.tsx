import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import JobHistory from '@/components/ui/3d-printing/JobHistory';

export default async function PrintingHistoryPage() {
  const supabase = createClient();
  const user = await getUser(supabase);

  if (!user) {
    return redirect('/signin');
  }

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
            Print Job History
          </h1>
          <p className="text-zinc-400">
            View and manage all your 3D printing jobs
          </p>
        </div>

        {/* Job History Component */}
        <JobHistory userId={user.id} />
      </div>
    </div>
  );
}