'use client';

import React, { useState } from 'react';
import { ConversionRecord } from '@/lib/types/3d-conversion';
import { ImageUpload, ConversionStatus, Model3DPreview } from './index';

interface ConversionWorkflowProps {
  onConversionComplete?: (result: ConversionRecord) => void;
  onError?: (error: string) => void;
  className?: string;
}

const ConversionWorkflow: React.FC<ConversionWorkflowProps> = ({
  onConversionComplete,
  onError,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'preview'>('upload');
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionRecord | null>(null);

  const handleUploadComplete = (uploadId: string) => {
    setConversionId(uploadId);
    setCurrentStep('processing');
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    onError?.(error);
  };

  const handleConversionComplete = (result: ConversionRecord) => {
    setConversionResult(result);
    setCurrentStep('preview');
  };

  const handleConversionError = (error: string) => {
    console.error('Conversion error:', error);
    onError?.(error);
    // Reset to upload step on error
    setCurrentStep('upload');
    setConversionId(null);
  };

  const handleStartOver = () => {
    setCurrentStep('upload');
    setConversionId(null);
    setConversionResult(null);
  };

  const handleModelAccept = () => {
    if (conversionResult) {
      onConversionComplete?.(conversionResult);
    }
  };

  const handleModelReject = () => {
    // Reset to upload step to try with a different image
    handleStartOver();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {currentStep === 'upload' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-zinc-200 mb-2">
              Convert Image to 3D Model
            </h2>
            <p className="text-zinc-400">
              Upload a 2D image and our AI will convert it into a 3D model ready for printing.
            </p>
          </div>
          
          <ImageUpload
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </div>
      )}

      {currentStep === 'processing' && conversionId && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-200 mb-2">
                Converting to 3D Model
              </h2>
              <p className="text-zinc-400">
                Please wait while our AI processes your image...
              </p>
            </div>
            
            <button
              onClick={handleStartOver}
              className="text-sm text-zinc-400 hover:text-zinc-300 underline"
            >
              Start Over
            </button>
          </div>

          <ConversionStatus
            conversionId={conversionId}
            onComplete={handleConversionComplete}
            onError={handleConversionError}
          />
        </div>
      )}

      {currentStep === 'preview' && conversionResult && conversionResult.model_file_url && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-200 mb-2">
                Preview Your 3D Model
              </h2>
              <p className="text-zinc-400">
                Review the generated 3D model and decide if you want to proceed with print preparation.
              </p>
            </div>
            
            <button
              onClick={handleStartOver}
              className="text-sm text-zinc-400 hover:text-zinc-300 underline"
            >
              Start Over
            </button>
          </div>

          <Model3DPreview
            modelUrl={conversionResult.model_file_url}
            format={conversionResult.model_metadata?.original_format || 'ply'}
            onAccept={handleModelAccept}
            onReject={handleModelReject}
            showControls={true}
            autoRotate={false}
          />
        </div>
      )}
    </div>
  );
};

export default ConversionWorkflow;