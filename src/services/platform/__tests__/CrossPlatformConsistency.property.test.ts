// Property-based tests for Cross-Platform Data Consistency
// Feature: health-tracker, Property 5: Cross-Platform Data Consistency

import * as fc from "fast-check";
import { HealthKitAdapter } from "../HealthKitAdapter";
import { HealthConnectAdapter } from "../HealthConnectAdapter";
import { DataStorageManager } from "../../database/DataStorageManager";
import { DatabaseMigrator } from "../../database/migrations";
import {
  HealthPlatform,
  DataSource,
  Exercise_Record,
  HKWorkout,
  ExerciseSession,
} from "@/types";

describe("Cross-Platform Data Consistency Properties", () => {
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
   * Property 5: Cross-Platform Data Consistency
   * For any synced data from different health platforms, the system should format
   * and display the data consistently regardless of the source platform.
   * Validates: Requirements 3.4
   */
  test("Property 5: Cross-Platform Data Consistency - equivalent exercises should have consistent format", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate equivalent exercise data for both platforms
        fc.record({
          exerciseName: fc.constantFrom(
            "Running",
            "Walking",
            "Cycling",
            "Swimming",
            "Yoga"
          ),
          startTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
          duration: fc.integer({ min: 10, max: 180 }), // 10 minutes to 3 hours
          calories: fc.option(fc.integer({ min: 50, max: 1000 }), {
            nil: undefined,
          }),
          heartRate: fc.option(fc.integer({ min: 60, max: 200 }), {
            nil: undefined,
          }),
        }),
        async ({
          exerciseName,
          startTime,
          duration,
          calories,
          heartRate: _heartRate,
        }) => {
          // Create equivalent workout data for both platforms
          const hkWorkout: HKWorkout = {
            uuid: `hk_${Date.now()}_${Math.random()}`,
            workoutActivityType: exerciseName, // Use the exact exercise name from the test
            startDate: startTime.toISOString(),
            endDate: new Date(
              startTime.getTime() + duration * 60 * 1000
            ).toISOString(),
            duration: duration * 60, // HealthKit uses seconds
            ...(calories !== undefined && { totalEnergyBurned: calories }),
            sourceName: "HealthKit",
          };

          const hcSession: ExerciseSession = {
            id: `hc_${Date.now()}_${Math.random()}`,
            exerciseType: exerciseName, // Use the exact exercise name from the test
            startTime: startTime.toISOString(),
            endTime: new Date(
              startTime.getTime() + duration * 60 * 1000
            ).toISOString(),
            title: exerciseName,
            notes: "Test exercise session",
          };

          // Convert platform-specific data to Exercise_Record
          const hkRecord =
            healthKitAdapter.convertHKWorkoutToExerciseRecord(hkWorkout);
          const hcRecord =
            healthConnectAdapter.convertSessionToExerciseRecord(hcSession);

          // Verify consistent formatting across platforms

          // 1. Exercise names should be consistently formatted
          expect(hkRecord.name).toBe(hcRecord.name);

          // 2. Duration should be in consistent units (minutes)
          expect(hkRecord.duration).toBe(duration);
          expect(hcRecord.duration).toBe(duration);
          expect(hkRecord.duration).toBe(hcRecord.duration);

          // 3. Start times should be equivalent
          expect(hkRecord.startTime.getTime()).toBe(startTime.getTime());
          expect(hcRecord.startTime.getTime()).toBe(startTime.getTime());
          expect(hkRecord.startTime.getTime()).toBe(
            hcRecord.startTime.getTime()
          );

          // 4. Source should be consistently marked as synced
          expect(hkRecord.source).toBe(DataSource.SYNCED);
          expect(hcRecord.source).toBe(DataSource.SYNCED);

          // 5. Platform attribution should be correct
          expect(hkRecord.platform).toBe(HealthPlatform.APPLE_HEALTHKIT);
          expect(hcRecord.platform).toBe(HealthPlatform.GOOGLE_HEALTH_CONNECT);

          // 6. Metadata structure should be consistent
          expect(hkRecord.metadata).toBeDefined();
          expect(hcRecord.metadata).toBeDefined();
          expect(hkRecord.metadata.originalId).toBeDefined();
          expect(hcRecord.metadata.originalId).toBeDefined();
          expect(hkRecord.metadata.dataType).toBeDefined();
          expect(hcRecord.metadata.dataType).toBeDefined();

          // 7. Timestamps should be properly set
          expect(hkRecord.createdAt).toBeInstanceOf(Date);
          expect(hcRecord.createdAt).toBeInstanceOf(Date);
          expect(hkRecord.updatedAt).toBeInstanceOf(Date);
          expect(hcRecord.updatedAt).toBeInstanceOf(Date);

          // 8. IDs should follow consistent patterns
          expect(hkRecord.id).toMatch(/^hk_/);
          expect(hcRecord.id).toMatch(/^hc_/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 5 Extension: Step data should be consistently formatted across platforms", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stepCount: fc.integer({ min: 1000, max: 30000 }),
          date: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
        }),
        async ({ stepCount: _stepCount, date: _date }) => {
          // Test step data sync for both platforms
          const hkStepSyncResult = await healthKitAdapter.syncStepData();
          const hcStepSyncResult = await healthConnectAdapter.syncStepData();

          // Both platforms should return valid sync results
          expect(hkStepSyncResult).toBeDefined();
          expect(hcStepSyncResult).toBeDefined();

          // If both have step records, verify consistent formatting
          if (
            hkStepSyncResult.newRecords.length > 0 &&
            hcStepSyncResult.newRecords.length > 0
          ) {
            const hkStepRecord = hkStepSyncResult.newRecords.find(
              (r) => r.metadata.dataType === "steps"
            );
            const hcStepRecord = hcStepSyncResult.newRecords.find(
              (r) => r.metadata.dataType === "steps"
            );

            if (hkStepRecord && hcStepRecord) {
              // Both should have consistent naming
              expect(hkStepRecord.name).toBe(hcStepRecord.name);

              // Both should be marked as synced
              expect(hkStepRecord.source).toBe(DataSource.SYNCED);
              expect(hcStepRecord.source).toBe(DataSource.SYNCED);

              // Platform attribution should be correct
              expect(hkStepRecord.platform).toBe(
                HealthPlatform.APPLE_HEALTHKIT
              );
              expect(hcStepRecord.platform).toBe(
                HealthPlatform.GOOGLE_HEALTH_CONNECT
              );

              // Data type should be consistently marked
              expect(hkStepRecord.metadata.dataType).toBe("steps");
              expect(hcStepRecord.metadata.dataType).toBe("steps");

              // Step count should be a number if present
              if (hkStepRecord.metadata.steps) {
                expect(typeof hkStepRecord.metadata.steps).toBe("number");
              }
              if (hcStepRecord.metadata.steps) {
                expect(typeof hcStepRecord.metadata.steps).toBe("number");
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 5 Display Consistency: Records from different platforms should display uniformly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            platform: fc.constantFrom(
              HealthPlatform.APPLE_HEALTHKIT,
              HealthPlatform.GOOGLE_HEALTH_CONNECT
            ),
            exerciseName: fc.constantFrom("Running", "Walking", "Cycling"),
            startTime: fc.date({
              min: new Date("2024-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 10, max: 120 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (exerciseData) => {
          const records: Exercise_Record[] = [];

          // Create records from different platforms using the conversion methods directly
          for (const data of exerciseData) {
            if (data.platform === HealthPlatform.APPLE_HEALTHKIT) {
              // Create mock HealthKit workout and convert it
              const mockHKWorkout: HKWorkout = {
                uuid: `hk_${Date.now()}_${Math.random()}`,
                workoutActivityType: data.exerciseName,
                startDate: data.startTime.toISOString(),
                endDate: new Date(
                  data.startTime.getTime() + data.duration * 60 * 1000
                ).toISOString(),
                duration: data.duration * 60,
                sourceName: "HealthKit",
              };

              const record =
                healthKitAdapter.convertHKWorkoutToExerciseRecord(
                  mockHKWorkout
                );
              records.push(record);
              await storageManager.saveExerciseRecord(record);
            } else {
              // Create mock Health Connect session and convert it
              const mockHCSession: ExerciseSession = {
                id: `hc_${Date.now()}_${Math.random()}`,
                exerciseType: data.exerciseName,
                startTime: data.startTime.toISOString(),
                endTime: new Date(
                  data.startTime.getTime() + data.duration * 60 * 1000
                ).toISOString(),
                title: data.exerciseName,
              };

              const record =
                healthConnectAdapter.convertSessionToExerciseRecord(
                  mockHCSession
                );
              records.push(record);
              await storageManager.saveExerciseRecord(record);
            }
          }

          // Retrieve all records
          const retrievedRecords = await storageManager.getExerciseHistory({
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
          });

          const syncedRecords = retrievedRecords.filter(
            (r) => r.source === DataSource.SYNCED
          );

          // Verify display consistency across platforms
          for (const record of syncedRecords) {
            // All records should have consistent required fields
            expect(record.id).toBeDefined();
            expect(record.name).toBeDefined();
            expect(record.startTime).toBeInstanceOf(Date);
            expect(record.duration).toBeGreaterThan(0);
            expect(record.source).toBe(DataSource.SYNCED);
            expect(record.platform).toBeDefined();
            expect([
              HealthPlatform.APPLE_HEALTHKIT,
              HealthPlatform.GOOGLE_HEALTH_CONNECT,
            ]).toContain(record.platform!);

            // Metadata should be consistently structured
            expect(record.metadata).toBeDefined();
            expect(record.metadata.originalId).toBeDefined();
            expect(record.metadata.dataType).toBeDefined();

            // Timestamps should be valid
            expect(record.createdAt).toBeInstanceOf(Date);
            expect(record.updatedAt).toBeInstanceOf(Date);
          }

          // Group by platform and verify consistent formatting within each platform
          const hkRecords = syncedRecords.filter(
            (r) => r.platform === HealthPlatform.APPLE_HEALTHKIT
          );
          const hcRecords = syncedRecords.filter(
            (r) => r.platform === HealthPlatform.GOOGLE_HEALTH_CONNECT
          );

          // Within each platform, formatting should be consistent
          if (hkRecords.length > 1) {
            for (let i = 1; i < hkRecords.length; i++) {
              const current = hkRecords[i];
              const first = hkRecords[0];
              if (current && first) {
                expect(typeof current.name).toBe(typeof first.name);
                expect(typeof current.duration).toBe(typeof first.duration);
                expect(current.source).toBe(first.source);
                expect(current.platform).toBe(first.platform);
              }
            }
          }

          if (hcRecords.length > 1) {
            for (let i = 1; i < hcRecords.length; i++) {
              const current = hcRecords[i];
              const first = hcRecords[0];
              if (current && first) {
                expect(typeof current.name).toBe(typeof first.name);
                expect(typeof current.duration).toBe(typeof first.duration);
                expect(current.source).toBe(first.source);
                expect(current.platform).toBe(first.platform);
              }
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 5 Metadata Consistency: Platform-specific metadata should follow consistent patterns", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          exerciseType: fc.constantFrom(
            "RUNNING",
            "WALKING",
            "CYCLING",
            "SWIMMING"
          ),
          startTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
          duration: fc.integer({ min: 5, max: 300 }),
        }),
        async ({ exerciseType, startTime, duration }) => {
          // Create equivalent records from both platforms using public methods
          // We'll test the public conversion methods instead of private ones

          const mockHKWorkout: HKWorkout = {
            uuid: `hk_${exerciseType}_${Date.now()}`,
            workoutActivityType: exerciseType,
            startDate: startTime.toISOString(),
            endDate: new Date(
              startTime.getTime() + duration * 60 * 1000
            ).toISOString(),
            duration: duration * 60,
            sourceName: "HealthKit",
          };

          const mockHCSession: ExerciseSession = {
            id: `hc_${exerciseType}_${Date.now()}`,
            exerciseType: exerciseType,
            startTime: startTime.toISOString(),
            endTime: new Date(
              startTime.getTime() + duration * 60 * 1000
            ).toISOString(),
            title: exerciseType,
          };

          const hkRecord =
            healthKitAdapter.convertHKWorkoutToExerciseRecord(mockHKWorkout);
          const hcRecord =
            healthConnectAdapter.convertSessionToExerciseRecord(mockHCSession);

          // Verify metadata consistency patterns

          // Both should have originalId
          expect(hkRecord.metadata.originalId).toBeDefined();
          expect(hcRecord.metadata.originalId).toBeDefined();

          // Both should have syncedAt timestamp
          expect(hkRecord.metadata.syncedAt).toBeDefined();
          expect(hcRecord.metadata.syncedAt).toBeDefined();
          expect(hkRecord.metadata.syncedAt).toBeInstanceOf(Date);
          expect(hcRecord.metadata.syncedAt).toBeInstanceOf(Date);

          // Platform-specific metadata should be preserved but in consistent structure
          if (hkRecord.metadata.workoutType) {
            expect(typeof hkRecord.metadata.workoutType).toBe("string");
          }

          if (hcRecord.metadata.exerciseType) {
            expect(typeof hcRecord.metadata.exerciseType).toBe("string");
          }

          // Numeric metadata should be numbers
          if (hkRecord.metadata.calories) {
            expect(typeof hkRecord.metadata.calories).toBe("number");
          }

          if (hcRecord.metadata.steps) {
            expect(typeof hcRecord.metadata.steps).toBe("number");
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
