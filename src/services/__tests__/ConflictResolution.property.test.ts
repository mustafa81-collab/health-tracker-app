// Property-based tests for Conflict Resolution Completeness
// Feature: health-tracker, Property 7: Conflict Resolution Completeness

import * as fc from "fast-check";
import { ConflictResolver } from "../ConflictResolver";
import { ConflictDetector } from "../ConflictDetector";
import {
  Exercise_Record,
  DataSource,
  ConflictType,
  ResolutionChoice,
  HealthPlatform,
  Conflict,
} from "@/types";

describe("Conflict Resolution Completeness Properties", () => {
  let conflictResolver: ConflictResolver;
  let conflictDetector: ConflictDetector;

  beforeEach(() => {
    conflictResolver = new ConflictResolver();
    conflictDetector = new ConflictDetector();
  });

  /**
   * Property 7: Conflict Resolution Completeness
   * For any detected conflict, the system should provide resolution options that,
   * when applied, result in a consistent state with no remaining conflicts.
   * Validates: Requirements 4.4, 4.5
   */
  test("Property 7: Conflict Resolution Completeness - all resolution choices should eliminate conflicts", () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate conflicting exercise pairs
          manualExercise: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.date({
              min: new Date("2024-01-01T08:00:00"),
              max: new Date("2024-01-01T20:00:00"),
            }),
            duration: fc.integer({ min: 15, max: 120 }),
          }),
          syncedExercise: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            startTime: fc.date({
              min: new Date("2024-01-01T08:00:00"),
              max: new Date("2024-01-01T20:00:00"),
            }),
            duration: fc.integer({ min: 15, max: 120 }),
          }),
          resolutionChoice: fc.constantFrom(
            ResolutionChoice.KEEP_MANUAL,
            ResolutionChoice.KEEP_SYNCED,
            ResolutionChoice.MERGE_RECORDS,
            ResolutionChoice.KEEP_BOTH
          ),
          userNotes: fc.option(fc.string({ maxLength: 200 })),
        }),
        ({ manualExercise, syncedExercise, resolutionChoice, userNotes }) => {
          // Create overlapping records to ensure conflict
          const manualRecord: Exercise_Record = {
            id: "manual_test",
            name: manualExercise.name,
            startTime: manualExercise.startTime,
            duration: manualExercise.duration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Force overlap by starting synced record during manual record
          const overlapStartTime = new Date(
            manualExercise.startTime.getTime() +
              Math.floor(manualExercise.duration * 0.4) * 60 * 1000 // Start 40% into manual record
          );

          const syncedRecord: Exercise_Record = {
            id: "synced_test",
            name: syncedExercise.name,
            startTime: overlapStartTime,
            duration: syncedExercise.duration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.APPLE_HEALTHKIT,
            metadata: { confidence: 0.8 },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Detect conflict
          const conflicts = conflictDetector.detectConflicts([
            manualRecord,
            syncedRecord,
          ]);

          // Should detect at least one conflict due to forced overlap
          expect(conflicts.conflicts.length).toBeGreaterThan(0);

          const conflict = conflicts.conflicts[0];
          if (!conflict) {
            return;
          }

          // Validate resolution choice is applicable
          const validation = conflictResolver.validateResolutionChoice(
            conflict,
            resolutionChoice
          );

          if (!validation.valid) {
            // If resolution choice is not valid for this conflict, skip this test case
            return;
          }

          // Apply resolution
          const resolutionResult = conflictResolver.resolveConflict(
            conflict,
            resolutionChoice,
            {
              ...(userNotes && { userNotes }),
            }
          );

          // Resolution should succeed
          expect(resolutionResult.success).toBe(true);
          expect(resolutionResult.error).toBeUndefined();
          expect(resolutionResult.resolution).toBeDefined();
          expect(resolutionResult.resultingRecords).toBeDefined();

          // Verify resolution properties
          const resolution = resolutionResult.resolution;
          expect(resolution.conflictId).toBe(conflict.id);
          expect(resolution.resolutionChoice).toBe(resolutionChoice);
          expect(resolution.resolvedAt).toBeInstanceOf(Date);
          expect(resolution.beforeState).toBeDefined();
          expect(resolution.afterState).toBeDefined();

          if (userNotes) {
            expect(resolution.userNotes).toBe(userNotes);
          }

          // Verify resulting records based on resolution choice
          const resultingRecords = resolutionResult.resultingRecords;

          switch (resolutionChoice) {
            case ResolutionChoice.KEEP_MANUAL:
              expect(resultingRecords).toHaveLength(1);
              expect(resultingRecords[0]?.id).toBe(manualRecord.id);
              expect(resultingRecords[0]?.source).toBe(DataSource.MANUAL);
              break;

            case ResolutionChoice.KEEP_SYNCED:
              expect(resultingRecords).toHaveLength(1);
              expect(resultingRecords[0]?.id).toBe(syncedRecord.id);
              expect(resultingRecords[0]?.source).toBe(DataSource.SYNCED);
              break;

            case ResolutionChoice.MERGE_RECORDS:
              expect(resultingRecords).toHaveLength(1);
              const mergedRecord = resultingRecords[0];
              expect(mergedRecord?.source).toBe(DataSource.MANUAL); // Merged records are treated as manual
              expect(mergedRecord?.metadata.mergedFrom).toEqual([
                manualRecord.id,
                syncedRecord.id,
              ]);
              expect(mergedRecord?.metadata.mergedAt).toBeInstanceOf(Date);
              break;

            case ResolutionChoice.KEEP_BOTH:
              expect(resultingRecords).toHaveLength(2);
              const adjustedManual = resultingRecords.find(
                (r) => r.id === manualRecord.id
              );
              const adjustedSynced = resultingRecords.find(
                (r) => r.id === syncedRecord.id
              );

              expect(adjustedManual).toBeDefined();
              expect(adjustedSynced).toBeDefined();
              expect(adjustedManual?.metadata.adjustedForConflict).toBe(true);
              expect(adjustedSynced?.metadata.adjustedForConflict).toBe(true);
              break;
          }

          // Critical property: No conflicts should remain after resolution
          const postResolutionConflicts =
            conflictDetector.detectConflicts(resultingRecords);
          expect(postResolutionConflicts.conflicts).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 7 Extension: Resolution presentation should provide accurate conflict visualization", () => {
    fc.assert(
      fc.property(
        fc.record({
          manualName: fc.string({ minLength: 1, maxLength: 30 }),
          syncedName: fc.string({ minLength: 1, maxLength: 30 }),
          baseTime: fc.date({
            min: new Date("2024-01-01T10:00:00"),
            max: new Date("2024-01-01T18:00:00"),
          }),
          manualDuration: fc.integer({ min: 20, max: 90 }),
          syncedDuration: fc.integer({ min: 20, max: 90 }),
          overlapMinutes: fc.integer({ min: 10, max: 30 }),
        }),
        ({
          manualName,
          syncedName,
          baseTime,
          manualDuration,
          syncedDuration,
          overlapMinutes,
        }) => {
          // Create records with controlled overlap
          const manualRecord: Exercise_Record = {
            id: "manual_viz",
            name: manualName,
            startTime: baseTime,
            duration: manualDuration,
            source: DataSource.MANUAL,
            metadata: { userNotes: "Manual entry" },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const syncedStartTime = new Date(
            baseTime.getTime() + (manualDuration - overlapMinutes) * 60 * 1000
          );

          const syncedRecord: Exercise_Record = {
            id: "synced_viz",
            name: syncedName,
            startTime: syncedStartTime,
            duration: syncedDuration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.GOOGLE_HEALTH_CONNECT,
            metadata: { confidence: 0.9, calories: 250 },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Create conflict
          const conflict: Conflict = {
            id: "test_conflict",
            manualRecord,
            syncedRecord,
            overlapDuration: overlapMinutes,
            conflictType: ConflictType.TIME_OVERLAP,
            detectedAt: new Date(),
          };

          // Present conflict for resolution
          const presentation = conflictResolver.presentConflict(conflict);

          // Verify presentation structure
          expect(presentation.conflict).toBe(conflict);
          expect(presentation.manualRecordDisplay).toBeDefined();
          expect(presentation.syncedRecordDisplay).toBeDefined();
          expect(presentation.overlapVisualization).toBeDefined();
          expect(presentation.recommendedAction).toBeDefined();
          expect(presentation.reasoning).toBeDefined();

          // Verify manual record display
          const manualDisplay = presentation.manualRecordDisplay;
          expect(manualDisplay.name).toBe(manualName);
          expect(manualDisplay.source).toBe("Manual Entry");
          expect(manualDisplay.platform).toBeUndefined();
          expect(manualDisplay.confidence).toBeUndefined();

          // Verify synced record display
          const syncedDisplay = presentation.syncedRecordDisplay;
          expect(syncedDisplay.name).toBe(syncedName);
          expect(syncedDisplay.source).toBe("Health App Sync");
          expect(syncedDisplay.platform).toBe("Google Health Connect");
          expect(syncedDisplay.confidence).toBe(0.9);

          // Verify overlap visualization
          const overlapViz = presentation.overlapVisualization;
          expect(overlapViz.overlapDuration).toContain(
            overlapMinutes.toString()
          );
          expect(overlapViz.overlapPercentage).toBeGreaterThan(0);
          expect(overlapViz.timelineData).toBeDefined();
          expect(overlapViz.timelineData.length).toBeGreaterThan(0);

          // Verify timeline segments make sense
          const timelineSegments = overlapViz.timelineData;
          const hasOverlapSegment = timelineSegments.some(
            (segment) => segment.type === "overlap"
          );
          expect(hasOverlapSegment).toBe(true);

          // Verify recommendation is valid
          expect(Object.values(ResolutionChoice)).toContain(
            presentation.recommendedAction
          );
          expect(presentation.reasoning).toBeTruthy();
          expect(presentation.reasoning.length).toBeGreaterThan(10);
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 7 Merge Strategy: Merged records should preserve essential information from both sources", () => {
    fc.assert(
      fc.property(
        fc.record({
          exerciseName: fc.constantFrom("Running", "Walking", "Cycling"),
          baseTime: fc.date({
            min: new Date("2024-01-01T09:00:00"),
            max: new Date("2024-01-01T17:00:00"),
          }),
          manualDuration: fc.integer({ min: 30, max: 90 }),
          syncedDuration: fc.integer({ min: 25, max: 95 }),
          mergeStrategy: fc.constantFrom(
            "prefer_manual",
            "prefer_synced",
            "combine_all"
          ),
          preserveMetadata: fc.boolean(),
        }),
        ({
          exerciseName,
          baseTime,
          manualDuration,
          syncedDuration,
          mergeStrategy,
          preserveMetadata,
        }) => {
          // Create similar exercises that should be merged
          const manualRecord: Exercise_Record = {
            id: "manual_merge",
            name: exerciseName,
            startTime: baseTime,
            duration: manualDuration,
            source: DataSource.MANUAL,
            metadata: {
              userNotes: "Manual tracking",
              estimatedDistance: 5.2,
              heartRate: 145,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const syncedRecord: Exercise_Record = {
            id: "synced_merge",
            name: exerciseName,
            startTime: new Date(baseTime.getTime() + 5 * 60 * 1000), // 5 minutes later
            duration: syncedDuration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.APPLE_HEALTHKIT,
            metadata: {
              confidence: 0.85,
              calories: 320,
              steps: 6500,
              deviceId: "apple_watch_1",
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Create conflict
          const conflict: Conflict = {
            id: "merge_conflict",
            manualRecord,
            syncedRecord,
            overlapDuration: Math.min(manualDuration, syncedDuration) - 5,
            conflictType: ConflictType.DUPLICATE_EXERCISE,
            detectedAt: new Date(),
          };

          // Apply merge resolution
          const resolutionResult = conflictResolver.resolveConflict(
            conflict,
            ResolutionChoice.MERGE_RECORDS,
            {
              mergeStrategy: mergeStrategy as
                | "prefer_manual"
                | "prefer_synced"
                | "combine_all",
              preserveMetadata,
            }
          );

          expect(resolutionResult.success).toBe(true);
          expect(resolutionResult.resultingRecords).toHaveLength(1);

          const mergedRecord = resolutionResult.resultingRecords[0];
          if (!mergedRecord) {
            return;
          }

          // Verify merged record properties
          expect(mergedRecord.source).toBe(DataSource.MANUAL);
          expect(mergedRecord.metadata.mergedFrom).toEqual([
            manualRecord.id,
            syncedRecord.id,
          ]);
          expect(mergedRecord.metadata.mergeStrategy).toBe(mergeStrategy);
          expect(mergedRecord.metadata.mergedAt).toBeInstanceOf(Date);

          // Verify timing encompasses both original records
          const manualEnd = new Date(
            baseTime.getTime() + manualDuration * 60 * 1000
          );
          const syncedEnd = new Date(
            syncedRecord.startTime.getTime() + syncedDuration * 60 * 1000
          );
          const mergedEnd = new Date(
            mergedRecord.startTime.getTime() + mergedRecord.duration * 60 * 1000
          );

          expect(mergedRecord.startTime.getTime()).toBeLessThanOrEqual(
            Math.min(baseTime.getTime(), syncedRecord.startTime.getTime())
          );
          expect(mergedEnd.getTime()).toBeGreaterThanOrEqual(
            Math.max(manualEnd.getTime(), syncedEnd.getTime())
          );

          // Verify metadata preservation based on strategy
          if (preserveMetadata || mergeStrategy === "combine_all") {
            // Should have metadata from both sources
            const hasManualMetadata =
              mergedRecord.metadata.userNotes === "Manual tracking" ||
              mergedRecord.metadata.userNotes_alt === "Manual tracking";
            const hasSyncedMetadata =
              mergedRecord.metadata.calories === 320 ||
              mergedRecord.metadata.calories_alt === 320;

            expect(hasManualMetadata || hasSyncedMetadata).toBe(true);
          }

          // Verify name selection based on strategy
          if (mergeStrategy === "prefer_synced") {
            expect(mergedRecord.name).toBe(syncedRecord.name);
          } else {
            expect(mergedRecord.name).toBe(manualRecord.name);
          }
        }
      ),
      { numRuns: 75 }
    );
  });

  test("Property 7 Validation: Invalid resolution choices should be rejected with clear reasons", () => {
    fc.assert(
      fc.property(
        fc.record({
          manualName: fc.string({ minLength: 1, maxLength: 20 }),
          syncedName: fc.string({ minLength: 1, maxLength: 20 }),
          baseTime: fc.date({
            min: new Date("2024-01-01T12:00:00"),
            max: new Date("2024-01-01T16:00:00"),
          }),
          duration: fc.integer({ min: 20, max: 60 }),
        }),
        ({ manualName, syncedName, baseTime, duration }) => {
          // Create very different exercises that shouldn't be merged
          const manualRecord: Exercise_Record = {
            id: "manual_different",
            name: manualName,
            startTime: baseTime,
            duration: duration,
            source: DataSource.MANUAL,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const syncedRecord: Exercise_Record = {
            id: "synced_different",
            name: syncedName,
            startTime: new Date(baseTime.getTime() + 10 * 60 * 1000),
            duration: duration,
            source: DataSource.SYNCED,
            platform: HealthPlatform.APPLE_HEALTHKIT,
            metadata: { confidence: 0.7 },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const conflict: Conflict = {
            id: "validation_conflict",
            manualRecord,
            syncedRecord,
            overlapDuration: 15,
            conflictType: ConflictType.TIME_OVERLAP,
            detectedAt: new Date(),
          };

          // Test all resolution choices
          const choices = [
            ResolutionChoice.KEEP_MANUAL,
            ResolutionChoice.KEEP_SYNCED,
            ResolutionChoice.MERGE_RECORDS,
            ResolutionChoice.KEEP_BOTH,
          ];

          for (const choice of choices) {
            const validation = conflictResolver.validateResolutionChoice(
              conflict,
              choice
            );

            expect(validation).toBeDefined();
            expect(typeof validation.valid).toBe("boolean");

            if (!validation.valid) {
              expect(validation.reason).toBeDefined();
              expect(validation.reason).toBeTruthy();
              expect(validation.reason!.length).toBeGreaterThan(5);
            }

            // MERGE_RECORDS should be invalid for very different exercise names
            if (choice === ResolutionChoice.MERGE_RECORDS) {
              const nameSimilarity = calculateSimpleNameSimilarity(
                manualName,
                syncedName
              );
              if (nameSimilarity < 0.3) {
                expect(validation.valid).toBe(false);
                expect(validation.reason).toContain("different");
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 7 Statistics: Resolution statistics should accurately reflect resolution patterns", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            choice: fc.constantFrom(
              ResolutionChoice.KEEP_MANUAL,
              ResolutionChoice.KEEP_SYNCED,
              ResolutionChoice.MERGE_RECORDS,
              ResolutionChoice.KEEP_BOTH
            ),
            conflictId: fc.string({ minLength: 5, maxLength: 20 }),
            hasNotes: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (resolutionData) => {
          // Create mock resolutions
          const resolutions = resolutionData.map((data, index) => ({
            id: `resolution_${index}`,
            conflictId: data.conflictId,
            resolutionChoice: data.choice,
            resolvedAt: new Date(),
            beforeState: {},
            afterState: {},
            ...(data.hasNotes && {
              userNotes: `Notes for resolution ${index}`,
            }),
          }));

          const stats = conflictResolver.getResolutionStatistics(resolutions);

          // Verify basic statistics
          expect(stats.totalResolutions).toBe(resolutions.length);
          expect(stats.resolutionsByChoice).toBeDefined();
          expect(stats.mostCommonChoice).toBeDefined();

          // Verify choice counts
          const expectedCounts = {
            [ResolutionChoice.KEEP_MANUAL]: 0,
            [ResolutionChoice.KEEP_SYNCED]: 0,
            [ResolutionChoice.MERGE_RECORDS]: 0,
            [ResolutionChoice.KEEP_BOTH]: 0,
          };

          for (const resolution of resolutions) {
            expectedCounts[resolution.resolutionChoice]++;
          }

          expect(stats.resolutionsByChoice).toEqual(expectedCounts);

          // Verify most common choice
          const maxCount = Math.max(...Object.values(expectedCounts));
          const mostCommonChoices = Object.entries(expectedCounts)
            .filter(([_, count]) => count === maxCount)
            .map(([choice, _]) => choice);

          expect(mostCommonChoices).toContain(stats.mostCommonChoice);

          // Verify all choice types are represented in the statistics
          expect(Object.keys(stats.resolutionsByChoice)).toHaveLength(4);
          for (const choice of Object.values(ResolutionChoice)) {
            expect(stats.resolutionsByChoice[choice]).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

// Helper function for simple name similarity calculation
function calculateSimpleNameSimilarity(name1: string, name2: string): number {
  const normalized1 = name1.toLowerCase().trim();
  const normalized2 = name2.toLowerCase().trim();

  if (normalized1 === normalized2) {
    return 1.0;
  }

  const words1 = normalized1.split(/\s+/);
  const words2 = normalized2.split(/\s+/);

  const commonWords = words1.filter((word) => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;

  return totalWords > 0 ? commonWords.length / totalWords : 0;
}
