/**
 * Data Storage Manager
 * 
 * Comprehensive data persistence layer providing CRUD operations for exercise records,
 * audit trail management, and conflict resolution support. This service serves as the
 * primary interface between the application's business logic and the SQLite database.
 * 
 * Key Features:
 * - Complete CRUD operations for exercise records
 * - Audit trail management with automatic cleanup
 * - Conflict preservation and resolution tracking
 * - Transaction support for data integrity
 * - Comprehensive error handling with detailed messages
 * - Performance-optimized queries with proper indexing
 * 
 * The service implements a repository pattern, abstracting database operations
 * and providing a clean interface for the service layer.
 * 
 * Requirements addressed:
 * - Data persistence (2.1, 2.2)
 * - Audit trail management (6.1, 6.2)
 * - Conflict data management (4.1, 4.2)
 * - Data integrity and transactions (2.3)
 */

import SQLite from "react-native-sqlite-storage";
import {
  Exercise_Record,
  DateRange,
  AuditRecord,
  DataSource,
  HealthPlatform,
  ExerciseMetadata,
} from "@/types";
import { DataStorageManager as IDataStorageManager } from "@/services/interfaces";
import { ERROR_MESSAGES } from "@/utils/constants";

/**
 * Data Storage Manager Implementation
 * 
 * Provides comprehensive data persistence services with robust error handling,
 * transaction support, and performance optimization.
 */
export class DataStorageManager implements IDataStorageManager {
  private db: SQLite.SQLiteDatabase;

  /**
   * Initialize the Data Storage Manager with database connection
   * @param database - SQLite database instance
   */
  constructor(database: SQLite.SQLiteDatabase) {
    this.db = database;
  }

  /**
   * Initialize database schema and tables
   * 
   * Note: Database initialization is handled by DatabaseMigrator service.
   * This method is kept for interface compliance and future extensibility.
   */
  async initializeDatabase(): Promise<void> {
    // Database initialization is handled by DatabaseMigrator
    // This method is kept for interface compliance
  }

  /**
   * Close database connection gracefully
   * 
   * Ensures proper cleanup of database resources when the application
   * is shutting down or when the service is being destroyed.
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }

  /**
   * Save or update an exercise record in the database
   * 
   * Uses INSERT OR REPLACE to handle both new records and updates.
   * Serializes metadata as JSON for flexible storage of platform-specific data.
   * 
   * @param record - Complete exercise record to save
   * @throws Error if save operation fails with detailed error message
   */
  async saveExerciseRecord(record: Exercise_Record): Promise<void> {
    try {
      const metadataJson = JSON.stringify(record.metadata);

      await this.db.executeSql(
        `INSERT OR REPLACE INTO exercise_records 
         (id, name, start_time, duration, source, platform, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.name,
          record.startTime.getTime(),
          record.duration,
          record.source,
          record.platform || null,
          metadataJson,
          record.createdAt.getTime(),
          record.updatedAt.getTime(),
        ]
      );
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.STORAGE.SAVE_FAILED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve exercise history within a specified date range
   * 
   * Returns exercises ordered by start time (most recent first) for
   * optimal user experience in history views.
   * 
   * @param dateRange - Start and end dates for the query
   * @returns Array of exercise records within the date range
   * @throws Error if retrieval operation fails
   */
  async getExerciseHistory(dateRange: DateRange): Promise<Exercise_Record[]> {
    try {
      const result = await this.db.executeSql(
        `SELECT * FROM exercise_records 
         WHERE start_time >= ? AND start_time <= ?
         ORDER BY start_time DESC`,
        [dateRange.start.getTime(), dateRange.end.getTime()]
      );

      const records: Exercise_Record[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          records.push(this.mapRowToExerciseRecord(row));
        }
      }

      return records;
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.STORAGE.LOAD_FAILED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update an existing exercise record with partial data
   * 
   * Merges provided updates with existing record data and updates
   * the modification timestamp automatically.
   * 
   * @param id - Unique identifier of the record to update
   * @param updates - Partial record data to apply
   * @throws Error if record not found or update operation fails
   */
  async updateRecord(
    id: string,
    updates: Partial<Exercise_Record>
  ): Promise<void> {
    try {
      // First, get the existing record
      const existingResult = await this.db.executeSql(
        "SELECT * FROM exercise_records WHERE id = ?",
        [id]
      );

      if (!existingResult || existingResult.length === 0 || !existingResult[0].rows || existingResult[0].rows.length === 0) {
        throw new Error("Record not found");
      }

      const existingRecord = this.mapRowToExerciseRecord(
        existingResult[0].rows.item(0)
      );

      // Merge updates with existing record
      const updatedRecord: Exercise_Record = {
        ...existingRecord,
        ...updates,
        id, // Ensure ID cannot be changed
        updatedAt: new Date(), // Always update the timestamp
      };

      // Save the updated record
      await this.saveExerciseRecord(updatedRecord);
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.STORAGE.UPDATE_FAILED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete an exercise record from the database
   * 
   * Performs hard deletion of the record. For soft deletion,
   * use the updateRecord method to set a deleted flag in metadata.
   * 
   * @param id - Unique identifier of the record to delete
   * @throws Error if record not found or deletion fails
   */
  async deleteRecord(id: string): Promise<void> {
    try {
      const result = await this.db.executeSql(
        "DELETE FROM exercise_records WHERE id = ?",
        [id]
      );

      if (!result || result.length === 0 || result[0].rowsAffected === 0) {
        throw new Error("Record not found");
      }
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.STORAGE.DELETE_FAILED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve audit trail records with specified limit
   * 
   * Returns audit records ordered by timestamp (most recent first)
   * for debugging and accountability purposes.
   * 
   * @param limit - Maximum number of audit records to retrieve
   * @returns Array of audit records
   * @throws Error if retrieval operation fails
   */
  async getAuditTrail(limit: number): Promise<AuditRecord[]> {
    try {
      const result = await this.db.executeSql(
        `SELECT * FROM audit_records 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [limit]
      );

      const auditRecords: AuditRecord[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          auditRecords.push(this.mapRowToAuditRecord(row));
        }
      }

      return auditRecords;
    } catch (error) {
      throw new Error(
        `Failed to load audit trail: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Additional helper methods for conflict and audit management

  async saveConflict(conflict: {
    id: string;
    manualRecordId: string;
    syncedRecordId: string;
    overlapDuration: number;
    conflictType: string;
    detectedAt: Date;
  }): Promise<void> {
    try {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO conflicts 
         (id, manual_record_id, synced_record_id, overlap_duration, conflict_type, status, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          conflict.id,
          conflict.manualRecordId,
          conflict.syncedRecordId,
          conflict.overlapDuration,
          conflict.conflictType,
          "pending",
          conflict.detectedAt.getTime(),
        ]
      );
    } catch (error) {
      throw new Error(
        `Failed to save conflict: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async saveAuditRecord(auditRecord: AuditRecord): Promise<void> {
    try {
      await this.db.executeSql(
        `INSERT INTO audit_records 
         (id, action, timestamp, record_id, before_data, after_data, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          auditRecord.id,
          auditRecord.action,
          auditRecord.timestamp.getTime(),
          auditRecord.recordId,
          auditRecord.beforeData
            ? JSON.stringify(auditRecord.beforeData)
            : null,
          auditRecord.afterData ? JSON.stringify(auditRecord.afterData) : null,
          JSON.stringify(auditRecord.metadata),
        ]
      );

      // Maintain rolling history limit
      await this.cleanupAuditRecords();
    } catch (error) {
      throw new Error(
        `Failed to save audit record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getRecordById(id: string): Promise<Exercise_Record | null> {
    try {
      const result = await this.db.executeSql(
        "SELECT * FROM exercise_records WHERE id = ?",
        [id]
      );

      if (!result || result.length === 0 || !result[0].rows || result[0].rows.length === 0) {
        return null;
      }

      return this.mapRowToExerciseRecord(result[0].rows.item(0));
    } catch (error) {
      throw new Error(
        `Failed to get record by ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieve all exercise records from the database
   * 
   * Returns all exercises ordered by start time (most recent first).
   * This method is used by the dashboard service to get all records
   * for statistics and recommendations.
   * 
   * @returns Array of all exercise records
   * @throws Error if retrieval operation fails
   */
  async getAllExerciseRecords(): Promise<Exercise_Record[]> {
    try {
      const result = await this.db.executeSql(
        `SELECT * FROM exercise_records 
         ORDER BY start_time DESC`
      );

      const records: Exercise_Record[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          records.push(this.mapRowToExerciseRecord(row));
        }
      }

      return records;
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.STORAGE.LOAD_FAILED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Conflict preservation methods

  async saveHeldRecord(record: Exercise_Record): Promise<void> {
    try {
      const metadataJson = JSON.stringify(record.metadata);

      await this.db.executeSql(
        `INSERT OR REPLACE INTO held_records 
         (id, name, start_time, duration, source, platform, metadata, created_at, updated_at, held_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.name,
          record.startTime.getTime(),
          record.duration,
          record.source,
          record.platform || null,
          metadataJson,
          record.createdAt.getTime(),
          record.updatedAt.getTime(),
          Date.now(),
        ]
      );
    } catch (error) {
      throw new Error(
        `Failed to save held record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getHeldRecords(): Promise<Exercise_Record[]> {
    try {
      const result = await this.db.executeSql(
        "SELECT * FROM held_records ORDER BY held_at DESC"
      );

      const records: Exercise_Record[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          records.push(this.mapRowToExerciseRecord(row));
        }
      }

      return records;
    } catch (error) {
      throw new Error(
        `Failed to get held records: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async removeHeldRecord(id: string): Promise<void> {
    try {
      await this.db.executeSql("DELETE FROM held_records WHERE id = ?", [id]);
    } catch (error) {
      throw new Error(
        `Failed to remove held record: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getUnresolvedConflicts(): Promise<any[]> {
    try {
      const result = await this.db.executeSql(
        `SELECT c.*, 
                mr.name as manual_name, mr.start_time as manual_start_time, mr.duration as manual_duration,
                sr.name as synced_name, sr.start_time as synced_start_time, sr.duration as synced_duration
         FROM conflicts c
         LEFT JOIN exercise_records mr ON c.manual_record_id = mr.id
         LEFT JOIN held_records sr ON c.synced_record_id = sr.id
         WHERE c.status = 'pending'
         ORDER BY c.detected_at DESC`
      );

      const conflicts: any[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);

          // Get full records
          const manualRecord = await this.getRecordById(row.manual_record_id);
          const syncedRecord = await this.getHeldRecordById(row.synced_record_id);

        if (manualRecord && syncedRecord) {
          conflicts.push({
            id: row.id,
            manualRecord,
            syncedRecord,
            overlapDuration: row.overlap_duration,
            conflictType: row.conflict_type,
            detectedAt: new Date(row.detected_at),
          });
        }
      }
      }

      return conflicts;
    } catch (error) {
      throw new Error(
        `Failed to get unresolved conflicts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getHeldRecordById(id: string): Promise<Exercise_Record | null> {
    try {
      const result = await this.db.executeSql(
        "SELECT * FROM held_records WHERE id = ?",
        [id]
      );

      if (!result || result.length === 0 || !result[0].rows || result[0].rows.length === 0) {
        return null;
      }

      return this.mapRowToExerciseRecord(result[0].rows.item(0));
    } catch (error) {
      throw new Error(
        `Failed to get held record by ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getConflictById(id: string): Promise<any | null> {
    try {
      const result = await this.db.executeSql(
        "SELECT * FROM conflicts WHERE id = ?",
        [id]
      );

      if (!result || result.length === 0 || !result[0].rows || result[0].rows.length === 0) {
        return null;
      }

      const row = result[0].rows.item(0);
      const manualRecord = await this.getRecordById(row.manual_record_id);
      const syncedRecord = await this.getHeldRecordById(row.synced_record_id);

      if (!manualRecord || !syncedRecord) {
        return null;
      }

      return {
        id: row.id,
        manualRecord,
        syncedRecord,
        overlapDuration: row.overlap_duration,
        conflictType: row.conflict_type,
        detectedAt: new Date(row.detected_at),
      };
    } catch (error) {
      throw new Error(
        `Failed to get conflict by ID: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async saveConflictResolution(resolution: any): Promise<void> {
    try {
      await this.db.executeSql(
        `INSERT INTO conflict_resolutions 
         (id, conflict_id, resolution_choice, resolved_at, before_state, after_state, user_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          resolution.id,
          resolution.conflictId,
          resolution.resolutionChoice,
          resolution.resolvedAt.getTime(),
          JSON.stringify(resolution.beforeState),
          JSON.stringify(resolution.afterState),
          resolution.userNotes || null,
        ]
      );
    } catch (error) {
      throw new Error(
        `Failed to save conflict resolution: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async markConflictResolved(conflictId: string): Promise<void> {
    try {
      await this.db.executeSql("UPDATE conflicts SET status = ? WHERE id = ?", [
        "resolved",
        conflictId,
      ]);
    } catch (error) {
      throw new Error(
        `Failed to mark conflict resolved: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getResolvedConflicts(): Promise<any[]> {
    try {
      const result = await this.db.executeSql(
        "SELECT * FROM conflicts WHERE status = ? ORDER BY detected_at DESC",
        ["resolved"]
      );

      const conflicts: any[] = [];

      if (result && result.length > 0 && result[0].rows) {
        for (let i = 0; i < result[0].rows.length; i++) {
          const row = result[0].rows.item(i);
          conflicts.push({
            id: row.id,
            conflictType: row.conflict_type,
            detectedAt: new Date(row.detected_at),
            overlapDuration: row.overlap_duration,
          });
        }
      }

      return conflicts;
    } catch (error) {
      throw new Error(
        `Failed to get resolved conflicts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async cleanupOldConflicts(cutoffDate: Date): Promise<void> {
    try {
      await this.db.executeSql(
        "DELETE FROM conflicts WHERE status = ? AND detected_at < ?",
        ["resolved", cutoffDate.getTime()]
      );
    } catch (error) {
      console.warn("Failed to cleanup old conflicts:", error);
    }
  }

  async cleanupOldAuditRecords(maxRecords: number = 100): Promise<void> {
    try {
      // Keep only the latest maxRecords records
      await this.db.executeSql(
        `
        DELETE FROM audit_records 
        WHERE id NOT IN (
          SELECT id FROM audit_records 
          ORDER BY timestamp DESC 
          LIMIT ?
        )
      `,
        [maxRecords]
      );
    } catch (error) {
      console.warn("Failed to cleanup audit records:", error);
    }
  }

  private async cleanupAuditRecords(): Promise<void> {
    try {
      // Keep only the latest 100 records
      await this.db.executeSql(`
        DELETE FROM audit_records 
        WHERE id NOT IN (
          SELECT id FROM audit_records 
          ORDER BY timestamp DESC 
          LIMIT 100
        )
      `);
    } catch (error) {
      console.warn("Failed to cleanup audit records:", error);
    }
  }

  private mapRowToExerciseRecord(row: any): Exercise_Record {
    let metadata: ExerciseMetadata = {};

    try {
      if (row.metadata) {
        metadata = JSON.parse(row.metadata);
      }
    } catch (error) {
      console.warn("Failed to parse metadata for record:", row.id);
    }

    return {
      id: row.id,
      name: row.name,
      startTime: new Date(row.start_time),
      duration: row.duration,
      source: row.source as DataSource,
      platform: row.platform ? (row.platform as HealthPlatform) : undefined,
      metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToAuditRecord(row: any): AuditRecord {
    let beforeData = null;
    let afterData = null;
    let metadata = {};

    try {
      if (row.before_data) {
        beforeData = JSON.parse(row.before_data);
      }
      if (row.after_data) {
        afterData = JSON.parse(row.after_data);
      }
      if (row.metadata) {
        metadata = JSON.parse(row.metadata);
      }
    } catch (error) {
      console.warn("Failed to parse audit record data:", row.id);
    }

    return {
      id: row.id,
      action: row.action,
      timestamp: new Date(row.timestamp),
      recordId: row.record_id,
      beforeData,
      afterData,
      metadata,
    };
  }

  // Transaction support for data integrity
  async executeTransaction<T>(
    operations: (db: SQLite.SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.transaction(
        async (tx) => {
          try {
            // Temporarily replace the database instance with the transaction
            const originalDb = this.db;
            this.db = tx as any;

            try {
              const result = await operations(tx as any);

              // Restore original database instance
              this.db = originalDb;

              resolve(result);
            } catch (error) {
              // Restore original database instance on error
              this.db = originalDb;
              throw error;
            }
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}
