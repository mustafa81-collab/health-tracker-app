// Service for managing offline functionality and sync queue

import { Exercise_Record, SyncResult } from "@/types";
import { DataStorageManager } from "./database/DataStorageManager";
import { SyncNotificationService } from "./SyncNotificationService";

export interface QueuedSyncOperation {
  id: string;
  type: "exercise_sync" | "step_sync";
  platform: string;
  timestamp: Date;
  retryCount: number;
  lastAttempt?: Date;
  data?: any; // Platform-specific data to sync
}

export interface OfflineStatus {
  isOnline: boolean;
  queuedOperations: number;
  lastOnlineTime?: Date | undefined;
  lastSyncAttempt?: Date | undefined;
}

export class OfflineManager {
  private isOnline: boolean = true;
  private syncQueue: QueuedSyncOperation[] = [];
  private storageManager: DataStorageManager;
  private notificationService: SyncNotificationService;
  private onlineCheckInterval?: NodeJS.Timeout | undefined;
  private statusListeners: ((status: OfflineStatus) => void)[] = [];
  private lastOnlineTime?: Date;
  private processingQueue: boolean = false;
  private isCleanedUp: boolean = false;

  constructor(
    storageManager: DataStorageManager,
    notificationService: SyncNotificationService
  ) {
    this.storageManager = storageManager;
    this.notificationService = notificationService;
    this.startOnlineMonitoring();
  }

  /**
   * Start monitoring online/offline status
   */
  private startOnlineMonitoring(): void {
    // Check online status every 30 seconds
    this.onlineCheckInterval = setInterval(() => {
      this.checkOnlineStatus();
    }, 30000);

    // Initial check
    this.checkOnlineStatus();
  }

  /**
   * Stop monitoring online/offline status
   */
  stopOnlineMonitoring(): void {
    if (this.onlineCheckInterval) {
      clearInterval(this.onlineCheckInterval);
      this.onlineCheckInterval = undefined as NodeJS.Timeout | undefined;
    }
  }

  /**
   * Check if device is online (simplified implementation)
   * In a real app, this would use NetInfo or similar
   */
  private async checkOnlineStatus(): Promise<void> {
    try {
      // Simple connectivity check - in production, use NetInfo
      const wasOnline = this.isOnline;

      // Mock online check - in real implementation, use:
      // const netInfo = await NetInfo.fetch();
      // this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      // For now, assume we're online (can be overridden for testing)
      this.isOnline = true;

      if (!wasOnline && this.isOnline) {
        // Just came back online
        this.handleBackOnline();
      } else if (wasOnline && !this.isOnline) {
        // Just went offline
        this.handleGoOffline();
      }

      this.notifyStatusListeners();
    } catch (error) {
      // If we can't check, assume offline
      if (this.isOnline) {
        this.isOnline = false;
        this.handleGoOffline();
        this.notifyStatusListeners();
      }
    }
  }

  /**
   * Handle going offline
   */
  private handleGoOffline(): void {
    this.notificationService.notifyOfflineMode();
  }

  /**
   * Handle coming back online
   */
  private handleBackOnline(): void {
    this.lastOnlineTime = new Date();
    this.notificationService.notifyBackOnline();
    // Don't await this to avoid blocking
    this.processSyncQueue().catch((error) => {
      console.warn("Error processing sync queue:", error);
    });
  }

  /**
   * Add a sync operation to the queue
   */
  queueSyncOperation(
    operation: Omit<QueuedSyncOperation, "id" | "timestamp" | "retryCount">
  ): string {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedOperation: QueuedSyncOperation = {
      ...operation,
      id,
      timestamp: new Date(),
      retryCount: 0,
    };

    this.syncQueue.push(queuedOperation);
    this.notificationService.updatePendingRecords(this.syncQueue.length);
    this.notifyStatusListeners();

    // If we're online, try to process immediately
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return id;
  }

  /**
   * Remove a sync operation from the queue
   */
  removeSyncOperation(id: string): void {
    this.syncQueue = this.syncQueue.filter((op) => op.id !== id);
    this.notificationService.updatePendingRecords(this.syncQueue.length);
    this.notifyStatusListeners();
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue(): Promise<void> {
    if (
      !this.isOnline ||
      this.syncQueue.length === 0 ||
      this.processingQueue ||
      this.isCleanedUp
    ) {
      return;
    }

    this.processingQueue = true;

    try {
      // Process operations in order
      const operations = [...this.syncQueue];

      for (const operation of operations) {
        // Check if we've been cleaned up during processing
        if (this.isCleanedUp) {
          break;
        }

        try {
          await this.processSyncOperation(operation);
          this.removeSyncOperation(operation.id);
        } catch (error) {
          // Update retry count and last attempt
          const updatedOperation = {
            ...operation,
            retryCount: operation.retryCount + 1,
            lastAttempt: new Date(),
          };

          // Replace in queue
          const index = this.syncQueue.findIndex(
            (op) => op.id === operation.id
          );
          if (index !== -1) {
            this.syncQueue[index] = updatedOperation;
          }

          // If too many retries, remove from queue
          if (updatedOperation.retryCount >= 3) {
            this.removeSyncOperation(operation.id);
            console.warn(
              `Sync operation ${operation.id} failed after 3 retries`
            );
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process a single sync operation
   */
  private async processSyncOperation(
    operation: QueuedSyncOperation
  ): Promise<void> {
    // Check if we've been cleaned up
    if (this.isCleanedUp) {
      return;
    }

    // This would delegate to the appropriate adapter
    // For now, we'll simulate the operation

    console.log(
      `Processing sync operation: ${operation.type} for ${operation.platform}`
    );

    // Simulate network delay - reduced for testing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Check again after delay
    if (this.isCleanedUp) {
      return;
    }

    // In a real implementation, this would:
    // 1. Get the appropriate health adapter
    // 2. Call the sync method
    // 3. Handle the result

    // For now, we'll just log success
    console.log(`Sync operation ${operation.id} completed successfully`);
  }

  /**
   * Get current offline status
   */
  getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      queuedOperations: this.syncQueue.length,
      lastOnlineTime: this.lastOnlineTime,
      lastSyncAttempt:
        this.syncQueue.length > 0
          ? this.syncQueue[this.syncQueue.length - 1]?.lastAttempt
          : (undefined as Date | undefined),
    };
  }

  /**
   * Get queued operations
   */
  getQueuedOperations(): QueuedSyncOperation[] {
    return [...this.syncQueue];
  }

  /**
   * Clear the sync queue (for testing or manual intervention)
   */
  clearSyncQueue(): void {
    this.syncQueue = [];
    this.notificationService.updatePendingRecords(0);
    this.notifyStatusListeners();
  }

  /**
   * Manually set online status (for testing)
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (!wasOnline && isOnline) {
      this.handleBackOnline();
    } else if (wasOnline && !isOnline) {
      this.handleGoOffline();
    }

    this.notifyStatusListeners();
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(listener: (status: OfflineStatus) => void): () => void {
    this.statusListeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify status listeners
   */
  private notifyStatusListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => listener(status));
  }

  /**
   * Check if we're currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Force a sync attempt (even if offline, for testing)
   */
  async forceSyncAttempt(): Promise<void> {
    await this.processSyncQueue();
  }

  /**
   * Get sync queue statistics
   */
  getQueueStats(): {
    total: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
    oldestOperation?: Date | undefined;
  } {
    const stats = {
      total: this.syncQueue.length,
      byType: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      oldestOperation: undefined as Date | undefined,
    };

    for (const operation of this.syncQueue) {
      // Count by type
      stats.byType[operation.type] = (stats.byType[operation.type] || 0) + 1;

      // Count by platform
      stats.byPlatform[operation.platform] =
        (stats.byPlatform[operation.platform] || 0) + 1;

      // Track oldest operation
      if (
        !stats.oldestOperation ||
        operation.timestamp < stats.oldestOperation
      ) {
        stats.oldestOperation = operation.timestamp;
      }
    }

    return stats;
  }

  /**
   * Cleanup - stop monitoring and clear resources
   */
  cleanup(): void {
    this.isCleanedUp = true;
    this.stopOnlineMonitoring();
    this.statusListeners = [];
    this.clearSyncQueue();
    this.processingQueue = false;
  }
}
