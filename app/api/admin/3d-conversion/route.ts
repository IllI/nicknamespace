// Admin API routes for 3D Conversion monitoring

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AdminMonitoringService } from '@/lib/services/admin-monitoring-service';

// Check if user is admin (simplified - in production would check roles/permissions)
async function isAdmin(userId: string): Promise<boolean> {
  // In a real implementation, you would check user roles in your database
  // For now, we'll use environment variable for admin user IDs
  const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
  return adminIds.includes(userId);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin permissions
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stats';

    switch (type) {
      case 'stats': {
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        
        const startDate = startDateParam ? new Date(startDateParam) : undefined;
        const endDate = endDateParam ? new Date(endDateParam) : undefined;

        const stats = await AdminMonitoringService.getSystemStats(startDate, endDate);
        return NextResponse.json({ stats });
      }

      case 'users': {
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');
        const sortBy = searchParams.get('sortBy') as 'conversions' | 'cost' | 'date' || 'conversions';

        const userManagement = await AdminMonitoringService.getUserManagement(limit, offset, sortBy);
        return NextResponse.json({ userManagement });
      }

      case 'health': {
        // Simple health check for now
        const stats = await AdminMonitoringService.getSystemStats();
        const health = {
          status: 'healthy' as const,
          metrics: {
            apiResponseTime: stats.performance.averageProcessingTime,
            errorRate: stats.performance.errorRate,
            storageUsage: stats.usage.storageUsageGB,
            activeConnections: stats.overview.activeUsers
          },
          alerts: [] as Array<{ level: string; message: string; timestamp: string }>
        };

        // Add alerts based on thresholds
        if (stats.performance.errorRate > 10) {
          health.alerts.push({
            level: 'warning',
            message: `High error rate: ${stats.performance.errorRate.toFixed(1)}%`,
            timestamp: new Date().toISOString()
          });
        }

        if (stats.performance.averageProcessingTime > 10) {
          health.alerts.push({
            level: 'warning',
            message: `Slow processing: ${stats.performance.averageProcessingTime.toFixed(1)} minutes`,
            timestamp: new Date().toISOString()
          });
        }

        return NextResponse.json({ health });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: stats, users, or health' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin permissions
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'update-user-tier': {
        const { userId, newTier } = params;
        if (!userId || !newTier || !['free', 'premium', 'enterprise'].includes(newTier)) {
          return NextResponse.json(
            { error: 'Valid userId and newTier are required' },
            { status: 400 }
          );
        }

        // Update user tier in database
        const { error } = await supabase
          .from('user_usage')
          .update({
            subscription_tier: newTier,
            updated_at: new Date().toISOString()
          } as any)
          .eq('user_id', userId);

        if (error) {
          throw new Error(`Failed to update user tier: ${error.message}`);
        }

        return NextResponse.json({ success: true, message: `User tier updated to ${newTier}` });
      }

      case 'reset-user-limits': {
        const { userId } = params;
        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required' },
            { status: 400 }
          );
        }

        // Reset user daily limits
        const { error } = await supabase
          .from('user_usage')
          .update({
            daily_conversions: 0,
            updated_at: new Date().toISOString()
          } as any)
          .eq('user_id', userId);

        if (error) {
          throw new Error(`Failed to reset user limits: ${error.message}`);
        }

        return NextResponse.json({ success: true, message: 'User limits reset successfully' });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: update-user-tier or reset-user-limits' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}