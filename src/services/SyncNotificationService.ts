// Service for managing sync status notifications and user feedback

import { SyncResult, SyncError, RetryResult } from "@/types";

export interface SyncNotification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  autoHide?: boolean;
  duration?: number | undefined; // milliseconds
}

export interface SyncStatusUpdate {
  isOnline: boolean;
  lastSyncTime?: Date;
  syncInProgress: boolean;
  pendingRecords: number;
  retryCount: number;
  nextRetryTime?: Date | undefined;
}

export class SyncNotificationService {
  private notifications: SyncNotification[] = [];
  private statusListeners: ((status: SyncStatusUpdate) => void)[] = [];
  private currentStatus: SyncStatusUpdate = {
    isOnline: true,
    syncInProgress: false,
    pendingRecords: 0,
    retryCount: 0,
  };

  /**
   * Add a notification to the queue
   */
  addNotification(
    notification: Omit<SyncNotification, "id" | "timestamp">
  ): string {
    const id = `notification_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const fullNotification: SyncNotification = {
      ...notification,
      id,
      timestamp: new Date(),
      autoHide: notification.autoHide ?? true,
      duration: notification.duration ?? 5000,
    };

    this.notifications.push(fullNotification);

    // Auto-remove notification after duration
    if (fullNotification.autoHide && fullNotification.duration) {
      setTimeout(() => {
        this.removeNotification(id);
      }, fullNotification.duration);
    }

    return id;
  }

  /**
   * Remove a notification by ID
   */
  removeNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  /**
   * Get all current notifications
   */
  getNotifications(): SyncNotification[] {
    return [...this.notifications];
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Notify sync success
   */
  notifySyncSuccess(result: SyncResult): void {
    const newRecordsCount = result.newRecords.length;
    const conflictsCount = result.conflicts.length;

    let message = "Health data synchronized successfully";
    if (newRecordsCount > 0) {
      message += `. ${newRecordsCount} new record${
        newRecordsCount === 1 ? "" : "s"
      } added`;
    }
    if (conflictsCount > 0) {
      message += `. ${conflictsCount} conflict${
        conflictsCount === 1 ? "" : "s"
      } detected`;
    }

    this.addNotification({
      type: "success",
      title: "Sync Complete",
      message,
      autoHide: true,
      duration: 3000,
    });

    this.updateStatus({
      ...this.currentStatus,
      lastSyncTime: result.lastSyncTimestamp,
      syncInProgress: false,
      retryCount: 0,
      nextRetryTime: undefined as Date | undefined,
    });
  }

  /**
   * Notify sync error with retry information
   */
  notifySyncError(error: SyncError, retryResult?: RetryResult): void {
    let message = error.message;

    if (retryResult && !retryResult.maxRetriesReached) {
      const nextRetrySeconds = Math.round(retryResult.nextRetryDelay / 1000);
      message += `. Retrying in ${nextRetrySeconds} seconds`;
    } else if (retryResult?.maxRetriesReached) {
      message += ". Maximum retry attempts reached";
    }

    this.addNotification({
      type: "error",
      title: "Sync Failed",
      message,
      autoHide: !retryResult?.maxRetriesReached,
      duration: retryResult?.maxRetriesReached
        ? (undefined as number | undefined)
        : 8000,
    });

    this.updateStatus({
      ...this.currentStatus,
      syncInProgress: false,
      retryCount: retryResult ? this.currentStatus.retryCount + 1 : 0,
      nextRetryTime:
        retryResult && !retryResult.maxRetriesReached
          ? new Date(Date.now() + retryResult.nextRetryDelay)
          : (undefined as Date | undefined),
    });
  }

  /**
   * Notify sync start
   */
  notifySyncStart(): void {
    this.addNotification({
      type: "info",
      title: "Syncing",
      message: "Synchronizing health data...",
      autoHide: true,
      duration: 2000,
    });

    this.updateStatus({
      ...this.currentStatus,
      syncInProgress: true,
    });
  }

  /**
   * Notify offline mode
   */
  notifyOfflineMode(): void {
    this.addNotification({
      type: "warning",
      title: "Offline Mode",
      message:
        "No internet connection. Data will sync when connection is restored",
      autoHide: false,
    });

    this.updateStatus({
      ...this.currentStatus,
      isOnline: false,
      syncInProgress: false,
    });
  }

  /**
   * Notify back online
   */
  notifyBackOnline(): void {
    // Remove offline notifications
    this.notifications = this.notifications.filter(
      (n) => n.title !== "Offline Mode"
    );

    this.addNotification({
      type: "success",
      title: "Back Online",
      message: "Internet connection restored. Syncing pending data...",
      autoHide: true,
      duration: 3000,
    });

    this.updateStatus({
      ...this.currentStatus,
      isOnline: true,
    });
  }

  /**
   * Update pending records count
   */
  updatePendingRecords(count: number): void {
    this.updateStatus({
      ...this.currentStatus,
      pendingRecords: count,
    });
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(listener: (status: SyncStatusUpdate) => void): () => void {
    this.statusListeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatusUpdate {
    return { ...this.currentStatus };
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: SyncStatusUpdate): void {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  /**
   * Format retry delay for user display
   */
  static formatRetryDelay(delayMs: number): string {
    const seconds = Math.round(delayMs / 1000);
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? "" : "s"}`;
    }
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  /**
   * Check if sync should be retried based on error type
   */
  static shouldRetrySync(error: SyncError): boolean {
    return error.retryable && !error.code.includes("PERMISSION_DENIED");
  }
}
