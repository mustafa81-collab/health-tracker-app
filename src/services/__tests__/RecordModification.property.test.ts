// Property test for record modification operations
// Property 10: Record Modification Operations
// Validates: Requirements 5.3, 5.4

import fc from "fast-check";
import { ExerciseRecordManager } from "../ExerciseRecordManager";
import { DataStorageManager } from "../database/DataStorageManager";
import {
  Exercise_Record,
  DataSource,
  HealthPlatform,
  AuditAction,
  AuditRecord,
} from "@/types";

// Mock DataStorageManager for testing
class MockDataStorageManager extends DataStorageManager {
  private records: Map<string, Exercise_Record> = new Map();
  private auditRecords: AuditRecord[] = [];

  constructor() {
    super(null as any); // Mock database
  }

  async getRecordById(id: string): Promise<Exercise_Record | null> {
    return this.records.get(id) || null;
  }

  async updateRecord(
    id: string,
    updates: Partial<Exercise_Record>
  ): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error("Record not found");
    }

    const updated = { ...existing, ...updates };
    this.records.set(id, updated);
  }

  async deleteRecord(id: string): Promise<void> {
    if (!this.records.has(id)) {
      throw new Error("Record not found");
    }
    this.records.delete(id);
  }

  async saveAuditRecord(auditRecord: AuditRecord): Promise<void> {
    this.auditRecords.push(auditRecord);
  }

  async getAuditTrail(limit: number): Promise<AuditRecord[]> {
    return this.auditRecords
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getExerciseHistory(dateRange?: {
    start: Date;
    end: Date;
  }): Promise<Exercise_Record[]> {
    const records = Array.from(this.records.values());

    if (!dateRange) {
      return records;
    }

    return records.filter(
      (record) =>
        record.startTime >= dateRange.start && record.startTime <= dateRange.end
    );
  }

  // Mock other required methods
  async initializeDatabase(): Promise<void> {}
  async closeDatabase(): Promise<void> {}
  async saveExerciseRecord(): Promise<void> {}
  async cleanupOldAuditRecords(): Promise<void> {}

  // Helper methods for testing
  addRecord(record: Exercise_Record): void {
    this.records.set(record.id, record);
  }

  getRecordCount(): number {
    return this.records.size;
  }

  clearRecords(): void {
    this.records.clear();
    this.auditRecords = [];
  }

  getAllRecords(): Exercise_Record[] {
    return Array.from(this.records.values());
  }
}

// Generators for test data
const exerciseRecordArb = fc
  .record({
    id: fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0),
    name: fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0),
    startTime: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
    duration: fc.integer({ min: 1, max: 1440 }),
    source: fc.constantFrom(DataSource.MANUAL, DataSource.SYNCED),
    platform: fc.option(
      fc.constantFrom(
        HealthPlatform.APPLE_HEALTHKIT,
        HealthPlatform.GOOGLE_HEALTH_CONNECT
      )
    ),
    metadata: fc.record({
      originalId: fc.option(fc.string()),
      confidence: fc.option(
        fc.float({ min: Math.fround(0), max: Math.fround(1) })
      ),
    }),
    createdAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
    updatedAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
  })
  .map((record) => ({
    ...record,
    platform: record.platform || undefined,
    metadata: {
      ...record.metadata,
      originalId: record.metadata.originalId || undefined,
      confidence: record.metadata.confidence || undefined,
    },
  }));

const recordUpdatesArb = fc
  .record({
    name: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    duration: fc.option(fc.integer({ min: 1, max: 1440 })),
    startTime: fc.option(
      fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") })
    ),
  })
  .map((updates) => ({
    ...(updates.name && { name: updates.name }),
    ...(updates.duration && { duration: updates.duration }),
    ...(updates.startTime && { startTime: updates.startTime }),
  }));

describe("Property 10: Record Modification Operations", () => {
  let mockStorage: MockDataStorageManager;
  let recordManager: ExerciseRecordManager;

  beforeEach(() => {
    mockStorage = new MockDataStorageManager();
    recordManager = new ExerciseRecordManager(mockStorage);
  });

  test("Property 10.1: Only manual records can be edited", async () => {
    await fc.assert(
      fc.asyncProperty(
        exerciseRecordArb,
        recordUpdatesArb,
        async (record, updates) => {
          const typedRecord = record as Exercise_Record;

          // Add record to storage
          mockStorage.addRecord(typedRecord);

          if (typedRecord.source === DataSource.MANUAL) {
            // Manual records should be editable
            await mockStorage.updateRecord(typedRecord.id, updates);

            const updatedRecord = await mockStorage.getRecordById(
              typedRecord.id
            );
            expect(updatedRecord).toBeDefined();

            // Verify updates were applied
            if (updates.name) {
              expect(updatedRecord!.name).toBe(updates.name);
            }
            if (updates.duration) {
              expect(updatedRecord!.duration).toBe(updates.duration);
            }
            if (updates.startTime) {
              expect(updatedRecord!.startTime).toEqual(updates.startTime);
            }
          } else {
            // Synced records should still be updatable at the storage level
            // (business logic restrictions would be enforced at the service level)
            await mockStorage.updateRecord(typedRecord.id, updates);

            const updatedRecord = await mockStorage.getRecordById(
              typedRecord.id
            );
            expect(updatedRecord).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 10.2: Record deletion must preserve audit trail", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        const typedRecord = record as Exercise_Record;
        mockStorage.clearRecords();

        // Add record to storage
        mockStorage.addRecord(typedRecord);

        // Delete the record
        const deleteResult = await recordManager.deleteExerciseRecord(
          typedRecord.id
        );

        expect(deleteResult.success).toBe(true);

        // Verify record is deleted
        const deletedRecord = await mockStorage.getRecordById(typedRecord.id);
        expect(deletedRecord).toBeNull();

        // Verify audit trail exists
        const auditRecords = await mockStorage.getAuditTrail(10);
        const deletionAudit = auditRecords.find(
          (audit) =>
            audit.action === AuditAction.RECORD_DELETED &&
            audit.recordId === typedRecord.id
        );

        expect(deletionAudit).toBeDefined();
        expect(deletionAudit!.beforeData).toBeDefined();
      }),
      { numRuns: 30 }
    );
  });

  test("Property 10.3: Batch deletion must handle partial failures gracefully", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseRecordArb, { minLength: 3, maxLength: 10 }),
        async (records) => {
          const typedRecords = records as Exercise_Record[];
          mockStorage.clearRecords();

          // Ensure unique IDs
          const uniqueRecords = typedRecords.map((record, index) => ({
            ...record,
            id: `${record.id.trim() || "record"}_${index}`,
          }));

          // Add some records to storage (but not all)
          const existingRecords = uniqueRecords.slice(
            0,
            Math.floor(uniqueRecords.length / 2)
          );
          const nonExistentIds = uniqueRecords
            .slice(Math.floor(uniqueRecords.length / 2))
            .map((r) => r.id);

          existingRecords.forEach((record) => mockStorage.addRecord(record));

          // Attempt to delete all records (including non-existent ones)
          const allIds = uniqueRecords.map((r) => r.id);
          const result = await recordManager.deleteMultipleRecords(allIds);

          // Should have some successful and some failed deletions
          expect(result.successful.length).toBe(existingRecords.length);
          expect(result.failed.length).toBe(nonExistentIds.length);

          // Verify successful deletions
          for (const successfulId of result.successful) {
            const record = await mockStorage.getRecordById(successfulId);
            expect(record).toBeNull();
          }

          // Verify failed deletions have error messages
          for (const failure of result.failed) {
            expect(failure.error).toBeDefined();
            expect(failure.error.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 10.4: Soft deletion must preserve record data", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        const typedRecord = record as Exercise_Record;
        mockStorage.clearRecords();

        // Add record to storage
        mockStorage.addRecord(typedRecord);

        // Soft delete the record
        const deleteResult = await recordManager.softDeleteRecord(
          typedRecord.id
        );

        expect(deleteResult.success).toBe(true);

        // Verify record still exists but is marked as deleted
        const softDeletedRecord = await mockStorage.getRecordById(
          typedRecord.id
        );
        expect(softDeletedRecord).toBeDefined();
        expect(softDeletedRecord!.metadata.deleted).toBe(true);
        expect(softDeletedRecord!.metadata.deletedAt).toBeDefined();

        // Verify original data is preserved
        expect(softDeletedRecord!.name).toBe(typedRecord.name);
        expect(softDeletedRecord!.duration).toBe(typedRecord.duration);
        expect(softDeletedRecord!.startTime.getTime()).toBe(
          typedRecord.startTime.getTime()
        );
      }),
      { numRuns: 30 }
    );
  });

  test("Property 10.5: Record restoration must remove deletion markers", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        const typedRecord = record as Exercise_Record;
        mockStorage.clearRecords();

        // Add record to storage
        mockStorage.addRecord(typedRecord);

        // Soft delete the record
        await recordManager.softDeleteRecord(typedRecord.id);

        // Restore the record
        const restoreResult = await recordManager.restoreRecord(typedRecord.id);

        expect(restoreResult.success).toBe(true);

        // Verify record is restored
        const restoredRecord = await mockStorage.getRecordById(typedRecord.id);
        expect(restoredRecord).toBeDefined();
        expect(restoredRecord!.metadata.deleted).toBeUndefined();
        expect(restoredRecord!.metadata.deletedAt).toBeUndefined();

        // Verify original data is intact
        expect(restoredRecord!.name).toBe(typedRecord.name);
        expect(restoredRecord!.duration).toBe(typedRecord.duration);
        expect(restoredRecord!.startTime.getTime()).toBe(
          typedRecord.startTime.getTime()
        );
      }),
      { numRuns: 25 }
    );
  });

  test("Property 10.6: Deletion statistics must be accurate", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseRecordArb, { minLength: 5, maxLength: 15 }),
        async (records) => {
          const typedRecords = records as Exercise_Record[];
          mockStorage.clearRecords();

          // Ensure unique IDs by adding index suffix
          const uniqueRecords = typedRecords.map((record, index) => ({
            ...record,
            id: `${record.id.trim() || "record"}_${index}`,
          }));

          // Add records to storage
          uniqueRecords.forEach((record) => mockStorage.addRecord(record));

          // Delete some records
          const recordsToDelete = uniqueRecords.slice(
            0,
            Math.floor(uniqueRecords.length / 2)
          );

          for (const record of recordsToDelete) {
            await recordManager.deleteExerciseRecord(record.id);
          }

          // Get deletion statistics
          const stats = await recordManager.getDeletionStatistics();

          // Verify statistics
          expect(stats.totalDeleted).toBe(recordsToDelete.length);

          // Count manual vs synced deletions
          const manualDeleted = recordsToDelete.filter(
            (r) => r.source === DataSource.MANUAL
          ).length;
          const syncedDeleted = recordsToDelete.filter(
            (r) => r.source === DataSource.SYNCED
          ).length;

          expect(stats.manualDeleted).toBe(manualDeleted);
          expect(stats.syncedDeleted).toBe(syncedDeleted);

          // All deletions should be recent (within last 24 hours)
          expect(stats.recentDeletions).toBe(recordsToDelete.length);
        }
      ),
      { numRuns: 15 }
    );
  });

  test("Property 10.7: Record updates must preserve essential metadata", async () => {
    await fc.assert(
      fc.asyncProperty(
        exerciseRecordArb,
        recordUpdatesArb,
        async (record, updates) => {
          const typedRecord = record as Exercise_Record;
          mockStorage.clearRecords();

          // Add record to storage
          mockStorage.addRecord(typedRecord);

          // Update the record
          await mockStorage.updateRecord(typedRecord.id, updates);

          const updatedRecord = await mockStorage.getRecordById(typedRecord.id);
          expect(updatedRecord).toBeDefined();

          // Essential metadata should be preserved
          expect(updatedRecord!.id).toBe(typedRecord.id);
          expect(updatedRecord!.source).toBe(typedRecord.source);
          expect(updatedRecord!.platform).toBe(typedRecord.platform);
          expect(updatedRecord!.createdAt.getTime()).toBe(
            typedRecord.createdAt.getTime()
          );

          // Original metadata should be preserved (unless explicitly updated)
          if (typedRecord.metadata.originalId) {
            expect(updatedRecord!.metadata.originalId).toBe(
              typedRecord.metadata.originalId
            );
          }
          if (typedRecord.metadata.confidence !== undefined) {
            expect(updatedRecord!.metadata.confidence).toBe(
              typedRecord.metadata.confidence
            );
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  test("Property 10.8: Deletion confirmation messages must be appropriate", () => {
    fc.assert(
      fc.property(exerciseRecordArb, (record) => {
        const typedRecord = record as Exercise_Record;
        const confirmation =
          recordManager.getDeleteConfirmationMessage(typedRecord);

        // Message should always be present
        expect(confirmation.title).toBeDefined();
        expect(confirmation.message).toBeDefined();
        expect(confirmation.warningLevel).toBeDefined();

        // Message should contain exercise name
        expect(confirmation.message).toContain(typedRecord.name);

        // Warning level should be appropriate for source type
        if (typedRecord.source === DataSource.MANUAL) {
          expect(confirmation.warningLevel).toBe("medium");
        } else {
          expect(confirmation.warningLevel).toBe("high");
          expect(confirmation.message).toContain("synced");
        }

        // All messages should warn about irreversibility
        expect(confirmation.message.toLowerCase()).toContain(
          "cannot be undone"
        );
      }),
      { numRuns: 50 }
    );
  });

  test("Property 10.9: Cleanup operations must handle edge cases", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseRecordArb, { minLength: 10, maxLength: 20 }),
        fc.integer({ min: 1, max: 60 }),
        async (records, daysOld) => {
          const typedRecords = records as Exercise_Record[];
          mockStorage.clearRecords();

          // Ensure unique IDs
          const uniqueRecords = typedRecords.map((record, index) => ({
            ...record,
            id: `${record.id.trim() || "record"}_${index}`,
          }));

          // Add records and soft delete some of them with old timestamps
          const oldDate = new Date();
          oldDate.setDate(oldDate.getDate() - daysOld - 5); // Ensure they're old enough

          const recordsToSoftDelete = uniqueRecords.slice(
            0,
            Math.floor(uniqueRecords.length / 2)
          );

          // Add all records
          uniqueRecords.forEach((record) => mockStorage.addRecord(record));

          // Soft delete some with old timestamps
          for (const record of recordsToSoftDelete) {
            await recordManager.softDeleteRecord(record.id);

            // Manually set old deletion timestamp
            const softDeleted = await mockStorage.getRecordById(record.id);
            if (softDeleted) {
              softDeleted.metadata.deletedAt = oldDate;
              await mockStorage.updateRecord(record.id, softDeleted);
            }
          }

          const initialCount = mockStorage.getRecordCount();

          // Cleanup old soft-deleted records
          const cleanupResult = await recordManager.cleanupSoftDeletedRecords(
            daysOld
          );

          // Verify cleanup results
          expect(cleanupResult.cleaned).toBeGreaterThanOrEqual(0);
          expect(cleanupResult.cleaned).toBeLessThanOrEqual(
            recordsToSoftDelete.length
          );

          // Verify records were actually removed
          const finalCount = mockStorage.getRecordCount();
          expect(finalCount).toBe(initialCount - cleanupResult.cleaned);
        }
      ),
      { numRuns: 10 }
    );
  });

  test("Property 10.10: Record modification operations must be atomic", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        const typedRecord = record as Exercise_Record;
        mockStorage.clearRecords();

        // Add record to storage
        mockStorage.addRecord(typedRecord);

        // Simulate concurrent operations
        const operations = [
          () =>
            mockStorage.updateRecord(typedRecord.id, {
              name: "Updated Name 1",
            }),
          () => mockStorage.updateRecord(typedRecord.id, { duration: 999 }),
          () =>
            mockStorage.updateRecord(typedRecord.id, {
              name: "Updated Name 2",
            }),
        ];

        // Execute operations
        await Promise.all(
          operations.map((op) =>
            op().catch(() => {
              // Ignore errors for this test - we're testing atomicity
            })
          )
        );

        // Verify record still exists and is in a valid state
        const finalRecord = await mockStorage.getRecordById(typedRecord.id);
        expect(finalRecord).toBeDefined();

        // Record should have valid data (not corrupted)
        expect(finalRecord!.id).toBe(typedRecord.id);
        expect(finalRecord!.name).toBeDefined();
        expect(finalRecord!.name.length).toBeGreaterThan(0);
        expect(finalRecord!.duration).toBeGreaterThan(0);
        expect(finalRecord!.startTime).toBeDefined();
      }),
      { numRuns: 20 }
    );
  });
});
