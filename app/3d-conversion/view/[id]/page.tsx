import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { ConversionDatabaseService } from '@/lib/services/conversion-database';
import Link from 'next/link';
import Model3DPreview from '@/components/ui/3d-conversion/Model3DPreview';
import ModelDownload from '@/components/ui/3d-conversion/ModelDownload';
import PrintPreparation from '@/components/ui/3d-conversion/PrintPreparation';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function ConversionViewPage({ params }: PageProps) {
  const supabase = createClient();
  const user = await getUser(supabase);

  if (!user) {
    return redirect('/signin?redirect=/3d-conversion/view/' + params.id);
  }

  const conversion = await ConversionDatabaseService.getConversionRecord(params.id);

  if (!conversion || conversion.user_id !== user.id) {
    return notFound();
  }

  return (
    <section className="min-h-screen bg-black">
      <div className="max-w-6xl px-4 py-8 mx-auto sm:px-6 sm:pt-24 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Conversion #{conversion.id.slice(-8)}
          </h1>
          <p className="text-zinc-400">
            Created {new Date(conversion.created_at).toLocaleDateString()}
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
                <Link href="/3d-conversion/history" className="ml-1 text-sm font-medium text-zinc-400 hover:text-white md:ml-2">History</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-3 h-3 text-zinc-400 mx-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 9 4-4-4-4"/>
                </svg>
                <span className="ml-1 text-sm font-medium text-white md:ml-2">View</span>
              </div>
            </li>
          </ol>
        </nav>

        {conversion.status === 'completed' && conversion.model_file_url ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 3D Model Preview */}
            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">3D Model Preview</h2>
              <Model3DPreview
                modelUrl={conversion.model_file_url}
                format={conversion.model_metadata?.original_format || 'ply'}
                onAccept={() => {}}
                onReject={() => {}}
                showControls={true}
                autoRotate={false}
              />
            </div>

            {/* Model Information and Actions */}
            <div className="space-y-6">
              {/* Model Metadata */}
              {conversion.model_metadata && (
                <div className="bg-zinc-900 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Model Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-400">Vertices:</span>
                      <span className="text-white ml-2">{conversion.model_metadata.vertices?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Faces:</span>
                      <span className="text-white ml-2">{conversion.model_metadata.faces?.toLocaleString()}</span>
                    </div>
                    {conversion.model_metadata.dimensions && (
                      <>
                        <div>
                          <span className="text-zinc-400">Width:</span>
                          <span className="text-white ml-2">{Math.round(conversion.model_metadata.dimensions.x)}mm</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Height:</span>
                          <span className="text-white ml-2">{Math.round(conversion.model_metadata.dimensions.y)}mm</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Depth:</span>
                          <span className="text-white ml-2">{Math.round(conversion.model_metadata.dimensions.z)}mm</span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Manifold:</span>
                          <span className={`ml-2 ${conversion.model_metadata.is_manifold ? 'text-green-400' : 'text-red-400'}`}>
                            {conversion.model_metadata.is_manifold ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Download Options */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Download Model</h3>
                <div className="space-y-3">
                  <a
                    href={`/api/3d-conversion/download/${conversion.id}?format=stl`}
                    className="block w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors text-center font-medium"
                    download
                  >
                    Download STL (Print Ready)
                  </a>
                  <a
                    href={`/api/3d-conversion/download/${conversion.id}?format=obj`}
                    className="block w-full px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors text-center font-medium"
                    download
                  >
                    Download OBJ (Editing)
                  </a>
                  <a
                    href={`/api/3d-conversion/download/${conversion.id}?format=ply`}
                    className="block w-full px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors text-center font-medium"
                    download
                  >
                    Download PLY (Original)
                  </a>
                </div>
              </div>

              {/* Print Preparation */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">3D Printing</h3>
                {conversion.model_metadata && (
                  <PrintPreparation 
                    conversionId={conversion.id}
                    modelMetadata={conversion.model_metadata}
                    onPrintReady={(result) => {
                      console.log('Print preparation complete:', result);
                    }}
                    defaultPrinterType="bambu_p1p"
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-lg p-12 text-center">
            {conversion.status === 'processing' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-zinc-600 border-t-pink-500 rounded-full animate-spin"></div>
                <h3 className="text-lg font-semibold text-white mb-2">Processing...</h3>
                <p className="text-zinc-400">Your 3D model is being generated. This may take a few minutes.</p>
              </>
            )}
            
            {conversion.status === 'failed' && (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">Conversion Failed</h3>
                <p className="text-zinc-400 mb-4">
                  {conversion.error_message || 'An error occurred during processing.'}
                </p>
                <Link 
                  href="/3d-conversion"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors"
                >
                  Try Again
                </Link>
              </>
            )}
            
            {conversion.status === 'uploading' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 border-4 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
                <h3 className="text-lg font-semibold text-white mb-2">Uploading...</h3>
                <p className="text-zinc-400">Your image is being uploaded and prepared for processing.</p>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <Link 
            href="/3d-conversion/history"
            className="inline-flex items-center px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to History
          </Link>
          
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
      </div>
    </section>
  );
}