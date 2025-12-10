'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  ErrorDetails, 
  ErrorSeverity, 
  RecoveryAction, 
  TroubleshootingStep 
} from '@/lib/types/error-handling';
import { errorHandler } from '@/lib/services/error-handling-service';

interface ErrorDisplayProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
  onAction?: (action: RecoveryAction) => void;
  className?: string;
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  onAction,
  className = '' 
}: ErrorDisplayProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const formattedError = errorHandler.formatUserError(error);
  const severity = formattedError.severity;

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'border-blue-200 bg-blue-50 text-blue-800';
      case ErrorSeverity.MEDIUM:
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case ErrorSeverity.HIGH:
        return 'border-orange-200 bg-orange-50 text-orange-800';
      case ErrorSeverity.CRITICAL:
        return 'border-red-200 bg-red-50 text-red-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return <Info className="h-5 w-5 text-blue-600" />;
      case ErrorSeverity.MEDIUM:
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case ErrorSeverity.HIGH:
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case ErrorSeverity.CRITICAL:
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleActionClick = (action: RecoveryAction) => {
    switch (action.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'navigate':
        if (action.target) {
          window.location.href = action.target;
        }
        break;
      case 'contact':
        window.location.href = 'mailto:support@example.com';
        break;
      case 'custom':
        onAction?.(action);
        break;
      default:
        onAction?.(action);
    }
  };

  return (
    <Card className={`${getSeverityColor(severity)} border-2 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {getSeverityIcon(severity)}
            <div>
              <CardTitle className="text-lg font-semibold">
                {formattedError.title}
              </CardTitle>
              <p className="text-sm opacity-90 mt-1">
                {formattedError.message}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recovery Actions */}
        {formattedError.actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">What you can do:</h4>
            <div className="flex flex-wrap gap-2">
              {formattedError.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={index === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  className={index === 0 ? "bg-white text-gray-900 hover:bg-gray-100" : ""}
                >
                  {action.action === 'retry' && <RefreshCw className="h-4 w-4 mr-2" />}
                  {action.action === 'navigate' && <ExternalLink className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Troubleshooting Steps */}
        {formattedError.troubleshooting && formattedError.troubleshooting.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="p-0 h-auto font-medium text-sm hover:bg-transparent"
            >
              <span>Troubleshooting Steps</span>
              {showTroubleshooting ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>

            {showTroubleshooting && (
              <div className="bg-white bg-opacity-50 rounded-lg p-4 space-y-3">
                {formattedError.troubleshooting.map((step, index) => (
                  <div key={index} className="flex space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-medium">
                      {step.step}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h5 className="font-medium text-sm">{step.title}</h5>
                      <p className="text-sm opacity-90">{step.description}</p>
                      {step.expected && (
                        <p className="text-xs opacity-75 italic">
                          Expected: {step.expected}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Technical Details (Development Mode) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="p-0 h-auto font-medium text-xs hover:bg-transparent opacity-75"
            >
              <span>Technical Details</span>
              {showDetails ? (
                <ChevronUp className="h-3 w-3 ml-2" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-2" />
              )}
            </Button>

            {showDetails && (
              <div className="bg-white bg-opacity-50 rounded-lg p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Error Code and Timestamp */}
        <div className="flex justify-between items-center text-xs opacity-75 pt-2 border-t border-current border-opacity-20">
          <span>Error Code: {error.code}</span>
          {error.timestamp && (
            <span>
              {new Date(error.timestamp).toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error to monitoring service
    const errorDetails = errorHandler.createError(
      'INTERNAL_ERROR',
      error,
      {
        operation: 'component_render',
        timestamp: new Date().toISOString()
      }
    );

    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!);
      }

      const errorDetails = errorHandler.createError(
        'INTERNAL_ERROR',
        this.state.error,
        {
          operation: 'component_render',
          timestamp: new Date().toISOString()
        }
      );

      return (
        <div className="p-4">
          <ErrorDisplay
            error={errorDetails}
            onRetry={() => {
              this.setState({ hasError: false, error: undefined });
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for handling errors in functional components
export function useErrorHandler() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleError = (code: string, originalError?: Error | string, context?: any) => {
    const errorDetails = errorHandler.createError(code, originalError, context);
    setError(errorDetails);
    return errorDetails;
  };

  const clearError = () => setError(null);

  const retryOperation = (operation: () => Promise<void> | void) => {
    clearError();
    try {
      const result = operation();
      if (result instanceof Promise) {
        result.catch((err) => {
          handleError('INTERNAL_ERROR', err);
        });
      }
    } catch (err) {
      handleError('INTERNAL_ERROR', err as Error);
    }
  };

  return {
    error,
    handleError,
    clearError,
    retryOperation
  };
}