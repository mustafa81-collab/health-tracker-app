// Property-based tests for local storage persistence
// Feature: health-tracker, Property 15: Local Storage Persistence

import * as fc from "fast-check";
import { DataStorageManager } from "../DataStorageManager";
import { DatabaseMigrator } from "../migrations";
import {
  Exercise_Record,
  DataSource,
  HealthPlatform,
  ExerciseMetadata,
} from "@/types";

describe("Local Storage Persistence Properties", () => {
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase(); // Clean slate for each test

    storageManager = new DataStorageManager(migrator.getDatabase());
  });

  afterEach(async () => {
    await migrator.close();
  });

  /**
   * Property 15: Local Storage Persistence
   * For any valid exercise data (entered or synced), the system should store it locally
   * and make it available for offline access and immediate loading on app startup.
   * Validates: Requirements 8.1, 8.4
   */
  test("Property 15: Local Storage Persistence - any valid exercise data should persist and be retrievable", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary valid exercise records
        fc
          .record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            startTime: fc.date({
              min: new Date("2020-01-01"),
              max: new Date("2030-01-01"),
            }),
            duration: fc.integer({ min: 1, max: 1440 }), // 1 minute to 24 hours
            source: fc.constantFrom(DataSource.MANUAL, DataSource.SYNCED),
            platform: fc.option(
              fc.constantFrom(
                HealthPlatform.APPLE_HEALTHKIT,
                HealthPlatform.GOOGLE_HEALTH_CONNECT
              ),
              { nil: undefined }
            ),
            metadata: fc.record(
              {
                calories: fc.option(fc.integer({ min: 0, max: 5000 }), {
                  nil: undefined,
                }),
                heartRate: fc.option(fc.integer({ min: 40, max: 220 }), {
                  nil: undefined,
                }),
                deviceId: fc.option(fc.string({ maxLength: 50 }), {
                  nil: undefined,
                }),
                appSource: fc.option(fc.string({ maxLength: 50 }), {
                  nil: undefined,
                }),
              },
              { requiredKeys: [] }
            ),
            createdAt: fc.date({
              min: new Date("2020-01-01"),
              max: new Date("2030-01-01"),
            }),
            updatedAt: fc.date({
              min: new Date("2020-01-01"),
              max: new Date("2030-01-01"),
            }),
          })
          .map((record) => ({
            ...record,
            metadata: Object.fromEntries(
              Object.entries(record.metadata).filter(
                ([_, value]) => value !== undefined
              )
            ) as ExerciseMetadata,
          })),
        async (exerciseRecord: Exercise_Record) => {
          // Save the exercise record
          await storageManager.saveExerciseRecord(exerciseRecord);

          // Retrieve it back
          const dateRange = {
            start: new Date(
              exerciseRecord.startTime.getTime() - 24 * 60 * 60 * 1000
            ), // 1 day before
            end: new Date(
              exerciseRecord.startTime.getTime() + 24 * 60 * 60 * 1000
            ), // 1 day after
          };

          const retrievedRecords = await storageManager.getExerciseHistory(
            dateRange
          );

          // Find our record in the results
          const retrievedRecord = retrievedRecords.find(
            (r) => r.id === exerciseRecord.id
          );

          // Assertions
          expect(retrievedRecord).toBeDefined();
          expect(retrievedRecord!.id).toBe(exerciseRecord.id);
          expect(retrievedRecord!.name).toBe(exerciseRecord.name);
          expect(retrievedRecord!.duration).toBe(exerciseRecord.duration);
          expect(retrievedRecord!.source).toBe(exerciseRecord.source);
          expect(new Date(retrievedRecord!.startTime)).toEqual(
            exerciseRecord.startTime
          );

          // Metadata should be preserved
          if (exerciseRecord.metadata.calories) {
            expect(retrievedRecord!.metadata.calories).toBe(
              exerciseRecord.metadata.calories
            );
          }
          if (exerciseRecord.metadata.heartRate) {
            expect(retrievedRecord!.metadata.heartRate).toBe(
              exerciseRecord.metadata.heartRate
            );
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  test("Property 15 Extension: Multiple records persistence - batch storage and retrieval should maintain data integrity", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of exercise records
        fc
          .array(
            fc
              .record({
                id: fc.string({ minLength: 1, maxLength: 50 }),
                name: fc.string({ minLength: 1, maxLength: 100 }),
                startTime: fc.date({
                  min: new Date("2024-01-01"),
                  max: new Date("2024-12-31"),
                }),
                duration: fc.integer({ min: 1, max: 1440 }),
                source: fc.constantFrom(DataSource.MANUAL, DataSource.SYNCED),
                platform: fc.option(
                  fc.constantFrom(
                    HealthPlatform.APPLE_HEALTHKIT,
                    HealthPlatform.GOOGLE_HEALTH_CONNECT
                  ),
                  { nil: undefined }
                ),
                metadata: fc.record(
                  {
                    calories: fc.option(fc.integer({ min: 0, max: 5000 }), {
                      nil: undefined,
                    }),
                    heartRate: fc.option(fc.integer({ min: 40, max: 220 }), {
                      nil: undefined,
                    }),
                  },
                  { requiredKeys: [] }
                ),
                createdAt: fc.date({
                  min: new Date("2024-01-01"),
                  max: new Date("2024-12-31"),
                }),
                updatedAt: fc.date({
                  min: new Date("2024-01-01"),
                  max: new Date("2024-12-31"),
                }),
              })
              .map((record) => ({
                ...record,
                metadata: Object.fromEntries(
                  Object.entries(record.metadata).filter(
                    ([_, value]) => value !== undefined
                  )
                ) as ExerciseMetadata,
              })),
            { minLength: 1, maxLength: 20 }
          )
          .map((records) => {
            // Ensure unique IDs
            return records.map((record, index) => ({
              ...record,
              id: `${record.id}-${index}`,
            }));
          }),
        async (exerciseRecords: Exercise_Record[]) => {
          // Save all records
          for (const record of exerciseRecords) {
            await storageManager.saveExerciseRecord(record);
          }

          // Retrieve all records for the year 2024
          const dateRange = {
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
          };

          const retrievedRecords = await storageManager.getExerciseHistory(
            dateRange
          );

          // All saved records should be retrievable
          expect(retrievedRecords.length).toBeGreaterThanOrEqual(
            exerciseRecords.length
          );

          // Each saved record should be found in retrieved records
          for (const originalRecord of exerciseRecords) {
            const retrievedRecord = retrievedRecords.find(
              (r) => r.id === originalRecord.id
            );
            expect(retrievedRecord).toBeDefined();
            expect(retrievedRecord!.name).toBe(originalRecord.name);
            expect(retrievedRecord!.duration).toBe(originalRecord.duration);
            expect(retrievedRecord!.source).toBe(originalRecord.source);
          }
        }
      ),
      { numRuns: 50 } // Fewer runs for batch operations
    );
  });
});
