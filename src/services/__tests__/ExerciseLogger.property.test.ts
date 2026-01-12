// Property-based tests for ExerciseLogger input validation
// Feature: health-tracker, Property 2: Input Validation Rejection

import * as fc from "fast-check";
import { ExerciseLogger } from "../ExerciseLogger";
import { DataStorageManager } from "../database/DataStorageManager";
import { DatabaseMigrator } from "../database/migrations";
import { ExerciseInput } from "@/types";
import { VALIDATION_RULES } from "@/utils/constants";

describe("ExerciseLogger Input Validation Properties", () => {
  let exerciseLogger: ExerciseLogger;
  let storageManager: DataStorageManager;
  let migrator: DatabaseMigrator;

  beforeEach(async () => {
    migrator = new DatabaseMigrator();
    await migrator.initialize();
    await migrator.resetDatabase();

    storageManager = new DataStorageManager(migrator.getDatabase());
    exerciseLogger = new ExerciseLogger(storageManager);
  });

  afterEach(async () => {
    await migrator.close();
  });

  /**
   * Property 2: Input Validation Rejection
   * For any invalid exercise input (incomplete data, invalid time format, or non-positive duration),
   * the system should reject the submission and prevent data storage.
   * Validates: Requirements 1.3, 1.4, 1.5
   */
  test("Property 2: Input Validation Rejection - invalid inputs should be rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid exercise inputs
        fc.oneof(
          // Invalid names (empty, too long, whitespace only)
          fc.record({
            name: fc.oneof(
              fc.constant(""), // empty string
              fc.constant("   "), // whitespace only
              fc.string({
                minLength: VALIDATION_RULES.NAME_MAX_LENGTH + 1,
                maxLength: 200,
              }) // too long
            ),
            startTime: fc.date({
              min: new Date("2023-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 1, max: 1440 }),
          }),

          // Invalid durations (negative, zero, too large)
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.date({
              min: new Date("2023-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.oneof(
              fc.integer({ min: -1000, max: 0 }), // negative or zero
              fc.integer({
                min: VALIDATION_RULES.DURATION_MAX + 1,
                max: 10000,
              }), // too large
              fc.constant(NaN), // NaN
              fc.constant(Infinity) // Infinity
            ),
          }),

          // Invalid start times (too far in future/past, invalid dates)
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.oneof(
              fc.date({
                min: new Date("2030-01-01"),
                max: new Date("2040-01-01"),
              }), // too far in future
              fc.date({
                min: new Date("2020-01-01"),
                max: new Date("2022-01-01"),
              }), // too far in past
              fc.constant(new Date("invalid")) // invalid date
            ),
            duration: fc.integer({ min: 1, max: 1440 }),
          }),

          // Missing required fields - create partial objects that are missing required fields
          fc.oneof(
            fc.record({
              name: fc.constant(undefined as any),
              startTime: fc.date({
                min: new Date("2023-01-01"),
                max: new Date("2024-12-31"),
              }),
              duration: fc.integer({ min: 1, max: 1440 }),
            }),
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              startTime: fc.constant(undefined as any),
              duration: fc.integer({ min: 1, max: 1440 }),
            }),
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              startTime: fc.date({
                min: new Date("2023-01-01"),
                max: new Date("2024-12-31"),
              }),
              duration: fc.constant(undefined as any),
            })
          )
        ),
        async (invalidInput: Partial<ExerciseInput>) => {
          // Validation should fail
          const validationResult = exerciseLogger.validateExerciseData(
            invalidInput as ExerciseInput
          );
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.length).toBeGreaterThan(0);

          // Attempting to save should throw an error
          await expect(
            exerciseLogger.saveManualLog(invalidInput as ExerciseInput)
          ).rejects.toThrow();

          // No record should be saved to storage
          const allRecords = await storageManager.getExerciseHistory({
            start: new Date("2020-01-01"),
            end: new Date("2030-01-01"),
          });

          // Should not find any record with this invalid data
          const matchingRecord = allRecords.find(
            (record) =>
              record.name === invalidInput.name &&
              record.duration === invalidInput.duration
          );
          expect(matchingRecord).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 2 Extension: Specific validation rules should be enforced consistently", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test name validation specifically
          nameTest: fc.oneof(
            fc.string({ minLength: 0, maxLength: 0 }), // empty
            fc.string().filter((s) => s.trim().length === 0 && s.length > 0), // whitespace only
            fc.string({ minLength: VALIDATION_RULES.NAME_MAX_LENGTH + 1 }) // too long
          ),
          // Test duration validation specifically
          durationTest: fc.oneof(
            fc.integer({ min: -100, max: 0 }), // non-positive
            fc.integer({ min: VALIDATION_RULES.DURATION_MAX + 1, max: 5000 }), // too large
            fc.constant(NaN),
            fc.constant(-Infinity),
            fc.constant(Infinity)
          ),
          // Valid fields for other properties
          validName: fc.string({ minLength: 1, maxLength: 50 }),
          validDuration: fc.integer({ min: 1, max: 1440 }),
          validStartTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
        }),
        async ({
          nameTest,
          durationTest,
          validName,
          validDuration,
          validStartTime,
        }) => {
          // Test invalid name with valid other fields
          const invalidNameInput: ExerciseInput = {
            name: nameTest,
            startTime: validStartTime,
            duration: validDuration,
          };

          const nameValidation =
            exerciseLogger.validateExerciseData(invalidNameInput);
          expect(nameValidation.isValid).toBe(false);
          expect(
            nameValidation.errors.some(
              (error) => error.includes("name") || error.includes("Name")
            )
          ).toBe(true);

          // Test invalid duration with valid other fields
          const invalidDurationInput: ExerciseInput = {
            name: validName,
            startTime: validStartTime,
            duration: durationTest,
          };

          const durationValidation =
            exerciseLogger.validateExerciseData(invalidDurationInput);
          expect(durationValidation.isValid).toBe(false);
          expect(
            durationValidation.errors.some(
              (error) =>
                error.includes("duration") || error.includes("Duration")
            )
          ).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 2 Boundary Testing: Edge cases around validation boundaries should be handled correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test boundary values
          nameLength: fc.oneof(
            fc.constant(0), // exactly at minimum boundary (invalid)
            fc.constant(VALIDATION_RULES.NAME_MAX_LENGTH), // exactly at maximum boundary (valid)
            fc.constant(VALIDATION_RULES.NAME_MAX_LENGTH + 1) // just over maximum boundary (invalid)
          ),
          duration: fc.oneof(
            fc.constant(0), // exactly zero (invalid)
            fc.constant(VALIDATION_RULES.DURATION_MIN), // exactly at minimum (valid)
            fc.constant(VALIDATION_RULES.DURATION_MAX), // exactly at maximum (valid)
            fc.constant(VALIDATION_RULES.DURATION_MAX + 1) // just over maximum (invalid)
          ),
          validStartTime: fc.date({
            min: new Date("2024-01-01"),
            max: new Date("2024-12-31"),
          }),
        }),
        async ({ nameLength, duration, validStartTime }) => {
          // Create name of specific length
          const name = nameLength === 0 ? "" : "a".repeat(nameLength);

          const input: ExerciseInput = {
            name,
            startTime: validStartTime,
            duration,
          };

          const validation = exerciseLogger.validateExerciseData(input);

          // Determine expected validity based on boundary rules
          const nameValid =
            nameLength > 0 && nameLength <= VALIDATION_RULES.NAME_MAX_LENGTH;
          const durationValid =
            duration >= VALIDATION_RULES.DURATION_MIN &&
            duration <= VALIDATION_RULES.DURATION_MAX;
          const expectedValid = nameValid && durationValid;

          expect(validation.isValid).toBe(expectedValid);

          if (!expectedValid) {
            expect(validation.errors.length).toBeGreaterThan(0);
            await expect(exerciseLogger.saveManualLog(input)).rejects.toThrow();
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
