'use client';

import React, { useState } from 'react';

interface SimpleModelUploadProps {
  userId: string;
  onUploadComplete: (jobId: string, modelInfo: any) => void;
  onUploadError: (error: string) => void;
}

export default function SimpleModelUpload({ userId, onUploadComplete, onUploadError }: SimpleModelUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !userId) return;

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Upload file to Supabase Storage (following API guide workflow)
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storagePath = `uploads/${fileName}`;
      
      setUploadProgress(25);
      
      // For now, simulate the upload to storage
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUploadProgress(50);
      
      // Step 2: Create job record via API route (handles RLS properly)
      const response = await fetch('/api/3d-printing/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          storage_path: storagePath,
          file_size_bytes: selectedFile.size,
          user_id: userId
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Job creation failed');
      }
      
      const jobData = result.job;
      
      setUploadProgress(100);
      
      const modelInfo = {
        jobId: jobData.id,
        filename: selectedFile.name,
        storagePath: storagePath,
        fileSize: selectedFile.size
      };
      
      onUploadComplete(modelInfo.jobId, modelInfo);
      setSelectedFile(null);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
      <h3 className="text-lg font-medium text-white mb-4">Upload 3D Model</h3>
      
      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept=".stl,.obj,.ply"
            onChange={handleFileSelect}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
        </div>
        
        {selectedFile && (
          <div className="text-sm text-zinc-400">
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </div>
        )}
        
        {error && (
          <div className="text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-300">Uploading and creating job...</span>
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
        
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || !userId}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
        >
          {isUploading ? 'Creating Print Job...' : 'Upload for 3D Printing'}
        </button>
      </div>
      
      <div className="mt-4 text-xs text-zinc-500">
        <p>Supported formats: STL, OBJ, PLY</p>
        <p>Maximum file size: 50MB</p>
        <p>Jobs are created via secure API and tracked in database</p>
        {!userId && <p className="text-red-400">⚠️ User authentication required for upload</p>}
      </div>
    </div>
  );
}