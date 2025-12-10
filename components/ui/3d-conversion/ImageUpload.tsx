'use client';

import React, { useState, useRef, useCallback } from 'react';
import cn from 'classnames';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ImageUploadProps } from '@/lib/types/3d-conversion';
import { Button } from '@/components/ui/button';

const ImageUpload: React.FC<ImageUploadProps> = ({
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFormats = ['image/png', 'image/jpeg', 'image/jpg'],
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file format. Please upload ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} files only.`;
    }
    
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      return `File size too large. Maximum size is ${maxSizeMB}MB.`;
    }
    
    return null;
  }, [acceptedFormats, maxFileSize]);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
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
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const trimmedDescription = textDescription.trim();
      if (trimmedDescription.length > 0) {
        formData.append('text_description', trimmedDescription);
      }

      // Create XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response.conversion_id);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || 'Upload failed'));
            } catch (e) {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
      });

      xhr.open('POST', '/api/3d-conversion/upload');
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(formData);

      const conversionId = await uploadPromise;
      onUploadComplete(conversionId);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, onUploadComplete, onUploadError, textDescription]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          accept={acceptedFormats.join(',')}
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
                {isDragOver ? 'Drop your image here' : 'Upload an image to convert to 3D'}
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                Drag and drop or click to select • PNG, JPG, JPEG • Max {Math.round(maxFileSize / (1024 * 1024))}MB
              </p>
            </div>
            {!disabled && (
              <Button
                className="mt-4"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border border-zinc-600"
                />
              ) : (
                <div className="w-24 h-24 bg-zinc-800 rounded-lg border border-zinc-600 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-zinc-400" />
                </div>
              )}
              
              <div className="flex-1 text-left">
                <p className="font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                <p className="text-sm text-zinc-400">{formatFileSize(selectedFile.size)}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedFile.type} • {selectedFile.lastModified ? new Date(selectedFile.lastModified).toLocaleDateString() : ''}
                </p>
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
                  <span className="text-zinc-300">Uploading...</span>
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
                disabled={disabled}
                className="w-full"
              >
                Start 3D Conversion
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

      {/* Text Description */}
      <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="conversion-text-description" className="text-sm font-medium text-zinc-200">
            Optional text description
          </label>
          <span className="text-xs text-zinc-500">
            Helps Hitem3D understand context (max 500 characters)
          </span>
        </div>
        <textarea
          id="conversion-text-description"
          className="w-full h-28 rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          placeholder="Describe the subject, materials, pose, lighting, or any other guidance to improve the 3D result."
          value={textDescription}
          onChange={(event) => {
            const value = event.target.value;
            if (value.length <= 500) {
              setTextDescription(value);
            }
          }}
          disabled={disabled}
        />
        <div className="mt-1 text-right text-xs text-zinc-500">
          {textDescription.trim().length}/{500}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 space-y-3">
        <div className="bg-blue-950/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-300 font-medium mb-1">🚀 Powered by Stable Fast 3D (SF3D)</p>
          <p className="text-xs text-blue-400">
            Free, high-quality 3D conversion with automatic fallback to premium models for best results
          </p>
        </div>
        
        <div className="text-xs text-zinc-500 space-y-1">
          <p>• Best results with clear, well-lit images with good contrast</p>
          <p>• Objects should be centered and fill most of the frame</p>
          <p>• Avoid blurry or heavily shadowed images</p>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;