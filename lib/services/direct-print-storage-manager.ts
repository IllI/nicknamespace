// Storage Management Service for Direct 3D Model Printing
import { createClient } from '@supabase/supabase-js';
import { DirectPrintDatabase } from './direct-print-database';
import { DirectPrintJob, StorageUsage } from '@/lib/types/direct-print-jobs';

interface StorageCleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
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

interface UserStorageQuota {
  userId: string;
  tier: 'free' | 'premium' | 'enterprise';
  currentUsageBytes: number;
  quotaLimitBytes: number;
  utilizationPercent: number;
  canUpload: boolean;
}

export class DirectPrintStorageManager {
  private supabase;
  private database: DirectPrintDatabase;
  private readonly BUCKET_NAME = 'direct-3d-models';

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.database = new DirectPrintDatabase();
  }

  /**
   * Cleanup failed job files older than specified days
   */
  async cleanupFailedJobs(olderThanDays: number = 7): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      filesDeleted: 0,
      bytesFreed: 0,
      errors: []
    };

    try {
      // First, mark failed jobs for cleanup in the database
      await this.database.markFailedJobsForCleanup();

      // Get jobs marked for cleanup
      const jobsToCleanup = await this.database.getJobsForCleanup();

      console.log(`Found ${jobsToCleanup.length} jobs marked for cleanup`);

      for (const job of jobsToCleanup) {
        try {
          // Delete the file from storage
          const { error } = await this.supabase.storage
            .from(this.BUCKET_NAME)
            .remove([job.storage_path]);

          if (error) {
            result.errors.push(`Failed to delete file ${job.storage_path}: ${error.message}`);
            continue;
          }

          // Delete the job record from database
          await this.database.deleteJob(job.id);

          result.filesDeleted++;
          result.bytesFreed += job.file_size_bytes;

          console.log(`Cleaned up job ${job.id}: ${job.filename} (${job.file_size_bytes} bytes)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to cleanup job ${job.id}: ${errorMessage}`);
        }
      }

      console.log(`Cleanup completed: ${result.filesDeleted} files deleted, ${result.bytesFreed} bytes freed`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Cleanup process failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get storage usage analytics across all users
   */
  async getStorageAnalytics(): Promise<StorageAnalytics> {
    try {
      const { data: jobs, error } = await this.supabase
        .from('direct_print_jobs')
        .select(`
          id,
          user_id,
          file_size_bytes,
          status,
          created_at,
          user_usage!inner(subscription_tier)
        `)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get storage analytics: ${error.message}`);
      }

      const analytics: StorageAnalytics = {
        totalUsers: 0,
        totalFiles: jobs?.length || 0,
        totalSizeBytes: 0,
        averageFileSize: 0,
        storageByStatus: {},
        storageByUserTier: {},
        oldestFile: '',
        newestFile: ''
      };

      if (!jobs || jobs.length === 0) {
        return analytics;
      }

      // Calculate basic metrics
      const uniqueUsers = new Set(jobs.map(job => job.user_id));
      analytics.totalUsers = uniqueUsers.size;
      analytics.totalSizeBytes = jobs.reduce((sum, job) => sum + job.file_size_bytes, 0);
      analytics.averageFileSize = analytics.totalSizeBytes / analytics.totalFiles;
      analytics.oldestFile = jobs[0].created_at;
      analytics.newestFile = jobs[jobs.length - 1].created_at;

      // Group by status
      for (const job of jobs) {
        if (!analytics.storageByStatus[job.status]) {
          analytics.storageByStatus[job.status] = { files: 0, sizeBytes: 0 };
        }
        analytics.storageByStatus[job.status].files++;
        analytics.storageByStatus[job.status].sizeBytes += job.file_size_bytes;
      }

      // Group by user tier
      for (const job of jobs) {
        const tier = job.user_usage?.subscription_tier || 'free';
        if (!analytics.storageByUserTier[tier]) {
          analytics.storageByUserTier[tier] = { users: 0, files: 0, sizeBytes: 0 };
        }
        analytics.storageByUserTier[tier].files++;
        analytics.storageByUserTier[tier].sizeBytes += job.file_size_bytes;
      }

      // Count unique users per tier
      const usersByTier = new Map<string, Set<string>>();
      for (const job of jobs) {
        const tier = job.user_usage?.subscription_tier || 'free';
        if (!usersByTier.has(tier)) {
          usersByTier.set(tier, new Set());
        }
        usersByTier.get(tier)!.add(job.user_id);
      }

      for (const [tier, users] of usersByTier) {
        if (analytics.storageByUserTier[tier]) {
          analytics.storageByUserTier[tier].users = users.size;
        }
      }

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get storage analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage quota information for a specific user
   */
  async getUserStorageQuota(userId: string): Promise<UserStorageQuota> {
    try {
      // Get user's subscription tier
      const { data: userUsage, error: userError } = await this.supabase
        .from('user_usage')
        .select('subscription_tier')
        .eq('user_id', userId)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw new Error(`Failed to get user tier: ${userError.message}`);
      }

      const tier = userUsage?.subscription_tier || 'free';

      // Get storage usage
      const usage = await this.database.getUserStorageUsage(userId);

      // Define quota limits
      const quotaLimits = {
        free: 1073741824,      // 1GB
        premium: 5368709120,   // 5GB
        enterprise: 21474836480 // 20GB
      };

      const quotaLimit = quotaLimits[tier as keyof typeof quotaLimits] || quotaLimits.free;
      const utilizationPercent = (usage.total_size_bytes / quotaLimit) * 100;

      return {
        userId,
        tier: tier as 'free' | 'premium' | 'enterprise',
        currentUsageBytes: usage.total_size_bytes,
        quotaLimitBytes: quotaLimit,
        utilizationPercent: Math.round(utilizationPercent * 100) / 100,
        canUpload: usage.total_size_bytes < quotaLimit
      };
    } catch (error) {
      throw new Error(`Failed to get user storage quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get users approaching their storage quota
   */
  async getUsersApproachingQuota(thresholdPercent: number = 80): Promise<UserStorageQuota[]> {
    try {
      // Get all users with storage usage
      const { data: users, error } = await this.supabase
        .from('direct_print_jobs')
        .select('user_id')
        .neq('status', 'cleanup_pending');

      if (error) {
        throw new Error(`Failed to get users: ${error.message}`);
      }

      if (!users) {
        return [];
      }

      const uniqueUsers = [...new Set(users.map(u => u.user_id))];
      const usersApproachingQuota: UserStorageQuota[] = [];

      for (const userId of uniqueUsers) {
        try {
          const quota = await this.getUserStorageQuota(userId);
          if (quota.utilizationPercent >= thresholdPercent) {
            usersApproachingQuota.push(quota);
          }
        } catch (error) {
          console.error(`Failed to get quota for user ${userId}:`, error);
        }
      }

      return usersApproachingQuota.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
    } catch (error) {
      throw new Error(`Failed to get users approaching quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup orphaned files (files in storage without database records)
   */
  async cleanupOrphanedFiles(): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      filesDeleted: 0,
      bytesFreed: 0,
      errors: []
    };

    try {
      // List all files in the storage bucket
      const { data: files, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          limit: 1000,
          offset: 0
        });

      if (error) {
        result.errors.push(`Failed to list storage files: ${error.message}`);
        return result;
      }

      if (!files || files.length === 0) {
        return result;
      }

      // Get all storage paths from database
      const { data: jobs, error: jobsError } = await this.supabase
        .from('direct_print_jobs')
        .select('storage_path');

      if (jobsError) {
        result.errors.push(`Failed to get job storage paths: ${jobsError.message}`);
        return result;
      }

      const validPaths = new Set(jobs?.map(job => job.storage_path) || []);

      // Find orphaned files
      for (const file of files) {
        if (file.name && !validPaths.has(file.name)) {
          try {
            const { error: deleteError } = await this.supabase.storage
              .from(this.BUCKET_NAME)
              .remove([file.name]);

            if (deleteError) {
              result.errors.push(`Failed to delete orphaned file ${file.name}: ${deleteError.message}`);
            } else {
              result.filesDeleted++;
              result.bytesFreed += file.metadata?.size || 0;
              console.log(`Deleted orphaned file: ${file.name}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Error deleting orphaned file ${file.name}: ${errorMessage}`);
          }
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Orphaned file cleanup failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Generate storage usage report
   */
  async generateStorageReport(): Promise<{
    analytics: StorageAnalytics;
    quotaWarnings: UserStorageQuota[];
    cleanupRecommendations: {
      failedJobsOlderThan7Days: number;
      orphanedFiles: number;
      potentialSavingsBytes: number;
    };
  }> {
    try {
      const [analytics, quotaWarnings] = await Promise.all([
        this.getStorageAnalytics(),
        this.getUsersApproachingQuota(80)
      ]);

      // Get cleanup recommendations
      const failedJobs = await this.supabase
        .from('direct_print_jobs')
        .select('file_size_bytes')
        .eq('status', 'failed')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const failedJobsCount = failedJobs.data?.length || 0;
      const potentialSavingsBytes = failedJobs.data?.reduce((sum, job) => sum + job.file_size_bytes, 0) || 0;

      return {
        analytics,
        quotaWarnings,
        cleanupRecommendations: {
          failedJobsOlderThan7Days: failedJobsCount,
          orphanedFiles: 0, // Would need to implement full orphaned file detection
          potentialSavingsBytes
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate storage report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce storage quotas by preventing uploads
   */
  async enforceStorageQuota(userId: string, fileSizeBytes: number): Promise<{
    allowed: boolean;
    reason: string;
    currentUsage: StorageUsage;
    quota: UserStorageQuota;
  }> {
    try {
      const [currentUsage, quota] = await Promise.all([
        this.database.getUserStorageUsage(userId),
        this.getUserStorageQuota(userId)
      ]);

      const wouldExceedQuota = (quota.currentUsageBytes + fileSizeBytes) > quota.quotaLimitBytes;

      return {
        allowed: !wouldExceedQuota,
        reason: wouldExceedQuota 
          ? `Upload would exceed ${quota.tier} tier storage limit of ${Math.round(quota.quotaLimitBytes / 1024 / 1024)}MB`
          : 'Upload allowed',
        currentUsage,
        quota
      };
    } catch (error) {
      throw new Error(`Failed to enforce storage quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}