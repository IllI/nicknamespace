'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar
} from 'lucide-react';

interface UsageStats {
  daily: {
    conversions: number;
    limit: number;
    remaining: number;
    resetTime: Date;
  };
  monthly: {
    conversions: number;
    apiCost: number;
  };
  total: {
    conversions: number;
    apiCost: number;
  };
}

interface ConversionHistory {
  records: Array<{
    id: string;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    created_at: string;
    completed_at?: string;
    error_message?: string;
  }>;
  totalCount: number;
  successRate: number;
  averageProcessingTime: number;
}

interface CostBreakdown {
  totalCost: number;
  apiCosts: number;
  storageCosts: number;
  breakdown: {
    conversions: number;
    avgCostPerConversion: number;
    estimatedMonthlyCost: number;
  };
}

interface UsageDashboardProps {
  className?: string;
}

export function UsageDashboard({ className }: UsageDashboardProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [history, setHistory] = useState<ConversionHistory | null>(null);
  const [costs, setCosts] = useState<CostBreakdown | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load usage stats
      const statsResponse = await fetch('/api/3d-conversion/usage?type=stats');
      if (!statsResponse.ok) throw new Error('Failed to load usage stats');
      const statsData = await statsResponse.json();
      setStats(statsData.stats);

      // Load conversion history
      const historyResponse = await fetch('/api/3d-conversion/usage?type=history&limit=20');
      if (!historyResponse.ok) throw new Error('Failed to load conversion history');
      const historyData = await historyResponse.json();
      setHistory(historyData.history);

      // Load cost breakdown
      const costsResponse = await fetch('/api/3d-conversion/usage?type=costs');
      if (!costsResponse.ok) throw new Error('Failed to load cost breakdown');
      const costsData = await costsResponse.json();
      setCosts(costsData.costs);

      // Load analytics for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const analyticsResponse = await fetch(
        `/api/3d-conversion/usage?type=analytics&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (!analyticsResponse.ok) throw new Error('Failed to load analytics');
      const analyticsData = await analyticsResponse.json();
      setAnalytics(analyticsData.analytics);

      // Check for upgrade prompts
      const upgradeResponse = await fetch('/api/3d-conversion/usage?type=upgrade-check');
      if (!upgradeResponse.ok) throw new Error('Failed to check upgrade status');
      const upgradeData = await upgradeResponse.json();
      setUpgradePrompt(upgradeData.upgradeCheck);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      case 'uploading': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'uploading': return <TrendingUp className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upgrade Prompt */}
      {upgradePrompt?.shouldPrompt && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{upgradePrompt.reason}</span>
            <Button size="sm" variant="outline">
              Upgrade to {upgradePrompt.recommendedTier}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.daily.conversions} / {stats?.daily.limit}
            </div>
            <Progress 
              value={(stats?.daily.conversions || 0) / (stats?.daily.limit || 1) * 100} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.daily.remaining} conversions remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {history?.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {history?.totalCount} total conversions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(costs?.totalCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(costs?.breakdown.avgCostPerConversion || 0)} avg per conversion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Conversion History</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Conversions</CardTitle>
              <CardDescription>
                Your last {history?.records.length} conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history?.records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(record.status)}
                      <div>
                        <p className="text-sm font-medium">
                          Conversion {record.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(record.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(record.status)} text-white`}
                      >
                        {record.status}
                      </Badge>
                      {record.completed_at && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round((new Date(record.completed_at).getTime() - new Date(record.created_at).getTime()) / 1000 / 60)}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.dailyUsage && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="conversions" 
                      stroke="#8884d8" 
                      name="Conversions"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="successfulConversions" 
                      stroke="#82ca9d" 
                      name="Successful"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Conversions:</span>
                  <span className="font-medium">{analytics?.summary.totalConversions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-medium">{analytics?.summary.successRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Daily:</span>
                  <span className="font-medium">{analytics?.summary.averageDaily.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span className="font-medium">{formatCurrency(analytics?.summary.totalCost || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {history?.averageProcessingTime.toFixed(1)}m
                </div>
                <p className="text-sm text-muted-foreground">
                  Average processing time per conversion
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>API Costs:</span>
                    <span className="font-medium">{formatCurrency(costs?.apiCosts || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Costs:</span>
                    <span className="font-medium">{formatCurrency(costs?.storageCosts || 0)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(costs?.totalCost || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Projections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Avg per Conversion:</span>
                  <span className="font-medium">
                    {formatCurrency(costs?.breakdown.avgCostPerConversion || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Monthly:</span>
                  <span className="font-medium">
                    {formatCurrency(costs?.breakdown.estimatedMonthlyCost || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Conversions:</span>
                  <span className="font-medium">{costs?.breakdown.conversions}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}