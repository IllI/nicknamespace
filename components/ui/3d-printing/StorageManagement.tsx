'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StorageQuota {
  userId: string;
  tier: 'free' | 'premium' | 'enterprise';
  currentUsageBytes: number;
  quotaLimitBytes: number;
  utilizationPercent: number;
  canUpload: boolean;
}

interface StorageAnalytics {
  totalUsers: number;
  totalFiles: number;
  totalSizeBytes: number;
  averageFileSize: number;
  storageByStatus: Record<string, { files: number; sizeBytes: number }>;
  storageByUserTier: Record<string, { users: number; files: number; sizeBytes: number }>;
  oldestFile: string;
  newestFile: string;
}

interface CleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
}

export function StorageManagement() {
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  useEffect(() => {
    loadUserQuota();
  }, []);

  const loadUserQuota = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/3d-printing/storage/quota', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load storage quota');
      }

      const result = await response.json();
      setQuota(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage quota');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/3d-printing/storage/cleanup?action=analytics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load storage analytics');
      }

      const result = await response.json();
      setAnalytics(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage analytics');
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async (type: 'failed_jobs' | 'orphaned_files') => {
    try {
      setLoading(true);
      setCleanupResult(null);
      
      const response = await fetch('/api/3d-printing/storage/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        },
        body: JSON.stringify({ type })
      });

      if (!response.ok) {
        throw new Error('Failed to run cleanup');
      }

      const result = await response.json();
      setCleanupResult(result.data);
      
      // Refresh quota after cleanup
      await loadUserQuota();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run cleanup');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getQuotaColor = (percent: number): string => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Storage Management</h2>
        <Button onClick={loadUserQuota} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="quota" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quota">Storage Quota</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="cleanup">Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="quota" className="space-y-4">
          {quota && (
            <Card>
              <CardHeader>
                <CardTitle>Your Storage Usage</CardTitle>
                <CardDescription>
                  Current usage for {quota.tier} tier account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Usage:</span>
                  <span className={getQuotaColor(quota.utilizationPercent)}>
                    {formatBytes(quota.currentUsageBytes)} / {formatBytes(quota.quotaLimitBytes)}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      quota.utilizationPercent >= 90 ? 'bg-red-500' :
                      quota.utilizationPercent >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(quota.utilizationPercent, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{quota.utilizationPercent.toFixed(1)}% used</span>
                  <span>{quota.canUpload ? 'Can upload' : 'Quota exceeded'}</span>
                </div>

                {quota.utilizationPercent >= 80 && (
                  <Alert>
                    <AlertDescription>
                      You're approaching your storage limit. Consider upgrading your plan or cleaning up old files.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Storage Analytics</h3>
            <Button onClick={loadAnalytics} disabled={loading}>
              Load Analytics
            </Button>
          </div>

          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Files:</span>
                      <span>{analytics.totalFiles.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span>{formatBytes(analytics.totalSizeBytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Users:</span>
                      <span>{analytics.totalUsers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg File:</span>
                      <span>{formatBytes(analytics.averageFileSize)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.storageByStatus).map(([status, data]) => (
                      <div key={status} className="flex justify-between text-sm">
                        <span className="capitalize">{status}:</span>
                        <span>{data.files} files ({formatBytes(data.sizeBytes)})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By User Tier</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analytics.storageByUserTier).map(([tier, data]) => (
                      <div key={tier} className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="capitalize">{tier}:</span>
                          <span>{data.users} users</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{data.files} files</span>
                          <span>{formatBytes(data.sizeBytes)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Cleanup Failed Jobs</CardTitle>
                <CardDescription>
                  Remove failed job files older than 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => runCleanup('failed_jobs')}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Cleaning...' : 'Cleanup Failed Jobs'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cleanup Orphaned Files</CardTitle>
                <CardDescription>
                  Remove files without database records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => runCleanup('orphaned_files')}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Cleaning...' : 'Cleanup Orphaned Files'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {cleanupResult && (
            <Card>
              <CardHeader>
                <CardTitle>Cleanup Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Files Deleted:</span>
                    <span>{cleanupResult.filesDeleted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Space Freed:</span>
                    <span>{formatBytes(cleanupResult.bytesFreed)}</span>
                  </div>
                  {cleanupResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-red-600">Errors:</h4>
                      <ul className="text-sm text-red-600 mt-1">
                        {cleanupResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}