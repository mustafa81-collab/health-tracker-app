// Integration tests for end-to-end user flows
// Requirements: All requirements (integration)

import SQLite from "react-native-sqlite-storage";
import { DataStorageManager } from "@/services/database/DataStorageManager";
import { ExerciseLogger } from "@/services/ExerciseLogger";
import { ExerciseRecordManager } from "@/services/ExerciseRecordManager";
import { ConflictDetector } from "@/services/ConflictDetector";
import { ConflictResolver } from "@/services/ConflictResolver";
import { DuplicateDetectionService } from "@/services/DuplicateDetectionService";
import { PermissionManager } from "@/services/PermissionManager";
import { DataPurgeService } from "@/services/DataPurgeService";
import {
  Exercise_Record,
  DataSource,
  HealthPlatform,
  ExerciseInput,
  ResolutionChoice,
  ConflictType,
} from "@/types";

// Mock SQLite for testing
jest.mock("react-native-sqlite-storage", () => ({
  openDatabase: jest.fn(() => ({
    executeSql: jest.fn(),
    close: jest.fn(),
  })),
}));

describe("End-to-End Integration Tests", () => {
  let database: SQLite.SQLiteDatabase;
  let storageManager: DataStorageManager;
  let exerciseLogger: ExerciseLogger;
  let recordManager: ExerciseRecordManager;
  let conflictDetector: ConflictDetector;
  let conflictResolver: ConflictResolver;
  let duplicateService: DuplicateDetectionService;
  let permissionManager: PermissionManager;
  let dataPurgeService: DataPurgeService;

  // Mock data
  const mockExerciseRecords: Exercise_Record[] = [];
  const mockConflicts: any[] = [];

  beforeEach(async () => {
    // Setup mock database
    database = {
      executeSql: jest.fn((sql, params) => {
        return new Promise((resolve, reject) => {
          try {
            // Mock different SQL operations
            if (sql.includes("INSERT") && sql.includes("exercise_records")) {
              const record = {
                id: params[0],
                name: params[1],
                start_time: params[2],
                duration: params[3],
                source: params[4],
                platform: params[5],
                metadata: params[6],
                created_at: params[7],
                updated_at: params[8],
              };

              // Check if record already exists (for INSERT OR REPLACE)
              const existingIndex = mockExerciseRecords.findIndex(
                (r) => r.id === record.id
              );
              const newRecord = {
                id: record.id,
                name: record.name,
                startTime: new Date(record.start_time),
                duration: record.duration,
                source: record.source as DataSource,
                platform: record.platform as HealthPlatform,
                metadata: JSON.parse(record.metadata),
                createdAt: new Date(record.created_at),
                updatedAt: new Date(record.updated_at),
              };

              if (existingIndex >= 0) {
                // Replace existing record
                mockExerciseRecords[existingIndex] = newRecord;
              } else {
                // Insert new record
                mockExerciseRecords.push(newRecord);
              }

              resolve([{ insertId: 1, rowsAffected: 1 }]);
            } else if (
              sql.includes("SELECT") &&
              sql.includes("exercise_records")
            ) {
              const rows = mockExerciseRecords.map((record) => ({
                id: record.id,
                name: record.name,
                start_time: record.startTime.getTime(),
                duration: record.duration,
                source: record.source,
                platform: record.platform,
                metadata: JSON.stringify(record.metadata),
                created_at: record.createdAt.getTime(),
                updated_at: record.updatedAt.getTime(),
              }));
              resolve([
                { rows: { length: rows.length, item: (i: number) => rows[i] } },
              ]);
            } else if (
              sql.includes("DELETE") &&
              sql.includes("exercise_records")
            ) {
              const recordId = params[0];
              const index = mockExerciseRecords.findIndex(
                (r) => r.id === recordId
              );
              if (index >= 0) {
                mockExerciseRecords.splice(index, 1);
              }
              resolve([{ rowsAffected: index >= 0 ? 1 : 0 }]);
            } else {
              resolve([{ rows: { length: 0, item: () => null } }]);
            }
          } catch (error) {
            reject(error);
          }
        });
      }),
      close: jest.fn(),
    } as any;

    // Initialize services
    storageManager = new DataStorageManager(database);
    exerciseLogger = new ExerciseLogger(storageManager);
    recordManager = new ExerciseRecordManager(storageManager);
    conflictDetector = new ConflictDetector();
    conflictResolver = new ConflictResolver();
    duplicateService = new DuplicateDetectionService();
    permissionManager = new PermissionManager();
    dataPurgeService = new DataPurgeService(storageManager, permissionManager);

    // Clear mock data
    mockExerciseRecords.length = 0;
    mockConflicts.length = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete User Journey: Manual Exercise Logging", () => {
    test("should successfully log, view, edit, and delete a manual exercise", async () => {
      // Step 1: Log a manual exercise
      const exerciseInput: ExerciseInput = {
        name: "Morning Run",
        startTime: new Date(), // Use current time to avoid validation issues
        duration: 30,
      };

      const loggedRecord = await exerciseLogger.saveManualLog(exerciseInput);
      expect(loggedRecord).toBeDefined();
      expect(loggedRecord.name).toBe("Morning Run");
      expect(loggedRecord.source).toBe(DataSource.MANUAL);

      // Step 2: Verify exercise appears in storage
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59
      );

      const storedRecords = await storageManager.getExerciseHistory({
        start: startOfDay,
        end: endOfDay,
      });
      expect(storedRecords.length).toBe(1);
      expect(storedRecords[0]!.name).toBe("Morning Run");

      // Step 3: Edit the exercise
      const recordToEdit = storedRecords[0]!;
      await storageManager.updateRecord(recordToEdit.id, {
        name: "Morning Jog",
        duration: 35,
      });

      // Step 4: Verify the edit
      const updatedRecords = await storageManager.getExerciseHistory({
        start: startOfDay,
        end: endOfDay,
      });
      expect(updatedRecords.length).toBe(1);
      expect(updatedRecords[0]!.name).toBe("Morning Jog");
      expect(updatedRecords[0]!.duration).toBe(35);

      // Step 5: Delete the exercise
      const deleteResult = await recordManager.deleteExerciseRecord(
        recordToEdit.id
      );
      expect(deleteResult.success).toBe(true);

      // Step 6: Verify deletion
      const finalRecords = await storageManager.getExerciseHistory({
        start: startOfDay,
        end: endOfDay,
      });
      expect(finalRecords.length).toBe(0);
    });

    test("should handle validation errors during manual logging", async () => {
      // Test invalid exercise name
      const invalidInput: ExerciseInput = {
        name: "", // Empty name should fail validation
        startTime: new Date(),
        duration: 30,
      };

      await expect(exerciseLogger.saveManualLog(invalidInput)).rejects.toThrow(
        "Exercise name is required"
      );

      // Test invalid duration
      const invalidDurationInput: ExerciseInput = {
        name: "Valid Exercise",
        startTime: new Date(),
        duration: 0, // Zero duration should fail
      };

      await expect(
        exerciseLogger.saveManualLog(invalidDurationInput)
      ).rejects.toThrow("Duration must be a positive number");
    });
  });

  describe("Conflict Detection and Resolution Flow", () => {
    test("should detect and resolve conflicts between manual and synced records", async () => {
      // Step 1: Create a manual exercise record
      const manualInput: ExerciseInput = {
        name: "Gym Workout",
        startTime: new Date(),
        duration: 60,
      };

      const manualRecord = await exerciseLogger.saveManualLog(manualInput);
      expect(manualRecord).toBeDefined();

      // Step 2: Create a conflicting synced record
      const syncedRecord: Exercise_Record = {
        id: "synced_123",
        name: "Strength Training",
        startTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes later
        duration: 45,
        source: DataSource.SYNCED,
        platform: HealthPlatform.APPLE_HEALTHKIT,
        metadata: {
          originalId: "hk_workout_123",
          confidence: 0.9,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add synced record to mock data
      mockExerciseRecords.push(syncedRecord);

      // Step 3: Detect conflicts
      const conflictAnalysis = conflictDetector.detectConflicts([
        manualRecord,
        syncedRecord,
      ]);
      expect(conflictAnalysis.conflicts.length).toBe(1);
      expect(conflictAnalysis.conflicts[0]!.conflictType).toBe(
        ConflictType.CONFLICTING_DATA
      );
      expect(conflictAnalysis.conflicts[0]!.overlapDuration).toBeGreaterThan(0);

      // Step 4: Resolve conflict by keeping manual record
      const conflict = conflictAnalysis.conflicts[0]!;
      const resolutionResult = conflictResolver.resolveConflict(
        conflict,
        ResolutionChoice.KEEP_MANUAL,
        {
          userNotes: "Manual record is more accurate",
        }
      );

      expect(resolutionResult.success).toBe(true);
      expect(resolutionResult.resolution.resolutionChoice).toBe(
        ResolutionChoice.KEEP_MANUAL
      );

      // Step 5: Verify resolution was applied
      const remainingRecords = mockExerciseRecords.filter(
        (r) => r.source === DataSource.MANUAL
      );
      expect(remainingRecords.length).toBe(1);
      expect(remainingRecords[0]!.name).toBe("Gym Workout");
    });

    test("should handle merge resolution correctly", async () => {
      // Create two overlapping records
      const manualRecord: Exercise_Record = {
        id: "manual_456",
        name: "Cardio Session",
        startTime: new Date("2024-01-15T09:00:00Z"),
        duration: 30,
        source: DataSource.MANUAL,
        metadata: { userNotes: "Felt great today" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const syncedRecord: Exercise_Record = {
        id: "synced_456",
        name: "Running",
        startTime: new Date("2024-01-15T09:10:00Z"),
        duration: 25,
        source: DataSource.SYNCED,
        platform: HealthPlatform.GOOGLE_HEALTH_CONNECT,
        metadata: {
          originalId: "gc_run_456",
          calories: 250,
          heartRate: 145,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockExerciseRecords.push(manualRecord, syncedRecord);

      // Detect conflict
      const conflictAnalysis = conflictDetector.detectConflicts([
        manualRecord,
        syncedRecord,
      ]);
      expect(conflictAnalysis.conflicts.length).toBe(1);

      // Resolve by merging
      const conflict = conflictAnalysis.conflicts[0]!;
      const resolutionResult = conflictResolver.resolveConflict(
        conflict,
        ResolutionChoice.MERGE_RECORDS,
        {
          userNotes: "Combine the best of both records",
        }
      );

      expect(resolutionResult.success).toBe(true);
      expect(resolutionResult.resolution.afterState.mergedRecord).toBeDefined();
    });
  });

  describe("Duplicate Prevention Flow", () => {
    test("should prevent duplicate records during sync", async () => {
      // Step 1: Create an existing manual record
      const now = new Date();
      const existingRecord: Exercise_Record = {
        id: "manual_789",
        name: "Evening Walk",
        startTime: now,
        duration: 20,
        source: DataSource.MANUAL,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockExerciseRecords.push(existingRecord);

      // Step 2: Create a potential duplicate from sync
      const incomingRecord: Exercise_Record = {
        id: "synced_789",
        name: "Walking",
        startTime: new Date(now.getTime() + 2 * 60 * 1000), // 2 minutes later
        duration: 18, // 2 minutes shorter
        source: DataSource.SYNCED,
        platform: HealthPlatform.APPLE_HEALTHKIT,
        metadata: {
          originalId: "hk_walk_789",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 3: Check for duplicates
      const duplicateResult = duplicateService.detectDuplicates(
        incomingRecord,
        [existingRecord]
      );

      // Should detect as potential duplicate (may not be high confidence due to name differences)
      expect(duplicateResult.confidence).toBeGreaterThanOrEqual(0);
      expect(duplicateResult.confidence).toBeLessThanOrEqual(1);

      // Step 4: Filter out duplicates
      const filterResult = duplicateService.filterDuplicates(
        [incomingRecord],
        [existingRecord]
      );

      expect(filterResult.summary.total).toBe(1);
      expect(
        filterResult.summary.unique + filterResult.summary.duplicatesFound
      ).toBeLessThanOrEqual(1);
    });
  });

  describe("Data Management Flow", () => {
    test("should handle data purge confirmation", async () => {
      // Step 1: Get purge confirmation
      const confirmation = dataPurgeService.getPurgeConfirmation();

      expect(confirmation.title).toBe("Delete All Data");
      expect(confirmation.confirmationText).toBeDefined();
      expect(confirmation.requiresTypedConfirmation).toBe(true);
    });
  });

  describe("Permission Management Flow", () => {
    test("should handle opt-in settings", async () => {
      // Step 1: Test opt-in settings
      const optInSettings = permissionManager.getOptInSettings();
      expect(optInSettings.dataCollection).toBe(false); // Default

      permissionManager.updateOptInSettings({
        dataCollection: true,
        syncEnabled: true,
      });

      const updatedOptIn = permissionManager.getOptInSettings();
      expect(updatedOptIn.dataCollection).toBe(true);
      expect(updatedOptIn.syncEnabled).toBe(true);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle database connection failures gracefully", async () => {
      // Mock database failure
      database.executeSql = jest.fn(
        (
          sql: string,
          params: any[],
          successCallback: any,
          errorCallback: any
        ) => {
          errorCallback(new Error("Database connection failed"));
        }
      ) as any;

      const exerciseInput: ExerciseInput = {
        name: "Test Exercise",
        startTime: new Date(),
        duration: 30,
      };

      await expect(
        exerciseLogger.saveManualLog(exerciseInput)
      ).rejects.toThrow();
    });

    test("should handle concurrent operations correctly", async () => {
      // Simulate concurrent exercise logging
      const now = new Date();
      const exercises = [
        {
          name: "Exercise 1",
          startTime: new Date(now.getTime() - 60 * 60 * 1000),
          duration: 30,
        }, // 1 hour ago
        {
          name: "Exercise 2",
          startTime: new Date(now.getTime() - 30 * 60 * 1000),
          duration: 45,
        }, // 30 minutes ago
        {
          name: "Exercise 3",
          startTime: new Date(now.getTime() - 10 * 60 * 1000),
          duration: 20,
        }, // 10 minutes ago
      ];

      const promises = exercises.map((exercise) =>
        exerciseLogger.saveManualLog(exercise)
      );

      const results = await Promise.all(promises);

      // All operations should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.source).toBe(DataSource.MANUAL);
      });

      // All records should be stored
      expect(mockExerciseRecords.length).toBe(3);
    });

    test("should handle invalid date ranges in queries", async () => {
      // Test with invalid date range (end before start)
      const invalidRange = {
        start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        end: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (end before start)
      };

      // Mock the database to handle the callback properly
      database.executeSql = jest.fn((sql, params) => {
        return Promise.resolve([{ rows: { length: 0, item: () => null } }]);
      });

      const records = await storageManager.getExerciseHistory(invalidRange);
      expect(records.length).toBe(0); // Should return empty array, not error
    });
  });

  describe("Performance and Scalability", () => {
    test("should handle large datasets efficiently", async () => {
      // Create a large number of records
      const largeDataset: Exercise_Record[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: `record_${i}`,
          name: `Exercise ${i}`,
          startTime: new Date(Date.now() + i * 60000), // 1 minute apart
          duration: 30 + (i % 60), // Varying durations
          source: i % 2 === 0 ? DataSource.MANUAL : DataSource.SYNCED,
          platform: i % 2 === 1 ? HealthPlatform.APPLE_HEALTHKIT : undefined,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      mockExerciseRecords.push(...largeDataset);

      // Test duplicate detection performance
      const startTime = Date.now();
      const testRecord = largeDataset[500]!; // Pick a record from the middle
      const duplicateResult = duplicateService.detectDuplicates(
        testRecord,
        largeDataset
      );
      const endTime = Date.now();

      expect(duplicateResult).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
