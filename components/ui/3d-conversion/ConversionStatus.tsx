'use client';

import React, { useState, useEffect, useCallback } from 'react';
import cn from 'classnames';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Loader2,
  Upload,
  Cpu,
  Download
} from 'lucide-react';
import { ConversionStatusProps, StatusResponse, ConversionRecord } from '@/lib/types/3d-conversion';
import { Button } from '@/components/ui/button';

const ConversionStatus: React.FC<ConversionStatusProps> = ({
  conversionId,
  onComplete,
  onError,
  pollInterval = 2000 // 2 seconds default
}) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const maxRetries = 3;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/3d-conversion/status/${conversionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: StatusResponse = await response.json();
      setStatus(data);
      setLastUpdated(new Date());
      setError(null);
      setRetryCount(0);

      // Stop polling if conversion is complete or failed
      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false);
        
        if (data.status === 'completed') {
          // Map the API response to ConversionRecord format
          const record: ConversionRecord = {
            id: data.conversion_id,
            user_id: '', // Not needed for display
            status: data.status,
            created_at: data.created_at,
            completed_at: data.completed_at,
            error_message: data.error_message,
            file_sizes: data.file_sizes,
            model_metadata: data.model_metadata,
            print_metadata: data.print_metadata,
            original_image_url: data.urls?.original_image,
            model_file_url: data.urls?.model_file, // Map from urls.model_file to model_file_url
          };
          onComplete(record);
        } else if (data.status === 'failed') {
          onError(data.error_message || 'Conversion failed');
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch status';
      setError(errorMessage);
      setRetryCount(prev => prev + 1);

      if (retryCount >= maxRetries) {
        setIsPolling(false);
        onError(`Failed to get conversion status after ${maxRetries} attempts: ${errorMessage}`);
      }
    }
  }, [conversionId, onComplete, onError, retryCount]);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsPolling(true);
    fetchStatus();
  }, [fetchStatus]);

  const handleCancel = useCallback(async () => {
    try {
      setIsPolling(false);
      // Note: Cancel endpoint would need to be implemented in the API
      // await fetch(`/api/3d-conversion/cancel/${conversionId}`, { method: 'POST' });
      onError('Conversion cancelled by user');
    } catch (err) {
      console.error('Failed to cancel conversion:', err);
    }
  }, [conversionId, onError]);

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(fetchStatus, pollInterval);
    
    // Initial fetch
    fetchStatus();

    return () => clearInterval(interval);
  }, [isPolling, pollInterval, fetchStatus]);

  const getStatusIcon = () => {
    if (!status) return <Loader2 className="w-6 h-6 animate-spin text-blue-400" />;

    switch (status.status) {
      case 'uploading':
        return <Upload className="w-6 h-6 text-blue-400" />;
      case 'processing':
        return <Cpu className="w-6 h-6 text-yellow-400" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Clock className="w-6 h-6 text-zinc-400" />;
    }
  };

  const getStatusMessage = () => {
    if (!status) return 'Initializing conversion...';

    switch (status.status) {
      case 'uploading':
        return 'Uploading image to processing server...';
      case 'processing':
        return 'Converting image to 3D model using AI...';
      case 'completed':
        return 'Conversion completed successfully!';
      case 'failed':
        return status.error_message || 'Conversion failed';
      default:
        return 'Processing...';
    }
  };

  const getProgressPercentage = () => {
    if (!status) return 0;
    
    // Use API progress if available, otherwise estimate based on status
    if (status.progress_percentage !== undefined) {
      return status.progress_percentage;
    }

    switch (status.status) {
      case 'uploading':
        return 25;
      case 'processing':
        return 75;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  };

  const getEstimatedTime = () => {
    if (!status?.estimated_completion) return null;
    
    try {
      const estimatedTime = new Date(status.estimated_completion);
      const now = new Date();
      const diffMs = estimatedTime.getTime() - now.getTime();
      
      if (diffMs <= 0) return 'Almost done...';
      
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      
      if (diffMinutes < 1) return 'Less than a minute';
      if (diffMinutes === 1) return '1 minute';
      return `${diffMinutes} minutes`;
    } catch {
      return null;
    }
  };

  const progress = getProgressPercentage();
  const estimatedTime = getEstimatedTime();
  const isComplete = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isProcessing = status && ['uploading', 'processing'].includes(status.status);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">
                3D Conversion Status
              </h3>
              <p className="text-sm text-zinc-400">
                ID: {conversionId.slice(0, 8)}...
              </p>
            </div>
          </div>
          
          {isProcessing && (
            <Button
              variant="slim"
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-zinc-300">
              {getStatusMessage()}
            </span>
            <span className="text-sm text-zinc-400">
              {progress}%
            </span>
          </div>
          
          <div className="w-full bg-zinc-700 rounded-full h-3">
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-500 ease-out',
                {
                  'bg-blue-500': isProcessing,
                  'bg-green-500': isComplete,
                  'bg-red-500': isFailed
                }
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status Details */}
        <div className="space-y-3">
          {estimatedTime && isProcessing && (
            <div className="flex items-center space-x-2 text-sm text-zinc-400">
              <Clock className="w-4 h-4" />
              <span>Estimated time remaining: {estimatedTime}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm text-zinc-400">
            <RefreshCw className="w-4 h-4" />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>

          {status?.status === 'processing' && (
            <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-300 font-medium">AI Processing in Progress</p>
                  <p className="text-blue-400 text-sm mt-1">
                    Using Stable Fast 3D (SF3D) to convert your image into a high-quality 3D model. 
                    This typically takes 2-5 minutes depending on image complexity.
                  </p>
                  <p className="text-blue-500 text-xs mt-2">
                    💡 Free service with automatic fallback to premium models if needed
                  </p>
                </div>
              </div>
            </div>
          )}

          {isComplete && (
            <div className="bg-green-950/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300 font-medium">Conversion Completed!</p>
                  <p className="text-green-400 text-sm mt-1">
                    Your 3D model is ready for preview and download.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">Conversion Failed</p>
                  <p className="text-red-400 text-sm mt-1">
                    {status.error_message || 'An unexpected error occurred during conversion.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-300 font-medium">Connection Issue</p>
                  <p className="text-yellow-400 text-sm mt-1">{error}</p>
                  <Button
                    variant="slim"
                    onClick={handleRetry}
                    className="mt-3 text-yellow-300 hover:text-yellow-200"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry ({retryCount}/{maxRetries})
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Processing Steps Indicator */}
        {isProcessing && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex items-center justify-between text-sm">
              <div className={cn(
                'flex items-center space-x-2',
                status?.status === 'uploading' ? 'text-blue-400' : 'text-green-400'
              )}>
                {status?.status === 'uploading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Upload</span>
              </div>

              <div className={cn(
                'flex items-center space-x-2',
                status?.status === 'processing' ? 'text-blue-400' : 
                status?.status === 'completed' ? 'text-green-400' : 'text-zinc-500'
              )}>
                {status?.status === 'processing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status?.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span>AI Processing</span>
              </div>

              <div className={cn(
                'flex items-center space-x-2',
                status?.status === 'completed' ? 'text-green-400' : 'text-zinc-500'
              )}>
                {status?.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Ready</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversionStatus;