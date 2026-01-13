/**
 * Dashboard Service
 * 
 * Provides data aggregation and calculation services for the home screen dashboard.
 * This service handles:
 * - Daily and weekly exercise statistics calculation
 * - Recent exercise retrieval and formatting
 * - Exercise recommendation generation based on user patterns
 * - Data caching for improved performance
 * 
 * The service integrates with DataStorageManager to retrieve exercise records
 * and performs complex calculations to generate meaningful insights for users.
 */

import { DataStorageManager } from "./database/DataStorageManager";
import {
  DashboardData,
  DailyExerciseStats,
  WeeklyExerciseStats,
  ExerciseRecommendation,
  Exercise_Record,
  DataSource,
} from "@/types";

/**
 * Popular exercise suggestions for new users or when insufficient data exists
 */
const POPULAR_EXERCISES = [
  { name: "Walking", description: "A gentle, accessible exercise for all fitness levels" },
  { name: "Push-ups", description: "Build upper body strength with this classic exercise" },
  { name: "Yoga", description: "Improve flexibility and mindfulness" },
  { name: "Running", description: "Great cardiovascular workout" },
  { name: "Cycling", description: "Low-impact cardio that's easy on joints" },
  { name: "Swimming", description: "Full-body workout with minimal joint stress" },
  { name: "Stretching", description: "Maintain flexibility and prevent injury" },
  { name: "Weight Training", description: "Build muscle strength and bone density" },
];

export class DashboardService {
  private cache: Map<string, { data: any; timestamp: Date }> = new Map();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private refreshListeners: Set<() => void> = new Set();
  private lastDataUpdate: Date = new Date();
  
  // Performance optimization: Pre-computed data cache
  private precomputedCache: Map<string, { data: any; timestamp: Date }> = new Map();
  private readonly PRECOMPUTE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private precomputeTimer: NodeJS.Timeout | null = null;
  
  // Performance optimization: Request deduplication
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  // Performance optimization: Optimistic updates
  private optimisticUpdates: Map<string, any> = new Map();

  constructor(private storageManager: DataStorageManager) {
    // Start background precomputation for better performance
    this.startBackgroundPrecomputation();
  }

  /**
   * Get dashboard data with request deduplication for better performance
   * @returns Promise resolving to complete dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const cacheKey = `dashboard_${now.toDateString()}`;
    
    // Check for optimistic updates first
    const optimisticData = this.optimisticUpdates.get(cacheKey);
    if (optimisticData) {
      return optimisticData;
    }

    // Check precomputed cache for fastest response
    const precomputed = this.precomputedCache.get(`precomputed_${now.toDateString()}`);
    if (precomputed && this.isCacheValid(precomputed.timestamp)) {
      return precomputed.data;
    }

    // Check regular cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent requests
    const existingRequest = this.pendingRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request with deduplication
    const request = this.getDashboardDataInternal();
    this.pendingRequests.set(cacheKey, request);

    try {
      const result = await request;
      
      // Cache the result
      this.setCachedData(cacheKey, result);
      
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Calculate daily exercise statistics for a specific date
   * @param date - The date to calculate statistics for
   * @returns Promise resolving to daily exercise statistics
   */
  async getDailyStats(date: Date): Promise<DailyExerciseStats> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all exercises for the day with timeout protection
      const exercises = await Promise.race([
        this.storageManager.getExerciseHistory({ start: startOfDay, end: endOfDay }),
        new Promise<Exercise_Record[]>((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )
      ]);

      if (exercises.length === 0) {
        return {
          exerciseCount: 0,
          totalDuration: 0,
        };
      }

      // Calculate statistics with validation
      const exerciseCount = Math.max(0, exercises.length);
      const totalDuration = Math.max(0, exercises.reduce((sum, exercise) => {
        // Validate duration is a positive number
        const duration = typeof exercise.duration === 'number' && exercise.duration >= 0 ? exercise.duration : 0;
        return sum + duration;
      }, 0));
      
      // Find most recent exercise
      const sortedExercises = exercises
        .filter(exercise => exercise.startTime instanceof Date && !isNaN(exercise.startTime.getTime()))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      const mostRecent = sortedExercises[0];

      return {
        exerciseCount,
        totalDuration,
        ...(mostRecent && {
          lastExerciseTime: mostRecent.startTime,
          lastExerciseName: mostRecent.name,
        }),
      };
    } catch (error) {
      console.error("Error calculating daily stats:", error);
      // Return safe default values on error
      return {
        exerciseCount: 0,
        totalDuration: 0,
      };
    }
  }

  /**
   * Calculate weekly exercise statistics starting from a specific date
   * @param weekStart - The start date of the week
   * @returns Promise resolving to weekly exercise statistics
   */
  async getWeeklyStats(weekStart: Date): Promise<WeeklyExerciseStats> {
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get exercises for current week with timeout protection
      const currentWeekExercises = await Promise.race([
        this.storageManager.getExerciseHistory({ start: weekStart, end: weekEnd }),
        new Promise<Exercise_Record[]>((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )
      ]);

      // Get exercises for previous week for comparison
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(weekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekStart);
      prevWeekEnd.setMilliseconds(-1);

      let previousWeekExercises: Exercise_Record[] = [];
      try {
        previousWeekExercises = await Promise.race([
          this.storageManager.getExerciseHistory({ start: prevWeekStart, end: prevWeekEnd }),
          new Promise<Exercise_Record[]>((_, reject) => 
            setTimeout(() => reject(new Error('Database query timeout')), 10000)
          )
        ]);
      } catch (error) {
        console.warn("Failed to get previous week data for comparison:", error);
        // Continue without comparison data
      }

      // Calculate current week stats with validation
      const exerciseCount = Math.max(0, currentWeekExercises.length);
      const totalDuration = Math.max(0, currentWeekExercises.reduce((sum, exercise) => {
        const duration = typeof exercise.duration === 'number' && exercise.duration >= 0 ? exercise.duration : 0;
        return sum + duration;
      }, 0));
      const averageDaily = exerciseCount / 7;

      // Find most frequent exercise with error handling
      let mostFrequentExercise: string | undefined;
      try {
        const exerciseFrequency = new Map<string, number>();
        currentWeekExercises.forEach(exercise => {
          if (exercise.name && typeof exercise.name === 'string') {
            const count = exerciseFrequency.get(exercise.name) || 0;
            exerciseFrequency.set(exercise.name, count + 1);
          }
        });

        let maxCount = 0;
        exerciseFrequency.forEach((count, exerciseName) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentExercise = exerciseName;
          }
        });
      } catch (error) {
        console.warn("Error calculating most frequent exercise:", error);
      }

      // Compare to previous week with error handling
      const previousWeekCount = Math.max(0, previousWeekExercises.length);
      let comparedToPreviousWeek: 'above' | 'below' | 'same' = 'same';
      
      try {
        if (exerciseCount > previousWeekCount) {
          comparedToPreviousWeek = 'above';
        } else if (exerciseCount < previousWeekCount) {
          comparedToPreviousWeek = 'below';
        }
      } catch (error) {
        console.warn("Error comparing to previous week:", error);
      }

      return {
        exerciseCount,
        totalDuration,
        averageDaily,
        comparedToPreviousWeek,
        ...(mostFrequentExercise && { mostFrequentExercise }),
      };
    } catch (error) {
      console.error("Error calculating weekly stats:", error);
      // Return safe default values on error
      return {
        exerciseCount: 0,
        totalDuration: 0,
        averageDaily: 0,
        comparedToPreviousWeek: 'same',
      };
    }
  }

  /**
   * Get the most recent exercise records
   * @param limit - Maximum number of exercises to return (3-5)
   * @returns Promise resolving to array of recent exercise records
   */
  async getRecentExercises(limit: number = 5): Promise<Exercise_Record[]> {
    try {
      // Ensure limit is between 3 and 5
      const safeLimit = Math.max(3, Math.min(5, limit));
      
      // Get all exercises with timeout protection
      const allExercises = await Promise.race([
        this.storageManager.getAllExerciseRecords(),
        new Promise<Exercise_Record[]>((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )
      ]);
      
      // Filter and validate exercises
      const validExercises = allExercises.filter(exercise => {
        return exercise && 
               exercise.startTime instanceof Date && 
               !isNaN(exercise.startTime.getTime()) &&
               exercise.name && 
               typeof exercise.name === 'string' &&
               typeof exercise.duration === 'number' &&
               exercise.duration >= 0;
      });
      
      // Sort by start time (most recent first) and limit results
      return validExercises
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        .slice(0, safeLimit);
    } catch (error) {
      console.error("Error getting recent exercises:", error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Generate exercise recommendations based on user's exercise history
   * @returns Promise resolving to array of 2 exercise recommendations
   */
  async getExerciseRecommendations(): Promise<ExerciseRecommendation[]> {
    try {
      // Get all exercises with timeout protection
      const allExercises = await Promise.race([
        this.storageManager.getAllExerciseRecords(),
        new Promise<Exercise_Record[]>((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )
      ]);
      
      if (allExercises.length === 0) {
        // New user - provide popular exercise suggestions
        return this.getPopularExerciseRecommendations();
      }

      const recommendations = this.calculateRecommendations(allExercises);
      
      // If we don't have enough recommendations from user history, supplement with popular exercises
      if (recommendations.length < 2) {
        const popularRecs = this.getPopularExerciseRecommendations();
        const existingNames = new Set(recommendations.map(r => r.exerciseName));
        
        for (const popular of popularRecs) {
          if (!existingNames.has(popular.exerciseName) && recommendations.length < 2) {
            recommendations.push(popular);
          }
        }
      }

      return recommendations.slice(0, 2); // Always return exactly 2 recommendations
    } catch (error) {
      console.error("Error generating recommendations:", error);
      // Return popular exercises as fallback
      return this.getPopularExerciseRecommendations();
    }
  }

  /**
   * Calculate exercise recommendations based on user's exercise patterns
   * @param exercises - All user exercise records
   * @returns Array of exercise recommendations
   */
  private calculateRecommendations(exercises: Exercise_Record[]): ExerciseRecommendation[] {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get unique exercise names and their last performed dates
    const exerciseMap = new Map<string, Date>();
    
    exercises.forEach(exercise => {
      const existingDate = exerciseMap.get(exercise.name);
      if (!existingDate || exercise.startTime > existingDate) {
        exerciseMap.set(exercise.name, exercise.startTime);
      }
    });

    // Find exercises not performed in the last 7 days
    const recommendations: ExerciseRecommendation[] = [];
    
    exerciseMap.forEach((lastPerformed, exerciseName) => {
      if (lastPerformed < sevenDaysAgo) {
        const daysSince = Math.floor((now.getTime() - lastPerformed.getTime()) / (24 * 60 * 60 * 1000));
        
        recommendations.push({
          exerciseName,
          lastPerformed,
          daysSinceLastPerformed: daysSince,
          description: `You haven't done ${exerciseName} in ${daysSince} days. Time to get back to it!`,
        });
      }
    });

    // Sort by days since last performed (longest first)
    return recommendations.sort((a, b) => b.daysSinceLastPerformed - a.daysSinceLastPerformed);
  }

  /**
   * Get popular exercise recommendations for new users
   * @returns Array of 2 popular exercise recommendations
   */
  private getPopularExerciseRecommendations(): ExerciseRecommendation[] {
    // Return first 2 popular exercises
    return POPULAR_EXERCISES.slice(0, 2).map(exercise => ({
      exerciseName: exercise.name,
      daysSinceLastPerformed: 0,
      description: exercise.description,
    }));
  }

  /**
   * Get the start of the week (Monday) for a given date
   * @param date - The date to find the week start for
   * @returns Date representing the start of the week
   */
  private getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Get cached data if it exists and is still valid
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (!this.isCacheValid(cached.timestamp)) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Store data in cache with timestamp
   * @param key - Cache key
   * @param data - Data to cache
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Enhanced cache clearing that also clears performance caches
   */
  public clearCache(): void {
    this.cache.clear();
    this.precomputedCache.clear();
    this.optimisticUpdates.clear();
    this.pendingRequests.clear();
  }

  /**
   * Invalidate cache for a specific date
   * @param date - Date to invalidate cache for
   */
  public invalidateCacheForDate(date: Date): void {
    const cacheKey = `dashboard_${date.toDateString()}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Add a listener for data refresh events
   * @param listener - Function to call when data should be refreshed
   */
  public addRefreshListener(listener: () => void): void {
    this.refreshListeners.add(listener);
  }

  /**
   * Remove a refresh listener
   * @param listener - Function to remove from listeners
   */
  public removeRefreshListener(listener: () => void): void {
    this.refreshListeners.delete(listener);
  }

  /**
   * Enhanced data update notification with performance optimizations
   */
  public notifyDataUpdate(): void {
    this.lastDataUpdate = new Date();
    
    // Clear all caches to force fresh data
    this.clearCache();
    
    // Trigger immediate precomputation for next access
    setTimeout(() => this.precomputeDashboardData(), 100);
    
    // Notify all listeners to refresh their data
    this.refreshListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in refresh listener:', error);
      }
    });
  }

  /**
   * Get the timestamp of the last data update
   * @returns Date of last data update
   */
  public getLastDataUpdate(): Date {
    return this.lastDataUpdate;
  }

  /**
   * Force refresh of dashboard data by clearing cache and notifying listeners
   * This is useful for manual refresh operations
   */
  public forceRefresh(): void {
    this.clearCache();
    this.notifyDataUpdate();
  }

  /**
   * Check if cached data is still valid based on last data update
   * @param cacheTimestamp - Timestamp of cached data
   * @returns True if cache is still valid
   */
  private isCacheValid(cacheTimestamp: Date): boolean {
    const now = new Date();
    const age = now.getTime() - cacheTimestamp.getTime();
    
    // Cache is invalid if it's older than the cache duration OR older than the last data update
    return age <= this.CACHE_DURATION_MS && cacheTimestamp >= this.lastDataUpdate;
  }

  /**
   * Get stale cached data (ignoring expiration) for fallback purposes
   * @param key - Cache key
   * @returns Stale cached data or null if not found
   */
  private getStaleCache(key: string): any | null {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  /**
   * Get empty dashboard data structure for fallback when no data is available
   * @returns Empty dashboard data with default values
   */
  private getEmptyDashboardData(): DashboardData {
    return {
      dailyStats: {
        exerciseCount: 0,
        totalDuration: 0,
      },
      weeklyStats: {
        exerciseCount: 0,
        totalDuration: 0,
        averageDaily: 0,
        comparedToPreviousWeek: 'same',
      },
      recentExercises: [],
      recommendations: this.getPopularExerciseRecommendations(),
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // PERFORMANCE OPTIMIZATION METHODS
  // ============================================================================

  /**
   * Start background precomputation of dashboard data for improved performance
   * This runs periodically to ensure fresh data is always available
   */
  private startBackgroundPrecomputation(): void {
    // Clear any existing timer
    if (this.precomputeTimer) {
      clearInterval(this.precomputeTimer);
    }

    // Start periodic precomputation
    this.precomputeTimer = setInterval(async () => {
      try {
        await this.precomputeDashboardData();
      } catch (error) {
        console.warn('Background precomputation failed:', error);
      }
    }, this.PRECOMPUTE_INTERVAL_MS);

    // Also precompute immediately
    setTimeout(() => this.precomputeDashboardData(), 1000);
  }

  /**
   * Precompute dashboard data in the background for faster access
   */
  private async precomputeDashboardData(): Promise<void> {
    const now = new Date();
    const cacheKey = `precomputed_${now.toDateString()}`;

    try {
      // Only precompute if we don't have recent precomputed data
      const existing = this.precomputedCache.get(cacheKey);
      if (existing && this.isCacheValid(existing.timestamp)) {
        return;
      }

      // Precompute all dashboard data
      const dashboardData = await this.getDashboardDataInternal();
      
      // Store in precomputed cache
      this.precomputedCache.set(cacheKey, {
        data: dashboardData,
        timestamp: now,
      });

      // Clean up old precomputed entries
      this.cleanupPrecomputedCache();
    } catch (error) {
      console.warn('Failed to precompute dashboard data:', error);
    }
  }

  /**
   * Internal method to get dashboard data without caching/deduplication
   * @returns Promise resolving to complete dashboard data
   */
  private async getDashboardDataInternal(): Promise<DashboardData> {
    try {
      // Get all data in parallel for better performance
      const [dailyStats, weeklyStats, recentExercises, recommendations] = await Promise.all([
        this.getDailyStats(new Date()),
        this.getWeeklyStats(this.getWeekStart(new Date())),
        this.getRecentExercises(5),
        this.getExerciseRecommendations(),
      ]);

      const dashboardData: DashboardData = {
        dailyStats,
        weeklyStats,
        recentExercises,
        recommendations,
        lastUpdated: new Date(),
      };
      
      return dashboardData;
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      
      // Try to return stale cached data as fallback
      const now = new Date();
      const cacheKey = `dashboard_${now.toDateString()}`;
      const staleCache = this.getStaleCache(cacheKey);
      if (staleCache) {
        console.log("Returning stale cached data due to error");
        return staleCache;
      }
      
      // If no cache available, return empty dashboard data
      console.log("No cached data available, returning empty dashboard");
      return this.getEmptyDashboardData();
    }
  }

  /**
   * Add optimistic update for immediate UI feedback
   * @param exerciseRecord - The exercise record that was added
   */
  public addOptimisticUpdate(exerciseRecord: Exercise_Record): void {
    const now = new Date();
    const cacheKey = `dashboard_${now.toDateString()}`;
    
    // Get current dashboard data
    const currentData = this.getCachedData(cacheKey) || this.getEmptyDashboardData();
    
    // Create optimistic update
    const optimisticData: DashboardData = {
      ...currentData,
      dailyStats: {
        ...currentData.dailyStats,
        exerciseCount: currentData.dailyStats.exerciseCount + 1,
        totalDuration: currentData.dailyStats.totalDuration + exerciseRecord.duration,
        lastExerciseTime: exerciseRecord.startTime,
        lastExerciseName: exerciseRecord.name,
      },
      recentExercises: [exerciseRecord, ...currentData.recentExercises.slice(0, 4)],
      lastUpdated: now,
    };

    // Store optimistic update
    this.optimisticUpdates.set(cacheKey, optimisticData);
    
    // Clear optimistic update after a short delay
    setTimeout(() => {
      this.optimisticUpdates.delete(cacheKey);
    }, 3000);
  }

  /**
   * Clean up old precomputed cache entries to prevent memory leaks
   */
  private cleanupPrecomputedCache(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, entry] of this.precomputedCache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      if (age > maxAge) {
        this.precomputedCache.delete(key);
      }
    }
  }

  /**
   * Get performance metrics for monitoring
   * @returns Object containing performance metrics
   */
  public getPerformanceMetrics(): {
    cacheSize: number;
    precomputedCacheSize: number;
    pendingRequestsCount: number;
    optimisticUpdatesCount: number;
    lastDataUpdate: Date;
  } {
    return {
      cacheSize: this.cache.size,
      precomputedCacheSize: this.precomputedCache.size,
      pendingRequestsCount: this.pendingRequests.size,
      optimisticUpdatesCount: this.optimisticUpdates.size,
      lastDataUpdate: this.lastDataUpdate,
    };
  }

  /**
   * Cleanup method to be called when service is no longer needed
   */
  public cleanup(): void {
    if (this.precomputeTimer) {
      clearInterval(this.precomputeTimer);
      this.precomputeTimer = null;
    }
    
    this.clearCache();
    this.refreshListeners.clear();
  }
}