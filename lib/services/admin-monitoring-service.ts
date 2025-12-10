// Admin Monitoring Service for 3D Conversion System

import { createClient } from '@supabase/supabase-js';
import { ConversionDatabaseService } from './conversion-database';
import { UserUsage, ConversionRecord } from '../types/3d-conversion';
import { CONVERSION_CONFIG } from '../config/3d-conversion';

// Initialize Supabase client for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface SystemStats {
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

export interface UserManagement {
  users: Array<{
    user_id: string;
    email?: string;
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

export class AdminMonitoringService {
  /**
   * Get comprehensive system statistics
   */
  static async getSystemStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<SystemStats> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Get conversion statistics
    const conversionStats = await ConversionDatabaseService.getConversionStatistics(
      start.toISOString(),
      end.toISOString()
    );

    // Get user statistics
    const { data: allUsers, error: usersError } = await supabase
      .from('user_usage')
      .select('*');

    if (usersError) {
      throw new Error(`Failed to get user statistics: ${usersError.message}`);
    }

    const totalUsers = allUsers?.length || 0;
    const activeUsers = allUsers?.filter((u: any) => 
      u.last_conversion_date && 
      new Date(u.last_conversion_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length || 0;

    // Calculate storage usage
    const { data: storageData, error: storageError } = await supabase
      .from('conversion_records')
      .select('file_sizes')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (storageError) {
      throw new Error(`Failed to get storage statistics: ${storageError.message}`);
    }

    const totalStorageBytes = storageData?.reduce((sum: number, record: any) => {
      const sizes = record.file_sizes || {};
      return sum + (sizes.original_image_bytes || 0) + (sizes.model_file_bytes || 0);
    }, 0) || 0;

    const storageUsageGB = totalStorageBytes / (1024 * 1024 * 1024);

    // Calculate costs
    const totalApiCosts = allUsers?.reduce((sum: number, user: any) => sum + (user.total_api_cost || 0), 0) || 0;
    const totalStorageCosts = storageUsageGB * CONVERSION_CONFIG.API_COSTS.STORAGE_PER_GB_MONTH;
    const costPerConversion = conversionStats.totalConversions > 0 
      ? (totalApiCosts + totalStorageCosts) / conversionStats.totalConversions 
      : 0;

    // Calculate monthly burn rate
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const dailyApiCost = totalApiCosts / daysInPeriod;
    const monthlyBurn = dailyApiCost * 30;

    return {
      overview: {
        totalUsers,
        activeUsers,
        totalConversions: conversionStats.totalConversions,
        successRate: conversionStats.totalConversions > 0 
          ? (conversionStats.successfulConversions / conversionStats.totalConversions) * 100 
          : 0,
        totalApiCost: totalApiCosts,
        averageProcessingTime: conversionStats.averageProcessingTime
      },
      usage: {
        dailyConversions: Math.round(conversionStats.totalConversions / daysInPeriod),
        monthlyConversions: conversionStats.totalConversions,
        peakHourlyRate: Math.round(conversionStats.totalConversions / daysInPeriod / 24 * 3), // Estimate peak as 3x average
        storageUsageGB
      },
      performance: {
        averageUploadTime: 2.5, // Estimated - would need more detailed tracking
        averageProcessingTime: conversionStats.averageProcessingTime,
        errorRate: conversionStats.totalConversions > 0 
          ? (conversionStats.failedConversions / conversionStats.totalConversions) * 100 
          : 0,
        timeoutRate: 5 // Estimated - would need more detailed tracking
      },
      costs: {
        totalApiCosts,
        totalStorageCosts,
        costPerConversion,
        monthlyBurn
      }
    };
  }

  /**
   * Get user management data
   */
  static async getUserManagement(
    limit: number = 100,
    offset: number = 0,
    sortBy: 'conversions' | 'cost' | 'date' = 'conversions'
  ): Promise<UserManagement> {
    let orderColumn = 'monthly_conversions';
    if (sortBy === 'cost') orderColumn = 'total_api_cost';
    if (sortBy === 'date') orderColumn = 'last_conversion_date';

    const { data: users, error } = await supabase
      .from('user_usage')
      .select(`
        user_id,
        subscription_tier,
        daily_conversions,
        monthly_conversions,
        total_api_cost,
        last_conversion_date
      `)
      .order(orderColumn, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get user management data: ${error.message}`);
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('user_usage')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to get user count: ${countError.message}`);
    }

    // Calculate tier distribution
    const { data: allUsers, error: allUsersError } = await supabase
      .from('user_usage')
      .select('subscription_tier');

    if (allUsersError) {
      throw new Error(`Failed to get tier distribution: ${allUsersError.message}`);
    }

    const tierDistribution = allUsers?.reduce((acc: any, user: any) => {
      acc[user.subscription_tier as keyof typeof acc]++;
      return acc;
    }, { free: 0, premium: 0, enterprise: 0 }) || { free: 0, premium: 0, enterprise: 0 };

    // Enhance user data with status
    const enhancedUsers = users?.map((user: any) => ({
      ...user,
      status: this.getUserStatus(user) as 'active' | 'inactive' | 'suspended'
    })) || [];

    return {
      users: enhancedUsers,
      totalCount: count || 0,
      tierDistribution
    };
  }

  /**
   * Helper method to determine user status
   */
  private static getUserStatus(user: any): string {
    const lastConversion = user.last_conversion_date ? new Date(user.last_conversion_date) : null;
    const daysSinceLastConversion = lastConversion 
      ? Math.floor((Date.now() - lastConversion.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    if (daysSinceLastConversion <= 7) return 'active';
    if (daysSinceLastConversion <= 30) return 'inactive';
    return 'suspended';
  }
}