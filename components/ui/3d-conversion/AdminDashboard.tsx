'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  Users, 
  Activity, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Database,
  Zap,
  Settings,
  RefreshCw
} from 'lucide-react';

interface SystemStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalConversions: number;
    successRate: number;
    totalApiCost: number;
    averageProcessingTime: number;
  };
  usage: {
    dailyConversions: number;
    monthlyConversions: number;
    peakHourlyRate: number;
    storageUsageGB: number;
  };
  performance: {
    averageUploadTime: number;
    averageProcessingTime: number;
    errorRate: number;
    timeoutRate: number;
  };
  costs: {
    totalApiCosts: number;
    totalStorageCosts: number;
    costPerConversion: number;
    monthlyBurn: number;
  };
}

interface UserManagement {
  users: Array<{
    user_id: string;
    subscription_tier: 'free' | 'premium' | 'enterprise';
    daily_conversions: number;
    monthly_conversions: number;
    total_api_cost: number;
    last_conversion_date: string;
    status: 'active' | 'inactive' | 'suspended';
  }>;
  totalCount: number;
  tierDistribution: {
    free: number;
    premium: number;
    enterprise: number;
  };
}

interface AdminDashboardProps {
  className?: string;
}

export function AdminDashboard({ className }: AdminDashboardProps) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<UserManagement | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // User management state
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newTier, setNewTier] = useState<string>('');
  const [userAction, setUserAction] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load system stats
      const statsResponse = await fetch('/api/admin/3d-conversion?type=stats');
      if (!statsResponse.ok) {
        if (statsResponse.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to load system stats');
      }
      const statsData = await statsResponse.json();
      setStats(statsData.stats);

      // Load user management data
      const usersResponse = await fetch('/api/admin/3d-conversion?type=users&limit=50');
      if (!usersResponse.ok) throw new Error('Failed to load user data');
      const usersData = await usersResponse.json();
      setUsers(usersData.userManagement);

      // Load health data
      const healthResponse = await fetch('/api/admin/3d-conversion?type=health');
      if (!healthResponse.ok) throw new Error('Failed to load health data');
      const healthData = await healthResponse.json();
      setHealth(healthData.health);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleUserAction = async () => {
    if (!selectedUser || !userAction) return;

    try {
      let body: any = { userId: selectedUser };
      
      if (userAction === 'update-tier') {
        if (!newTier) return;
        body.action = 'update-user-tier';
        body.newTier = newTier;
      } else if (userAction === 'reset-limits') {
        body.action = 'reset-user-limits';
      }

      const response = await fetch('/api/admin/3d-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('Failed to perform user action');
      }

      // Refresh data after action
      await refreshData();
      
      // Reset form
      setSelectedUser('');
      setNewTier('');
      setUserAction('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform action');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-yellow-500';
      case 'suspended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-500';
      case 'premium': return 'bg-blue-500';
      case 'free': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
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

  // Prepare chart data
  const tierData = users ? [
    { name: 'Free', value: users.tierDistribution.free, color: '#6B7280' },
    { name: 'Premium', value: users.tierDistribution.premium, color: '#3B82F6' },
    { name: 'Enterprise', value: users.tierDistribution.enterprise, color: '#8B5CF6' }
  ] : [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">3D Conversion Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor system performance and manage users</p>
        </div>
        <Button onClick={refreshData} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Health Alerts */}
      {health?.alerts && health.alerts.length > 0 && (
        <div className="space-y-2">
          {health.alerts.map((alert: any, index: number) => (
            <Alert key={index} className={alert.level === 'error' ? 'border-red-500' : 'border-yellow-500'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overview.activeUsers} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.overview.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overview.totalConversions} total conversions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.costs.monthlyBurn || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.costs.costPerConversion || 0)} per conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.performance.averageProcessingTime.toFixed(1)}m</div>
            <p className="text-xs text-muted-foreground">
              {stats?.performance.errorRate.toFixed(1)}% error rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {tierData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>System Status:</span>
                  <Badge className={health?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}>
                    {health?.status || 'Unknown'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>API Response Time:</span>
                    <span>{health?.metrics.apiResponseTime?.toFixed(1)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate:</span>
                    <span>{health?.metrics.errorRate?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Usage:</span>
                    <span>{health?.metrics.storageUsage?.toFixed(2)} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Users:</span>
                    <span>{health?.metrics.activeConnections}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {/* User Actions */}
          <Card>
            <CardHeader>
              <CardTitle>User Management Actions</CardTitle>
              <CardDescription>Manage user tiers and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="User ID"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                />
                <Select value={userAction} onValueChange={setUserAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update-tier">Update Tier</SelectItem>
                    <SelectItem value="reset-limits">Reset Limits</SelectItem>
                  </SelectContent>
                </Select>
                {userAction === 'update-tier' && (
                  <Select value={newTier} onValueChange={setNewTier}>
                    <SelectTrigger>
                      <SelectValue placeholder="New tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={handleUserAction} disabled={!selectedUser || !userAction}>
                  Execute Action
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle>Top Users</CardTitle>
              <CardDescription>Users sorted by monthly conversions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users?.users.slice(0, 20).map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium">{user.user_id.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {new Date(user.last_conversion_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getTierColor(user.subscription_tier)}>
                        {user.subscription_tier}
                      </Badge>
                      <Badge className={getStatusColor(user.status)}>
                        {user.status}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">{user.monthly_conversions} conversions</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(user.total_api_cost)} cost
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Average Upload Time:</span>
                    <span>{stats?.performance.averageUploadTime.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Processing Time:</span>
                    <span>{stats?.performance.averageProcessingTime.toFixed(1)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate:</span>
                    <span>{stats?.performance.errorRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timeout Rate:</span>
                    <span>{stats?.performance.timeoutRate.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Daily Conversions:</span>
                  <span>{stats?.usage.dailyConversions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Conversions:</span>
                  <span>{stats?.usage.monthlyConversions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak Hourly Rate:</span>
                  <span>{stats?.usage.peakHourlyRate}/hour</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Usage:</span>
                  <span>{stats?.usage.storageUsageGB.toFixed(2)} GB</span>
                </div>
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
                    <span>{formatCurrency(stats?.costs.totalApiCosts || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Costs:</span>
                    <span>{formatCurrency(stats?.costs.totalStorageCosts || 0)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-medium">
                    <span>Total Costs:</span>
                    <span>{formatCurrency((stats?.costs.totalApiCosts || 0) + (stats?.costs.totalStorageCosts || 0))}</span>
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
                  <span>Cost per Conversion:</span>
                  <span>{formatCurrency(stats?.costs.costPerConversion || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Burn Rate:</span>
                  <span>{formatCurrency(stats?.costs.monthlyBurn || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Annual Projection:</span>
                  <span>{formatCurrency((stats?.costs.monthlyBurn || 0) * 12)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}