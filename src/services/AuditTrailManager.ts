// Service for managing audit trail and data management with rolling history

import {
  AuditRecord,
  AuditAction,
  AuditMetadata,
  ConflictResolution,
  Exercise_Record,
} from "@/types";
import { DataStorageManager } from "./database/DataStorageManager";
import { AUDIT_CONFIG } from "@/utils/constants";

export interface AuditTrailConfig {
  maxRecords: number;
  cleanupThreshold: number;
  enableAutoCleanup: boolean;
  retentionDays?: number;
}

export interface AuditQuery {
  action?: AuditAction;
  recordId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface AuditStatistics {
  totalRecords: number;
  recordsByAction: Record<AuditAction, number>;
  recordsByDay: Record<string, number>;
  oldestRecord?: Date;
  newestRecord?: Date;
  averageRecordsPerDay: number;
}

export class AuditTrailManager {
  private storageManager: DataStorageManager;
  private config: AuditTrailConfig;

  constructor(
    storageManager: DataStorageManager,
    config: Partial<AuditTrailConfig> = {}
  ) {
    this.storageManager = storageManager;
    this.config = {
      maxRecords: AUDIT_CONFIG.MAX_RECORDS,
      cleanupThreshold: AUDIT_CONFIG.CLEANUP_THRESHOLD,
      enableAutoCleanup: true,
      retentionDays: 90, // 90 days default retention
      ...config,
    };
  }

  /**
   * Create audit record for conflict resolution
   */
  async auditConflictResolution(
    resolution: ConflictResolution,
    beforeState: any,
    afterState: any
  ): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("conflict_resolution"),
      action: AuditAction.CONFLICT_RESOLVED,
      timestamp: new Date(),
      recordId: resolution.conflictId,
      beforeData: beforeState,
      afterData: afterState,
      metadata: {
        userId: "system", // In a real app, this would be the actual user ID
        source: "conflict_resolution",
        ...this.extractResolutionMetadata(resolution),
      } as AuditMetadata,
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Create audit record for exercise record creation
   */
  async auditRecordCreation(record: Exercise_Record): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("record_creation"),
      action: AuditAction.RECORD_CREATED,
      timestamp: new Date(),
      recordId: record.id,
      beforeData: null,
      afterData: record,
      metadata: {
        source: record.source,
        ...(record.platform && { platform: record.platform }),
        ...this.extractRecordMetadata(record),
      },
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Create audit record for exercise record update
   */
  async auditRecordUpdate(
    recordId: string,
    beforeData: Exercise_Record,
    afterData: Exercise_Record,
    updatedFields: string[]
  ): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("record_update"),
      action: AuditAction.RECORD_UPDATED,
      timestamp: new Date(),
      recordId,
      beforeData,
      afterData,
      metadata: {
        source: afterData.source,
        ...(afterData.platform && { platform: afterData.platform }),
        updatedFields,
        ...this.extractRecordMetadata(afterData),
      },
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Create audit record for exercise record deletion
   */
  async auditRecordDeletion(record: Exercise_Record): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("record_deletion"),
      action: AuditAction.RECORD_DELETED,
      timestamp: new Date(),
      recordId: record.id,
      beforeData: record,
      afterData: null,
      metadata: {
        source: record.source,
        ...(record.platform && { platform: record.platform }),
        ...this.extractRecordMetadata(record),
      },
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Create audit record for resolution undo
   */
  async auditResolutionUndo(
    originalResolution: ConflictResolution,
    undoMetadata: any
  ): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("resolution_undo"),
      action: AuditAction.RESOLUTION_UNDONE,
      timestamp: new Date(),
      recordId: originalResolution.id,
      beforeData: originalResolution,
      afterData: undoMetadata,
      metadata: {
        source: "undo_operation",
      },
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Save audit record with automatic cleanup
   */
  private async saveAuditRecord(auditRecord: AuditRecord): Promise<void> {
    await this.storageManager.saveAuditRecord(auditRecord);

    // Trigger cleanup if enabled and threshold is reached
    if (this.config.enableAutoCleanup) {
      const currentCount = await this.getAuditRecordCount();
      if (currentCount >= this.config.cleanupThreshold) {
        await this.performCleanup();
      }
    }
  }

  /**
   * Get audit trail with optional filtering
   */
  async getAuditTrail(query: AuditQuery = {}): Promise<AuditRecord[]> {
    const limit = query.limit || 50;

    // For now, use the basic getAuditTrail method from storage manager
    // In a full implementation, this would support more complex filtering
    const allRecords = await this.storageManager.getAuditTrail(1000); // Get more records for filtering

    let filteredRecords = allRecords;

    // Apply filters
    if (query.action) {
      filteredRecords = filteredRecords.filter(
        (r) => r.action === query.action
      );
    }

    if (query.recordId) {
      filteredRecords = filteredRecords.filter(
        (r) => r.recordId === query.recordId
      );
    }

    if (query.startDate) {
      filteredRecords = filteredRecords.filter(
        (r) => r.timestamp >= query.startDate!
      );
    }

    if (query.endDate) {
      filteredRecords = filteredRecords.filter(
        (r) => r.timestamp <= query.endDate!
      );
    }

    // Sort by timestamp (newest first) and limit
    return filteredRecords
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get audit records for a specific exercise record
   */
  async getRecordAuditHistory(recordId: string): Promise<AuditRecord[]> {
    return this.getAuditTrail({ recordId, limit: 100 });
  }

  /**
   * Get audit records for conflict resolutions
   */
  async getConflictResolutionAudits(): Promise<AuditRecord[]> {
    return this.getAuditTrail({
      action: AuditAction.CONFLICT_RESOLVED,
      limit: 100,
    });
  }

  /**
   * Get recent audit activity
   */
  async getRecentActivity(hours: number = 24): Promise<AuditRecord[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.getAuditTrail({ startDate, limit: 100 });
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(): Promise<AuditStatistics> {
    const allRecords = await this.storageManager.getAuditTrail(1000);

    const stats: AuditStatistics = {
      totalRecords: allRecords.length,
      recordsByAction: {
        [AuditAction.CONFLICT_RESOLVED]: 0,
        [AuditAction.RECORD_CREATED]: 0,
        [AuditAction.RECORD_UPDATED]: 0,
        [AuditAction.RECORD_DELETED]: 0,
        [AuditAction.RESOLUTION_UNDONE]: 0,
      },
      recordsByDay: {},
      averageRecordsPerDay: 0,
    };

    if (allRecords.length === 0) {
      return stats;
    }

    // Calculate statistics
    let oldestTimestamp = allRecords[0]!.timestamp.getTime();
    let newestTimestamp = allRecords[0]!.timestamp.getTime();

    for (const record of allRecords) {
      // Count by action
      stats.recordsByAction[record.action]++;

      // Count by day
      const dayKey = record.timestamp.toISOString().split("T")[0];
      if (dayKey) {
        stats.recordsByDay[dayKey] = (stats.recordsByDay[dayKey] || 0) + 1;
      }

      // Track oldest and newest
      const timestamp = record.timestamp.getTime();
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
      }
      if (timestamp > newestTimestamp) {
        newestTimestamp = timestamp;
      }
    }

    stats.oldestRecord = new Date(oldestTimestamp);
    stats.newestRecord = new Date(newestTimestamp);

    // Calculate average records per day
    const daysDiff = Math.max(
      1,
      Math.ceil((newestTimestamp - oldestTimestamp) / (24 * 60 * 60 * 1000))
    );
    stats.averageRecordsPerDay = allRecords.length / daysDiff;

    return stats;
  }

  /**
   * Perform cleanup of old audit records
   */
  async performCleanup(): Promise<{
    removedCount: number;
    remainingCount: number;
  }> {
    const beforeCount = await this.getAuditRecordCount();

    // Clean up old records beyond the max limit
    await this.storageManager.cleanupOldAuditRecords(this.config.maxRecords);

    // If retention days is configured, also clean up by date
    if (this.config.retentionDays) {
      const cutoffDate = new Date(
        Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
      );
      await this.cleanupByDate(cutoffDate);
    }

    const afterCount = await this.getAuditRecordCount();

    return {
      removedCount: beforeCount - afterCount,
      remainingCount: afterCount,
    };
  }

  /**
   * Clean up audit records older than specified date
   */
  private async cleanupByDate(cutoffDate: Date): Promise<void> {
    // This would need to be implemented in the DataStorageManager
    // For now, we'll just log the intent
    console.log(
      `Would clean up audit records older than ${cutoffDate.toISOString()}`
    );
  }

  /**
   * Get count of audit records
   */
  private async getAuditRecordCount(): Promise<number> {
    const records = await this.storageManager.getAuditTrail(10000); // Large number to get all
    return records.length;
  }

  /**
   * Extract metadata from conflict resolution
   */
  private extractResolutionMetadata(
    _resolution: ConflictResolution
  ): Partial<AuditMetadata> {
    return {
      // Store resolution-specific metadata as additional properties
      // The AuditMetadata interface allows additional properties via [key: string]: any
    };
  }

  /**
   * Extract metadata from exercise record
   */
  private extractRecordMetadata(
    record: Exercise_Record
  ): Partial<AuditMetadata> {
    return {
      source: record.source,
      ...(record.platform && { platform: record.platform }),
      ...(record.metadata?.originalId && {
        originalId: record.metadata.originalId as string,
      }),
    };
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `audit_${prefix}_${timestamp}_${random}`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AuditTrailConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AuditTrailConfig {
    return { ...this.config };
  }

  /**
   * Export audit trail for backup or analysis
   */
  async exportAuditTrail(format: "json" | "csv" = "json"): Promise<string> {
    const records = await this.storageManager.getAuditTrail(10000);

    if (format === "json") {
      return JSON.stringify(records, null, 2);
    } else {
      // CSV format
      const headers = ["id", "action", "timestamp", "recordId", "metadata"];
      const csvRows = [headers.join(",")];

      for (const record of records) {
        const row = [
          record.id,
          record.action,
          record.timestamp.toISOString(),
          record.recordId || "",
          JSON.stringify(record.metadata).replace(/"/g, '""'), // Escape quotes for CSV
        ];
        csvRows.push(row.join(","));
      }

      return csvRows.join("\n");
    }
  }

  /**
   * Validate audit trail integrity
   */
  async validateAuditTrail(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const records = await this.storageManager.getAuditTrail(1000);

    // Check for required fields
    for (const record of records) {
      if (!record.id) {
        issues.push(`Record missing ID: ${JSON.stringify(record)}`);
      }
      if (!record.action) {
        issues.push(`Record ${record.id} missing action`);
      }
      if (!record.timestamp) {
        issues.push(`Record ${record.id} missing timestamp`);
      }
      if (!record.metadata) {
        issues.push(`Record ${record.id} missing metadata`);
      }
    }

    // Check for chronological order (newest first)
    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      const previous = records[i - 1];

      if (current && previous && current.timestamp > previous.timestamp) {
        issues.push(
          `Records out of chronological order: ${current.id} after ${previous.id}`
        );
      }
    }

    // Check for duplicate IDs
    const ids = new Set();
    for (const record of records) {
      if (ids.has(record.id)) {
        issues.push(`Duplicate audit record ID: ${record.id}`);
      }
      ids.add(record.id);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Create audit record for bulk operations
   */
  async auditBulkOperation(
    operation: string,
    affectedRecordIds: string[],
    metadata: any
  ): Promise<void> {
    const auditRecord: AuditRecord = {
      id: this.generateAuditId("bulk_operation"),
      action: AuditAction.RECORD_UPDATED, // Use appropriate action
      timestamp: new Date(),
      recordId: `bulk_${operation}_${Date.now()}`,
      beforeData: null,
      afterData: {
        operation,
        affectedRecords: affectedRecordIds.length,
        recordIds: affectedRecordIds,
      },
      metadata: {
        source: "bulk_operation",
        operation,
        recordCount: affectedRecordIds.length,
        ...metadata,
      },
    };

    await this.saveAuditRecord(auditRecord);
  }

  /**
   * Undo a conflict resolution using audit data
   */
  async undoConflictResolution(
    resolutionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the audit record for this resolution
      const auditRecords = await this.getAuditTrail({ limit: 1000 });
      const resolutionAudit = auditRecords.find(
        (record) =>
          record.action === AuditAction.CONFLICT_RESOLVED &&
          record.recordId === resolutionId
      );

      if (!resolutionAudit) {
        return { success: false, error: "Resolution audit record not found" };
      }

      // Check if this resolution has already been undone
      const undoAudit = auditRecords.find(
        (record) =>
          record.action === AuditAction.RESOLUTION_UNDONE &&
          record.beforeData?.id === resolutionId
      );

      if (undoAudit) {
        return { success: false, error: "Resolution has already been undone" };
      }

      // Restore the before state
      const beforeState = resolutionAudit.beforeData;
      const afterState = resolutionAudit.afterData;

      // Create undo metadata
      const undoMetadata = {
        undoTimestamp: new Date(),
        originalResolutionId: resolutionId,
        restoredState: beforeState,
        undoReason: "User requested undo",
      };

      // Create audit record for the undo operation
      await this.auditResolutionUndo(afterState, undoMetadata);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error during undo",
      };
    }
  }

  /**
   * Get undoable operations (recent conflict resolutions)
   */
  async getUndoableOperations(
    maxAgeHours: number = 24
  ): Promise<AuditRecord[]> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const auditRecords = await this.getAuditTrail({ limit: 1000 });
    const undoneResolutions = new Set(
      auditRecords
        .filter((record) => record.action === AuditAction.RESOLUTION_UNDONE)
        .map((record) => record.beforeData?.id)
        .filter(Boolean)
    );

    return auditRecords.filter(
      (record) =>
        record.action === AuditAction.CONFLICT_RESOLVED &&
        record.timestamp >= cutoffTime &&
        !undoneResolutions.has(record.recordId)
    );
  }

  /**
   * Undo a record operation (creation, update, or deletion)
   */
  async undoRecordOperation(
    auditRecordId: string
  ): Promise<{ success: boolean; error?: string; restoredRecord?: any }> {
    try {
      // Find the audit record
      const auditRecords = await this.getAuditTrail({ limit: 1000 });
      const targetAudit = auditRecords.find(
        (record) => record.id === auditRecordId
      );

      if (!targetAudit) {
        return { success: false, error: "Audit record not found" };
      }

      // Check if this operation can be undone
      if (
        ![
          AuditAction.RECORD_CREATED,
          AuditAction.RECORD_UPDATED,
          AuditAction.RECORD_DELETED,
        ].includes(targetAudit.action)
      ) {
        return { success: false, error: "Operation cannot be undone" };
      }

      // Check if this operation has already been undone
      const undoAudit = auditRecords.find(
        (record) => (record.metadata as any).originalAuditId === auditRecordId
      );

      if (undoAudit) {
        return { success: false, error: "Operation has already been undone" };
      }

      let restoredRecord = null;
      let undoAction: AuditAction;

      // Determine undo action based on original action
      switch (targetAudit.action) {
        case AuditAction.RECORD_CREATED:
          // Undo creation by "deleting" the record
          undoAction = AuditAction.RECORD_DELETED;
          restoredRecord = null;
          break;

        case AuditAction.RECORD_UPDATED:
          // Undo update by restoring previous state
          undoAction = AuditAction.RECORD_UPDATED;
          restoredRecord = targetAudit.beforeData;
          break;

        case AuditAction.RECORD_DELETED:
          // Undo deletion by recreating the record
          undoAction = AuditAction.RECORD_CREATED;
          restoredRecord = targetAudit.beforeData;
          break;

        default:
          return { success: false, error: "Unsupported operation type" };
      }

      // Create audit record for the undo operation
      const undoAuditRecord: AuditRecord = {
        id: this.generateAuditId("undo_operation"),
        action: undoAction,
        timestamp: new Date(),
        recordId: targetAudit.recordId,
        beforeData: targetAudit.afterData,
        afterData: restoredRecord,
        metadata: {
          source: "undo_operation",
          originalAuditId: auditRecordId,
          originalAction: targetAudit.action,
          undoReason: "User requested undo",
        } as any,
      };

      await this.saveAuditRecord(undoAuditRecord);

      return { success: true, restoredRecord };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error during undo",
      };
    }
  }

  /**
   * Get undo history for a specific record
   */
  async getRecordUndoHistory(recordId: string): Promise<AuditRecord[]> {
    const auditRecords = await this.getAuditTrail({ recordId, limit: 100 });

    return auditRecords.filter(
      (record) =>
        record.metadata.source === "undo_operation" ||
        record.action === AuditAction.RESOLUTION_UNDONE
    );
  }

  /**
   * Check if an operation can be undone
   */
  async canUndoOperation(
    auditRecordId: string
  ): Promise<{ canUndo: boolean; reason?: string }> {
    try {
      const auditRecords = await this.getAuditTrail({ limit: 1000 });
      const targetAudit = auditRecords.find(
        (record) => record.id === auditRecordId
      );

      if (!targetAudit) {
        return { canUndo: false, reason: "Audit record not found" };
      }

      // Check if operation type supports undo
      const undoableActions = [
        AuditAction.RECORD_CREATED,
        AuditAction.RECORD_UPDATED,
        AuditAction.RECORD_DELETED,
        AuditAction.CONFLICT_RESOLVED,
      ];

      if (!undoableActions.includes(targetAudit.action)) {
        return {
          canUndo: false,
          reason: "Operation type does not support undo",
        };
      }

      // Check if already undone
      const isUndone = auditRecords.some(
        (record) =>
          (record.metadata as any).originalAuditId === auditRecordId ||
          (record.action === AuditAction.RESOLUTION_UNDONE &&
            record.beforeData?.id === targetAudit.recordId)
      );

      if (isUndone) {
        return { canUndo: false, reason: "Operation has already been undone" };
      }

      // Check age limit (e.g., can only undo operations from last 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const age = Date.now() - targetAudit.timestamp.getTime();

      if (age > maxAge) {
        return { canUndo: false, reason: "Operation is too old to undo" };
      }

      return { canUndo: true };
    } catch (error) {
      return {
        canUndo: false,
        reason:
          error instanceof Error
            ? error.message
            : "Error checking undo eligibility",
      };
    }
  }

  /**
   * Get audit trail management statistics
   */
  async getManagementStatistics(): Promise<{
    totalRecords: number;
    undoableOperations: number;
    recentUndos: number;
    oldestUndoableOperation?: Date;
    storageUtilization: number;
  }> {
    const auditRecords = await this.getAuditTrail({ limit: 1000 });
    const undoableOps = await this.getUndoableOperations();

    const recentUndos = auditRecords.filter(
      (record) =>
        record.metadata.source === "undo_operation" &&
        record.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    const oldestUndoable =
      undoableOps.length > 0
        ? undoableOps.reduce(
            (oldest, op) =>
              !oldest || op.timestamp < oldest ? op.timestamp : oldest,
            null as Date | null
          )
        : undefined;

    return {
      totalRecords: auditRecords.length,
      undoableOperations: undoableOps.length,
      recentUndos,
      ...(oldestUndoable && { oldestUndoableOperation: oldestUndoable }),
      storageUtilization: auditRecords.length / this.config.maxRecords,
    };
  }
}
