'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Users,
  FileText,
  Zap,
  Server,
  Database,
  HardDrive
} from 'lucide-react';

interface AnalyticsReport {
  period: {
    start: string;
    end: string;
    days: number;
  };
  jobMetrics: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    successRate: number;
    averageProcessingTime: number;
    averageUploadTime: number;
    averageFileSize: number;
  };
  userAnalytics: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    averageJobsPerUser: number;
    topFileFormats: Array<{ format: string; count: number; percentage: number }>;
    usageByTimeOfDay: Array<{ hour: number; jobCount: number }>;
  };
  performanceMetrics: {
    uploadTimes: { p50: number; p95: number; p99: number; average: number };
    processingTimes: { p50: number; p95: number; p99: number; average: number };
    errorRates: {
      uploadErrors: number;
      validationErrors: number;
      printServiceErrors: number;
      storageErrors: number;
    };
  };
  trends: {
    jobVolumeChange: number;
    successRateChange: number;
    performanceChange: number;
  };
  generatedAt: string;
}

interface RealTimeMetrics {
  timestamp: string;
  activeJobs: {
    total: number;
    byStatus: Record<string, number>;
  };
  recentActivity: {
    last5Minutes: number;
    last15Minutes: number;
    lastHour: number;
  };
  systemHealth: {
    printServiceConnected: boolean;
    storageHealthy: boolean;
    errorRate: number;
  };
  performance: {
    averageUploadTime: number;
    averageProcessingTime: number;
    queueLength: number;
  };
}

export function MonitoringDashboard() {
  const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch analytics report
  const fetchAnalytics = async (period: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/direct-print?period=${period}&realtime=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalyticsReport(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch real-time metrics
  const fetchRealTimeMetrics = async () => {
    try {
      const response = await fetch('/api/analytics/direct-print/realtime');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch real-time metrics: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRealTimeMetrics(data);
    } catch (err) {
      console.error('Failed to fetch real-time metrics:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAnalytics(selectedPeriod);
    fetchRealTimeMetrics();
  }, [selectedPeriod]);

  // Auto-refresh real-time metrics
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchRealTimeMetrics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getHealthIcon = (healthy: boolean) => {
    return healthy 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  if (loading && !analyticsReport) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => fetchAnalytics(selectedPeriod)}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">3D Print Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time metrics and analytics for direct print service
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Real-time Status Cards */}
          {realTimeMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{realTimeMetrics.activeJobs.total}</div>
                  <p className="text-xs text-muted-foreground">
                    Queue: {realTimeMetrics.performance.queueLength}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{realTimeMetrics.recentActivity.lastHour}</div>
                  <p className="text-xs text-muted-foreground">
                    Last hour ({realTimeMetrics.recentActivity.last5Minutes} in 5min)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.systemHealth.errorRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last hour
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(realTimeMetrics.performance.averageProcessingTime)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload: {formatDuration(realTimeMetrics.performance.averageUploadTime)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analytics Overview */}
          {analyticsReport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Job Statistics
                  </CardTitle>
                  <CardDescription>
                    {analyticsReport.period.days} day period
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Jobs:</span>
                    <span className="font-medium">{analyticsReport.jobMetrics.totalJobs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-medium text-green-600">
                      {analyticsReport.jobMetrics.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Jobs:</span>
                    <span className="font-medium text-red-600">
                      {analyticsReport.jobMetrics.failedJobs}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg File Size:</span>
                    <span className="font-medium">
                      {formatFileSize(analyticsReport.jobMetrics.averageFileSize)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Users:</span>
                    <span className="font-medium">{analyticsReport.userAnalytics.totalUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Users:</span>
                    <span className="font-medium">{analyticsReport.userAnalytics.activeUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Users:</span>
                    <span className="font-medium text-green-600">
                      {analyticsReport.userAnalytics.newUsers}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jobs per User:</span>
                    <span className="font-medium">
                      {analyticsReport.userAnalytics.averageJobsPerUser.toFixed(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trends</CardTitle>
                  <CardDescription>vs previous period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Job Volume:</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(analyticsReport.trends.jobVolumeChange)}
                      <span className="font-medium">
                        {Math.abs(analyticsReport.trends.jobVolumeChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Success Rate:</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(analyticsReport.trends.successRateChange)}
                      <span className="font-medium">
                        {Math.abs(analyticsReport.trends.successRateChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Performance:</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(analyticsReport.trends.performanceChange)}
                      <span className="font-medium">
                        {Math.abs(analyticsReport.trends.performanceChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {analyticsReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Performance</CardTitle>
                  <CardDescription>Time from upload start to completion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.uploadTimes.average)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>50th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.uploadTimes.p50)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>95th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.uploadTimes.p95)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>99th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.uploadTimes.p99)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Processing Performance</CardTitle>
                  <CardDescription>Time from submission to completion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.processingTimes.average)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>50th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.processingTimes.p50)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>95th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.processingTimes.p95)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>99th percentile:</span>
                    <span className="font-medium">
                      {formatDuration(analyticsReport.performanceMetrics.processingTimes.p99)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Error Analysis</CardTitle>
                  <CardDescription>Breakdown of error types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsReport.performanceMetrics.errorRates.uploadErrors}
                      </div>
                      <div className="text-sm text-muted-foreground">Upload Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {analyticsReport.performanceMetrics.errorRates.validationErrors}
                      </div>
                      <div className="text-sm text-muted-foreground">Validation Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {analyticsReport.performanceMetrics.errorRates.printServiceErrors}
                      </div>
                      <div className="text-sm text-muted-foreground">Print Service Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {analyticsReport.performanceMetrics.errorRates.storageErrors}
                      </div>
                      <div className="text-sm text-muted-foreground">Storage Errors</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {analyticsReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>File Format Usage</CardTitle>
                  <CardDescription>Most popular file formats</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analyticsReport.userAnalytics.topFileFormats.map((format, index) => (
                      <div key={format.format} className="flex justify-between items-center">
                        <span className="capitalize">{format.format}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${format.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {format.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage by Hour</CardTitle>
                  <CardDescription>Peak usage times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {analyticsReport.userAnalytics.usageByTimeOfDay
                      .filter(hour => hour.jobCount > 0)
                      .sort((a, b) => b.jobCount - a.jobCount)
                      .slice(0, 8)
                      .map((hour) => (
                        <div key={hour.hour} className="flex justify-between items-center">
                          <span>{hour.hour}:00</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${(hour.jobCount / Math.max(...analyticsReport.userAnalytics.usageByTimeOfDay.map(h => h.jobCount))) * 100}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">
                              {hour.jobCount}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {realTimeMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Print Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <div className="flex items-center gap-2">
                      {getHealthIcon(realTimeMetrics.systemHealth.printServiceConnected)}
                      <span className="font-medium">
                        {realTimeMetrics.systemHealth.printServiceConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <div className="flex items-center gap-2">
                      {getHealthIcon(realTimeMetrics.systemHealth.storageHealthy)}
                      <span className="font-medium">
                        {realTimeMetrics.systemHealth.storageHealthy ? 'Healthy' : 'Issues'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <div className="flex items-center gap-2">
                      {getHealthIcon(true)} {/* Assume healthy if we got metrics */}
                      <span className="font-medium">Connected</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {realTimeMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Active Job Status</CardTitle>
                <CardDescription>Current jobs by status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(realTimeMetrics.activeJobs.byStatus).map(([status, count]) => (
                    <div key={status} className="text-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm text-muted-foreground capitalize">{status}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}