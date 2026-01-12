// Property-based tests for Health Platform Sync Behavior
// Feature: health-tracker, Property 3: Health Platform Sync Behavior

import * as fc from "fast-check";
import { HealthKitAdapter } from "../HealthKitAdapter";
import { HealthConnectAdapter } from "../HealthConnectAdapter";
import { DataStorageManager } from "../../database/DataStorageManager";
import { DatabaseMigrator } from "../../database/migrations";
import {
  PermissionStatus,
  SyncResult,
  HealthPlatform,
  DataSource,
} from "@/types";

describe("Health Platform Sync Behavior Properties", () => {
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;
  let healthKitAdapter: HealthKitAdapter;
  let healthConnectAdapter: HealthConnectAdapter;

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase();

    storageManager = new DataStorageManager(migrator.getDatabase());
    healthKitAdapter = new HealthKitAdapter(storageManager);
    healthConnectAdapter = new HealthConnectAdapter(storageManager);
  });

  afterEach(async () => {
    await migrator.close();
  });

  /**
   * Property 3: Health Platform Sync Behavior
   * For any granted permissions and available health platform data, the system should
   * successfully fetch and store the data with appropriate metadata and platform attribution.
   * Validates: Requirements 2.2, 2.3
   */
  test("Property 3: Health Platform Sync Behavior - successful sync should store data with metadata", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test scenarios for both platforms
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          permissionsGranted: fc.boolean(),
          hasData: fc.boolean(),
          dataCount: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ platform, permissionsGranted, hasData, dataCount }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          if (permissionsGranted) {
            // Mock successful permission request
            const permissionStatus = await adapter.requestPermissions();
            expect(permissionStatus.granted).toBe(true);

            if (hasData && dataCount > 0) {
              // Test exercise data sync
              const exerciseSyncResult = await adapter.syncExerciseData();

              // Verify sync result structure
              expect(exerciseSyncResult).toBeDefined();
              expect(exerciseSyncResult.success).toBeDefined();
              expect(exerciseSyncResult.newRecords).toBeDefined();
              expect(exerciseSyncResult.conflicts).toBeDefined();
              expect(exerciseSyncResult.lastSyncTimestamp).toBeDefined();

              if (exerciseSyncResult.success) {
                // Verify all synced records have proper metadata
                for (const record of exerciseSyncResult.newRecords) {
                  expect(record.source).toBe(DataSource.SYNCED);
                  expect(record.platform).toBe(platform);
                  expect(record.metadata).toBeDefined();
                  expect(record.metadata.originalId).toBeDefined();
                  expect(record.metadata.syncedAt).toBeDefined();
                  expect(record.createdAt).toBeDefined();
                  expect(record.updatedAt).toBeDefined();

                  // Verify record can be retrieved from storage
                  const retrievedRecord = await storageManager.getRecordById(
                    record.id
                  );
                  expect(retrievedRecord).toBeDefined();
                  if (retrievedRecord) {
                    expect(retrievedRecord.platform).toBe(platform);
                    expect(retrievedRecord.source).toBe(DataSource.SYNCED);
                  }
                }
              }

              // Test step data sync
              const stepSyncResult = await adapter.syncStepData();

              // Verify step sync result structure
              expect(stepSyncResult).toBeDefined();
              expect(stepSyncResult.success).toBeDefined();
              expect(stepSyncResult.newRecords).toBeDefined();

              if (stepSyncResult.success) {
                // Verify step records have proper metadata
                for (const record of stepSyncResult.newRecords) {
                  expect(record.source).toBe(DataSource.SYNCED);
                  expect(record.platform).toBe(platform);
                  expect(record.metadata.dataType).toBe("steps");
                  expect(record.metadata.steps).toBeDefined();
                  expect(typeof record.metadata.steps).toBe("number");
                }
              }
            }
          }
        }
      ),
      { numRuns: 50 } // Fewer runs for integration tests
    );
  });

  test("Property 3 Extension: Sync operations should be idempotent", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          syncCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ platform, syncCount }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          // Request permissions first
          await adapter.requestPermissions();

          const syncResults: SyncResult[] = [];

          // Perform multiple sync operations
          for (let i = 0; i < syncCount; i++) {
            const result = await adapter.syncExerciseData();
            syncResults.push(result);
          }

          // Verify that subsequent syncs don't create duplicate records
          if (syncResults.length > 1) {
            const firstSyncResult = syncResults[0];
            if (firstSyncResult) {
              const firstSyncRecordCount = firstSyncResult.newRecords.length;

              // After first sync, subsequent syncs should find fewer or no new records
              // (assuming the same data is being synced)
              for (let i = 1; i < syncResults.length; i++) {
                const currentSyncResult = syncResults[i];
                if (currentSyncResult) {
                  const subsequentSyncRecordCount =
                    currentSyncResult.newRecords.length;

                  // Subsequent syncs should not create more records than the first sync
                  // (they might create fewer due to duplicate detection)
                  expect(subsequentSyncRecordCount).toBeLessThanOrEqual(
                    firstSyncRecordCount
                  );
                }
              }
            }
          }

          // Verify no duplicate records exist in storage
          const allRecords = await storageManager.getExerciseHistory({
            start: new Date("2020-01-01"),
            end: new Date("2030-01-01"),
          });

          const syncedRecords = allRecords.filter(
            (r) => r.source === DataSource.SYNCED && r.platform === platform
          );

          // Check for duplicates by original ID and start time
          const recordKeys = new Set<string>();

          for (const record of syncedRecords) {
            const key = `${
              record.metadata.originalId
            }_${record.startTime.getTime()}`;
            expect(recordKeys.has(key)).toBe(false); // Should not have duplicates
            recordKeys.add(key);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 3 Data Integrity: Synced data should maintain referential integrity", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
        }),
        async ({ platform }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          // Request permissions and sync data
          await adapter.requestPermissions();
          const syncResult = await adapter.syncExerciseData();

          if (syncResult.success && syncResult.newRecords.length > 0) {
            // Verify each synced record maintains data integrity
            for (const record of syncResult.newRecords) {
              // Basic data integrity checks
              expect(record.id).toBeDefined();
              expect(record.name).toBeDefined();
              expect(record.startTime).toBeInstanceOf(Date);
              expect(record.duration).toBeGreaterThan(0);
              expect(record.source).toBe(DataSource.SYNCED);
              expect(record.platform).toBe(platform);

              // Metadata integrity
              expect(record.metadata).toBeDefined();
              expect(record.metadata.originalId).toBeDefined();
              expect(record.metadata.syncedAt).toBeDefined();

              // Timestamp integrity
              expect(record.createdAt).toBeInstanceOf(Date);
              expect(record.updatedAt).toBeInstanceOf(Date);
              expect(record.createdAt.getTime()).toBeLessThanOrEqual(
                record.updatedAt.getTime()
              );

              // Platform-specific metadata
              if (platform === HealthPlatform.APPLE_HEALTHKIT) {
                expect(record.metadata.dataType).toBeDefined();
              } else if (platform === HealthPlatform.GOOGLE_HEALTH_CONNECT) {
                expect(record.metadata.dataType).toBeDefined();
              }

              // Verify record exists in storage with same integrity
              const storedRecord = await storageManager.getRecordById(
                record.id
              );
              expect(storedRecord).toBeDefined();
              expect(storedRecord!.id).toBe(record.id);
              expect(storedRecord!.source).toBe(record.source);
              expect(storedRecord!.platform).toBe(record.platform);
              expect(storedRecord!.metadata.originalId).toBe(
                record.metadata.originalId
              );
            }
          }
        }
      ),
      { numRuns: 40 }
    );
  });

  test("Property 3 Permission Handling: Permission status should be consistent", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
        }),
        async ({ platform }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          // Request permissions multiple times
          const permissionResults: PermissionStatus[] = [];

          for (let i = 0; i < 3; i++) {
            const result = await adapter.requestPermissions();
            permissionResults.push(result);
          }

          // Verify permission results are consistent
          for (let i = 1; i < permissionResults.length; i++) {
            const current = permissionResults[i];
            const previous = permissionResults[i - 1];

            if (current && previous) {
              // Permission status should be consistent across calls
              expect(current.granted).toBe(previous.granted);

              // Granted permissions should be the same or a superset
              expect(current.permissions.length).toBeGreaterThanOrEqual(
                previous.permissions.length
              );

              // All previously granted permissions should still be granted
              for (const permission of previous.permissions) {
                expect(current.permissions).toContain(permission);
              }
            }
          }

          // Verify adapter initialization status
          const isInitialized = await adapter.isInitialized();
          expect(isInitialized).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});
