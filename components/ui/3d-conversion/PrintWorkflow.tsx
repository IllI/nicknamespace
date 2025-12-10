'use client';

import React, { useState } from 'react';
import PrintPreparation from './PrintPreparation';
import ModelDownload from './ModelDownload';
import { 
  ConversionRecord, 
  PrintPreparationResponse 
} from '@/lib/types/3d-conversion';

interface PrintWorkflowProps {
  conversionRecord: ConversionRecord;
  onWorkflowComplete?: () => void;
}

type WorkflowStep = 'preparation' | 'download' | 'complete';

const PrintWorkflow: React.FC<PrintWorkflowProps> = ({
  conversionRecord,
  onWorkflowComplete
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('preparation');
  const [printPreparationResult, setPrintPreparationResult] = useState<PrintPreparationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePrintReady = (result: PrintPreparationResponse) => {
    setPrintPreparationResult(result);
    setCurrentStep('download');
    setError(null);
  };

  const handleDownloadComplete = () => {
    setCurrentStep('complete');
    onWorkflowComplete?.();
  };

  const handleDownloadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const resetWorkflow = () => {
    setCurrentStep('preparation');
    setPrintPreparationResult(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-zinc-200">
            3D Print Preparation
          </h1>
          <button
            onClick={resetWorkflow}
            className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
          >
            Start Over
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Step 1: Preparation */}
          <div className={`flex items-center ${currentStep === 'preparation' ? 'text-violet-400' : currentStep === 'download' || currentStep === 'complete' ? 'text-green-400' : 'text-zinc-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'preparation' ? 'bg-violet-600 text-white' : 
              currentStep === 'download' || currentStep === 'complete' ? 'bg-green-600 text-white' : 
              'bg-zinc-700 text-zinc-400'
            }`}>
              {currentStep === 'download' || currentStep === 'complete' ? '✓' : '1'}
            </div>
            <span className="ml-2 font-medium">Print Preparation</span>
          </div>

          <div className={`flex-1 h-0.5 ${currentStep === 'download' || currentStep === 'complete' ? 'bg-green-400' : 'bg-zinc-700'}`}></div>

          {/* Step 2: Download */}
          <div className={`flex items-center ${currentStep === 'download' ? 'text-violet-400' : currentStep === 'complete' ? 'text-green-400' : 'text-zinc-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'download' ? 'bg-violet-600 text-white' : 
              currentStep === 'complete' ? 'bg-green-600 text-white' : 
              'bg-zinc-700 text-zinc-400'
            }`}>
              {currentStep === 'complete' ? '✓' : '2'}
            </div>
            <span className="ml-2 font-medium">Download Files</span>
          </div>

          <div className={`flex-1 h-0.5 ${currentStep === 'complete' ? 'bg-green-400' : 'bg-zinc-700'}`}></div>

          {/* Step 3: Complete */}
          <div className={`flex items-center ${currentStep === 'complete' ? 'text-green-400' : 'text-zinc-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'complete' ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'
            }`}>
              {currentStep === 'complete' ? '✓' : '3'}
            </div>
            <span className="ml-2 font-medium">Ready to Print</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-400 mr-2">⚠️</div>
            <div>
              <div className="text-red-400 font-medium">Error</div>
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'preparation' && (
          <PrintPreparation
            conversionId={conversionRecord.id}
            modelMetadata={conversionRecord.model_metadata!}
            onPrintReady={handlePrintReady}
          />
        )}

        {currentStep === 'download' && printPreparationResult && (
          <ModelDownload
            conversionRecord={conversionRecord}
            printPreparationResult={printPreparationResult}
            onDownloadComplete={handleDownloadComplete}
            onDownloadError={handleDownloadError}
          />
        )}

        {currentStep === 'complete' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-zinc-200 mb-2">
              Ready to Print!
            </h2>
            <p className="text-zinc-400 mb-6">
              Your 3D model has been prepared and optimized for printing. 
              You can now send the files to your 3D printer.
            </p>
            
            <div className="bg-zinc-800 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-medium text-zinc-200 mb-4">Next Steps</h3>
              <ol className="text-left text-zinc-300 space-y-2">
                <li>1. Load the STL file into your slicer</li>
                <li>2. Import the OrcaSlicer profile (if available)</li>
                <li>3. Review the print settings</li>
                <li>4. Slice and send to your printer</li>
                <li>5. Enjoy your 3D printed model!</li>
              </ol>
            </div>

            <div className="mt-6 space-x-4">
              <button
                onClick={resetWorkflow}
                className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
              >
                Prepare Another Model
              </button>
              <button
                onClick={onWorkflowComplete}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Information Sidebar */}
      <div className="mt-8 p-4 bg-zinc-800 rounded-lg">
        <h3 className="text-lg font-medium text-zinc-200 mb-3">Model Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-zinc-400">Status:</span>
            <div className={`font-medium ${conversionRecord.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>
              {conversionRecord.status.charAt(0).toUpperCase() + conversionRecord.status.slice(1)}
            </div>
          </div>
          
          {conversionRecord.model_metadata && (
            <>
              <div>
                <span className="text-zinc-400">Vertices:</span>
                <div className="text-zinc-200 font-medium">
                  {conversionRecord.model_metadata.vertices.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Faces:</span>
                <div className="text-zinc-200 font-medium">
                  {conversionRecord.model_metadata.faces.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Print Ready:</span>
                <div className={`font-medium ${conversionRecord.model_metadata.is_manifold ? 'text-green-400' : 'text-yellow-400'}`}>
                  {conversionRecord.model_metadata.is_manifold ? 'Yes' : 'Needs Repair'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintWorkflow;