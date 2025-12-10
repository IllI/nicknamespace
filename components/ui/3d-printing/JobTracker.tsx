'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Download,
  RotateCcw,
  Play,
  Pause,
  Loader2,
  Upload,
  Scissors,
  Printer,
  Timer,
  TrendingUp,
  Info,
  Eye
} from 'lucide-react';
import { DirectPrintJob, StatusUpdate, PrintSettings } from '@/lib/types/direct-print-jobs';
import { Button } from '@/components/ui/button';
import PrintJobManager from '@/components/ui/3d-printing/PrintJobManager';
import Model3DPreview from '@/components/ui/3d-printing/Model3DPreview';
import ReprintDialog from '@/components/ui/3d-printing/ReprintDialog';

interface JobTrackerProps {
  jobId: string;
  userId: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const JobTracker: React.FC<JobTrackerProps> = ({ jobId, userId }) => {
  const [job, setJob] = useState<DirectPrintJob | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusUpdate[]>([]);
  const [estimatedCompletion, setEstimatedCompletion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintManager, setShowPrintManager] = useState(false);
  const [showReprintDialog, setShowReprintDialog] = useState(false);
  const [showModelPreview, setShowModelPreview] = useState(false);
  const [modelPreviewUrl, setModelPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch job status
  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/3d-printing/status/${jobId}`);
      const data = await response.json();

      if (data.success) {
        setJob(data.job);
        setStatusHistory(data.statusHistory || []);
        setEstimatedCompletion(data.estimatedCompletion || null);
        setError(null);
        setIsConnected(true);
        setLastUpdated(new Date());
      } else {
        setError(data.error?.message || 'Failed to fetch job status');
        setIsConnected(false);
      }
    } catch (err) {
      setError('Network error while fetching job status');
      setIsConnected(false);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Set up real-time subscription and polling
  useEffect(() => {
    // Initial fetch
    fetchJobStatus();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`direct_print_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_print_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          const updatedJob = payload.new as DirectPrintJob;
          setJob(updatedJob);
          
          // Refresh full status to get updated history
          fetchJobStatus();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to job updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Subscription error, falling back to polling');
        }
      });

    // Set up polling for active jobs as backup
    let pollInterval: NodeJS.Timeout | null = null;
    
    const startPolling = () => {
      if (job && ['downloading', 'slicing', 'uploading', 'printing'].includes(job.status)) {
        pollInterval = setInterval(() => {
          fetchJobStatus();
        }, 5000); // Poll every 5 seconds for active jobs
      }
    };

    // Start polling if job is active
    if (job) {
      startPolling();
    }

    // Cleanup subscription and polling
    return () => {
      supabase.removeChannel(subscription);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [jobId, fetchJobStatus, job?.status]);

  const getStatusIcon = (status: string, isActive: boolean = false) => {
    const iconClass = `w-5 h-5 ${isActive ? 'animate-pulse' : ''}`;
    
    switch (status) {
      case 'complete':
        return <CheckCircle className={`${iconClass} text-green-400`} />;
      case 'failed':
        return <XCircle className={`${iconClass} text-red-400`} />;
      case 'printing':
        return <Printer className={`${iconClass} text-blue-400 ${isActive ? 'animate-bounce' : ''}`} />;
      case 'uploading':
        return <Upload className={`${iconClass} text-purple-400`} />;
      case 'slicing':
        return <Scissors className={`${iconClass} text-orange-400`} />;
      case 'downloading':
        return <Download className={`${iconClass} text-cyan-400`} />;
      case 'pending':
        return <Pause className={`${iconClass} text-yellow-400`} />;
      case 'cleanup_pending':
        return <Loader2 className={`${iconClass} text-zinc-400 animate-spin`} />;
      default:
        return <Clock className={`${iconClass} text-zinc-400`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'printing':
        return 'text-blue-400';
      case 'uploading':
        return 'text-purple-400';
      case 'slicing':
        return 'text-orange-400';
      case 'downloading':
        return 'text-cyan-400';
      case 'pending':
        return 'text-yellow-400';
      case 'cleanup_pending':
        return 'text-zinc-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getStatusProgress = (status: string): number => {
    switch (status) {
      case 'pending':
        return 0;
      case 'downloading':
        return 20;
      case 'slicing':
        return 40;
      case 'uploading':
        return 60;
      case 'printing':
        return 80;
      case 'complete':
        return 100;
      case 'failed':
        return 0;
      case 'cleanup_pending':
        return 95;
      default:
        return 0;
    }
  };

  const getStatusDescription = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Job created and waiting for submission';
      case 'downloading':
        return 'Print service is downloading your model file';
      case 'slicing':
        return 'Model is being processed and sliced for printing';
      case 'uploading':
        return 'Sliced file is being uploaded to the printer';
      case 'printing':
        return 'Your model is currently being printed';
      case 'complete':
        return 'Print job completed successfully';
      case 'failed':
        return 'Print job encountered an error';
      case 'cleanup_pending':
        return 'Job completed, cleaning up temporary files';
      default:
        return `Current status: ${status}`;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const calculateTimeRemaining = (estimatedCompletion: string): string => {
    const now = new Date();
    const completion = new Date(estimatedCompletion);
    const diffMs = completion.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Completing soon...';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return formatDuration(diffMinutes);
  };

  const getElapsedTime = (startTime: string): string => {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return formatDuration(diffMinutes);
  };

  const ProgressBar: React.FC<{ progress: number; status: string }> = ({ progress, status }) => (
    <div className="w-full bg-zinc-700 rounded-full h-2 mb-4">
      <div 
        className={`h-2 rounded-full transition-all duration-500 ease-out ${
          status === 'failed' ? 'bg-red-500' : 
          status === 'complete' ? 'bg-green-500' : 
          'bg-blue-500'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );

  const handleSubmitJob = () => {
    setShowPrintManager(true);
  };

  const handleJobSubmitted = () => {
    setShowPrintManager(false);
    fetchJobStatus(); // Refresh status
  };

  const handleDownloadModel = async () => {
    try {
      const response = await fetch(`/api/3d-printing/download/${jobId}?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError(data.error?.message || 'Failed to download model');
      }
    } catch (err) {
      setError('Network error while downloading model');
      console.error('Download error:', err);
    }
  };

  const handleReprint = async (originalJobId: string, printSettings?: Partial<PrintSettings>) => {
    try {
      const response = await fetch('/api/3d-printing/reprint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalJobId,
          printSettings,
          userId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the new job page
        window.location.href = `/3d-printing/job/${data.jobId}`;
      } else {
        throw new Error(data.error?.message || 'Failed to create reprint job');
      }
    } catch (err) {
      throw err; // Re-throw to be handled by ReprintDialog
    }
  };

  const handleShowModelPreview = async () => {
    if (!job) return;

    try {
      const response = await fetch(`/api/3d-printing/download/${jobId}?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setModelPreviewUrl(data.downloadUrl);
        setShowModelPreview(true);
      } else {
        setError(data.error?.message || 'Failed to load model preview');
      }
    } catch (err) {
      setError('Network error while loading model preview');
      console.error('Preview error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-zinc-400">Loading job status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-500 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-red-300 font-medium">Error Loading Job</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
        <Button
          onClick={fetchJobStatus}
          className="mt-4"
          variant="outline"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
        <p className="text-zinc-400">Job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold text-white">Job Status</h1>
          <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
            isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-zinc-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button
            onClick={fetchJobStatus}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Job Overview */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">{job.filename}</h2>
            <div className="flex items-center space-x-3 mb-3">
              {getStatusIcon(job.status, ['downloading', 'slicing', 'uploading', 'printing'].includes(job.status))}
              <span className={`font-medium ${getStatusColor(job.status)}`}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
              {['downloading', 'slicing', 'uploading', 'printing'].includes(job.status) && (
                <span className="text-sm text-zinc-400">
                  • {getStatusDescription(job.status)}
                </span>
              )}
            </div>
            <ProgressBar progress={getStatusProgress(job.status)} status={job.status} />
          </div>
          <div className="text-right text-sm text-zinc-400 ml-6">
            <div>Job ID: {job.id.slice(0, 8)}...</div>
            <div>Created: {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'}</div>
            {job.submitted_at && (
              <div>Submitted: {new Date(job.submitted_at).toLocaleDateString()}</div>
            )}
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-sm text-zinc-400">File Size</div>
            <div className="text-white">{(job.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</div>
          </div>
          {job.model_metadata && (
            <>
              <div>
                <div className="text-sm text-zinc-400">Vertices</div>
                <div className="text-white">{job.model_metadata.vertices?.toLocaleString() || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Faces</div>
                <div className="text-white">{job.model_metadata.faces?.toLocaleString() || 'N/A'}</div>
              </div>
            </>
          )}
        </div>

        {/* Timing Information */}
        {(estimatedCompletion || job.estimated_duration_minutes || job.submitted_at) && (
          <div className="bg-blue-950/20 border border-blue-500 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {job.estimated_duration_minutes && (
                <div className="flex items-center space-x-2">
                  <Timer className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-blue-300 font-medium">Estimated Duration</div>
                    <div className="text-blue-200 text-sm">{formatDuration(job.estimated_duration_minutes)}</div>
                  </div>
                </div>
              )}
              
              {job.submitted_at && (
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-blue-300 font-medium">Elapsed Time</div>
                    <div className="text-blue-200 text-sm">{getElapsedTime(job.submitted_at)}</div>
                  </div>
                </div>
              )}
              
              {estimatedCompletion && job.status === 'printing' && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-blue-300 font-medium">Time Remaining</div>
                    <div className="text-blue-200 text-sm">{calculateTimeRemaining(estimatedCompletion)}</div>
                  </div>
                </div>
              )}
            </div>
            
            {estimatedCompletion && job.status === 'printing' && (
              <div className="mt-3 pt-3 border-t border-blue-500/30">
                <div className="text-blue-300 text-sm">
                  <strong>Estimated completion:</strong> {estimatedCompletion ? new Date(estimatedCompletion).toLocaleString() : 'Unknown'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.error_message && (
          <div className="bg-red-950/20 border border-red-500 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-300 font-medium">Print Job Failed</p>
                <p className="text-red-400 text-sm mt-1">{job.error_message}</p>
                
                {/* Troubleshooting suggestions */}
                <div className="mt-3 p-3 bg-red-900/30 rounded border border-red-600/30">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-200 text-sm font-medium">Troubleshooting Tips:</p>
                      <ul className="text-red-300 text-xs mt-1 space-y-1 list-disc list-inside">
                        <li>Check if your model file is valid and not corrupted</li>
                        <li>Ensure the model fits within the printer's build volume (256×256×256mm)</li>
                        <li>Verify the print service is running and accessible</li>
                        <li>Try uploading the model again or contact support if the issue persists</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {job.status === 'pending' && (
            <Button onClick={handleSubmitJob} className="bg-blue-600 hover:bg-blue-700">
              <Play className="w-4 h-4 mr-2" />
              Submit for Printing
            </Button>
          )}
          
          {job.status === 'failed' && (
            <Button onClick={handleSubmitJob} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry Print Job
            </Button>
          )}

          {/* Download Model - Available for all jobs */}
          <Button onClick={handleDownloadModel} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Model
          </Button>

          {/* Model Preview - Available for all jobs */}
          <Button onClick={handleShowModelPreview} variant="outline">
            <Eye className="w-4 h-4 mr-2" />
            Preview Model
          </Button>

          {/* Reprint - Available for completed or failed jobs */}
          {(job.status === 'complete' || job.status === 'failed') && (
            <Button onClick={() => setShowReprintDialog(true)} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reprint Model
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
        <h3 className="text-lg font-medium text-white mb-4">Status Timeline</h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-600"></div>
          
          <div className="space-y-6">
            {statusHistory.map((update, index) => {
              const isLatest = index === statusHistory.length - 1;
              const isActive = isLatest && ['downloading', 'slicing', 'uploading', 'printing'].includes(update.status);
              
              return (
                <div key={index} className="relative flex items-start space-x-4">
                  {/* Timeline dot */}
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                    update.status === 'failed' ? 'bg-red-950 border-red-500' :
                    update.status === 'complete' ? 'bg-green-950 border-green-500' :
                    isActive ? 'bg-blue-950 border-blue-400' :
                    'bg-zinc-800 border-zinc-600'
                  }`}>
                    {getStatusIcon(update.status, isActive)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${getStatusColor(update.status)}`}>
                        {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {update.timestamp ? new Date(update.timestamp).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    
                    {update.message && (
                      <p className="text-sm text-zinc-300 mb-2">{update.message}</p>
                    )}
                    
                    {/* Additional context for current status */}
                    {isLatest && update.status !== 'complete' && update.status !== 'failed' && (
                      <div className="text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-1 inline-block">
                        {getStatusDescription(update.status)}
                      </div>
                    )}
                    
                    {/* Show elapsed time for active statuses */}
                    {isActive && (
                      <div className="text-xs text-blue-400 mt-1">
                        Running for {getElapsedTime(update.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Print Settings */}
      {job.print_settings && Object.keys(job.print_settings).length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
          <h3 className="text-lg font-medium text-white mb-4">Print Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(job.print_settings).map(([key, value]) => (
              <div key={key}>
                <div className="text-sm text-zinc-400 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-white">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print Job Manager Modal */}
      {showPrintManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Configure Print Job</h3>
              <button
                onClick={() => setShowPrintManager(false)}
                className="text-zinc-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <PrintJobManager
              jobId={jobId}
              modelMetadata={job.model_metadata}
              onJobSubmitted={handleJobSubmitted}
              onCancel={() => setShowPrintManager(false)}
            />
          </div>
        </div>
      )}

      {/* Model Preview Modal */}
      {showModelPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg border border-zinc-700 max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-lg font-medium text-white">3D Model Preview</h3>
              <button
                onClick={() => {
                  setShowModelPreview(false);
                  setModelPreviewUrl(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <Model3DPreview
                modelUrl={modelPreviewUrl || undefined}
                filename={job.filename}
                modelMetadata={job.model_metadata}
                className="h-96"
                showControls={true}
                autoRotate={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reprint Dialog */}
      {showReprintDialog && (
        <ReprintDialog
          job={job}
          isOpen={showReprintDialog}
          onClose={() => setShowReprintDialog(false)}
          onReprint={handleReprint}
        />
      )}
    </div>
  );
};

export default JobTracker;