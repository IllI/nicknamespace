// Usage Tracking and Limits Service for 3D Conversion

import { ConversionDatabaseService } from './conversion-database';
import { UserUsage, ConversionRecord } from '../types/3d-conversion';
import { CONVERSION_CONFIG, getDailyLimit, SubscriptionTier } from '../config/3d-conversion';

export interface UsageStats {
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

export interface ConversionHistory {
  records: ConversionRecord[];
  totalCount: number;
  successRate: number;
  averageProcessingTime: number;
}

export class UsageTrackingService {
  /**
   * Check if user can perform a conversion (within limits)
   */
  static async canUserConvert(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    usage: UsageStats;
  }> {
    const userUsage = await ConversionDatabaseService.getUserUsage(userId);
    const usage = await this.getUserUsageStats(userId);
    
    if (usage.daily.remaining <= 0) {
      return {
        allowed: false,
        reason: `Daily limit of ${usage.daily.limit} conversions reached. Limit resets at midnight UTC.`,
        usage
      };
    }

    return {
      allowed: true,
      usage
    };
  }

  /**
   * Record a conversion attempt and update usage
   */
  static async recordConversionAttempt(
    userId: string,
    conversionId: string,
    apiCost: number = CONVERSION_CONFIG.API_COSTS.TRIPOSR_PER_REQUEST
  ): Promise<void> {
    // Increment conversion count
    await ConversionDatabaseService.incrementUserConversion(userId);
    
    // Update API cost
    await ConversionDatabaseService.updateUserApiCost(userId, apiCost);
  }

  /**
   * Get comprehensive usage statistics for a user
   */
  static async getUserUsageStats(userId: string): Promise<UsageStats> {
    const userUsage = await ConversionDatabaseService.getUserUsage(userId);
    const dailyLimit = getDailyLimit(userUsage.subscription_tier);
    
    // Calculate reset time (midnight UTC)
    const resetTime = new Date();
    resetTime.setUTCHours(24, 0, 0, 0);

    // Get total conversions from conversion records
    const allRecords = await ConversionDatabaseService.getUserConversionRecords(userId, 1000);
    const totalConversions = allRecords.length;

    return {
      daily: {
        conversions: userUsage.daily_conversions,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - userUsage.daily_conversions),
        resetTime
      },
      monthly: {
        conversions: userUsage.monthly_conversions,
        apiCost: userUsage.total_api_cost
      },
      total: {
        conversions: totalConversions,
        apiCost: userUsage.total_api_cost
      }
    };
  }

  /**
   * Get user's conversion history with analytics
   */
  static async getUserConversionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ConversionHistory> {
    const records = await ConversionDatabaseService.getUserConversionRecords(userId, limit, offset);
    const allRecords = await ConversionDatabaseService.getUserConversionRecords(userId, 1000);
    
    const totalCount = allRecords.length;
    const completedRecords = allRecords.filter(r => r.status === 'completed');
    const successRate = totalCount > 0 ? (completedRecords.length / totalCount) * 100 : 0;
    
    // Calculate average processing time for completed conversions
    const processingTimes = completedRecords
      .filter(r => r.created_at && r.completed_at)
      .map(r => {
        const start = new Date(r.created_at).getTime();
        const end = new Date(r.completed_at!).getTime();
        return (end - start) / 1000 / 60; // Convert to minutes
      });
    
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      records,
      totalCount,
      successRate,
      averageProcessingTime
    };
  }

  /**
   * Get cost breakdown for a user
   */
  static async getUserCostBreakdown(userId: string): Promise<{
    totalCost: number;
    apiCosts: number;
    storageCosts: number;
    breakdown: {
      conversions: number;
      avgCostPerConversion: number;
      estimatedMonthlyCost: number;
    };
  }> {
    const userUsage = await ConversionDatabaseService.getUserUsage(userId);
    const records = await ConversionDatabaseService.getUserConversionRecords(userId, 1000);
    
    const apiCosts = userUsage.total_api_cost;
    
    // Estimate storage costs based on file sizes
    const totalStorageBytes = records.reduce((sum, record) => {
      const imageSizeBytes = record.file_sizes?.original_image_bytes || 0;
      const modelSizeBytes = record.file_sizes?.model_file_bytes || 0;
      return sum + imageSizeBytes + modelSizeBytes;
    }, 0);
    
    const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);
    const storageCosts = totalStorageGB * CONVERSION_CONFIG.API_COSTS.STORAGE_PER_GB_MONTH;
    
    const totalCost = apiCosts + storageCosts;
    const avgCostPerConversion = records.length > 0 ? totalCost / records.length : 0;
    
    // Estimate monthly cost based on current usage pattern
    const daysInMonth = 30;
    const dailyAverage = userUsage.monthly_conversions / daysInMonth;
    const estimatedMonthlyCost = dailyAverage * avgCostPerConversion * daysInMonth;

    return {
      totalCost,
      apiCosts,
      storageCosts,
      breakdown: {
        conversions: records.length,
        avgCostPerConversion,
        estimatedMonthlyCost
      }
    };
  }

  /**
   * Upgrade user subscription tier
   */
  static async upgradeUserTier(
    userId: string,
    newTier: SubscriptionTier
  ): Promise<UserUsage> {
    const { data, error } = await ConversionDatabaseService['supabase']
      .from('user_usage')
      .update({
        subscription_tier: newTier,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upgrade user tier: ${error.message}`);
    }

    return data;
  }

  /**
   * Get usage analytics for date range
   */
  static async getUsageAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    dailyUsage: Array<{
      date: string;
      conversions: number;
      successfulConversions: number;
      failedConversions: number;
      apiCost: number;
    }>;
    summary: {
      totalConversions: number;
      successRate: number;
      totalCost: number;
      averageDaily: number;
    };
  }> {
    const records = await ConversionDatabaseService.getUserConversionRecords(userId, 1000);
    
    // Filter records by date range
    const filteredRecords = records.filter(record => {
      const recordDate = new Date(record.created_at);
      return recordDate >= startDate && recordDate <= endDate;
    });

    // Group by date
    const dailyGroups = new Map<string, ConversionRecord[]>();
    filteredRecords.forEach(record => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      if (!dailyGroups.has(date)) {
        dailyGroups.set(date, []);
      }
      dailyGroups.get(date)!.push(record);
    });

    // Calculate daily usage
    const dailyUsage = Array.from(dailyGroups.entries()).map(([date, dayRecords]) => {
      const conversions = dayRecords.length;
      const successfulConversions = dayRecords.filter(r => r.status === 'completed').length;
      const failedConversions = dayRecords.filter(r => r.status === 'failed').length;
      const apiCost = conversions * CONVERSION_CONFIG.API_COSTS.TRIPOSR_PER_REQUEST;

      return {
        date,
        conversions,
        successfulConversions,
        failedConversions,
        apiCost
      };
    });

    // Calculate summary
    const totalConversions = filteredRecords.length;
    const successfulConversions = filteredRecords.filter(r => r.status === 'completed').length;
    const successRate = totalConversions > 0 ? (successfulConversions / totalConversions) * 100 : 0;
    const totalCost = totalConversions * CONVERSION_CONFIG.API_COSTS.TRIPOSR_PER_REQUEST;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDaily = daysDiff > 0 ? totalConversions / daysDiff : 0;

    return {
      dailyUsage: dailyUsage.sort((a, b) => a.date.localeCompare(b.date)),
      summary: {
        totalConversions,
        successRate,
        totalCost,
        averageDaily
      }
    };
  }

  /**
   * Check if user needs to be prompted for upgrade
   */
  static async shouldPromptUpgrade(userId: string): Promise<{
    shouldPrompt: boolean;
    reason?: string;
    recommendedTier?: SubscriptionTier;
  }> {
    const userUsage = await ConversionDatabaseService.getUserUsage(userId);
    const usage = await this.getUserUsageStats(userId);

    // If user is at 80% of daily limit, suggest upgrade
    if (usage.daily.conversions >= usage.daily.limit * 0.8) {
      const nextTier = userUsage.subscription_tier === 'free' ? 'premium' : 'enterprise';
      return {
        shouldPrompt: true,
        reason: `You've used ${usage.daily.conversions} of ${usage.daily.limit} daily conversions. Upgrade for higher limits.`,
        recommendedTier: nextTier
      };
    }

    // If user has hit limit multiple times this month, suggest upgrade
    if (userUsage.subscription_tier === 'free' && userUsage.monthly_conversions >= 100) {
      return {
        shouldPrompt: true,
        reason: 'You\'re a power user! Upgrade to premium for higher daily limits and priority processing.',
        recommendedTier: 'premium'
      };
    }

    return { shouldPrompt: false };
  }
}