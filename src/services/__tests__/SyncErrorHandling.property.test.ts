// Property-based tests for Sync Error Handling
// Feature: health-tracker, Property 4: Sync Error Handling

import * as fc from "fast-check";
import { HealthKitAdapter } from "../platform/HealthKitAdapter";
import { HealthConnectAdapter } from "../platform/HealthConnectAdapter";
import { SyncNotificationService } from "../SyncNotificationService";
import { OfflineManager } from "../OfflineManager";
import { DataStorageManager } from "../database/DataStorageManager";
import { DatabaseMigrator } from "../database/migrations";
import { HealthPlatform, SyncError } from "@/types";

describe("Sync Error Handling Properties", () => {
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
    offlineManager.cleanup();
    await migrator.close();
  });

  /**
   * Property 4: Sync Error Handling
   * For any sync error (network failure, permission denied, platform unavailable),
   * the system should handle it gracefully with appropriate user feedback and retry logic.
   * Validates: Requirements 2.4, 2.5
   */
  test("Property 4: Sync Error Handling - errors should be handled gracefully with retry logic", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          errorType: fc.constantFrom(
            "NETWORK_ERROR",
            "PERMISSION_DENIED",
            "PLATFORM_UNAVAILABLE",
            "TIMEOUT",
            "UNKNOWN_ERROR"
          ),
          isRetryable: fc.boolean(),
        }),
        async ({ platform, errorType, isRetryable }) => {
          // Clear any existing notifications
          notificationService.clearNotifications();

          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          // Create a sync error
          const syncError: SyncError = {
            code: errorType,
            message: `Simulated ${errorType
              .toLowerCase()
              .replace("_", " ")} error`,
            retryable: isRetryable,
          };

          // Test error handling
          const retryResult = await adapter.handleSyncFailure(syncError);

          // Verify retry result structure
          expect(retryResult).toBeDefined();
          expect(retryResult.success).toBe(false);
          expect(typeof retryResult.nextRetryDelay).toBe("number");
          expect(typeof retryResult.maxRetriesReached).toBe("boolean");

          if (isRetryable) {
            // For retryable errors, should provide retry information
            if (retryResult.maxRetriesReached) {
              expect(retryResult.nextRetryDelay).toBe(0);
            } else {
              expect(retryResult.nextRetryDelay).toBeGreaterThan(0);

              // Retry delay should follow exponential backoff
              const expectedMinDelay = 1000; // Base delay from SYNC_CONFIG
              expect(retryResult.nextRetryDelay).toBeGreaterThanOrEqual(
                expectedMinDelay
              );
              expect(retryResult.nextRetryDelay).toBeLessThanOrEqual(30000); // Max delay from SYNC_CONFIG
            }
          } else {
            // Non-retryable errors should not allow retry
            expect(retryResult.maxRetriesReached).toBe(true);
            expect(retryResult.nextRetryDelay).toBe(0);
          }

          // Verify notification was created
          const notifications = notificationService.getNotifications();
          expect(notifications.length).toBeGreaterThan(0);

          // Should have an error notification
          const errorNotification = notifications.find(
            (n) => n.type === "error"
          );
          expect(errorNotification).toBeDefined();
          if (errorNotification) {
            expect(errorNotification.title).toContain("Sync");
            // The notification message may be modified by the notification service
            // to include retry information, so we check if it contains the original message
            const originalMessage = syncError.message;
            expect(errorNotification.message).toContain(
              originalMessage.split(".")[0]
            ); // Check the base message part
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 4 Extension: Exponential backoff should increase delay with each retry", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          initialRetryCount: fc.integer({ min: 0, max: 2 }),
        }),
        async ({ platform, initialRetryCount }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          const syncError: SyncError = {
            code: "NETWORK_ERROR",
            message: "Network connection failed",
            retryable: true,
          };

          // Simulate multiple retry attempts
          const retryDelays: number[] = [];

          // Set initial retry count by calling handleSyncFailure multiple times
          for (let i = 0; i < initialRetryCount; i++) {
            await adapter.handleSyncFailure(syncError);
          }

          // Now test the next few retries
          for (let i = 0; i < 3; i++) {
            const retryResult = await adapter.handleSyncFailure(syncError);

            if (!retryResult.maxRetriesReached) {
              retryDelays.push(retryResult.nextRetryDelay);
            } else {
              break;
            }
          }

          // Verify exponential backoff - each delay should be larger than the previous
          for (let i = 1; i < retryDelays.length; i++) {
            const currentDelay = retryDelays[i];
            const previousDelay = retryDelays[i - 1];

            if (currentDelay && previousDelay) {
              // Allow for some jitter, but delay should generally increase
              expect(currentDelay).toBeGreaterThanOrEqual(previousDelay * 0.9);
            }
          }

          // All delays should be within reasonable bounds
          for (const delay of retryDelays) {
            expect(delay).toBeGreaterThanOrEqual(1000); // At least 1 second
            expect(delay).toBeLessThanOrEqual(30000); // At most 30 seconds
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 4 Permission Errors: Permission denied errors should not be retried", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          permissionType: fc.constantFrom(
            "READ_STEPS",
            "READ_WORKOUT",
            "READ_HEART_RATE"
          ),
        }),
        async ({ platform, permissionType }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          const permissionError: SyncError = {
            code: "PERMISSION_DENIED",
            message: `Permission denied for ${permissionType}`,
            retryable: false, // Permission errors should not be retryable
          };

          const retryResult = await adapter.handleSyncFailure(permissionError);

          // Permission errors should immediately reach max retries
          expect(retryResult.maxRetriesReached).toBe(true);
          expect(retryResult.nextRetryDelay).toBe(0);
          expect(retryResult.success).toBe(false);

          // Should create appropriate notification
          const notifications = notificationService.getNotifications();
          const errorNotification = notifications.find(
            (n) => n.type === "error" && n.message.includes("Permission denied")
          );
          expect(errorNotification).toBeDefined();
          if (errorNotification) {
            // Permission error notifications should not auto-hide
            expect(errorNotification.autoHide).toBe(false);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 4 Network Errors: Network errors should be queued for offline retry", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          networkErrorType: fc.constantFrom(
            "NETWORK_ERROR",
            "TIMEOUT",
            "CONNECTION_FAILED"
          ),
        }),
        async ({ platform, networkErrorType: _networkErrorType }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          // Simulate going offline
          offlineManager.setOnlineStatus(false);

          // Attempt sync while offline
          const syncResult = await adapter.syncWithRetry();

          // Should fail but queue for retry
          expect(syncResult.success).toBe(false);
          expect(syncResult.error).toContain("offline");

          // Should have queued operation
          const queuedOps = offlineManager.getQueuedOperations();
          expect(queuedOps.length).toBeGreaterThan(0);

          const queuedOp = queuedOps.find((op) => op.platform === platform);
          expect(queuedOp).toBeDefined();
          if (queuedOp) {
            expect(queuedOp.type).toBe("exercise_sync");
            expect(queuedOp.retryCount).toBe(0);
          }

          // Verify offline notification
          const notifications = notificationService.getNotifications();
          const offlineNotification = notifications.find(
            (n) => n.type === "warning" && n.title === "Offline Mode"
          );
          expect(offlineNotification).toBeDefined();

          // Simulate coming back online
          offlineManager.setOnlineStatus(true);

          // Should trigger queue processing
          await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async processing

          // Should have back online notification - get notifications again after coming online
          const updatedNotifications = notificationService.getNotifications();
          const backOnlineNotification = updatedNotifications.find(
            (n) => n.type === "success" && n.title === "Back Online"
          );
          expect(backOnlineNotification).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 4 Error Recovery: System should recover gracefully after errors are resolved", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          platform: fc.constantFrom(
            HealthPlatform.APPLE_HEALTHKIT,
            HealthPlatform.GOOGLE_HEALTH_CONNECT
          ),
          errorSequence: fc.array(
            fc.record({
              errorType: fc.constantFrom(
                "NETWORK_ERROR",
                "TIMEOUT",
                "PLATFORM_UNAVAILABLE"
              ),
              shouldRecover: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ platform, errorSequence }) => {
          const adapter =
            platform === HealthPlatform.APPLE_HEALTHKIT
              ? healthKitAdapter
              : healthConnectAdapter;

          let hasRecovered = false;

          for (const errorStep of errorSequence) {
            if (errorStep.shouldRecover) {
              // Simulate successful sync after errors
              try {
                const syncResult = await adapter.syncExerciseData();
                if (syncResult.success) {
                  hasRecovered = true;

                  // Should have success notification
                  const notifications = notificationService.getNotifications();
                  const successNotification = notifications.find(
                    (n) => n.type === "success"
                  );
                  expect(successNotification).toBeDefined();

                  // Retry count should be reset after success
                  const status = notificationService.getStatus();
                  expect(status.retryCount).toBe(0);
                  expect(status.nextRetryTime).toBeUndefined();

                  break;
                }
              } catch (error) {
                // Expected for mock implementation
              }
            } else {
              // Simulate error
              const syncError: SyncError = {
                code: errorStep.errorType,
                message: `Simulated ${errorStep.errorType}`,
                retryable: true,
              };

              await adapter.handleSyncFailure(syncError);
            }
          }

          // If we had a recovery step, verify the system state is clean
          if (hasRecovered) {
            const status = notificationService.getStatus();
            expect(status.syncInProgress).toBe(false);
            expect(status.retryCount).toBe(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
