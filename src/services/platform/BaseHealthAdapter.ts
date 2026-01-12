// Base class for health platform adapters with common functionality

import { HealthPlatformSync } from "@/services/interfaces";
import { DataStorageManager } from "../database/DataStorageManager";
import { SyncNotificationService } from "../SyncNotificationService";
import { OfflineManager } from "../OfflineManager";
import {
  PermissionStatus,
  SyncResult,
  SyncError,
  RetryResult,
  Exercise_Record,
  DataSource,
  HealthPlatform,
} from "@/types";
import { SYNC_CONFIG } from "@/utils/constants";

export abstract class BaseHealthAdapter implements HealthPlatformSync {
  protected storageManager: DataStorageManager;
  protected notificationService: SyncNotificationService;
  protected offlineManager: OfflineManager;
  protected platform: HealthPlatform;
  private retryCount: number = 0;
  private lastSyncTimestamp: Date | null = null;

  constructor(
    storageManager: DataStorageManager,
    platform: HealthPlatform,
    notificationService?: SyncNotificationService,
    offlineManager?: OfflineManager
  ) {
    this.storageManager = storageManager;
    this.platform = platform;
    this.notificationService =
      notificationService || new SyncNotificationService();
    this.offlineManager =
      offlineManager ||
      new OfflineManager(storageManager, this.notificationService);
  }

  // Abstract methods that must be implemented by platform-specific adapters
  abstract requestPermissions(): Promise<PermissionStatus>;
  abstract syncExerciseData(): Promise<SyncResult>;
  abstract syncStepData(): Promise<SyncResult>;

  /**
   * Handle sync failures with exponential backoff retry logic
   */
  async handleSyncFailure(error: SyncError): Promise<RetryResult> {
    this.retryCount++;

    if (!error.retryable || this.retryCount >= SYNC_CONFIG.RETRY_ATTEMPTS) {
      // Reset retry count and return failure
      this.retryCount = 0;
      const retryResult = {
        success: false,
        nextRetryDelay: 0,
        maxRetriesReached: true,
      };

      // Notify about the sync error
      this.notificationService.notifySyncError(error, retryResult);

      return retryResult;
    }

    // Calculate exponential backoff delay
    const baseDelay = SYNC_CONFIG.INITIAL_RETRY_DELAY;
    const backoffMultiplier = SYNC_CONFIG.BACKOFF_MULTIPLIER;
    const maxDelay = SYNC_CONFIG.MAX_RETRY_DELAY;

    let nextDelay =
      baseDelay * Math.pow(backoffMultiplier, this.retryCount - 1);
    nextDelay = Math.min(nextDelay, maxDelay);

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * nextDelay;
    nextDelay += jitter;

    const retryResult = {
      success: false,
      nextRetryDelay: Math.round(nextDelay),
      maxRetriesReached: false,
    };

    // Notify about the sync error
    this.notificationService.notifySyncError(error, retryResult);

    return retryResult;
  }

  /**
   * Reset retry counter (call after successful sync)
   */
  protected resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTimestamp(): Date | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Update last sync timestamp
   */
  protected updateLastSyncTimestamp(): void {
    this.lastSyncTimestamp = new Date();
  }

  /**
   * Create Exercise_Record from platform-specific data
   */
  protected createExerciseRecord(
    id: string,
    name: string,
    startTime: Date,
    duration: number,
    metadata: any = {}
  ): Exercise_Record {
    const now = new Date();

    return {
      id: this.generateSyncedRecordId(id),
      name,
      startTime,
      duration,
      source: DataSource.SYNCED,
      platform: this.platform,
      metadata: {
        ...metadata,
        originalId: id,
        syncedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Generate unique ID for synced records
   */
  protected generateSyncedRecordId(originalId: string): string {
    const platformPrefix =
      this.platform === HealthPlatform.APPLE_HEALTHKIT ? "hk" : "hc";
    return `${platformPrefix}_${originalId}_${Date.now()}`;
  }

  /**
   * Save synced exercise records to storage
   */
  protected async saveSyncedRecords(records: Exercise_Record[]): Promise<void> {
    for (const record of records) {
      await this.storageManager.saveExerciseRecord(record);

      // Create audit record
      await this.storageManager.saveAuditRecord({
        id: this.generateAuditId(),
        action: "record_created" as any,
        timestamp: new Date(),
        recordId: record.id,
        beforeData: null,
        afterData: record,
        metadata: {
          source: "platform_sync",
          platform: this.platform,
          originalId: record.metadata.originalId || "",
        },
      });
    }
  }

  /**
   * Check for duplicate records to prevent re-syncing
   */
  protected async isDuplicateRecord(
    originalId: string,
    startTime: Date
  ): Promise<boolean> {
    try {
      // Check for existing records with same original ID and start time
      const dateRange = {
        start: new Date(startTime.getTime() - 60 * 1000), // 1 minute before
        end: new Date(startTime.getTime() + 60 * 1000), // 1 minute after
      };

      const existingRecords = await this.storageManager.getExerciseHistory(
        dateRange
      );

      return existingRecords.some(
        (record) =>
          record.source === DataSource.SYNCED &&
          record.platform === this.platform &&
          record.metadata.originalId === originalId
      );
    } catch (error) {
      console.warn("Error checking for duplicate records:", error);
      return false; // If we can't check, assume it's not a duplicate
    }
  }

  /**
   * Create successful sync result
   */
  protected createSuccessResult(newRecords: Exercise_Record[]): SyncResult {
    this.resetRetryCount();
    this.updateLastSyncTimestamp();

    const result: SyncResult = {
      newRecords,
      conflicts: [], // Conflicts will be detected separately
      lastSyncTimestamp: this.lastSyncTimestamp!,
      success: true,
    };

    // Notify success
    this.notificationService.notifySyncSuccess(result);

    return result;
  }

  /**
   * Create failed sync result
   */
  protected createFailureResult(error: string): SyncResult {
    const result: SyncResult = {
      newRecords: [],
      conflicts: [],
      lastSyncTimestamp: this.lastSyncTimestamp || new Date(),
      success: false,
      error,
    };

    // Notify error
    const syncError: SyncError = {
      code: "SYNC_FAILED",
      message: error,
      retryable: true,
    };
    this.notificationService.notifySyncError(syncError);

    return result;
  }

  /**
   * Validate sync data before processing
   */
  protected validateSyncData(data: any): boolean {
    if (!data) {
      return false;
    }

    // Basic validation - can be extended by subclasses
    return typeof data === "object";
  }

  /**
   * Convert duration from platform format to minutes
   */
  protected convertDurationToMinutes(
    duration: number,
    unit: string = "seconds"
  ): number {
    switch (unit.toLowerCase()) {
      case "seconds":
        return Math.round(duration / 60);
      case "minutes":
        return Math.round(duration);
      case "hours":
        return Math.round(duration * 60);
      case "milliseconds":
        return Math.round(duration / 60000);
      default:
        return Math.round(duration / 60); // Assume seconds by default
    }
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `audit_sync_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Get platform name for logging
   */
  getPlatformName(): string {
    return this.platform;
  }

  /**
   * Check if adapter is properly initialized
   */
  abstract isInitialized(): Promise<boolean>;

  /**
   * Perform sync with automatic retry and notifications
   */
  async syncWithRetry(): Promise<SyncResult> {
    // Check if we're offline
    if (!this.offlineManager.isCurrentlyOnline()) {
      // Queue the sync operation for later
      this.offlineManager.queueSyncOperation({
        type: "exercise_sync",
        platform: this.platform,
      });

      return this.createFailureResult(
        "Device is offline. Sync queued for when connection is restored."
      );
    }

    this.notificationService.notifySyncStart();

    try {
      const result = await this.syncExerciseData();

      if (result.success) {
        return result; // Success notification already sent in createSuccessResult
      } else {
        // Handle retry logic
        const syncError: SyncError = {
          code: "SYNC_FAILED",
          message: result.error || "Unknown sync error",
          retryable: true,
        };

        const retryResult = await this.handleSyncFailure(syncError);

        if (!retryResult.maxRetriesReached) {
          // Schedule retry
          setTimeout(() => {
            this.syncWithRetry();
          }, retryResult.nextRetryDelay);
        } else {
          // Queue for offline retry if max retries reached
          this.offlineManager.queueSyncOperation({
            type: "exercise_sync",
            platform: this.platform,
          });
        }

        return result;
      }
    } catch (error) {
      const syncError: SyncError = {
        code: "SYNC_EXCEPTION",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      };

      const retryResult = await this.handleSyncFailure(syncError);
      this.notificationService.notifySyncError(syncError, retryResult);

      if (!retryResult.maxRetriesReached) {
        // Schedule retry
        setTimeout(() => {
          this.syncWithRetry();
        }, retryResult.nextRetryDelay);
      } else {
        // Queue for offline retry if max retries reached
        this.offlineManager.queueSyncOperation({
          type: "exercise_sync",
          platform: this.platform,
        });
      }

      return this.createFailureResult(syncError.message);
    }
  }

  /**
   * Get notification service for external access
   */
  getNotificationService(): SyncNotificationService {
    return this.notificationService;
  }

  /**
   * Get offline manager for external access
   */
  getOfflineManager(): OfflineManager {
    return this.offlineManager;
  }
}
