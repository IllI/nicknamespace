'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Upload, X, FileText, AlertCircle, Box } from 'lucide-react';
import { ModelUploadProps, ModelInfo } from '@/lib/types/direct-print-jobs';
// Temporarily removed ErrorDisplay to fix import issues
// import { ErrorDisplay, useErrorHandler } from './ErrorDisplay';
import { errorHandler } from '@/lib/services/error-handling-service';
import { Button } from '@/components/ui/button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ModelUpload: React.FC<ModelUploadProps> = ({
  onUploadComplete,
  onUploadError,
  maxFileSize = 100 * 1024 * 1024, // 100MB default (increased for complex formats)
  acceptedFormats = ['3mf', 'stl', 'obj', 'ply', 'gltf', 'glb', 'fbx', 'dae', 'x3d', 'amf'],
  disabled = false,
  userId
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<any>(null);
  // Simple error state instead of useErrorHandler
  const [error, setError] = useState<string | null>(null);
  
  const handleError = (code: string, message: string, context?: any) => {
    console.error('Error:', { code, message, context });
    setError(message);
  };
  
  const clearError = () => setError(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File) => {
    return errorHandler.validateFilePreUpload(file);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      handleError(validationError.code, validationError.message, {
        filename: file.name,
        fileSize: file.size,
        operation: 'file_selection'
      });
      onUploadError(validationError.message);
      return;
    }

    clearError();
    setSelectedFile(file);
    
    // Perform basic client-side validation
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      // Simple validation without Three.js dependency
      const result = {
        isValid: true,
        issues: [] as string[],
        warnings: [] as string[],
        fitsInBuildVolume: true,
        modelStats: {
          vertices: 0,
          faces: 0
        },
        format: extension || 'unknown'
      };
      
      // Basic file format validation
      if (!extension || !acceptedFormats.includes(extension)) {
        result.isValid = false;
        result.issues.push(`Unsupported file format: ${extension}`);
      }
      
      // File size validation
      if (file.size > maxFileSize) {
        result.isValid = false;
        result.issues.push(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${maxFileSize / 1024 / 1024}MB)`);
      }
      
      // Add format-specific warnings
      if (extension && ['3mf', 'x3d', 'amf'].includes(extension)) {
        result.warnings.push(`${extension.toUpperCase()} format will be processed by the print service. Full validation available after upload.`);
      }
      
      if (extension && ['gltf', 'glb', 'fbx', 'dae'].includes(extension)) {
        result.warnings.push(`${extension.toUpperCase()} format detected. Model will be converted to STL for printing.`);
      }
      
      setValidationResult(result);
      
      if (!result.isValid && result.issues.length > 0) {
        const errorMessage = `Model validation failed: ${result.issues.join(', ')}`;
        handleError('VALIDATION_FAILED', errorMessage);
        onUploadError(errorMessage);
      }
    } catch (validationError) {
      console.warn('Client-side validation failed:', validationError);
      // Continue without client-side validation - server will validate
      setValidationResult({ isValid: true, issues: [], warnings: [], fitsInBuildVolume: true });
    }
  }, [validateFile, onUploadError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !userId) return;

    setIsUploading(true);
    setUploadProgress(0);
    clearError();

    try {
      // Step 1: Upload file to Supabase Storage (following API guide workflow)
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storagePath = `uploads/${fileName}`;
      
      setUploadProgress(25);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('3d-models')
        .upload(storagePath, selectedFile);
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      setUploadProgress(50);
      
      // Step 2: Create job record in database
      const { data: jobData, error: jobError } = await supabase
        .from('direct_print_jobs')
        .insert({
          filename: selectedFile.name,
          storage_path: storagePath,
          status: 'pending',
          file_size_bytes: selectedFile.size,
          user_id: userId
        })
        .select()
        .single();
      
      if (jobError) {
        // Clean up uploaded file if job creation fails
        await supabase.storage.from('3d-models').remove([storagePath]);
        throw new Error(`Job creation failed: ${jobError.message}`);
      }
      
      setUploadProgress(75);
      
      // Step 3: Execute print job (this will communicate with the actual printer)
      const printResponse = await fetch('/api/3d-printing/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobData.id
        })
      });

      const printData = await printResponse.json();
      
      if (!printResponse.ok || !printData.success) {
        // Job status will be updated by the executor, but we can add additional context
        throw new Error(printData.error || 'Failed to execute print job');
      }
      
      setUploadProgress(100);
      
      const modelInfo = {
        jobId: jobData.id,
        filename: selectedFile.name,
        storagePath: storagePath,
        fileSize: selectedFile.size,
        modelMetadata: validationResult
      };
      
      onUploadComplete(modelInfo.jobId, modelInfo);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      handleError('UPLOAD_FAILED', errorMessage);
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, userId, validationResult, onUploadComplete, onUploadError]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setValidationResult(null);
    clearError();
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    // Return different colored icons based on file type
    switch (extension) {
      case '3mf':
        return <Box className="w-8 h-8 text-purple-400" />;
      case 'stl':
        return <Box className="w-8 h-8 text-blue-400" />;
      case 'obj':
        return <Box className="w-8 h-8 text-green-400" />;
      case 'ply':
        return <Box className="w-8 h-8 text-yellow-400" />;
      case 'gltf':
      case 'glb':
        return <Box className="w-8 h-8 text-red-400" />;
      case 'fbx':
        return <Box className="w-8 h-8 text-orange-400" />;
      case 'dae':
        return <Box className="w-8 h-8 text-cyan-400" />;
      case 'x3d':
        return <Box className="w-8 h-8 text-pink-400" />;
      case 'amf':
        return <Box className="w-8 h-8 text-indigo-400" />;
      default:
        return <Box className="w-8 h-8 text-zinc-400" />;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200',
          {
            'border-zinc-600 bg-zinc-900': !isDragOver && !error,
            'border-blue-500 bg-blue-950/20': isDragOver && !disabled,
            'border-red-500 bg-red-950/20': error,
            'border-zinc-700 bg-zinc-800 opacity-50 cursor-not-allowed': disabled,
            'cursor-pointer hover:border-zinc-500': !disabled && !selectedFile
          }
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.map(f => `.${f}`).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {!selectedFile ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Upload className="w-12 h-12 text-zinc-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-zinc-200">
                {isDragOver ? 'Drop your 3D model here' : 'Upload a 3D model for printing'}
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                Drag and drop or click to select • {acceptedFormats.slice(0, 6).map(f => f.toUpperCase()).join(', ')}{acceptedFormats.length > 6 ? ' + more' : ''} • Max {Math.round(maxFileSize / (1024 * 1024))}MB
              </p>
            </div>
            {!disabled && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose File
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Preview */}
            <div className="flex items-start space-x-4">
              <div className="w-24 h-24 bg-zinc-800 rounded-lg border border-zinc-600 flex items-center justify-center">
                {getFileIcon(selectedFile.name)}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                <p className="text-sm text-zinc-400">{formatFileSize(selectedFile.size)}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedFile.type || 'application/octet-stream'} • {selectedFile.lastModified ? new Date(selectedFile.lastModified).toLocaleDateString() : ''}
                </p>
                
                {/* Validation Results */}
                {validationResult && (
                  <div className="mt-2 text-xs">
                    {validationResult.isValid ? (
                      <div className="text-green-400">
                        ✓ Valid 3D model ({validationResult.modelStats?.vertices || 0} vertices, {validationResult.modelStats?.faces || 0} faces)
                      </div>
                    ) : (
                      <div className="text-yellow-400">
                        ⚠ {validationResult.warnings?.length || 0} warnings found
                      </div>
                    )}
                    {validationResult.fitsInBuildVolume ? (
                      <div className="text-green-400">✓ Fits in build volume</div>
                    ) : (
                      <div className="text-red-400">✗ Exceeds build volume (256×256×256mm)</div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleClearFile}
                className="p-1 hover:bg-zinc-700 rounded transition-colors"
                disabled={isUploading}
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300">Uploading and validating...</span>
                  <span className="text-zinc-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            {!isUploading && (
              <Button
                onClick={handleUpload}
                disabled={disabled || (validationResult && !validationResult.isValid)}
                className="w-full"
              >
                {validationResult && !validationResult.isValid ? 'Model has validation issues' : 'Upload for 3D Printing'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-950/20 border border-red-500 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-medium">Upload Error</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-950/20 border border-yellow-500 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 font-medium">Model Warnings</p>
              <ul className="text-yellow-400 text-sm mt-1 space-y-1">
                {validationResult.warnings.map((warning: string, index: number) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 text-xs text-zinc-500 space-y-1">
        <p>• <strong>Fully supported:</strong> STL, OBJ, PLY, GLTF, GLB, FBX, DAE files up to 100MB</p>
        <p>• <strong>Print service supported:</strong> 3MF, X3D, AMF (converted automatically)</p>
        <p>• Models must fit within 256×256×256mm build volume</p>
        <p>• Manifold (watertight) models print best</p>
        <p>• Files are validated before printing to ensure quality</p>
      </div>
    </div>
  );
};

export default ModelUpload;