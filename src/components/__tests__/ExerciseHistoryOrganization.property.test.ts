// Property test for exercise history organization
// Property 9: Exercise History Organization
// Validates: Requirements 5.2

import fc from "fast-check";
import { Exercise_Record, DataSource, HealthPlatform } from "@/types";

// Mock implementation of history organization logic
class MockExerciseHistoryOrganizer {
  // Sort exercises chronologically (most recent first)
  sortExercisesChronologically(records: Exercise_Record[]): Exercise_Record[] {
    return records.sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  // Group exercises by date
  groupExercisesByDate(records: Exercise_Record[]): {
    [key: string]: Exercise_Record[];
  } {
    const groups: { [key: string]: Exercise_Record[] } = {};

    records.forEach((record) => {
      const dateKey = record.startTime.toISOString().split("T")[0]!; // YYYY-MM-DD
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey]!.push(record);
    });

    return groups;
  }

  // Get ordered date groups (most recent first)
  getOrderedDateGroups(records: Exercise_Record[]): Array<{
    date: string;
    exercises: Exercise_Record[];
  }> {
    const groups = this.groupExercisesByDate(records);

    return Object.entries(groups)
      .map(([date, exercises]) => ({ date, exercises }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // Sort exercises within each date group by time
  sortExercisesWithinDateGroups(
    groups: Array<{
      date: string;
      exercises: Exercise_Record[];
    }>
  ): Array<{
    date: string;
    exercises: Exercise_Record[];
  }> {
    return groups.map((group) => ({
      ...group,
      exercises: this.sortExercisesChronologically(group.exercises),
    }));
  }

  // Get complete organized history
  getOrganizedHistory(records: Exercise_Record[]): Array<{
    date: string;
    exercises: Exercise_Record[];
  }> {
    const dateGroups = this.getOrderedDateGroups(records);
    return this.sortExercisesWithinDateGroups(dateGroups);
  }

  // Check if exercises are properly ordered within a date
  areExercisesOrderedWithinDate(exercises: Exercise_Record[]): boolean {
    for (let i = 1; i < exercises.length; i++) {
      if (
        exercises[i - 1]!.startTime.getTime() <
        exercises[i]!.startTime.getTime()
      ) {
        return false; // Should be most recent first
      }
    }
    return true;
  }

  // Check if date groups are properly ordered
  areDateGroupsOrdered(
    groups: Array<{ date: string; exercises: Exercise_Record[] }>
  ): boolean {
    for (let i = 1; i < groups.length; i++) {
      if (groups[i - 1]!.date < groups[i]!.date) {
        return false; // Should be most recent date first
      }
    }
    return true;
  }

  // Validate complete organization structure
  validateOrganization(records: Exercise_Record[]): {
    isChronologicallyOrdered: boolean;
    areDateGroupsCorrect: boolean;
    areExercisesGroupedCorrectly: boolean;
    isWithinDateOrderCorrect: boolean;
  } {
    const organized = this.getOrganizedHistory(records);

    // Check date group ordering
    const areDateGroupsCorrect = this.areDateGroupsOrdered(organized);

    // Check that all exercises are grouped correctly by date
    let areExercisesGroupedCorrectly = true;
    organized.forEach((group) => {
      group.exercises.forEach((exercise) => {
        const exerciseDateKey = exercise.startTime.toISOString().split("T")[0];
        if (exerciseDateKey !== group.date) {
          areExercisesGroupedCorrectly = false;
        }
      });
    });

    // Check within-date ordering
    let isWithinDateOrderCorrect = true;
    organized.forEach((group) => {
      if (!this.areExercisesOrderedWithinDate(group.exercises)) {
        isWithinDateOrderCorrect = false;
      }
    });

    // Check overall chronological ordering
    const flattenedExercises = organized.flatMap((group) => group.exercises);
    const isChronologicallyOrdered =
      this.areExercisesOrderedWithinDate(flattenedExercises);

    return {
      isChronologicallyOrdered,
      areDateGroupsCorrect,
      areExercisesGroupedCorrectly,
      isWithinDateOrderCorrect,
    };
  }
}

// Generators for test data
const exerciseRecordArb = fc
  .record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    startTime: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
    duration: fc.integer({ min: 1, max: 1440 }),
    source: fc.constantFrom(DataSource.MANUAL, DataSource.SYNCED),
    platform: fc.option(
      fc.constantFrom(
        HealthPlatform.APPLE_HEALTHKIT,
        HealthPlatform.GOOGLE_HEALTH_CONNECT
      )
    ),
    metadata: fc.record({
      originalId: fc.option(fc.string()),
      confidence: fc.option(
        fc.float({ min: Math.fround(0), max: Math.fround(1) })
      ),
    }),
    createdAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
    updatedAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2025-12-31"),
    }),
  })
  .map((record) => ({
    ...record,
    id: `exercise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
    platform: record.platform || undefined,
    metadata: {
      ...record.metadata,
      originalId: record.metadata.originalId || undefined,
      confidence: record.metadata.confidence || undefined,
    },
  }));

describe("Property 9: Exercise History Organization", () => {
  let organizer: MockExerciseHistoryOrganizer;

  beforeEach(() => {
    organizer = new MockExerciseHistoryOrganizer();
  });

  test("Property 9.1: Exercises must be organized chronologically (most recent first)", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 2, maxLength: 50 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const sorted = organizer.sortExercisesChronologically(typedRecords);

          // Verify chronological ordering (most recent first)
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1]!.startTime.getTime()).toBeGreaterThanOrEqual(
              sorted[i]!.startTime.getTime()
            );
          }

          // Verify all records are preserved
          expect(sorted.length).toBe(typedRecords.length);

          // Verify no records are lost or duplicated
          const originalIds = typedRecords.map((r) => r.id).sort();
          const sortedIds = sorted.map((r) => r.id).sort();
          expect(sortedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 50 }
    );
  });

  test("Property 9.2: Exercises must be grouped correctly by date", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 5, maxLength: 30 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const groups = organizer.groupExercisesByDate(typedRecords);

          // All records must be grouped
          const totalGroupedRecords = Object.values(groups).reduce(
            (sum, group) => sum + group.length,
            0
          );
          expect(totalGroupedRecords).toBe(typedRecords.length);

          // Each group must contain only records from the same date
          Object.entries(groups).forEach(([dateKey, groupRecords]) => {
            groupRecords.forEach((record) => {
              const recordDateKey = record.startTime
                .toISOString()
                .split("T")[0];
              expect(recordDateKey).toBe(dateKey);
            });
          });

          // Date keys must be valid
          Object.keys(groups).forEach((dateKey) => {
            expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(new Date(dateKey).toISOString().split("T")[0]).toBe(dateKey);
          });
        }
      ),
      { numRuns: 40 }
    );
  });

  test("Property 9.3: Date groups must be ordered chronologically (most recent first)", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 10, maxLength: 40 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const orderedGroups = organizer.getOrderedDateGroups(typedRecords);

          // Verify date group ordering
          for (let i = 1; i < orderedGroups.length; i++) {
            expect(
              orderedGroups[i - 1]!.date.localeCompare(orderedGroups[i]!.date)
            ).toBeGreaterThanOrEqual(0);
          }

          // Verify all records are preserved across groups
          const totalRecords = orderedGroups.reduce(
            (sum, group) => sum + group.exercises.length,
            0
          );
          expect(totalRecords).toBe(typedRecords.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 9.4: Exercises within each date group must be chronologically ordered", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 15, maxLength: 50 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const organized = organizer.getOrganizedHistory(typedRecords);

          // Check ordering within each date group
          organized.forEach((group) => {
            for (let i = 1; i < group.exercises.length; i++) {
              expect(
                group.exercises[i - 1]!.startTime.getTime()
              ).toBeGreaterThanOrEqual(group.exercises[i]!.startTime.getTime());
            }
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  test("Property 9.5: Complete organization must satisfy all ordering requirements", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 20, maxLength: 60 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const validation = organizer.validateOrganization(typedRecords);

          // All organization requirements must be satisfied
          expect(validation.isChronologicallyOrdered).toBe(true);
          expect(validation.areDateGroupsCorrect).toBe(true);
          expect(validation.areExercisesGroupedCorrectly).toBe(true);
          expect(validation.isWithinDateOrderCorrect).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 9.6: Organization must be stable across multiple operations", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 10, maxLength: 30 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];

          // Organize multiple times
          const organized1 = organizer.getOrganizedHistory(typedRecords);
          const organized2 = organizer.getOrganizedHistory(typedRecords);
          const organized3 = organizer.getOrganizedHistory(typedRecords);

          // Results should be identical
          expect(organized1.length).toBe(organized2.length);
          expect(organized2.length).toBe(organized3.length);

          // Compare each date group
          for (let i = 0; i < organized1.length; i++) {
            expect(organized1[i]!.date).toBe(organized2[i]!.date);
            expect(organized2[i]!.date).toBe(organized3[i]!.date);

            expect(organized1[i]!.exercises.length).toBe(
              organized2[i]!.exercises.length
            );
            expect(organized2[i]!.exercises.length).toBe(
              organized3[i]!.exercises.length
            );

            // Compare exercise IDs in order
            const ids1 = organized1[i]!.exercises.map((e) => e.id);
            const ids2 = organized2[i]!.exercises.map((e) => e.id);
            const ids3 = organized3[i]!.exercises.map((e) => e.id);

            expect(ids1).toEqual(ids2);
            expect(ids2).toEqual(ids3);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  test("Property 9.7: Organization must handle same-time exercises consistently", async () => {
    await fc.assert(
      fc.property(
        fc.tuple(
          fc.date({ min: new Date("2024-01-01"), max: new Date("2024-12-31") }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 3,
            maxLength: 8,
          })
        ),
        ([baseTime, exerciseNames]) => {
          // Create exercises with identical start times
          const sameTimeRecords: Exercise_Record[] = exerciseNames.map(
            (name, index) => ({
              id: `same_time_${index}`,
              name,
              startTime: baseTime,
              duration: 30 + index,
              source: DataSource.MANUAL,
              metadata: { originalId: `orig_${index}` },
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );

          const organized = organizer.getOrganizedHistory(sameTimeRecords);

          // Should be grouped in single date group
          expect(organized.length).toBe(1);
          expect(organized[0]!.exercises.length).toBe(sameTimeRecords.length);

          // All exercises should have the same start time
          const group = organized[0]!;
          group.exercises.forEach((exercise) => {
            expect(exercise.startTime.getTime()).toBe(baseTime.getTime());
          });

          // Organization should be stable for same-time records
          const organized2 = organizer.getOrganizedHistory(sameTimeRecords);
          expect(organized2[0]!.exercises.map((e) => e.id)).toEqual(
            organized[0]!.exercises.map((e) => e.id)
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 9.8: Organization must preserve exercise data integrity", async () => {
    await fc.assert(
      fc.property(
        fc.array(exerciseRecordArb, { minLength: 5, maxLength: 25 }),
        (records) => {
          const typedRecords = records as Exercise_Record[];
          const organized = organizer.getOrganizedHistory(typedRecords);

          // Flatten organized structure
          const flattenedExercises = organized.flatMap(
            (group) => group.exercises
          );

          // All original records must be present
          expect(flattenedExercises.length).toBe(typedRecords.length);

          // Check that each original record is preserved
          typedRecords.forEach((originalRecord) => {
            const foundRecord = flattenedExercises.find(
              (r) => r.id === originalRecord.id
            );
            expect(foundRecord).toBeDefined();

            if (foundRecord) {
              // Verify data integrity
              expect(foundRecord.name).toBe(originalRecord.name);
              expect(foundRecord.startTime.getTime()).toBe(
                originalRecord.startTime.getTime()
              );
              expect(foundRecord.duration).toBe(originalRecord.duration);
              expect(foundRecord.source).toBe(originalRecord.source);
              expect(foundRecord.platform).toBe(originalRecord.platform);
            }
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 9.9: Empty and single-record cases must be handled correctly", async () => {
    // Test empty array
    const emptyOrganized = organizer.getOrganizedHistory([]);
    expect(emptyOrganized).toEqual([]);

    // Test single record
    await fc.assert(
      fc.property(exerciseRecordArb, (record) => {
        const typedRecord = record as Exercise_Record;
        const organized = organizer.getOrganizedHistory([typedRecord]);

        expect(organized.length).toBe(1);
        expect(organized[0]!.exercises.length).toBe(1);
        expect(organized[0]!.exercises[0]!.id).toBe(typedRecord.id);

        const expectedDate = typedRecord.startTime.toISOString().split("T")[0];
        expect(organized[0]!.date).toBe(expectedDate);
      }),
      { numRuns: 20 }
    );
  });

  test("Property 9.10: Organization must handle cross-date boundary cases", async () => {
    await fc.assert(
      fc.property(
        fc.tuple(
          fc.date({
            min: new Date("2024-01-01T23:58:00"),
            max: new Date("2024-01-01T23:59:59"),
          }),
          fc.date({
            min: new Date("2024-01-02T00:00:00"),
            max: new Date("2024-01-02T00:02:00"),
          })
        ),
        ([lateNightTime, earlyMorningTime]) => {
          // Skip test if dates ended up on the same day (can happen during shrinking)
          const lateDate = lateNightTime.toISOString().split("T")[0];
          const earlyDate = earlyMorningTime.toISOString().split("T")[0];

          if (lateDate === earlyDate) {
            return; // Skip this test case
          }

          const records: Exercise_Record[] = [
            {
              id: "late_night",
              name: "Late Night Exercise",
              startTime: lateNightTime,
              duration: 30,
              source: DataSource.MANUAL,
              metadata: { originalId: "late" },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "early_morning",
              name: "Early Morning Exercise",
              startTime: earlyMorningTime,
              duration: 45,
              source: DataSource.MANUAL,
              metadata: { originalId: "early" },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];

          const organized = organizer.getOrganizedHistory(records);

          // Should be in separate date groups
          expect(organized.length).toBe(2);

          // More recent date should come first
          expect(organized[0]!.date).toBe(earlyDate);
          expect(organized[1]!.date).toBe(lateDate);

          // Each group should have one exercise
          expect(organized[0]!.exercises.length).toBe(1);
          expect(organized[1]!.exercises.length).toBe(1);

          // Verify correct exercise in each group
          expect(organized[0]!.exercises[0]!.id).toBe("early_morning");
          expect(organized[1]!.exercises[0]!.id).toBe("late_night");
        }
      ),
      { numRuns: 15 }
    );
  });
});
