// Service for managing exercise record operations (edit, delete)
// Requirements: 5.3, 5.4

import { DataStorageManager } from "./database/DataStorageManager";
import { AuditTrailManager } from "./AuditTrailManager";
import { Exercise_Record, DataSource, AuditAction } from "@/types";

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface DeleteOptions {
  confirmationRequired?: boolean;
  auditTrail?: boolean;
}

export class ExerciseRecordManager {
  private storageManager: DataStorageManager;
  private auditManager: AuditTrailManager;

  constructor(storageManager: DataStorageManager) {
    this.storageManager = storageManager;
    this.auditManager = new AuditTrailManager(storageManager);
  }

  /**
   * Delete an exercise record with proper validation and audit trail
   */
  async deleteExerciseRecord(
    recordId: string,
    options: DeleteOptions = {}
  ): Promise<DeleteResult> {
    try {
      // Get the record to be deleted
      const record = await this.storageManager.getRecordById(recordId);

      if (!record) {
        return {
          success: false,
          error: "Exercise record not found",
        };
      }

      // Check if record can be deleted
      const canDelete = this.canDeleteRecord(record);
      if (!canDelete.allowed) {
        return {
          success: false,
          error: canDelete.reason || "Record cannot be deleted",
        };
      }

      // Create audit record before deletion if enabled
      if (options.auditTrail !== false) {
        await this.auditManager.auditRecordDeletion(record);
      }

      // Delete the record
      await this.storageManager.deleteRecord(recordId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Delete multiple exercise records in a batch operation
   */
  async deleteMultipleRecords(
    recordIds: string[],
    options: DeleteOptions = {}
  ): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const recordId of recordIds) {
      const result = await this.deleteExerciseRecord(recordId, options);

      if (result.success) {
        successful.push(recordId);
      } else {
        failed.push({
          id: recordId,
          error: result.error || "Unknown error",
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Check if a record can be deleted
   */
  private canDeleteRecord(record: Exercise_Record): {
    allowed: boolean;
    reason?: string;
  } {
    // Manual records can always be deleted
    if (record.source === DataSource.MANUAL) {
      return { allowed: true };
    }

    // Synced records can be deleted but with warning
    if (record.source === DataSource.SYNCED) {
      return {
        allowed: true,
        reason:
          "This is a synced record. Deleting it may cause it to reappear during the next sync.",
      };
    }

    return { allowed: true };
  }

  /**
   * Get deletion confirmation message for a record
   */
  getDeleteConfirmationMessage(record: Exercise_Record): {
    title: string;
    message: string;
    warningLevel: "low" | "medium" | "high";
  } {
    const baseMessage = `Are you sure you want to delete "${record.name}"?`;

    if (record.source === DataSource.MANUAL) {
      return {
        title: "Delete Exercise",
        message: `${baseMessage}\n\nThis action cannot be undone.`,
        warningLevel: "medium",
      };
    } else {
      return {
        title: "Delete Synced Exercise",
        message: `${baseMessage}\n\nThis exercise was synced from your health platform. Deleting it may cause it to reappear during the next sync.\n\nThis action cannot be undone.`,
        warningLevel: "high",
      };
    }
  }

  /**
   * Soft delete - mark record as deleted without removing from database
   */
  async softDeleteRecord(recordId: string): Promise<DeleteResult> {
    try {
      const record = await this.storageManager.getRecordById(recordId);

      if (!record) {
        return {
          success: false,
          error: "Exercise record not found",
        };
      }

      // Update record with deleted flag
      const updatedRecord = {
        ...record,
        metadata: {
          ...record.metadata,
          deleted: true,
          deletedAt: new Date(),
        },
        updatedAt: new Date(),
      };

      await this.storageManager.updateRecord(recordId, updatedRecord);

      // Create audit record
      await this.auditManager.auditRecordDeletion(record);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Restore a soft-deleted record
   */
  async restoreRecord(recordId: string): Promise<DeleteResult> {
    try {
      const record = await this.storageManager.getRecordById(recordId);

      if (!record) {
        return {
          success: false,
          error: "Exercise record not found",
        };
      }

      if (!record.metadata.deleted) {
        return {
          success: false,
          error: "Record is not deleted",
        };
      }

      // Remove deleted flag
      const updatedMetadata = { ...record.metadata };
      delete updatedMetadata.deleted;
      delete updatedMetadata.deletedAt;

      const restoredRecord = {
        ...record,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      };

      await this.storageManager.updateRecord(recordId, restoredRecord);

      // Create audit record for restoration
      await this.auditManager.auditRecordCreation(restoredRecord);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get statistics about deletions
   */
  async getDeletionStatistics(): Promise<{
    totalDeleted: number;
    manualDeleted: number;
    syncedDeleted: number;
    recentDeletions: number; // Last 24 hours
  }> {
    try {
      // Get audit records for deletions
      const auditRecords = await this.auditManager.getAuditTrail({
        limit: 1000,
      });
      const deletionRecords = auditRecords.filter(
        (record) => record.action === AuditAction.RECORD_DELETED
      );

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      let manualDeleted = 0;
      let syncedDeleted = 0;
      let recentDeletions = 0;

      for (const record of deletionRecords) {
        // Count recent deletions
        if (record.timestamp.getTime() > oneDayAgo) {
          recentDeletions++;
        }

        // Count by source type (if available in beforeData)
        if (record.beforeData && typeof record.beforeData === "object") {
          const beforeData = record.beforeData as any;
          if (beforeData.source === DataSource.MANUAL) {
            manualDeleted++;
          } else if (beforeData.source === DataSource.SYNCED) {
            syncedDeleted++;
          }
        }
      }

      return {
        totalDeleted: deletionRecords.length,
        manualDeleted,
        syncedDeleted,
        recentDeletions,
      };
    } catch (error) {
      console.error("Error getting deletion statistics:", error);
      return {
        totalDeleted: 0,
        manualDeleted: 0,
        syncedDeleted: 0,
        recentDeletions: 0,
      };
    }
  }

  /**
   * Cleanup old soft-deleted records
   */
  async cleanupSoftDeletedRecords(olderThanDays: number = 30): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Get all records (we'll need to filter for soft-deleted ones)
      const allRecords = await this.storageManager.getExerciseHistory({
        start: new Date("2020-01-01"),
        end: new Date("2030-12-31"),
      });

      const softDeletedRecords = allRecords.filter(
        (record) =>
          record.metadata.deleted &&
          record.metadata.deletedAt &&
          new Date(record.metadata.deletedAt).getTime() < cutoffDate.getTime()
      );

      let cleaned = 0;
      const errors: string[] = [];

      for (const record of softDeletedRecords) {
        try {
          await this.storageManager.deleteRecord(record.id);
          cleaned++;
        } catch (error) {
          errors.push(
            `Failed to cleanup record ${record.id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      return { cleaned, errors };
    } catch (error) {
      return {
        cleaned: 0,
        errors: [
          error instanceof Error ? error.message : "Unknown error occurred",
        ],
      };
    }
  }
}
