// Property-based tests for Conflict Detection Accuracy
// Feature: health-tracker, Property 6: Conflict Detection Accuracy

import * as fc from "fast-check";
import { ConflictDetector } from "../ConflictDetector";
import {
  Exercise_Record,
  DataSource,
  ConflictType,
  HealthPlatform,
} from "@/types";

describe("Conflict Detection Accuracy Properties", () => {
  let conflictDetector: ConflictDetector;

  beforeEach(() => {
    conflictDetector = new ConflictDetector();
  });

  /**
   * Property 6: Conflict Detection Accuracy
   * For any set of manual and synced exercise records with overlapping times,
   * the system should accurately detect and categorize conflicts.
   * Validates: Requirements 4.1
   */
  test("Property 6: Conflict Detection Accuracy - overlapping records should be detected as conflicts", () => {
    fc.assert(
      fc.property(
        fc.record({
          manualRecord: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.date({
              min: new Date("2024-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 10, max: 180 }), // 10 minutes to 3 hours
          }),
          syncedRecord: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.date({
              min: new Date("2024-01-01"),
              max: new Date("2024-12-31"),
            }),
            duration: fc.integer({ min: 10, max: 180 }),
          }),
          shouldOverlap: fc.boolean(),
        }),
        ({ manualRecord, syncedRecord, shouldOverlap }) => {
          const manualExercise: Exercise_Record = {
            id: "manual_test",
            name: manualRecord.name,
            startTime: manualRecord.startTime,
            duration: manualRecord.duration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          let syncedExercise: Exercise_Record;

          if (shouldOverlap) {
            // Force overlap by starting synced record during manual record
            const overlapStartTime = new Date(
              manualRecord.startTime.getTime() +
                Math.floor(manualRecord.duration * 0.3) * 60 * 1000 // Start 30% into manual record
            );

            syncedExercise = {
              id: "synced_test",
              name: syncedRecord.name,
              startTime: overlapStartTime,
              duration: syncedRecord.duration,
              source: DataSource.SYNCED,
              platform: HealthPlatform.APPLE_HEALTHKIT,
              metadata: { originalId: "hk_test" },
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          } else {
            // Ensure no overlap by placing synced record well after manual record
            const noOverlapStartTime = new Date(
              manualRecord.startTime.getTime() +
                (manualRecord.duration + 60) * 60 * 1000 // Start 1 hour after manual record ends
            );

            syncedExercise = {
              id: "synced_test",
              name: syncedRecord.name,
              startTime: noOverlapStartTime,
              duration: syncedRecord.duration,
              source: DataSource.SYNCED,
              platform: HealthPlatform.APPLE_HEALTHKIT,
              metadata: { originalId: "hk_test" },
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }

          // Detect conflicts
          const analysis = conflictDetector.detectConflicts([
            manualExercise,
            syncedExercise,
          ]);

          // Verify conflict detection accuracy
          expect(analysis.totalRecordsAnalyzed).toBe(2);
          expect(analysis.manualRecordsCount).toBe(1);
          expect(analysis.syncedRecordsCount).toBe(1);

          if (shouldOverlap) {
            // Should detect exactly one conflict
            expect(analysis.conflicts.length).toBe(1);

            const conflict = analysis.conflicts[0];
            expect(conflict).toBeDefined();
            if (conflict) {
              expect(conflict.manualRecord.id).toBe("manual_test");
              expect(conflict.syncedRecord.id).toBe("synced_test");
              expect(conflict.overlapDuration).toBeGreaterThan(0);
              expect(conflict.detectedAt).toBeInstanceOf(Date);
              expect(Object.values(ConflictType)).toContain(
                conflict.conflictType
              );
            }
          } else {
            // Should not detect any conflicts
            expect(analysis.conflicts.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6 Extension: Time overlap calculation should be accurate", () => {
    fc.assert(
      fc.property(
        fc.record({
          record1: fc.record({
            startTime: fc.date({
              min: new Date("2024-01-01T08:00:00"),
              max: new Date("2024-01-01T20:00:00"),
            }),
            duration: fc.integer({ min: 30, max: 120 }), // 30 minutes to 2 hours
          }),
          record2: fc.record({
            startTime: fc.date({
              min: new Date("2024-01-01T08:00:00"),
              max: new Date("2024-01-01T20:00:00"),
            }),
            duration: fc.integer({ min: 30, max: 120 }),
          }),
        }),
        ({ record1, record2 }) => {
          const exerciseRecord1: Exercise_Record = {
            id: "test1",
            name: "Exercise 1",
            startTime: record1.startTime,
            duration: record1.duration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const exerciseRecord2: Exercise_Record = {
            id: "test2",
            name: "Exercise 2",
            startTime: record2.startTime,
            duration: record2.duration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.APPLE_HEALTHKIT,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const overlapResult = conflictDetector.calculateTimeOverlap(
            exerciseRecord1,
            exerciseRecord2
          );

          // Calculate expected overlap manually
          const end1 = new Date(
            record1.startTime.getTime() + record1.duration * 60 * 1000
          );
          const end2 = new Date(
            record2.startTime.getTime() + record2.duration * 60 * 1000
          );

          const actualOverlapStart = new Date(
            Math.max(record1.startTime.getTime(), record2.startTime.getTime())
          );
          const actualOverlapEnd = new Date(
            Math.min(end1.getTime(), end2.getTime())
          );

          if (actualOverlapStart < actualOverlapEnd) {
            const expectedOverlapMs =
              actualOverlapEnd.getTime() - actualOverlapStart.getTime();
            const expectedOverlapMinutes = Math.round(
              expectedOverlapMs / (60 * 1000)
            );

            if (expectedOverlapMinutes >= 5) {
              // OVERLAP_THRESHOLD_MINUTES
              expect(overlapResult.hasOverlap).toBe(true);
              expect(overlapResult.overlapDuration).toBe(
                expectedOverlapMinutes
              );
              expect(overlapResult.overlapStart.getTime()).toBe(
                actualOverlapStart.getTime()
              );
              expect(overlapResult.overlapEnd.getTime()).toBe(
                actualOverlapEnd.getTime()
              );
            } else {
              expect(overlapResult.hasOverlap).toBe(false);
            }
          } else {
            expect(overlapResult.hasOverlap).toBe(false);
            expect(overlapResult.overlapDuration).toBe(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  test("Property 6 Conflict Types: Similar exercises should be classified as duplicates", () => {
    fc.assert(
      fc.property(
        fc.record({
          baseName: fc.constantFrom(
            "Running",
            "Walking",
            "Cycling",
            "Swimming"
          ),
          nameVariations: fc.array(fc.string({ minLength: 0, maxLength: 10 }), {
            maxLength: 3,
          }),
          baseDuration: fc.integer({ min: 30, max: 120 }),
          durationVariation: fc.integer({ min: -5, max: 5 }),
          startTime: fc.date({
            min: new Date("2024-01-01T08:00:00"),
            max: new Date("2024-01-01T20:00:00"),
          }),
        }),
        ({
          baseName,
          nameVariations,
          baseDuration,
          durationVariation,
          startTime,
        }) => {
          // Create similar exercise names
          const manualName = baseName + (nameVariations[0] || "");
          const syncedName = baseName + (nameVariations[1] || "");

          const manualDuration = Math.max(
            10,
            baseDuration + durationVariation * -1
          );
          const syncedDuration = Math.max(10, baseDuration + durationVariation);

          // Create overlapping records with similar names and durations
          const manualRecord: Exercise_Record = {
            id: "manual_similar",
            name: manualName,
            startTime: startTime,
            duration: manualDuration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const syncedRecord: Exercise_Record = {
            id: "synced_similar",
            name: syncedName,
            startTime: new Date(startTime.getTime() + 10 * 60 * 1000), // Start 10 minutes later
            duration: syncedDuration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.APPLE_HEALTHKIT,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const analysis = conflictDetector.detectConflicts([
            manualRecord,
            syncedRecord,
          ]);

          if (analysis.conflicts.length > 0) {
            const conflict = analysis.conflicts[0];
            if (conflict) {
              // If names are very similar (same base name), should be classified as duplicate
              if (
                manualName.toLowerCase().includes(baseName.toLowerCase()) &&
                syncedName.toLowerCase().includes(baseName.toLowerCase())
              ) {
                // Check if durations are also similar (within 20% of each other)
                const durationSimilarity =
                  Math.min(manualDuration, syncedDuration) /
                  Math.max(manualDuration, syncedDuration);

                if (durationSimilarity >= 0.8) {
                  expect(conflict.conflictType).toBe(
                    ConflictType.DUPLICATE_EXERCISE
                  );
                }
              }

              // All conflicts should have valid properties
              expect(conflict.overlapDuration).toBeGreaterThan(0);
              expect(conflict.detectedAt).toBeInstanceOf(Date);
              expect(conflict.manualRecord.id).toBe("manual_similar");
              expect(conflict.syncedRecord.id).toBe("synced_similar");
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6 Edge Cases: Boundary conditions should be handled correctly", () => {
    fc.assert(
      fc.property(
        fc.record({
          overlapType: fc.constantFrom(
            "exact_match",
            "minimal_overlap",
            "complete_overlap",
            "partial_overlap"
          ),
          baseDuration: fc.integer({ min: 10, max: 60 }),
          startTime: fc.date({
            min: new Date("2024-01-01T10:00:00"),
            max: new Date("2024-01-01T18:00:00"),
          }),
        }),
        ({ overlapType, baseDuration, startTime }) => {
          let manualRecord: Exercise_Record;
          let syncedRecord: Exercise_Record;

          const baseRecord = {
            name: "Test Exercise",
            startTime: startTime,
            duration: baseDuration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          manualRecord = {
            ...baseRecord,
            id: "manual_edge",
            source: DataSource.MANUAL,
          };

          switch (overlapType) {
            case "exact_match":
              // Exact same time and duration
              syncedRecord = {
                ...baseRecord,
                id: "synced_edge",
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              };
              break;

            case "minimal_overlap":
              // Just barely overlapping (threshold test)
              syncedRecord = {
                ...baseRecord,
                id: "synced_edge",
                startTime: new Date(
                  startTime.getTime() + (baseDuration - 5) * 60 * 1000
                ), // 5 min overlap
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              };
              break;

            case "complete_overlap":
              // Synced record completely contains manual record
              syncedRecord = {
                ...baseRecord,
                id: "synced_edge",
                startTime: new Date(startTime.getTime() - 10 * 60 * 1000), // Start 10 min earlier
                duration: baseDuration + 20, // End 10 min later
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              };
              break;

            case "partial_overlap":
              // Partial overlap
              syncedRecord = {
                ...baseRecord,
                id: "synced_edge",
                startTime: new Date(
                  startTime.getTime() +
                    Math.floor(baseDuration * 0.5) * 60 * 1000
                ),
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              };
              break;

            default:
              syncedRecord = {
                ...baseRecord,
                id: "synced_edge",
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              };
          }

          const analysis = conflictDetector.detectConflicts([
            manualRecord,
            syncedRecord,
          ]);

          // Verify appropriate conflict detection based on overlap type
          switch (overlapType) {
            case "exact_match":
            case "complete_overlap":
            case "partial_overlap":
              expect(analysis.conflicts.length).toBe(1);
              if (analysis.conflicts[0]) {
                expect(analysis.conflicts[0].overlapDuration).toBeGreaterThan(
                  0
                );
              }
              break;

            case "minimal_overlap":
              // Should detect conflict since 5 minutes meets threshold
              expect(analysis.conflicts.length).toBe(1);
              if (analysis.conflicts[0]) {
                expect(analysis.conflicts[0].overlapDuration).toBe(5);
              }
              break;
          }

          // All detected conflicts should have valid structure
          for (const conflict of analysis.conflicts) {
            expect(conflict.id).toBeDefined();
            expect(conflict.manualRecord).toBeDefined();
            expect(conflict.syncedRecord).toBeDefined();
            expect(conflict.overlapDuration).toBeGreaterThanOrEqual(5); // Minimum threshold
            expect(conflict.detectedAt).toBeInstanceOf(Date);
            expect(Object.values(ConflictType)).toContain(
              conflict.conflictType
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 6 Performance: Conflict detection should scale reasonably with record count", () => {
    fc.assert(
      fc.property(
        fc.record({
          recordCount: fc.integer({ min: 10, max: 100 }),
          conflictRatio: fc.float({ min: 0, max: 0.5 }), // Up to 50% conflicts
        }),
        ({ recordCount, conflictRatio }) => {
          const records: Exercise_Record[] = [];
          const baseTime = new Date("2024-01-01T08:00:00");

          // Create records with controlled conflict ratio
          for (let i = 0; i < recordCount; i++) {
            const isManual = i % 2 === 0;
            const shouldConflict = Math.random() < conflictRatio;

            let startTime: Date;
            if (shouldConflict && i > 0) {
              // Create overlap with previous record
              const prevRecord = records[i - 1];
              if (prevRecord) {
                startTime = new Date(
                  prevRecord.startTime.getTime() + 15 * 60 * 1000
                ); // 15 min after prev start
              } else {
                startTime = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
              }
            } else {
              // No overlap
              startTime = new Date(baseTime.getTime() + i * 2 * 60 * 60 * 1000); // 2 hours apart
            }

            const record: Exercise_Record = {
              id: `${isManual ? "manual" : "synced"}_${i}`,
              name: `Exercise ${i}`,
              startTime,
              duration: 30,
              source: isManual ? DataSource.MANUAL : DataSource.SYNCED,
              platform: isManual ? undefined : HealthPlatform.APPLE_HEALTHKIT,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            records.push(record);
          }

          // Measure performance
          const startTime = Date.now();
          const analysis = conflictDetector.detectConflicts(records);
          const endTime = Date.now();
          const executionTime = endTime - startTime;

          // Performance should be reasonable (less than 1 second for 100 records)
          expect(executionTime).toBeLessThan(1000);

          // Results should be consistent
          expect(analysis.totalRecordsAnalyzed).toBe(recordCount);
          expect(analysis.conflicts.length).toBeGreaterThanOrEqual(0);
          expect(analysis.conflicts.length).toBeLessThanOrEqual(
            recordCount * recordCount
          ); // Theoretical maximum

          // Verify all conflicts are valid
          for (const conflict of analysis.conflicts) {
            expect(conflict.manualRecord.source).toBe(DataSource.MANUAL);
            expect(conflict.syncedRecord.source).toBe(DataSource.SYNCED);
            expect(conflict.overlapDuration).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
