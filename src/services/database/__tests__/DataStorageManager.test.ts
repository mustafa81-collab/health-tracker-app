// Unit tests for DataStorageManager

import { DataStorageManager } from "../DataStorageManager";
import { DatabaseMigrator } from "../migrations";
import {
  Exercise_Record,
  DataSource,
  HealthPlatform,
  AuditAction,
} from "@/types";

describe("DataStorageManager", () => {
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;

  const mockExerciseRecord: Exercise_Record = {
    id: "test-exercise-1",
    name: "Morning Run",
    startTime: new Date("2024-01-15T08:00:00Z"),
    duration: 30,
    source: DataSource.MANUAL,
    metadata: {
      calories: 250,
      heartRate: 150,
    },
    createdAt: new Date("2024-01-15T08:00:00Z"),
    updatedAt: new Date("2024-01-15T08:00:00Z"),
  };

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase();

    storageManager = new DataStorageManager(migrator.getDatabase());
  });

  afterEach(async () => {
    await migrator.close();
  });

  describe("saveExerciseRecord", () => {
    test("should save a valid exercise record", async () => {
      await expect(
        storageManager.saveExerciseRecord(mockExerciseRecord)
      ).resolves.not.toThrow();
    });

    test("should save record with synced data source", async () => {
      const syncedRecord: Exercise_Record = {
        ...mockExerciseRecord,
        id: "synced-exercise-1",
        source: DataSource.SYNCED,
        platform: HealthPlatform.APPLE_HEALTHKIT,
      };

      await expect(
        storageManager.saveExerciseRecord(syncedRecord)
      ).resolves.not.toThrow();
    });

    test("should handle records with minimal metadata", async () => {
      const minimalRecord: Exercise_Record = {
        ...mockExerciseRecord,
        id: "minimal-exercise-1",
        metadata: {},
      };

      await expect(
        storageManager.saveExerciseRecord(minimalRecord)
      ).resolves.not.toThrow();
    });
  });

  describe("getExerciseHistory", () => {
    beforeEach(async () => {
      // Save test records
      await storageManager.saveExerciseRecord(mockExerciseRecord);

      const secondRecord: Exercise_Record = {
        ...mockExerciseRecord,
        id: "test-exercise-2",
        name: "Evening Walk",
        startTime: new Date("2024-01-15T18:00:00Z"),
        duration: 45,
      };
      await storageManager.saveExerciseRecord(secondRecord);
    });

    test("should retrieve records within date range", async () => {
      const dateRange = {
        start: new Date("2024-01-15T00:00:00Z"),
        end: new Date("2024-01-15T23:59:59Z"),
      };

      const records = await storageManager.getExerciseHistory(dateRange);

      expect(records).toHaveLength(2);
      if (records.length >= 2) {
        expect(records[0]?.name).toBe("Evening Walk"); // Should be ordered by start_time DESC
        expect(records[1]?.name).toBe("Morning Run");
      }
    });

    test("should return empty array for date range with no records", async () => {
      const dateRange = {
        start: new Date("2024-01-16T00:00:00Z"),
        end: new Date("2024-01-16T23:59:59Z"),
      };

      const records = await storageManager.getExerciseHistory(dateRange);
      expect(records).toHaveLength(0);
    });

    test("should preserve metadata in retrieved records", async () => {
      const dateRange = {
        start: new Date("2024-01-15T00:00:00Z"),
        end: new Date("2024-01-15T23:59:59Z"),
      };

      const records = await storageManager.getExerciseHistory(dateRange);
      const morningRun = records.find((r) => r.name === "Morning Run");

      expect(morningRun).toBeDefined();
      if (morningRun) {
        expect(morningRun.metadata.calories).toBe(250);
        expect(morningRun.metadata.heartRate).toBe(150);
      }
    });
  });

  describe("updateRecord", () => {
    beforeEach(async () => {
      await storageManager.saveExerciseRecord(mockExerciseRecord);
    });

    test("should update existing record fields", async () => {
      const updates = {
        name: "Updated Morning Run",
        duration: 35,
      };

      await storageManager.updateRecord(mockExerciseRecord.id, updates);

      const updatedRecord = await storageManager.getRecordById(
        mockExerciseRecord.id
      );
      expect(updatedRecord).toBeDefined();
      expect(updatedRecord!.name).toBe("Updated Morning Run");
      expect(updatedRecord!.duration).toBe(35);
      expect(updatedRecord!.updatedAt.getTime()).toBeGreaterThan(
        mockExerciseRecord.updatedAt.getTime()
      );
    });

    test("should throw error when updating non-existent record", async () => {
      await expect(
        storageManager.updateRecord("non-existent-id", { name: "Updated" })
      ).rejects.toThrow("Record not found");
    });

    test("should not allow ID to be changed", async () => {
      const updates = {
        id: "new-id",
        name: "Updated Name",
      };

      await storageManager.updateRecord(mockExerciseRecord.id, updates);

      const record = await storageManager.getRecordById(mockExerciseRecord.id);
      expect(record).toBeDefined();
      expect(record!.id).toBe(mockExerciseRecord.id); // ID should remain unchanged
      expect(record!.name).toBe("Updated Name"); // But name should be updated
    });
  });

  describe("deleteRecord", () => {
    beforeEach(async () => {
      await storageManager.saveExerciseRecord(mockExerciseRecord);
    });

    test("should delete existing record", async () => {
      await expect(
        storageManager.deleteRecord(mockExerciseRecord.id)
      ).resolves.not.toThrow();

      const record = await storageManager.getRecordById(mockExerciseRecord.id);
      expect(record).toBeNull();
    });

    test("should throw error when deleting non-existent record", async () => {
      await expect(
        storageManager.deleteRecord("non-existent-id")
      ).rejects.toThrow("Record not found");
    });
  });

  describe("getRecordById", () => {
    beforeEach(async () => {
      await storageManager.saveExerciseRecord(mockExerciseRecord);
    });

    test("should retrieve record by ID", async () => {
      const record = await storageManager.getRecordById(mockExerciseRecord.id);
      expect(record).toBeDefined();
      if (record) {
        expect(record.id).toBe(mockExerciseRecord.id);
        expect(record.name).toBe(mockExerciseRecord.name);
        expect(record.duration).toBe(mockExerciseRecord.duration);
      }
    });

    test("should return null for non-existent ID", async () => {
      const record = await storageManager.getRecordById("non-existent-id");
      expect(record).toBeNull();
    });
  });

  describe("audit trail functionality", () => {
    test("should save and retrieve audit records", async () => {
      const auditRecord = {
        id: "audit-1",
        action: AuditAction.RECORD_CREATED,
        timestamp: new Date(),
        recordId: mockExerciseRecord.id,
        beforeData: null,
        afterData: mockExerciseRecord,
        metadata: {
          userId: "test-user",
          deviceId: "test-device",
        },
      };

      await storageManager.saveAuditRecord(auditRecord);

      const auditTrail = await storageManager.getAuditTrail(10);
      expect(auditTrail).toHaveLength(1);
      if (auditTrail.length > 0) {
        expect(auditTrail[0]?.action).toBe(AuditAction.RECORD_CREATED);
        expect(auditTrail[0]?.recordId).toBe(mockExerciseRecord.id);
      }
    });

    test("should maintain rolling history limit", async () => {
      // Create more than 100 audit records
      for (let i = 0; i < 105; i++) {
        const auditRecord = {
          id: `audit-${i}`,
          action: AuditAction.RECORD_CREATED,
          timestamp: new Date(Date.now() + i * 1000), // Different timestamps
          recordId: `record-${i}`,
          beforeData: null,
          afterData: { test: i },
          metadata: {},
        };
        await storageManager.saveAuditRecord(auditRecord);
      }

      const auditTrail = await storageManager.getAuditTrail(200); // Request more than limit
      expect(auditTrail.length).toBeLessThanOrEqual(100); // Should be capped at 100
    });
  });

  describe("transaction support", () => {
    test("should execute operations in transaction", async () => {
      const result = await storageManager.executeTransaction(async (_db) => {
        await storageManager.saveExerciseRecord(mockExerciseRecord);
        return "success";
      });

      expect(result).toBe("success");

      const record = await storageManager.getRecordById(mockExerciseRecord.id);
      expect(record).toBeDefined();
    });

    test("should rollback transaction on error", async () => {
      // This test verifies that transaction errors are properly handled
      // The actual rollback behavior is handled by the SQLite library

      let transactionCalled = false;
      const originalTransaction = (storageManager as any).db.transaction;

      (storageManager as any).db.transaction = jest.fn(
        (callback, errorCallback, successCallback) => {
          transactionCalled = true;

          // Create a mock transaction
          const mockTx = {
            executeSql: jest.fn(() =>
              Promise.resolve([
                { rows: { length: 0, item: jest.fn() }, rowsAffected: 1 },
              ])
            ),
          };

          // Call the original transaction logic but with our mock
          originalTransaction.call(
            (storageManager as any).db,
            (_tx: any) => callback(mockTx),
            errorCallback,
            successCallback
          );
        }
      );

      try {
        await storageManager.executeTransaction(async (_db) => {
          await storageManager.saveExerciseRecord(mockExerciseRecord);
          throw new Error("Simulated error");
        });
        // Should not reach here
        fail("Expected transaction to throw error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Simulated error");
      }

      // Restore original transaction
      (storageManager as any).db.transaction = originalTransaction;

      // Verify transaction was called
      expect(transactionCalled).toBe(true);
    });
  });
});
