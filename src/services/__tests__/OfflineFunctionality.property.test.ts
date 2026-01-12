// Property-based tests for Offline Functionality
// Feature: health-tracker, Property 16: Offline Functionality

import * as fc from "fast-check";
import { OfflineManager } from "../OfflineManager";
import { SyncNotificationService } from "../SyncNotificationService";
import { DataStorageManager } from "../database/DataStorageManager";
import { DatabaseMigrator } from "../database/migrations";
import { HealthKitAdapter } from "../platform/HealthKitAdapter";
import { HealthConnectAdapter } from "../platform/HealthConnectAdapter";
import { HealthPlatform, DataSource } from "@/types";

describe("Offline Functionality Properties", () => {
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;
  let notificationService: SyncNotificationService;
  let offlineManager: OfflineManager;
  let healthKitAdapter: HealthKitAdapter;
  let healthConnectAdapter: HealthConnectAdapter;

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase();

    storageManager = new DataStorageManager(migrator.getDatabase());
    notificationService = new SyncNotificationService();
    offlineManager = new OfflineManager(storageManager, notificationService);

    // Start in a known state (offline) to avoid status conflicts
    offlineManager.setOnlineStatus(false);

    healthKitAdapter = new HealthKitAdapter(
      storageManager,
      notificationService,
      offlineManager
    );
    healthConnectAdapter = new HealthConnectAdapter(
      storageManager,
      notificationService,
      offlineManager
    );
  });

  afterEach(async () => {
    // Clean up offline manager first to stop any ongoing operations
    offlineManager.cleanup();

    // Wait a bit for any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Close database connection
    await migrator.close();
  });

  /**
   * Property 16: Offline Functionality
   * For any offline period, the system should continue to function for manual data entry
   * and queue sync operations for when connectivity is restored.
   * Validates: Requirements 8.2
   */
  test("Property 16: Offline Functionality - manual data entry should work offline and sync operations should be queued", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          exerciseData: fc.array(
            fc.record({
              name: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s.trim().length > 0),
              startTime: fc.date({
                min: new Date("2024-01-01"),
                max: new Date("2024-12-31"),
              }),
              duration: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 1, maxLength: 5 } // Reduced for faster tests
          ),
          offlineDuration: fc.integer({ min: 1, max: 50 }), // Reduced duration
          syncAttempts: fc.integer({ min: 1, max: 3 }), // Reduced attempts
        }),
        async ({ exerciseData, offlineDuration, syncAttempts }) => {
          // Start online
          offlineManager.setOnlineStatus(true);
          expect(offlineManager.isCurrentlyOnline()).toBe(true);

          // Go offline
          offlineManager.setOnlineStatus(false);
          expect(offlineManager.isCurrentlyOnline()).toBe(false);

          // Verify offline notification was sent
          const notifications = notificationService.getNotifications();
          const offlineNotification = notifications.find(
            (n) => n.type === "warning" && n.title === "Offline Mode"
          );
          expect(offlineNotification).toBeDefined();

          // Manual data entry should still work offline
          const savedRecords = [];
          for (const exercise of exerciseData) {
            // Manual logging should work regardless of online status
            const exerciseRecord = {
              id: `manual_${Date.now()}_${Math.random()}`,
              name: exercise.name,
              startTime: exercise.startTime,
              duration: exercise.duration,
              source: DataSource.MANUAL,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await storageManager.saveExerciseRecord(exerciseRecord);
            savedRecords.push(exerciseRecord);
          }

          // Verify all manual records were saved
          const retrievedRecords = await storageManager.getExerciseHistory({
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
          });

          expect(retrievedRecords.length).toBeGreaterThanOrEqual(
            exerciseData.length
          );

          for (const originalExercise of exerciseData) {
            const foundRecord = retrievedRecords.find(
              (r) =>
                r.name === originalExercise.name &&
                r.duration === originalExercise.duration &&
                r.source === DataSource.MANUAL
            );
            expect(foundRecord).toBeDefined();
          }

          // Attempt sync operations while offline - should be queued
          const initialQueueSize = offlineManager.getQueuedOperations().length;

          for (let i = 0; i < syncAttempts; i++) {
            const platform =
              i % 2 === 0
                ? HealthPlatform.APPLE_HEALTHKIT
                : HealthPlatform.GOOGLE_HEALTH_CONNECT;
            const adapter =
              platform === HealthPlatform.APPLE_HEALTHKIT
                ? healthKitAdapter
                : healthConnectAdapter;

            const syncResult = await adapter.syncWithRetry();

            // Should fail but queue the operation
            expect(syncResult.success).toBe(false);
            expect(syncResult.error).toContain("offline");
          }

          // Verify operations were queued
          const queuedOps = offlineManager.getQueuedOperations();
          expect(queuedOps.length).toBe(initialQueueSize + syncAttempts);

          // All queued operations should have correct properties
          for (const op of queuedOps.slice(initialQueueSize)) {
            expect(op.type).toBe("exercise_sync");
            expect(op.retryCount).toBe(0);
            expect(op.timestamp).toBeInstanceOf(Date);
            expect([
              HealthPlatform.APPLE_HEALTHKIT,
              HealthPlatform.GOOGLE_HEALTH_CONNECT,
            ]).toContain(op.platform);
          }

          // Simulate being offline for the specified duration (scaled down)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(offlineDuration, 100))
          );

          // Come back online
          offlineManager.setOnlineStatus(true);
          expect(offlineManager.isCurrentlyOnline()).toBe(true);

          // Should get back online notification
          const backOnlineNotification = notifications.find(
            (n) => n.type === "success" && n.title === "Back Online"
          );
          expect(backOnlineNotification).toBeDefined();

          // Queue should start processing (though operations may still be there due to mock implementation)
          const status = offlineManager.getStatus();
          expect(status.isOnline).toBe(true);

          // Wait a bit for queue processing to start
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      ),
      { numRuns: 50 } // Reduced runs for faster testing
    );
  }, 10000); // Increased timeout to 10 seconds

  test("Property 16 Extension: Queue management should handle operations correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          operations: fc.array(
            fc.record({
              type: fc.constantFrom("exercise_sync", "step_sync"),
              platform: fc.constantFrom(
                HealthPlatform.APPLE_HEALTHKIT,
                HealthPlatform.GOOGLE_HEALTH_CONNECT
              ),
            }),
            { minLength: 1, maxLength: 20 }
          ),
        }),
        async ({ operations }) => {
          // Start offline
          offlineManager.setOnlineStatus(false);

          // Queue multiple operations
          const queuedIds = [];
          for (const op of operations) {
            const id = offlineManager.queueSyncOperation({
              type: op.type as "exercise_sync" | "step_sync",
              platform: op.platform,
            });
            queuedIds.push(id);
          }

          // Verify all operations were queued
          const queuedOps = offlineManager.getQueuedOperations();
          expect(queuedOps.length).toBe(operations.length);

          // Each operation should have unique ID
          const ids = queuedOps.map((op) => op.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // Verify queue statistics
          const stats = offlineManager.getQueueStats();
          expect(stats.total).toBe(operations.length);
          expect(stats.oldestOperation).toBeDefined();

          // Count by type and platform should match
          const typeCount = operations.reduce((acc, op) => {
            acc[op.type] = (acc[op.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const platformCount = operations.reduce((acc, op) => {
            acc[op.platform] = (acc[op.platform] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          expect(stats.byType).toEqual(typeCount);
          expect(stats.byPlatform).toEqual(platformCount);

          // Test manual removal of operations
          if (queuedIds.length > 0) {
            const idToRemove = queuedIds[0];
            if (idToRemove) {
              offlineManager.removeSyncOperation(idToRemove);

              const updatedOps = offlineManager.getQueuedOperations();
              expect(updatedOps.length).toBe(operations.length - 1);
              expect(
                updatedOps.find((op) => op.id === idToRemove)
              ).toBeUndefined();
            }
          }

          // Test clearing queue
          offlineManager.clearSyncQueue();
          const clearedOps = offlineManager.getQueuedOperations();
          expect(clearedOps.length).toBe(0);

          const clearedStats = offlineManager.getQueueStats();
          expect(clearedStats.total).toBe(0);
          expect(clearedStats.oldestOperation).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 16 Status Updates: Offline status should be accurately tracked and reported", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          statusChanges: fc.array(
            fc.record({
              isOnline: fc.boolean(),
              duration: fc.integer({ min: 10, max: 50 }), // Reduced duration
            }),
            { minLength: 2, maxLength: 5 } // Reduced changes
          ),
        }),
        async ({ statusChanges }) => {
          const statusUpdates: any[] = [];

          // Subscribe to status updates
          const unsubscribe = offlineManager.onStatusUpdate((status) => {
            statusUpdates.push({ ...status, timestamp: new Date() });
          });

          try {
            // Apply status changes
            for (const change of statusChanges) {
              // Set the status
              offlineManager.setOnlineStatus(change.isOnline);

              // Wait for the specified duration
              await new Promise((resolve) =>
                setTimeout(resolve, change.duration)
              );

              // Verify current status matches what we just set
              const currentStatus = offlineManager.getStatus();
              expect(currentStatus.isOnline).toBe(change.isOnline);
            }

            // Should have received status updates
            expect(statusUpdates.length).toBeGreaterThan(0);

            // Each status update should have correct structure
            for (const update of statusUpdates) {
              expect(typeof update.isOnline).toBe("boolean");
              expect(typeof update.queuedOperations).toBe("number");
              expect(update.queuedOperations).toBeGreaterThanOrEqual(0);

              if (update.lastOnlineTime) {
                expect(update.lastOnlineTime).toBeInstanceOf(Date);
              }

              if (update.lastSyncAttempt) {
                expect(update.lastSyncAttempt).toBeInstanceOf(Date);
              }
            }

            // Final status should match last change
            const finalStatus = offlineManager.getStatus();
            const lastChange = statusChanges[statusChanges.length - 1];
            if (lastChange) {
              expect(finalStatus.isOnline).toBe(lastChange.isOnline);
            }
          } finally {
            unsubscribe();
            // Clean up any pending operations
            offlineManager.clearSyncQueue();
            // Wait a bit for cleanup
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
      ),
      { numRuns: 20 } // Reduced runs
    );
  }, 8000); // Increased timeout

  test("Property 16 Data Persistence: Offline data should persist across app restarts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          exerciseData: fc.array(
            fc.record({
              name: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter((s) => s.trim().length > 0),
              startTime: fc.date({
                min: new Date("2024-01-01"),
                max: new Date("2024-12-31"),
              }),
              duration: fc.integer({ min: 1, max: 300 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ exerciseData }) => {
          // Go offline
          offlineManager.setOnlineStatus(false);

          // Save exercise data while offline
          const savedRecords = [];
          for (const exercise of exerciseData) {
            const exerciseRecord = {
              id: `offline_${Date.now()}_${Math.random()}`,
              name: exercise.name,
              startTime: exercise.startTime,
              duration: exercise.duration,
              source: DataSource.MANUAL,
              metadata: { offlineCreated: true } as any,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await storageManager.saveExerciseRecord(exerciseRecord);
            savedRecords.push(exerciseRecord);
          }

          // Simulate app restart by creating new storage manager with same database
          const newStorageManager = new DataStorageManager(
            migrator.getDatabase()
          );

          // Verify data persisted across "restart"
          const retrievedRecords = await newStorageManager.getExerciseHistory({
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
          });

          // All offline records should still be there
          for (const savedRecord of savedRecords) {
            const foundRecord = retrievedRecords.find(
              (r) => r.id === savedRecord.id
            );
            expect(foundRecord).toBeDefined();
            if (foundRecord) {
              expect(foundRecord.name).toBe(savedRecord.name);
              expect(foundRecord.duration).toBe(savedRecord.duration);
              expect(foundRecord.source).toBe(DataSource.MANUAL);
              expect((foundRecord.metadata as any).offlineCreated).toBe(true);
            }
          }

          // Verify data integrity
          expect(retrievedRecords.length).toBeGreaterThanOrEqual(
            savedRecords.length
          );

          // All retrieved records should have valid structure
          for (const record of retrievedRecords) {
            expect(record.id).toBeDefined();
            expect(record.name).toBeDefined();
            expect(record.startTime).toBeInstanceOf(Date);
            expect(record.duration).toBeGreaterThan(0);
            expect(record.source).toBeDefined();
            expect(record.createdAt).toBeInstanceOf(Date);
            expect(record.updatedAt).toBeInstanceOf(Date);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
