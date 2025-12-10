'use client';

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import ImageUpload from './ImageUpload';
import ConversionStatus from './ConversionStatus';

interface ProductConversionIntegrationProps {
  user: User | null;
  productId?: string;
  productName?: string;
  className?: string;
}

export default function ProductConversionIntegration({
  user,
  productId,
  productName,
  className = ''
}: ProductConversionIntegrationProps) {
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  if (!user) {
    return (
      <div className={`bg-zinc-900 rounded-lg p-6 border border-zinc-800 ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-pink-500 to-violet-500 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Create 3D Model</h3>
          <p className="text-zinc-400 mb-6">
            Transform any image into a 3D model ready for printing
          </p>
          <Link
            href="/signin?redirect=/3d-conversion"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors font-medium"
          >
            Sign In to Convert
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 rounded-lg p-6 border border-zinc-800 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">3D Model Conversion</h3>
          <p className="text-zinc-400">
            {productName ? `Convert ${productName} to 3D model` : 'Transform your image into a 3D model'}
          </p>
        </div>
        
        {!showUpload && !conversionId && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Start Conversion
          </button>
        )}
      </div>

      {showUpload && !conversionId && (
        <div className="space-y-4">
          <ImageUpload
            onUploadComplete={(uploadId) => {
              setConversionId(uploadId);
              setShowUpload(false);
            }}
            onUploadError={(error) => {
              console.error('Upload error:', error);
            }}
            maxFileSize={10 * 1024 * 1024} // 10MB
            acceptedFormats={['image/png', 'image/jpeg', 'image/jpg']}
          />
          
          <button
            onClick={() => setShowUpload(false)}
            className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {conversionId && (
        <div className="space-y-4">
          <ConversionStatus
            conversionId={conversionId}
            onComplete={(conversion) => {
              // Handle completion - could redirect to view page or show success
              window.location.href = `/3d-conversion/view/${conversion.id}`;
            }}
            onError={(error) => {
              console.error('Conversion error:', error);
              // Reset to allow retry
              setConversionId(null);
              setShowUpload(false);
            }}
          />
          
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setConversionId(null);
                setShowUpload(false);
              }}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Start New Conversion
            </button>
            
            <Link
              href="/3d-conversion/history"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-lg hover:from-pink-600 hover:to-violet-600 transition-colors text-center"
            >
              View All Conversions
            </Link>
          </div>
        </div>
      )}

      {/* Feature highlights */}
      <div className="mt-6 pt-6 border-t border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-pink-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-zinc-300">AI-Powered</span>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-violet-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-zinc-300">Print Ready</span>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-zinc-300">Fast Processing</span>
          </div>
        </div>
      </div>
    </div>
  );
}