import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { ConversionDatabaseService } from '@/lib/services/conversion-database';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default async function ConversionHistoryPage() {
  const supabase = createClient();
  const user = await getUser(supabase);

  if (!user) {
    return redirect('/signin?redirect=/3d-conversion/history');
  }

  const conversions = await ConversionDatabaseService.getUserConversionRecords(user.id);

  return (
    <section className="min-h-screen bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
        {/* Header */}
        <div className="sm:align-center sm:flex sm:flex-col mb-12">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Conversion History
          </h1>
          <p className="max-w-2xl m-auto mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl">
            View and manage your 3D model conversions
          </p>
        </div>

        {/* Breadcrumb Navigation */}
        <nav className="flex mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/" className="inline-flex items-center text-sm font-medium text-zinc-400 hover:text-white">
                <svg className="w-3 h-3 mr-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                  <path d="m19.707 9.293-2-2-7-7a1 1 0 0 0-1.414 0l-7 7-2 2a1 1 0 0 0 1.414 1.414L9 3.414V19a1 1 0 0 0 2 0V3.414l7.293 7.293a1 1 0 0 0 1.414-1.414Z"/>
                </svg>
                Home
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-3 h-3 text-zinc-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
                </svg>
                <Link href="/3d-conversion" className="ml-1 text-sm font-medium text-zinc-400 hover:text-white md:ml-2">3D Conversion</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-3 h-3 text-zinc-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
                </svg>
                <span className="ml-1 text-sm font-medium text-white md:ml-2">History</span>
              </div>
            </li>
          </ol>
        </nav>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-8">
          <Link 
            href="/3d-conversion"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversion
          </Link>
        </div>

        {/* Conversions List */}
        <div className="bg-zinc-900 rounded-lg overflow-hidden">
          {conversions.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-semibold text-white mb-2">No conversions yet</h3>
              <p className="text-zinc-400 mb-6">Start by uploading your first image to convert to 3D</p>
              <Link 
                href="/3d-conversion"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {conversions.map((conversion: any) => (
                <div key={conversion.id} className="p-6 hover:bg-zinc-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Status Indicator */}
                      <div className={`w-3 h-3 rounded-full ${
                        conversion.status === 'completed' ? 'bg-green-500' :
                        conversion.status === 'failed' ? 'bg-red-500' :
                        conversion.status === 'processing' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} />
                      
                      {/* Conversion Info */}
                      <div>
                        <h3 className="text-white font-medium">
                          Conversion #{conversion.id.slice(-8)}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          {formatDistanceToNow(new Date(conversion.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Status Badge */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        conversion.status === 'completed' ? 'bg-green-900 text-green-300' :
                        conversion.status === 'failed' ? 'bg-red-900 text-red-300' :
                        conversion.status === 'processing' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-blue-900 text-blue-300'
                      }`}>
                        {conversion.status.charAt(0).toUpperCase() + conversion.status.slice(1)}
                      </span>

                      {/* Actions */}
                      {conversion.status === 'completed' && conversion.model_file_url && (
                        <div className="flex space-x-2">
                          <Link
                            href={`/3d-conversion/view/${conversion.id}`}
                            className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors text-sm"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/3d-conversion/download/${conversion.id}?format=stl`}
                            className="px-3 py-1 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded hover:from-pink-600 hover:to-violet-600 transition-colors text-sm"
                            download
                          >
                            Download
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error Message */}
                  {conversion.status === 'failed' && conversion.error_message && (
                    <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded text-red-300 text-sm">
                      {conversion.error_message}
                    </div>
                  )}

                  {/* Model Info */}
                  {conversion.model_metadata && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-400">Vertices:</span>
                        <span className="text-white ml-2">{conversion.model_metadata.vertices?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Faces:</span>
                        <span className="text-white ml-2">{conversion.model_metadata.faces?.toLocaleString()}</span>
                      </div>
                      {conversion.model_metadata.dimensions && (
                        <div>
                          <span className="text-zinc-400">Size:</span>
                          <span className="text-white ml-2">
                            {Math.round(conversion.model_metadata.dimensions.x)}×
                            {Math.round(conversion.model_metadata.dimensions.y)}×
                            {Math.round(conversion.model_metadata.dimensions.z)}mm
                          </span>
                        </div>
                      )}
                      {conversion.print_metadata && (
                        <div>
                          <span className="text-zinc-400">Print Time:</span>
                          <span className="text-white ml-2">
                            {Math.round(conversion.print_metadata.estimated_print_time_minutes / 60)}h {conversion.print_metadata.estimated_print_time_minutes % 60}m
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}