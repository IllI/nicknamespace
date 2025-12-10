// Background Service Manager for Job Status Synchronization
import { jobStatusSynchronizer } from './job-status-synchronizer';

export class BackgroundServiceManager {
  private static instance: BackgroundServiceManager;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): BackgroundServiceManager {
    if (!BackgroundServiceManager.instance) {
      BackgroundServiceManager.instance = new BackgroundServiceManager();
    }
    return BackgroundServiceManager.instance;
  }

  /**
   * Initialize background services
   * Should be called once when the application starts
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Background services already initialized');
      return;
    }

    console.log('🚀 Initializing background services...');

    try {
      // Start job status synchronizer
      await jobStatusSynchronizer.start();
      
      this.isInitialized = true;
      console.log('✅ Background services initialized successfully');
      
      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();
      
    } catch (error) {
      console.error('❌ Failed to initialize background services:', error);
      throw error;
    }
  }

  /**
   * Shutdown all background services gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('🛑 Shutting down background services...');

    try {
      // Stop job status synchronizer
      jobStatusSynchronizer.stop();
      
      this.isInitialized = false;
      console.log('✅ Background services shut down successfully');
      
    } catch (error) {
      console.error('❌ Error during background services shutdown:', error);
    }
  }

  /**
   * Get status of all background services
   */
  getServicesStatus(): {
    initialized: boolean;
    synchronizer: ReturnType<typeof jobStatusSynchronizer.getPollingStats>;
  } {
    return {
      initialized: this.isInitialized,
      synchronizer: jobStatusSynchronizer.getPollingStats()
    };
  }

  /**
   * Restart all background services
   */
  async restart(): Promise<void> {
    console.log('🔄 Restarting background services...');
    
    await this.shutdown();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.initialize();
    
    console.log('✅ Background services restarted');
  }

  /**
   * Set up graceful shutdown handlers for different environments
   */
  private setupShutdownHandlers(): void {
    // Only set up in server environments
    if (typeof window !== 'undefined') {
      return;
    }

    const shutdownHandler = async (signal: string) => {
      console.log(`📡 Received ${signal}, shutting down gracefully...`);
      await this.shutdown();
      process.exit(0);
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // Nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Health check for all background services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: {
      synchronizer: {
        running: boolean;
        activeJobs: number;
        lastError?: string;
      };
    };
    timestamp: string;
  }> {
    const syncStats = jobStatusSynchronizer.getPollingStats();
    
    return {
      healthy: this.isInitialized && syncStats.isRunning,
      services: {
        synchronizer: {
          running: syncStats.isRunning,
          activeJobs: syncStats.activeJobs
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const backgroundServiceManager = BackgroundServiceManager.getInstance();

// Auto-initialize in production server environments
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // Delay initialization to allow other services to start
  setTimeout(async () => {
    try {
      await backgroundServiceManager.initialize();
    } catch (error) {
      console.error('❌ Failed to auto-initialize background services:', error);
    }
  }, 5000); // 5 second delay
}