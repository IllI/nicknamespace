'use client';

import React, { useState } from 'react';
import { 
  ConversionRecord, 
  PrintPreparationResponse 
} from '@/lib/types/3d-conversion';

interface ModelDownloadProps {
  conversionRecord: ConversionRecord;
  printPreparationResult?: PrintPreparationResponse;
  onDownloadStart?: (format: string) => void;
  onDownloadComplete?: (format: string) => void;
  onDownloadError?: (error: string) => void;
}

interface DownloadOption {
  format: 'stl' | 'obj' | 'ply';
  variant: 'original' | 'print-ready' | 'repaired';
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
  fileSize?: string;
  compatibility: string[];
}

const ModelDownload: React.FC<ModelDownloadProps> = ({
  conversionRecord,
  printPreparationResult,
  onDownloadStart,
  onDownloadComplete,
  onDownloadError
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // Define available download options
  const downloadOptions: DownloadOption[] = [
    {
      format: 'stl',
      variant: 'print-ready',
      name: 'STL (Print Ready)',
      description: 'Optimized for 3D printing with Bambu P1P settings',
      icon: '🖨️',
      recommended: true,
      fileSize: '~2-5MB',
      compatibility: ['OrcaSlicer', 'PrusaSlicer', 'Cura', 'Bambu Studio']
    },
    {
      format: 'stl',
      variant: 'original',
      name: 'STL (Original)',
      description: 'Standard STL format without printer-specific optimizations',
      icon: '📐',
      fileSize: '~2-5MB',
      compatibility: ['All 3D Slicers', 'CAD Software']
    },
    {
      format: 'obj',
      variant: 'original',
      name: 'OBJ (Editable)',
      description: 'Wavefront OBJ format for editing in 3D software',
      icon: '✏️',
      fileSize: '~3-8MB',
      compatibility: ['Blender', 'Maya', 'Fusion 360', 'Tinkercad']
    },
    {
      format: 'ply',
      variant: 'original',
      name: 'PLY (Original)',
      description: 'Original format from TripoSR with vertex colors',
      icon: '🎨',
      fileSize: '~5-15MB',
      compatibility: ['MeshLab', 'CloudCompare', 'Blender']
    }
  ];

  // Handle file download
  const handleDownload = async (option: DownloadOption) => {
    const downloadKey = `${option.format}-${option.variant}`;
    
    try {
      setDownloadingFormat(downloadKey);
      setDownloadProgress(prev => ({ ...prev, [downloadKey]: 0 }));
      onDownloadStart?.(downloadKey);

      // Construct download URL with query parameters
      const params = new URLSearchParams({
        format: option.format,
        variant: option.variant,
        ...(option.format === 'stl' && option.variant === 'print-ready' && { printer: 'bambu_p1p' })
      });

      const downloadUrl = `/api/3d-conversion/download/${conversionRecord.id}?${params.toString()}`;

      // Create a temporary link to trigger download
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `model-${conversionRecord.id}.${option.format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      
      setDownloadProgress(prev => ({ ...prev, [downloadKey]: 100 }));
      onDownloadComplete?.(downloadKey);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      onDownloadError?.(errorMessage);
      console.error('Download error:', error);
    } finally {
      setDownloadingFormat(null);
      // Clear progress after a delay
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[downloadKey];
          return newProgress;
        });
      }, 2000);
    }
  };

  // Handle OrcaSlicer profile download
  const handleOrcaSlicerDownload = async () => {
    if (!printPreparationResult?.orcaslicer_profile_url) {
      onDownloadError?.('OrcaSlicer profile not available');
      return;
    }

    try {
      setDownloadingFormat('orcaslicer-profile');
      onDownloadStart?.('orcaslicer-profile');

      const response = await fetch(printPreparationResult.orcaslicer_profile_url);
      
      if (!response.ok) {
        throw new Error(`Profile download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `bambu-p1p-profile-${conversionRecord.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      onDownloadComplete?.('orcaslicer-profile');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile download failed';
      onDownloadError?.(errorMessage);
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Get file size estimate based on model metadata
  const getEstimatedFileSize = (format: string, variant: string): string => {
    if (!conversionRecord.model_metadata) return 'Unknown';
    
    const { vertices, faces } = conversionRecord.model_metadata;
    const complexity = (vertices + faces) / 1000; // Rough complexity metric
    
    switch (format) {
      case 'stl':
        return `~${Math.max(1, Math.round(complexity * 0.05))}MB`;
      case 'obj':
        return `~${Math.max(2, Math.round(complexity * 0.08))}MB`;
      case 'ply':
        return `~${Math.max(3, Math.round(complexity * 0.12))}MB`;
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="w-full bg-zinc-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          Download 3D Model
        </h2>
        <p className="text-zinc-400 text-sm">
          Choose the format that best suits your needs
        </p>
      </div>

      {/* Download Options */}
      <div className="space-y-4 mb-6">
        {downloadOptions.map((option) => {
          const downloadKey = `${option.format}-${option.variant}`;
          const isDownloading = downloadingFormat === downloadKey;
          const progress = downloadProgress[downloadKey] || 0;
          const estimatedSize = getEstimatedFileSize(option.format, option.variant);

          return (
            <div
              key={downloadKey}
              className={`p-4 border rounded-lg transition-colors ${
                option.recommended 
                  ? 'border-violet-600 bg-violet-900/20' 
                  : 'border-zinc-700 bg-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">{option.icon}</span>
                    <div>
                      <h3 className="font-medium text-zinc-200 flex items-center">
                        {option.name}
                        {option.recommended && (
                          <span className="ml-2 px-2 py-1 bg-violet-600 text-white text-xs rounded">
                            Recommended
                          </span>
                        )}
                      </h3>
                      <p className="text-zinc-400 text-sm">{option.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-400">File Size:</span>
                      <span className="ml-2 text-zinc-200">{estimatedSize}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Format:</span>
                      <span className="ml-2 text-zinc-200 uppercase">{option.format}</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <span className="text-zinc-400 text-sm">Compatible with:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {option.compatibility.map((app) => (
                        <span
                          key={app}
                          className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Download Progress */}
                  {isDownloading && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-zinc-400">Downloading...</span>
                        <span className="text-zinc-300">{progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-700 rounded-full h-2">
                        <div
                          className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDownload(option)}
                  disabled={isDownloading || downloadingFormat !== null}
                  className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isDownloading
                      ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                      : downloadingFormat !== null
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      : option.recommended
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200'
                  }`}
                >
                  {isDownloading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Downloading
                    </div>
                  ) : (
                    'Download'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* OrcaSlicer Profile Download */}
      {printPreparationResult?.orcaslicer_profile_url && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-zinc-200 mb-3">Printer Profiles</h3>
          
          <div className="p-4 border border-zinc-700 bg-zinc-800 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">⚙️</span>
                  <div>
                    <h3 className="font-medium text-zinc-200">
                      OrcaSlicer Profile (Bambu P1P)
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      Pre-configured slicer settings optimized for your model
                    </p>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-zinc-400">Includes:</span>
                  <span className="ml-2 text-zinc-200">
                    Layer height, infill, supports, and material settings
                  </span>
                </div>

                <div className="mt-2">
                  <span className="text-zinc-400 text-sm">Compatible with:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded">
                      OrcaSlicer
                    </span>
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded">
                      Bambu Studio
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOrcaSlicerDownload}
                disabled={downloadingFormat === 'orcaslicer-profile' || downloadingFormat !== null}
                className={`ml-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                  downloadingFormat === 'orcaslicer-profile'
                    ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                    : downloadingFormat !== null
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {downloadingFormat === 'orcaslicer-profile' ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Downloading
                  </div>
                ) : (
                  'Download Profile'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h3 className="text-lg font-medium text-zinc-200 mb-3">Usage Instructions</h3>
        
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-zinc-300 mb-1">For 3D Printing:</h4>
            <ol className="text-zinc-400 space-y-1 ml-4">
              <li>1. Download the <strong>STL (Print Ready)</strong> file</li>
              <li>2. Download the <strong>OrcaSlicer Profile</strong> if using Bambu printers</li>
              <li>3. Import both files into your slicer software</li>
              <li>4. Review settings and slice the model</li>
              <li>5. Send to your 3D printer</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-zinc-300 mb-1">For Editing:</h4>
            <ol className="text-zinc-400 space-y-1 ml-4">
              <li>1. Download the <strong>OBJ (Editable)</strong> or <strong>PLY (Original)</strong> file</li>
              <li>2. Import into your preferred 3D modeling software</li>
              <li>3. Make desired modifications</li>
              <li>4. Export as STL for printing</li>
            </ol>
          </div>

          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded">
            <div className="text-blue-400 font-medium mb-1">💡 Pro Tip</div>
            <div className="text-blue-300 text-sm">
              The print-ready STL includes optimizations for better adhesion and reduced warping. 
              Always use this version for the best printing results.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelDownload;