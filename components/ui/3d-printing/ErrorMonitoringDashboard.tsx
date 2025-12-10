'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Users, 
  Activity,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ErrorSeverity } from '@/lib/types/error-handling';

interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByOperation: Record<string, number>;
  recentErrors: Array<{
    id: string;
    error_code: string;
    error_message: string;
    user_message: string;
    severity: ErrorSeverity;
    created_at: string;
    user_id?: string;
    operation?: string;
  }>;
  errorRate: number;
  topErrors: Array<{ code: string; count: number; percentage: number }>;
}

interface ErrorTrend {
  date: string;
  count: number;
  severity: ErrorSeverity;
}

interface ErrorMonitoringDashboardProps {
  className?: string;
}

export function ErrorMonitoringDashboard({ className = '' }: ErrorMonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [trends, setTrends] = useState<ErrorTrend[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [timeRange]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, trendsResponse] = await Promise.all([
        fetch(`/api/3d-printing/monitoring/metrics?range=${timeRange}`),
        fetch(`/api/3d-printing/monitoring/trends?range=${timeRange}`)
      ]);

      if (!metricsResponse.ok || !trendsResponse.ok) {
        throw new Error('Failed to load monitoring data');
      }

      const metricsData = await metricsResponse.json();
      const trendsData = await trendsResponse.json();

      setMetrics(metricsData);
      setTrends(trendsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'bg-blue-100 text-blue-800';
      case ErrorSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800';
      case ErrorSeverity.HIGH:
        return 'bg-orange-100 text-orange-800';
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportMetrics = () => {
    if (!metrics) return;

    const data = {
      timeRange,
      exportedAt: new Date().toISOString(),
      metrics,
      trends
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-metrics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">Failed to Load Monitoring Data</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
            <Button 
              onClick={loadMetrics} 
              className="mt-4"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Error Monitoring</h2>
          <p className="text-gray-600">3D Printing Service Error Analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportMetrics} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{metrics.totalErrors}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{metrics.errorRate.toFixed(1)}</span>
              <span className="text-sm text-gray-500">/hour</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Critical Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">
                {metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Affected Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">
                {new Set(metrics.recentErrors.map(e => e.user_id).filter(Boolean)).size}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Error Severity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.errorsBySeverity).map(([severity, count]) => (
              <div key={severity} className="text-center">
                <Badge className={getSeverityColor(severity as ErrorSeverity)}>
                  {severity}
                </Badge>
                <div className="mt-2 text-2xl font-bold">{count}</div>
                <div className="text-sm text-gray-500">
                  {metrics.totalErrors > 0 
                    ? `${Math.round((count / metrics.totalErrors) * 100)}%`
                    : '0%'
                  }
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Most Common Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.topErrors.slice(0, 10).map((error, index) => (
              <div key={error.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <code className="text-sm font-mono bg-gray-200 px-2 py-1 rounded">
                    {error.code}
                  </code>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">{error.count} occurrences</span>
                  <Badge variant="outline">{error.percentage}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.recentErrors.slice(0, 20).map((error) => (
              <div key={error.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge className={getSeverityColor(error.severity)}>
                      {error.severity}
                    </Badge>
                    <code className="text-sm font-mono">{error.error_code}</code>
                    {error.operation && (
                      <Badge variant="outline">{error.operation}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{error.user_message}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(error.created_at).toLocaleString()}
                    </span>
                    {error.user_id && (
                      <span>User: {error.user_id.slice(0, 8)}...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Trends Chart Placeholder */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Chart visualization would go here</p>
                <p className="text-sm text-gray-500">
                  {trends.length} data points over {timeRange}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}