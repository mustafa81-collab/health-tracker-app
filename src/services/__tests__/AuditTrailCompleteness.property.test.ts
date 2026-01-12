// Property test for audit trail completeness
// Property 11: Audit Trail Completeness
// Validates: Requirements 6.1, 6.2, 6.3

import fc from "fast-check";
import { AuditTrailManager } from "../AuditTrailManager";
import { DataStorageManager } from "../database/DataStorageManager";
import {
  Exercise_Record,
  ConflictResolution,
  AuditAction,
  DataSource,
  HealthPlatform,
  ResolutionChoice,
  ConflictType,
} from "@/types";

// Mock DataStorageManager for testing
class MockDataStorageManager extends DataStorageManager {
  private auditRecords: any[] = [];
  private recordCount = 0;

  constructor() {
    super(null as any); // Mock database
  }

  async saveAuditRecord(auditRecord: any): Promise<void> {
    this.auditRecords.push(auditRecord);
  }

  async getAuditTrail(limit: number): Promise<any[]> {
    return this.auditRecords
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async cleanupOldAuditRecords(): Promise<void> {
    // Keep only the latest 100 records
    this.auditRecords = this.auditRecords
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);
  }

  // Mock other required methods
  async initializeDatabase(): Promise<void> {}
  async closeDatabase(): Promise<void> {}
  async saveExerciseRecord(): Promise<void> {}
  async getExerciseHistory(): Promise<Exercise_Record[]> {
    return [];
  }
  async updateRecord(): Promise<void> {}
  async deleteRecord(): Promise<void> {}

  // Helper methods for testing
  getAuditRecordCount(): number {
    return this.auditRecords.length;
  }

  clearAuditRecords(): void {
    this.auditRecords = [];
  }
}

// Generators for test data
const exerciseRecordArb = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
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
      calories: fc.option(fc.integer({ min: 0, max: 2000 })),
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
    platform: record.platform || undefined, // Convert null to undefined
    metadata: {
      ...record.metadata,
      originalId: record.metadata.originalId || undefined,
      confidence: record.metadata.confidence || undefined,
      calories: record.metadata.calories || undefined,
    },
  }));

const conflictResolutionArb = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    conflictId: fc.string({ minLength: 1, maxLength: 50 }),
    resolutionChoice: fc.constantFrom(
      ResolutionChoice.KEEP_MANUAL,
      ResolutionChoice.KEEP_SYNCED,
      ResolutionChoice.MERGE_RECORDS,
      ResolutionChoice.KEEP_BOTH
    ),
    resolvedAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
    beforeState: fc.record({
      manualRecord: exerciseRecordArb,
      syncedRecord: exerciseRecordArb,
    }),
    afterState: fc.record({
      manualRecord: fc.option(exerciseRecordArb),
      syncedRecord: fc.option(exerciseRecordArb),
      mergedRecord: fc.option(exerciseRecordArb),
    }),
    userNotes: fc.option(fc.string({ maxLength: 500 })),
  })
  .map((resolution) => ({
    ...resolution,
    userNotes: resolution.userNotes || undefined,
    afterState: {
      manualRecord: resolution.afterState.manualRecord || undefined,
      syncedRecord: resolution.afterState.syncedRecord || undefined,
      mergedRecord: resolution.afterState.mergedRecord || undefined,
    },
  }));

describe("Property 11: Audit Trail Completeness", () => {
  let mockStorage: MockDataStorageManager;
  let auditManager: AuditTrailManager;

  beforeEach(() => {
    mockStorage = new MockDataStorageManager();
    auditManager = new AuditTrailManager(mockStorage);
  });

  test("Property 11.1: All conflict resolutions must create audit records", async () => {
    await fc.assert(
      fc.asyncProperty(
        conflictResolutionArb,
        fc.record({
          beforeState: fc.anything(),
          afterState: fc.anything(),
        }),
        async (resolution, states) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Audit a conflict resolution
          await auditManager.auditConflictResolution(
            resolution as ConflictResolution,
            states.beforeState,
            states.afterState
          );

          // Verify audit record was created
          const auditRecords = await auditManager.getAuditTrail();

          expect(auditRecords).toHaveLength(1);

          const auditRecord = auditRecords[0]!;
          expect(auditRecord.action).toBe(AuditAction.CONFLICT_RESOLVED);
          expect(auditRecord.recordId).toBe(resolution.conflictId);
          expect(auditRecord.beforeData).toEqual(states.beforeState);
          expect(auditRecord.afterData).toEqual(states.afterState);
          expect(auditRecord.metadata.source).toBe("conflict_resolution");
          expect(auditRecord.timestamp).toBeInstanceOf(Date);
          expect(auditRecord.id).toMatch(/^audit_conflict_resolution_/);
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 11.2: All record operations must create audit records", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        // Clear previous audit records
        mockStorage.clearAuditRecords();

        // Test record creation audit
        await auditManager.auditRecordCreation(record as Exercise_Record);

        let auditRecords = await auditManager.getAuditTrail();
        expect(auditRecords).toHaveLength(1);
        expect(auditRecords[0]!.action).toBe(AuditAction.RECORD_CREATED);
        expect(auditRecords[0]!.recordId).toBe(record.id);
        expect(auditRecords[0]!.beforeData).toBeNull();
        expect(auditRecords[0]!.afterData).toEqual(record);

        // Test record update audit
        const updatedRecord = { ...record, name: "Updated Exercise" };
        await auditManager.auditRecordUpdate(
          record.id,
          record as Exercise_Record,
          updatedRecord as Exercise_Record,
          ["name"]
        );

        auditRecords = await auditManager.getAuditTrail();
        expect(auditRecords).toHaveLength(2);

        const updateAudit = auditRecords.find(
          (r) => r.action === AuditAction.RECORD_UPDATED
        );
        expect(updateAudit).toBeDefined();
        expect(updateAudit!.recordId).toBe(record.id);
        expect(updateAudit!.beforeData).toEqual(record);
        expect(updateAudit!.afterData).toEqual(updatedRecord);
        expect(updateAudit!.metadata.updatedFields).toEqual(["name"]);

        // Test record deletion audit
        await auditManager.auditRecordDeletion(record as Exercise_Record);

        auditRecords = await auditManager.getAuditTrail();
        expect(auditRecords).toHaveLength(3);

        const deleteAudit = auditRecords.find(
          (r) => r.action === AuditAction.RECORD_DELETED
        );
        expect(deleteAudit).toBeDefined();
        expect(deleteAudit!.recordId).toBe(record.id);
        expect(deleteAudit!.beforeData).toEqual(record);
        expect(deleteAudit!.afterData).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  test("Property 11.3: Audit records must maintain chronological order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseRecordArb, { minLength: 2, maxLength: 10 }),
        async (records) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Create audit records with small delays to ensure different timestamps
          for (let i = 0; i < records.length; i++) {
            const record = records[i]!;
            await auditManager.auditRecordCreation(record as Exercise_Record);
            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 1));
          }

          // Get audit trail
          const auditRecords = await auditManager.getAuditTrail();

          expect(auditRecords).toHaveLength(records.length);

          // Verify chronological order (newest first)
          for (let i = 1; i < auditRecords.length; i++) {
            expect(
              auditRecords[i - 1]!.timestamp.getTime()
            ).toBeGreaterThanOrEqual(auditRecords[i]!.timestamp.getTime());
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 11.4: Audit trail must respect rolling history limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 105, max: 150 }), // More than the 100 record limit
        async (recordCount) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Create more audit records than the limit
          for (let i = 0; i < recordCount; i++) {
            const record: Exercise_Record = {
              id: `record_${i}`,
              name: `Exercise ${i}`,
              startTime: new Date(),
              duration: 30,
              source: DataSource.MANUAL,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await auditManager.auditRecordCreation(record);
          }

          // Verify that cleanup maintains the limit
          const auditRecords = await auditManager.getAuditTrail({
            limit: 1000,
          }); // Request more than limit

          // Should not exceed the configured maximum
          expect(auditRecords.length).toBeLessThanOrEqual(120); // Cleanup threshold
        }
      ),
      { numRuns: 10 }
    );
  });

  test("Property 11.5: Audit metadata must be complete and consistent", async () => {
    await fc.assert(
      fc.asyncProperty(exerciseRecordArb, async (record) => {
        // Clear previous audit records
        mockStorage.clearAuditRecords();

        // Audit record creation
        await auditManager.auditRecordCreation(record as Exercise_Record);

        const auditRecords = await auditManager.getAuditTrail();
        const auditRecord = auditRecords[0]!;

        // Verify required metadata fields
        expect(auditRecord.metadata).toBeDefined();
        expect(auditRecord.metadata.source).toBe(record.source);

        // Platform should be included if present in original record
        if (record.platform) {
          expect(auditRecord.metadata.platform).toBe(record.platform);
        }

        // Original ID should be included if present
        if (record.metadata.originalId) {
          expect(auditRecord.metadata.originalId).toBe(
            record.metadata.originalId
          );
        }

        // Verify audit record structure
        expect(auditRecord.id).toBeDefined();
        expect(auditRecord.action).toBeDefined();
        expect(auditRecord.timestamp).toBeInstanceOf(Date);
        expect(auditRecord.recordId).toBe(record.id);
      }),
      { numRuns: 50 }
    );
  });

  test("Property 11.6: Resolution undo operations must create audit records", async () => {
    await fc.assert(
      fc.asyncProperty(
        conflictResolutionArb,
        fc.record({
          undoReason: fc.string({ maxLength: 200 }),
          undoTimestamp: fc.date(),
        }),
        async (resolution, undoMetadata) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Audit resolution undo
          await auditManager.auditResolutionUndo(
            resolution as ConflictResolution,
            undoMetadata
          );

          const auditRecords = await auditManager.getAuditTrail();

          expect(auditRecords).toHaveLength(1);

          const auditRecord = auditRecords[0]!;
          expect(auditRecord.action).toBe(AuditAction.RESOLUTION_UNDONE);
          expect(auditRecord.recordId).toBe(resolution.id);
          expect(auditRecord.beforeData).toEqual(resolution);
          expect(auditRecord.afterData).toEqual(undoMetadata);
          expect(auditRecord.metadata.source).toBe("undo_operation");
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 11.7: Bulk operations must create comprehensive audit records", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // operation name
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 1,
          maxLength: 20,
        }), // record IDs
        fc.record({
          reason: fc.string({ maxLength: 200 }),
          batchId: fc.string({ maxLength: 50 }),
        }),
        async (operation, recordIds, metadata) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Audit bulk operation
          await auditManager.auditBulkOperation(operation, recordIds, metadata);

          const auditRecords = await auditManager.getAuditTrail();

          expect(auditRecords).toHaveLength(1);

          const auditRecord = auditRecords[0]!;
          expect(auditRecord.action).toBe(AuditAction.RECORD_UPDATED);
          expect(auditRecord.recordId).toMatch(
            new RegExp(
              `^bulk_${operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_`
            )
          );
          expect(auditRecord.afterData.operation).toBe(operation);
          expect(auditRecord.afterData.affectedRecords).toBe(recordIds.length);
          expect(auditRecord.afterData.recordIds).toEqual(recordIds);
          expect(auditRecord.metadata.source).toBe("bulk_operation");
          expect((auditRecord.metadata as any).operation).toBe(operation);
          expect((auditRecord.metadata as any).recordCount).toBe(
            recordIds.length
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 11.8: Audit trail statistics must be accurate", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(exerciseRecordArb, { minLength: 5, maxLength: 15 }),
        async (records) => {
          // Clear previous audit records
          mockStorage.clearAuditRecords();

          // Create various types of audit records
          const createdRecords = records.slice(
            0,
            Math.floor(records.length / 2)
          );
          const updatedRecords = records.slice(Math.floor(records.length / 2));

          for (const record of createdRecords) {
            await auditManager.auditRecordCreation(record as Exercise_Record);
          }

          for (const record of updatedRecords) {
            await auditManager.auditRecordUpdate(
              record.id,
              record as Exercise_Record,
              { ...record, name: "Updated" } as Exercise_Record,
              ["name"]
            );
          }

          // Get statistics
          const stats = await auditManager.getAuditStatistics();

          // Verify statistics accuracy
          expect(stats.totalRecords).toBe(records.length);
          expect(stats.recordsByAction[AuditAction.RECORD_CREATED]).toBe(
            createdRecords.length
          );
          expect(stats.recordsByAction[AuditAction.RECORD_UPDATED]).toBe(
            updatedRecords.length
          );
          expect(stats.recordsByAction[AuditAction.RECORD_DELETED]).toBe(0);
          expect(stats.recordsByAction[AuditAction.CONFLICT_RESOLVED]).toBe(0);
          expect(stats.recordsByAction[AuditAction.RESOLUTION_UNDONE]).toBe(0);

          // Verify date-based statistics
          expect(stats.oldestRecord).toBeInstanceOf(Date);
          expect(stats.newestRecord).toBeInstanceOf(Date);
          expect(stats.averageRecordsPerDay).toBeGreaterThan(0);
          expect(Object.keys(stats.recordsByDay).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 15 }
    );
  });
});
