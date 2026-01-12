// Property-based tests for Manual Exercise Persistence
// Feature: health-tracker, Property 1: Manual Exercise Data Persistence

import * as fc from "fast-check";
import { ManualExerciseService } from "../ManualExerciseService";
import { DataStorageManager } from "../database/DataStorageManager";
import { DatabaseMigrator } from "../database/migrations";
import { ExerciseInput, DataSource } from "@/types";

describe("Manual Exercise Persistence Properties", () => {
  let manualExerciseService: ManualExerciseService;
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase();

    storageManager = new DataStorageManager(migrator.getDatabase());
    manualExerciseService = new ManualExerciseService(storageManager);
  });

  afterEach(async () => {
    await migrator.close();
  });

  /**
   * Property 1: Manual Exercise Data Persistence
   * For any valid exercise data (non-empty name, valid time format, positive duration),
   * saving it as a Manual_Log should result in the data being stored locally with a timestamp
   * and retrievable from storage.
   * Validates: Requirements 1.2
   */
  test("Property 1: Manual Exercise Data Persistence - valid exercise data should persist with timestamp", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid exercise inputs
        fc.record({
          name: fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          startTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
          duration: fc.integer({ min: 1, max: 1440 }), // 1 minute to 24 hours
        }),
        async (exerciseInput: ExerciseInput) => {
          const beforeSave = new Date();

          // Save the manual exercise
          const savedRecord = await manualExerciseService.saveManualExercise(
            exerciseInput
          );

          const afterSave = new Date();

          // Verify the saved record properties
          expect(savedRecord.id).toBeDefined();
          expect(savedRecord.name).toBe(exerciseInput.name.trim());
          expect(savedRecord.startTime).toEqual(exerciseInput.startTime);
          expect(savedRecord.duration).toBe(exerciseInput.duration);
          expect(savedRecord.source).toBe(DataSource.MANUAL);

          // Verify timestamps are properly set
          expect(savedRecord.createdAt).toBeDefined();
          expect(savedRecord.updatedAt).toBeDefined();
          expect(savedRecord.createdAt.getTime()).toBeGreaterThanOrEqual(
            beforeSave.getTime()
          );
          expect(savedRecord.createdAt.getTime()).toBeLessThanOrEqual(
            afterSave.getTime()
          );
          expect(savedRecord.updatedAt.getTime()).toBeGreaterThanOrEqual(
            beforeSave.getTime()
          );
          expect(savedRecord.updatedAt.getTime()).toBeLessThanOrEqual(
            afterSave.getTime()
          );

          // Verify the record can be retrieved from storage
          const retrievedRecord =
            await manualExerciseService.getManualExerciseById(savedRecord.id);

          expect(retrievedRecord).toBeDefined();
          expect(retrievedRecord!.id).toBe(savedRecord.id);
          expect(retrievedRecord!.name).toBe(savedRecord.name);
          expect(retrievedRecord!.startTime).toEqual(savedRecord.startTime);
          expect(retrievedRecord!.duration).toBe(savedRecord.duration);
          expect(retrievedRecord!.source).toBe(DataSource.MANUAL);
          expect(retrievedRecord!.createdAt).toEqual(savedRecord.createdAt);
          expect(retrievedRecord!.updatedAt).toEqual(savedRecord.updatedAt);

          // Verify it appears in exercise history
          const dateRange = {
            start: new Date(
              exerciseInput.startTime.getTime() - 24 * 60 * 60 * 1000
            ), // 1 day before
            end: new Date(
              exerciseInput.startTime.getTime() + 24 * 60 * 60 * 1000
            ), // 1 day after
          };

          const historyRecords =
            await manualExerciseService.getManualExerciseHistory(dateRange);
          const foundInHistory = historyRecords.find(
            (r) => r.id === savedRecord.id
          );

          expect(foundInHistory).toBeDefined();
          expect(foundInHistory!.name).toBe(exerciseInput.name.trim());
          expect(foundInHistory!.duration).toBe(exerciseInput.duration);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 1 Extension: Batch persistence should maintain data integrity", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of valid exercise inputs
        fc.array(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            startTime: fc.date({
              min: new Date("2024-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 1, max: 300 }), // Shorter durations for batch tests
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (exerciseInputs: ExerciseInput[]) => {
          const beforeSave = new Date();

          // Save all exercises in batch
          const savedRecords =
            await manualExerciseService.saveMultipleManualExercises(
              exerciseInputs
            );

          const afterSave = new Date();

          // Verify all records were saved
          expect(savedRecords).toHaveLength(exerciseInputs.length);

          // Verify each saved record
          for (let i = 0; i < exerciseInputs.length; i++) {
            const input = exerciseInputs[i];
            const saved = savedRecords[i];

            if (!input || !saved) {
              continue;
            } // Skip if either is undefined

            expect(saved.name).toBe(input.name.trim());
            expect(saved.startTime).toEqual(input.startTime);
            expect(saved.duration).toBe(input.duration);
            expect(saved.source).toBe(DataSource.MANUAL);
            expect(saved.createdAt.getTime()).toBeGreaterThanOrEqual(
              beforeSave.getTime()
            );
            expect(saved.createdAt.getTime()).toBeLessThanOrEqual(
              afterSave.getTime()
            );

            // Verify each can be retrieved individually
            const retrieved = await manualExerciseService.getManualExerciseById(
              saved.id
            );
            expect(retrieved).toBeDefined();
            if (retrieved) {
              expect(retrieved.name).toBe(saved.name);
              expect(retrieved.duration).toBe(saved.duration);
            }
          }

          // Verify all appear in history
          const dateRange = {
            start: new Date("2024-01-01"),
            end: new Date("2024-12-31"),
          };

          const historyRecords =
            await manualExerciseService.getManualExerciseHistory(dateRange);

          // All saved records should be found in history
          for (const savedRecord of savedRecords) {
            const foundInHistory = historyRecords.find(
              (r) => r.id === savedRecord.id
            );
            expect(foundInHistory).toBeDefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 1 Round-trip: Save then retrieve should preserve all data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          startTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
          duration: fc.integer({ min: 1, max: 1440 }),
        }),
        async (exerciseInput: ExerciseInput) => {
          // Save the exercise
          const savedRecord = await manualExerciseService.saveManualExercise(
            exerciseInput
          );

          // Retrieve it back
          const retrievedRecord =
            await manualExerciseService.getManualExerciseById(savedRecord.id);

          // Round-trip should preserve all data exactly
          expect(retrievedRecord).not.toBeNull();
          expect(retrievedRecord!.id).toBe(savedRecord.id);
          expect(retrievedRecord!.name).toBe(savedRecord.name);
          expect(retrievedRecord!.startTime.getTime()).toBe(
            savedRecord.startTime.getTime()
          );
          expect(retrievedRecord!.duration).toBe(savedRecord.duration);
          expect(retrievedRecord!.source).toBe(savedRecord.source);
          expect(retrievedRecord!.createdAt.getTime()).toBe(
            savedRecord.createdAt.getTime()
          );
          expect(retrievedRecord!.updatedAt.getTime()).toBe(
            savedRecord.updatedAt.getTime()
          );

          // Metadata should also be preserved
          expect(retrievedRecord!.metadata).toEqual(savedRecord.metadata);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 1 Update Persistence: Updates should preserve data integrity", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Original exercise
          original: fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter((s) => s.trim().length > 0),
            startTime: fc.date({
              min: new Date("2024-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 1, max: 1440 }),
          }),
          // Updates to apply - ensure we only include defined values
          updates: fc
            .record(
              {
                name: fc.option(
                  fc
                    .string({ minLength: 1, maxLength: 50 })
                    .filter((s) => s.trim().length > 0),
                  { nil: undefined }
                ),
                startTime: fc.option(
                  fc.date({
                    min: new Date("2024-01-01"),
                    max: new Date("2024-12-31"),
                  }),
                  { nil: undefined }
                ),
                duration: fc.option(fc.integer({ min: 1, max: 1440 }), {
                  nil: undefined,
                }),
              },
              { requiredKeys: [] }
            )
            .map((updates) => {
              // Filter out undefined values to create a proper Partial<ExerciseInput>
              const filteredUpdates: Partial<ExerciseInput> = {};
              if (updates.name !== undefined) {
                filteredUpdates.name = updates.name;
              }
              if (updates.startTime !== undefined) {
                filteredUpdates.startTime = updates.startTime;
              }
              if (updates.duration !== undefined) {
                filteredUpdates.duration = updates.duration;
              }
              return filteredUpdates;
            }),
        }),
        async ({ original, updates }) => {
          // Save original exercise
          const savedRecord = await manualExerciseService.saveManualExercise(
            original
          );
          const originalUpdatedAt = savedRecord.updatedAt;

          // Apply updates if any are provided
          const hasUpdates =
            updates.name !== undefined ||
            updates.startTime !== undefined ||
            updates.duration !== undefined;

          if (hasUpdates) {
            // Wait a small amount to ensure updatedAt timestamp changes
            await new Promise((resolve) => setTimeout(resolve, 10));

            const updatedRecord =
              await manualExerciseService.updateManualExercise(
                savedRecord.id,
                updates
              );

            // Verify updates were applied
            expect(updatedRecord.id).toBe(savedRecord.id);
            expect(updatedRecord.name).toBe(
              (updates.name || original.name).trim()
            );
            expect(updatedRecord.startTime).toEqual(
              updates.startTime || original.startTime
            );
            expect(updatedRecord.duration).toBe(
              updates.duration || original.duration
            );
            expect(updatedRecord.source).toBe(DataSource.MANUAL);

            // Verify updatedAt timestamp changed
            expect(updatedRecord.updatedAt.getTime()).toBeGreaterThan(
              originalUpdatedAt.getTime()
            );

            // Verify createdAt timestamp remained the same
            expect(updatedRecord.createdAt.getTime()).toBe(
              savedRecord.createdAt.getTime()
            );

            // Verify updated record can be retrieved
            const retrievedUpdated =
              await manualExerciseService.getManualExerciseById(savedRecord.id);
            expect(retrievedUpdated).toBeDefined();
            expect(retrievedUpdated!.name).toBe(updatedRecord.name);
            expect(retrievedUpdated!.duration).toBe(updatedRecord.duration);
            expect(retrievedUpdated!.startTime).toEqual(
              updatedRecord.startTime
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
