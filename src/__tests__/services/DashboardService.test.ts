/**
 * Property-Based Tests for DashboardService
 * 
 * These tests validate the correctness properties defined in the design document
 * using property-based testing with fast-check to ensure universal correctness
 * across all possible inputs.
 * 
 * Feature: home-screen-dashboard
 * Requirements: 1.1, 1.2, 2.1, 2.2, 4.1
 */

import * as fc from 'fast-check';
import SQLite from 'react-native-sqlite-storage';
import { DashboardService } from '@/services/DashboardService';
import { DataStorageManager } from '@/services/database/DataStorageManager';
import {
  Exercise_Record,
  DataSource,
  HealthPlatform,
  DailyExerciseStats,
  WeeklyExerciseStats,
  ExerciseRecommendation,
} from '@/types';

// Mock SQLite for testing
jest.mock('react-native-sqlite-storage');

describe('DashboardService Property-Based Tests', () => {
  let mockDatabase: jest.Mocked<SQLite.SQLiteDatabase>;
  let storageManager: DataStorageManager;
  let dashboardService: DashboardService;
  let mockExerciseRecords: Exercise_Record[] = [];

  beforeEach(() => {
    // Reset mock data
    mockExerciseRecords = [];

    // Setup mock database with improved query handling
    mockDatabase = {
      executeSql: jest.fn((sql: string, params?: any[]) => {
        return new Promise((resolve) => {
          if (sql.includes('SELECT') && sql.includes('exercise_records')) {
            let filteredRecords = [...mockExerciseRecords]; // Create a copy to avoid mutation issues
            
            // Handle date range queries - match DataStorageManager behavior exactly
            if (params && params.length >= 2) {
              const startTimeMs = params[0]; // Already in milliseconds from DataStorageManager
              const endTimeMs = params[1];   // Already in milliseconds from DataStorageManager
              
              // Filter records by comparing millisecond timestamps
              if (typeof startTimeMs === 'number' && typeof endTimeMs === 'number') {
                filteredRecords = mockExerciseRecords.filter(record => {
                  if (!record || !record.startTime) return false;
                  const recordTimeMs = record.startTime.getTime();
                  return recordTimeMs >= startTimeMs && recordTimeMs <= endTimeMs;
                });
              }
            }
            
            const rows = filteredRecords.map(record => ({
              id: record.id,
              name: record.name,
              start_time: record.startTime.getTime(),
              duration: record.duration,
              source: record.source,
              platform: record.platform,
              metadata: JSON.stringify(record.metadata || {}),
              created_at: record.createdAt.getTime(),
              updated_at: record.updatedAt.getTime(),
            }));
            
            resolve([{ rows: { length: rows.length, item: (i: number) => rows[i] } }]);
          } else {
            resolve([{ rows: { length: 0, item: () => null } }]);
          }
        });
      }),
      close: jest.fn(),
    } as any;

    storageManager = new DataStorageManager(mockDatabase);
    dashboardService = new DashboardService(storageManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any timers to prevent open handles
    dashboardService?.cleanup();
  });

  // Generators for property-based testing
  const exerciseNameArb = fc.string({ minLength: 1, maxLength: 100 });
  const durationArb = fc.integer({ min: 1, max: 480 }); // 1 to 480 minutes (8 hours)
  const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });
  const dataSourceArb = fc.constantFrom(DataSource.MANUAL, DataSource.SYNCED);
  const healthPlatformArb = fc.constantFrom(HealthPlatform.APPLE_HEALTHKIT, HealthPlatform.GOOGLE_HEALTH_CONNECT);

  const exerciseRecordArb = fc.record({
    id: fc.uuid(),
    name: exerciseNameArb,
    startTime: dateArb,
    duration: durationArb,
    source: dataSourceArb,
    platform: fc.option(healthPlatformArb),
    metadata: fc.record({}),
    createdAt: dateArb,
    updatedAt: dateArb,
  }).map(record => ({
    ...record,
    metadata: record.metadata || {},
  })) as fc.Arbitrary<Exercise_Record>;

  const exerciseRecordsArb = fc.array(exerciseRecordArb, { minLength: 0, maxLength: 50 });

  describe('Property 1: Daily Exercise Count Accuracy', () => {
    test('Feature: home-screen-dashboard, Property 1: Daily Exercise Count Accuracy', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          dateArb,
          async (exercises: Exercise_Record[], targetDate: Date) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Calculate expected count for the target date
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const expectedCount = exercises.filter(exercise => 
              exercise.startTime >= startOfDay && exercise.startTime <= endOfDay
            ).length;

            // Execute: Get daily stats
            const dailyStats = await dashboardService.getDailyStats(targetDate);

            // Verify: Count should match expected
            expect(dailyStats.exerciseCount).toBe(expectedCount);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 2: Daily Duration Calculation', () => {
    test('Feature: home-screen-dashboard, Property 2: Daily Duration Calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          dateArb,
          async (exercises: Exercise_Record[], targetDate: Date) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Calculate expected duration for the target date
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const exercisesForDay = exercises.filter(exercise => 
              exercise.startTime >= startOfDay && exercise.startTime <= endOfDay
            );
            const expectedDuration = exercisesForDay.reduce((sum, exercise) => sum + exercise.duration, 0);

            // Execute: Get daily stats
            const dailyStats = await dashboardService.getDailyStats(targetDate);

            // Verify: Duration should match expected
            expect(dailyStats.totalDuration).toBe(expectedDuration);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 5: Weekly Exercise Count Accuracy', () => {
    test('Feature: home-screen-dashboard, Property 5: Weekly Exercise Count Accuracy', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          dateArb,
          async (exercises: Exercise_Record[], weekStartDate: Date) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Calculate expected count for the week
            const weekStart = new Date(weekStartDate);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const expectedCount = exercises.filter(exercise => 
              exercise.startTime >= weekStart && exercise.startTime <= weekEnd
            ).length;

            // Execute: Get weekly stats
            const weeklyStats = await dashboardService.getWeeklyStats(weekStart);

            // Verify: Count should match expected
            expect(weeklyStats.exerciseCount).toBe(expectedCount);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 6: Weekly Duration Calculation', () => {
    test('Feature: home-screen-dashboard, Property 6: Weekly Duration Calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          dateArb,
          async (exercises: Exercise_Record[], weekStartDate: Date) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Calculate expected duration for the week
            const weekStart = new Date(weekStartDate);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const exercisesForWeek = exercises.filter(exercise => 
              exercise.startTime >= weekStart && exercise.startTime <= weekEnd
            );
            const expectedDuration = exercisesForWeek.reduce((sum, exercise) => sum + exercise.duration, 0);

            // Execute: Get weekly stats
            const weeklyStats = await dashboardService.getWeeklyStats(weekStart);

            // Verify: Duration should match expected
            expect(weeklyStats.totalDuration).toBe(expectedDuration);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 13: Recommendation Time Filtering', () => {
    test('Feature: home-screen-dashboard, Property 13: Recommendation Time Filtering', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          async (exercises: Exercise_Record[]) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Execute: Get recommendations
            const recommendations = await dashboardService.getExerciseRecommendations();

            // Verify: All recommendations should be for exercises not performed in last 7 days
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            for (const recommendation of recommendations) {
              if (recommendation.lastPerformed) {
                // If lastPerformed is set, it should be more than 7 days ago
                expect(recommendation.lastPerformed.getTime()).toBeLessThan(sevenDaysAgo.getTime());
                expect(recommendation.daysSinceLastPerformed).toBeGreaterThanOrEqual(7);
              }
            }

            // Should return exactly 2 recommendations
            expect(recommendations.length).toBe(2);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Additional Property Tests for Edge Cases', () => {
    test('Property: Empty dataset handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateArb,
          async (targetDate: Date) => {
            // Setup: Empty dataset
            mockExerciseRecords = [];

            // Execute: Get all stats
            const [dailyStats, weeklyStats, recentExercises, recommendations] = await Promise.all([
              dashboardService.getDailyStats(targetDate),
              dashboardService.getWeeklyStats(targetDate),
              dashboardService.getRecentExercises(5),
              dashboardService.getExerciseRecommendations(),
            ]);

            // Verify: All should handle empty data gracefully
            expect(dailyStats.exerciseCount).toBe(0);
            expect(dailyStats.totalDuration).toBe(0);
            expect(weeklyStats.exerciseCount).toBe(0);
            expect(weeklyStats.totalDuration).toBe(0);
            expect(recentExercises.length).toBe(0);
            expect(recommendations.length).toBe(2); // Should provide popular exercises
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: Recent exercises ordering and limiting', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          fc.integer({ min: 3, max: 5 }),
          async (exercises: Exercise_Record[], limit: number) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Execute: Get recent exercises
            const recentExercises = await dashboardService.getRecentExercises(limit);

            // Verify: Should be limited correctly
            expect(recentExercises.length).toBeLessThanOrEqual(Math.min(limit, exercises.length));

            // Verify: Should be ordered by start time (most recent first)
            for (let i = 1; i < recentExercises.length; i++) {
              expect(recentExercises[i - 1].startTime.getTime()).toBeGreaterThanOrEqual(
                recentExercises[i].startTime.getTime()
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Property: Most frequent exercise detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('Running', 'Walking', 'Cycling', 'Swimming'),
              startTime: dateArb,
              duration: durationArb,
            }),
            { minLength: 1, maxLength: 20 }
          ),
          dateArb,
          async (exerciseData, weekStart: Date) => {
            // Setup: Create exercises with known names
            mockExerciseRecords = exerciseData.map((data, index) => ({
              id: `exercise_${index}`,
              name: data.name,
              startTime: new Date(weekStart.getTime() + index * 60 * 60 * 1000), // Spread across week
              duration: data.duration,
              source: DataSource.MANUAL,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            // Execute: Get weekly stats
            const weeklyStats = await dashboardService.getWeeklyStats(weekStart);

            // Verify: Most frequent exercise should be correct
            if (weeklyStats.mostFrequentExercise) {
              // Count occurrences manually
              const counts = new Map<string, number>();
              exerciseData.forEach(exercise => {
                counts.set(exercise.name, (counts.get(exercise.name) || 0) + 1);
              });

              let maxCount = 0;
              let expectedMostFrequent = '';
              counts.forEach((count, name) => {
                if (count > maxCount) {
                  maxCount = count;
                  expectedMostFrequent = name;
                }
              });

              expect(weeklyStats.mostFrequentExercise).toBe(expectedMostFrequent);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('Property: Mixed data source inclusion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: exerciseNameArb,
              startTime: dateArb,
              duration: durationArb,
              source: dataSourceArb,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          dateArb,
          async (exerciseData, targetDate: Date) => {
            // Setup: Create exercises with mixed sources
            mockExerciseRecords = exerciseData.map((data, index) => ({
              id: `exercise_${index}`,
              name: data.name,
              startTime: new Date(targetDate.getTime() + index * 60 * 1000), // Same day, different times
              duration: data.duration,
              source: data.source,
              platform: data.source === DataSource.SYNCED ? HealthPlatform.APPLE_HEALTHKIT : undefined,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            // Execute: Get daily stats
            const dailyStats = await dashboardService.getDailyStats(targetDate);

            // Verify: Should include both manual and synced data
            const manualCount = exerciseData.filter(e => e.source === DataSource.MANUAL).length;
            const syncedCount = exerciseData.filter(e => e.source === DataSource.SYNCED).length;
            const totalExpected = manualCount + syncedCount;

            expect(dailyStats.exerciseCount).toBe(totalExpected);

            const totalDurationExpected = exerciseData.reduce((sum, e) => sum + e.duration, 0);
            expect(dailyStats.totalDuration).toBe(totalDurationExpected);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Cache Behavior Tests', () => {
    test('Property: Cache invalidation works correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          exerciseRecordsArb,
          dateArb,
          async (exercises: Exercise_Record[], targetDate: Date) => {
            // Setup: Add exercises to mock data
            mockExerciseRecords = exercises;

            // Execute: Get dashboard data twice
            const firstResult = await dashboardService.getDashboardData();
            const secondResult = await dashboardService.getDashboardData();

            // Verify: Results should be identical (cached)
            expect(firstResult.dailyStats.exerciseCount).toBe(secondResult.dailyStats.exerciseCount);
            expect(firstResult.weeklyStats.exerciseCount).toBe(secondResult.weeklyStats.exerciseCount);

            // Clear cache and verify it's cleared
            dashboardService.clearCache();
            const thirdResult = await dashboardService.getDashboardData();

            // Should still be the same data, but freshly calculated
            expect(thirdResult.dailyStats.exerciseCount).toBe(firstResult.dailyStats.exerciseCount);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Real-time Data Update Properties', () => {
    describe('Property 20: Dashboard Data Refresh', () => {
      test('Feature: home-screen-dashboard, Property 20: Dashboard Data Refresh', async () => {
        await fc.assert(
          fc.asyncProperty(
            exerciseRecordsArb,
            async (exercises: Exercise_Record[]) => {
              // Setup: Initial dataset
              mockExerciseRecords = exercises;
              
              // Clear all caches before starting
              dashboardService.clearCache();
              
              // Execute: Get initial dashboard data
              const initialData = await dashboardService.getDashboardData();
              
              // Clear cache to simulate refresh
              dashboardService.clearCache();
              
              // Execute: Get refreshed data
              const refreshedData = await dashboardService.getDashboardData();
              
              // Verify: Data should be consistent after refresh
              expect(refreshedData.dailyStats.exerciseCount).toBe(initialData.dailyStats.exerciseCount);
              expect(refreshedData.weeklyStats.exerciseCount).toBe(initialData.weeklyStats.exerciseCount);
              expect(refreshedData.recentExercises.length).toBe(initialData.recentExercises.length);
              
              // Verify: Recommendations should always be 2
              expect(refreshedData.recommendations.length).toBe(2);
              expect(initialData.recommendations.length).toBe(2);
              
              // Verify: Last updated timestamp should be newer or equal
              expect(refreshedData.lastUpdated.getTime()).toBeGreaterThanOrEqual(initialData.lastUpdated.getTime());
            }
          ),
          { numRuns: 10 } // Reduce runs to speed up testing
        );
      });
    });

    describe('Property 21: Reactive Statistics Updates', () => {
      test('Feature: home-screen-dashboard, Property 21: Reactive Statistics Updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            exerciseRecordsArb,
            exerciseRecordArb,
            async (initialExercises: Exercise_Record[], newExercise: Exercise_Record) => {
              // Setup: Initial dataset
              mockExerciseRecords = [...initialExercises];
              
              // Ensure the new exercise has a valid date for testing
              const testDate = new Date();
              testDate.setHours(12, 0, 0, 0); // Set to noon for consistent testing
              const newExerciseWithDate = {
                ...newExercise,
                startTime: testDate,
                createdAt: testDate,
                updatedAt: testDate,
              };
              
              // Execute: Get initial statistics for the test date
              const initialStats = await dashboardService.getDailyStats(testDate);
              
              // Simulate adding new exercise
              mockExerciseRecords.push(newExerciseWithDate);
              
              // Notify service of data update (simulates reactive update)
              dashboardService.notifyDataUpdate();
              
              // Execute: Get updated statistics
              const updatedStats = await dashboardService.getDailyStats(testDate);
              
              // Verify: Statistics should reflect the new exercise
              const exercisesOnSameDay = initialExercises.filter(exercise => {
                const exerciseDate = new Date(exercise.startTime);
                exerciseDate.setHours(0, 0, 0, 0);
                const targetDate = new Date(testDate);
                targetDate.setHours(0, 0, 0, 0);
                return exerciseDate.getTime() === targetDate.getTime();
              });
              
              const expectedCount = exercisesOnSameDay.length + 1; // +1 for new exercise
              const expectedDuration = exercisesOnSameDay.reduce((sum, e) => sum + e.duration, 0) + newExerciseWithDate.duration;
              
              expect(updatedStats.exerciseCount).toBe(expectedCount);
              expect(updatedStats.totalDuration).toBe(expectedDuration);
            }
          ),
          { numRuns: 20 }
        );
      });
    });

    describe('Property 23: Sync Data Integration', () => {
      test('Feature: home-screen-dashboard, Property 23: Sync Data Integration', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(exerciseRecordArb, { minLength: 1, maxLength: 10 }),
            fc.array(
              exerciseRecordArb.map(record => ({
                ...record,
                source: DataSource.SYNCED,
                platform: HealthPlatform.APPLE_HEALTHKIT,
              })),
              { minLength: 1, maxLength: 5 }
            ),
            async (manualExercises: Exercise_Record[], syncedExercises: Exercise_Record[]) => {
              // Use a consistent test date
              const testDate = new Date();
              testDate.setHours(12, 0, 0, 0); // Set to noon for consistent testing
              
              // Setup: Start with manual exercises only, all on the test date
              mockExerciseRecords = manualExercises.map(exercise => ({
                ...exercise,
                source: DataSource.MANUAL,
                platform: undefined,
                startTime: new Date(testDate.getTime() + Math.random() * 60 * 60 * 1000), // Same day, different hours
                createdAt: testDate,
                updatedAt: testDate,
              }));
              
              // Execute: Get initial dashboard data
              const initialData = await dashboardService.getDashboardData();
              
              // Simulate data synchronization event - add synced exercises on the same date
              const allSyncedOnTargetDate = syncedExercises.map((exercise, index) => ({
                ...exercise,
                startTime: new Date(testDate.getTime() + (index + 1) * 30 * 60 * 1000), // Same day, spaced 30 min apart
                createdAt: testDate,
                updatedAt: testDate,
              }));
              
              mockExerciseRecords.push(...allSyncedOnTargetDate);
              
              // Notify service of sync data update
              dashboardService.notifyDataUpdate();
              
              // Execute: Get updated dashboard data
              const updatedData = await dashboardService.getDashboardData();
              
              // Verify: Dashboard should include synced data in calculations
              const manualCountOnDate = manualExercises.length; // All manual exercises are on test date
              const syncedCountOnDate = allSyncedOnTargetDate.length;
              const expectedTotalCount = manualCountOnDate + syncedCountOnDate;
              
              // Get daily stats for target date to verify integration
              const dailyStats = await dashboardService.getDailyStats(testDate);
              
              expect(dailyStats.exerciseCount).toBe(expectedTotalCount);
              
              // Verify that both manual and synced exercises are included
              const recentExercises = await dashboardService.getRecentExercises(10);
              const manualInRecent = recentExercises.filter(e => e.source === DataSource.MANUAL).length;
              const syncedInRecent = recentExercises.filter(e => e.source === DataSource.SYNCED).length;
              
              expect(manualInRecent + syncedInRecent).toBe(recentExercises.length);
              
              // Verify total duration includes both sources
              const expectedTotalDuration = 
                manualExercises.reduce((sum, e) => sum + e.duration, 0) +
                allSyncedOnTargetDate.reduce((sum, e) => sum + e.duration, 0);
              
              expect(dailyStats.totalDuration).toBe(expectedTotalDuration);
            }
          ),
          { numRuns: 20 }
        );
      });
    });

    describe('Refresh Listener Management', () => {
      test('Property: Refresh listeners are called on data updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            exerciseRecordsArb,
            async (exercises: Exercise_Record[]) => {
              // Setup: Mock listener
              let listenerCallCount = 0;
              const mockListener = jest.fn(() => {
                listenerCallCount++;
              });
              
              // Add listener
              dashboardService.addRefreshListener(mockListener);
              
              // Execute: Notify data update
              dashboardService.notifyDataUpdate();
              
              // Verify: Listener should be called
              expect(listenerCallCount).toBe(1);
              expect(mockListener).toHaveBeenCalledTimes(1);
              
              // Execute: Multiple updates
              dashboardService.notifyDataUpdate();
              dashboardService.notifyDataUpdate();
              
              // Verify: Listener called for each update
              expect(listenerCallCount).toBe(3);
              expect(mockListener).toHaveBeenCalledTimes(3);
              
              // Cleanup: Remove listener
              dashboardService.removeRefreshListener(mockListener);
              
              // Execute: Update after removal
              dashboardService.notifyDataUpdate();
              
              // Verify: Listener not called after removal
              expect(listenerCallCount).toBe(3); // Should remain 3
              expect(mockListener).toHaveBeenCalledTimes(3);
            }
          ),
          { numRuns: 10 }
        );
      });
    });

    describe('Error Handling and Fallback Properties', () => {
      test('Property: Stale cache fallback on errors', async () => {
        await fc.assert(
          fc.asyncProperty(
            exerciseRecordsArb,
            async (exercises: Exercise_Record[]) => {
              // Setup: Initial successful data load
              mockExerciseRecords = exercises;
              const initialData = await dashboardService.getDashboardData();
              
              // Simulate database error by making executeSql throw
              mockDatabase.executeSql.mockRejectedValueOnce(new Error('Database connection failed'));
              
              // Execute: Try to get data during error
              const fallbackData = await dashboardService.getDashboardData();
              
              // Verify: Should return stale cached data
              expect(fallbackData.dailyStats.exerciseCount).toBe(initialData.dailyStats.exerciseCount);
              expect(fallbackData.weeklyStats.exerciseCount).toBe(initialData.weeklyStats.exerciseCount);
              expect(fallbackData.recentExercises.length).toBe(initialData.recentExercises.length);
            }
          ),
          { numRuns: 10 }
        );
      });

      test('Property: Empty dashboard data on complete failure', async () => {
        // Setup: Clear cache and make all database calls fail
        dashboardService.clearCache();
        mockDatabase.executeSql.mockRejectedValue(new Error('Complete database failure'));
        
        // Execute: Try to get data
        const emptyData = await dashboardService.getDashboardData();
        
        // Verify: Should return empty but valid dashboard data
        expect(emptyData.dailyStats.exerciseCount).toBe(0);
        expect(emptyData.dailyStats.totalDuration).toBe(0);
        expect(emptyData.weeklyStats.exerciseCount).toBe(0);
        expect(emptyData.weeklyStats.totalDuration).toBe(0);
        expect(emptyData.recentExercises).toEqual([]);
        expect(emptyData.recommendations.length).toBe(2); // Should provide popular exercises
        expect(emptyData.lastUpdated).toBeInstanceOf(Date);
      });
    });
  });
});