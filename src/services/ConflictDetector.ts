/**
 * Conflict Detection Service
 * 
 * Sophisticated service for detecting conflicts between manual and synchronized exercise data.
 * This service provides:
 * 
 * - Time overlap detection with configurable thresholds
 * - Exercise similarity analysis using multiple algorithms
 * - Conflict type classification for appropriate resolution strategies
 * - Statistical analysis of conflict patterns
 * - Performance-optimized detection algorithms
 * 
 * The service uses advanced algorithms including:
 * - Levenshtein distance for name similarity
 * - Normalized exercise name comparison
 * - Duration similarity analysis
 * - Time overlap calculation with buffer zones
 * 
 * Requirements addressed:
 * - Conflict detection (4.1, 4.2)
 * - Data source comparison (3.1, 3.2)
 * - Intelligent conflict classification (4.3)
 */

import {
  Exercise_Record,
  Conflict,
  ConflictType,
  OverlapResult,
  DataSource,
} from "@/types";
import { CONFLICT_DETECTION } from "@/utils/constants";

/**
 * Comprehensive conflict analysis result
 * 
 * Provides detailed information about detected conflicts including
 * statistical breakdowns and categorization by conflict type.
 */
export interface ConflictAnalysis {
  conflicts: Conflict[];                              // All detected conflicts
  totalRecordsAnalyzed: number;                      // Total records processed
  manualRecordsCount: number;                        // Count of manual records
  syncedRecordsCount: number;                        // Count of synced records
  conflictsByType: Record<ConflictType, number>;     // Conflicts grouped by type
}

/**
 * Conflict Detection Service
 * 
 * Implements sophisticated algorithms for detecting conflicts between
 * manual and synchronized exercise data with high accuracy and performance.
 */
export class ConflictDetector {
  /**
   * Detect conflicts between manual and synced records
   * 
   * This method performs comprehensive conflict analysis by:
   * 1. Separating records by data source
   * 2. Comparing each manual record against each synced record
   * 3. Analyzing time overlaps and exercise similarities
   * 4. Classifying conflicts by type for appropriate resolution
   * 
   * @param records - Array of all exercise records to analyze
   * @returns Detailed conflict analysis with statistics
   */
  detectConflicts(records: Exercise_Record[]): ConflictAnalysis {
    const manualRecords = records.filter((r) => r.source === DataSource.MANUAL);
    const syncedRecords = records.filter((r) => r.source === DataSource.SYNCED);

    const conflicts: Conflict[] = [];
    const conflictsByType: Record<ConflictType, number> = {
      [ConflictType.TIME_OVERLAP]: 0,
      [ConflictType.DUPLICATE_EXERCISE]: 0,
      [ConflictType.CONFLICTING_DATA]: 0,
    };

    // Perform pairwise comparison between manual and synced records
    for (const manualRecord of manualRecords) {
      for (const syncedRecord of syncedRecords) {
        const conflict = this.analyzeRecordPair(manualRecord, syncedRecord);
        if (conflict) {
          conflicts.push(conflict);
          conflictsByType[conflict.conflictType]++;
        }
      }
    }

    return {
      conflicts,
      totalRecordsAnalyzed: records.length,
      manualRecordsCount: manualRecords.length,
      syncedRecordsCount: syncedRecords.length,
      conflictsByType,
    };
  }

  /**
   * Analyze a pair of records for potential conflicts
   * 
   * Performs detailed analysis including:
   * - Time overlap calculation
   * - Exercise similarity assessment
   * - Conflict type determination
   * 
   * @param manualRecord - Manual exercise record
   * @param syncedRecord - Synchronized exercise record
   * @returns Conflict object if conflict detected, null otherwise
   */
  private analyzeRecordPair(
    manualRecord: Exercise_Record,
    syncedRecord: Exercise_Record
  ): Conflict | null {
    // Check for time overlap first (most common conflict indicator)
    const overlapResult = this.calculateTimeOverlap(manualRecord, syncedRecord);

    if (overlapResult.hasOverlap) {
      // Determine specific conflict type based on overlap and similarity
      const conflictType = this.determineConflictType(
        manualRecord,
        syncedRecord,
        overlapResult
      );

      return {
        id: this.generateConflictId(manualRecord, syncedRecord),
        manualRecord,
        syncedRecord,
        overlapDuration: overlapResult.overlapDuration,
        conflictType,
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Calculate time overlap between two exercise records
   * 
   * Uses precise time calculations to determine if and how much
   * two exercises overlap in time, considering configurable thresholds.
   * 
   * @param record1 - First exercise record
   * @param record2 - Second exercise record
   * @returns Detailed overlap analysis result
   */
  calculateTimeOverlap(
    record1: Exercise_Record,
    record2: Exercise_Record
  ): OverlapResult {
    // Calculate end times for both exercises
    const start1 = record1.startTime;
    const end1 = new Date(start1.getTime() + record1.duration * 60 * 1000);

    const start2 = record2.startTime;
    const end2 = new Date(start2.getTime() + record2.duration * 60 * 1000);

    // Calculate overlap period
    const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    if (overlapStart < overlapEnd) {
      const overlapDurationMs = overlapEnd.getTime() - overlapStart.getTime();
      const overlapDurationMinutes = Math.round(
        overlapDurationMs / (60 * 1000)
      );

      // Only consider it an overlap if it meets the minimum threshold
      if (
        overlapDurationMinutes >= CONFLICT_DETECTION.OVERLAP_THRESHOLD_MINUTES
      ) {
        return {
          hasOverlap: true,
          overlapDuration: overlapDurationMinutes,
          overlapStart,
          overlapEnd,
        };
      }
    }

    return {
      hasOverlap: false,
      overlapDuration: 0,
      overlapStart: new Date(),
      overlapEnd: new Date(),
    };
  }

  /**
   * Determine the type of conflict based on record similarity and overlap
   */
  private determineConflictType(
    manualRecord: Exercise_Record,
    syncedRecord: Exercise_Record,
    overlapResult: OverlapResult
  ): ConflictType {
    // Check if exercises are similar (likely the same exercise)
    const nameSimilarity = this.calculateNameSimilarity(
      manualRecord.name,
      syncedRecord.name
    );
    const durationSimilarity = this.calculateDurationSimilarity(
      manualRecord.duration,
      syncedRecord.duration
    );

    // Check if both names contain common exercise terms
    const commonTerms = [
      "running",
      "walking",
      "cycling",
      "swimming",
      "workout",
      "exercise",
    ];
    const manualNormalized = this.normalizeExerciseName(manualRecord.name);
    const syncedNormalized = this.normalizeExerciseName(syncedRecord.name);

    const hasCommonTerm = commonTerms.some(
      (term) =>
        manualNormalized.includes(term) && syncedNormalized.includes(term)
    );

    // If names are very similar and durations are close, likely a duplicate
    if (
      nameSimilarity >= CONFLICT_DETECTION.SIMILARITY_THRESHOLD &&
      durationSimilarity >= 0.8
    ) {
      return ConflictType.DUPLICATE_EXERCISE;
    }

    // If both names contain the same exercise term and durations are very similar, likely duplicate
    if (hasCommonTerm && durationSimilarity >= 0.8) {
      return ConflictType.DUPLICATE_EXERCISE;
    }

    // If durations are very similar (even if names differ), could be duplicate
    if (
      durationSimilarity >= 0.9 &&
      overlapResult.overlapDuration >=
        Math.min(manualRecord.duration, syncedRecord.duration) * 0.8
    ) {
      return ConflictType.DUPLICATE_EXERCISE;
    }

    // If there's significant overlap but exercises are different, it's conflicting data
    if (
      overlapResult.overlapDuration >
      Math.min(manualRecord.duration, syncedRecord.duration) * 0.5
    ) {
      return ConflictType.CONFLICTING_DATA;
    }

    // Default to time overlap
    return ConflictType.TIME_OVERLAP;
  }

  /**
   * Calculate similarity between two exercise names
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalized1 = this.normalizeExerciseName(name1);
    const normalized2 = this.normalizeExerciseName(name2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    if (maxLength === 0) {
      return 1.0;
    }

    return 1 - distance / maxLength;
  }

  /**
   * Calculate similarity between two durations
   */
  private calculateDurationSimilarity(
    duration1: number,
    duration2: number
  ): number {
    const maxDuration = Math.max(duration1, duration2);
    const minDuration = Math.min(duration1, duration2);

    if (maxDuration === 0) {
      return 1.0;
    }

    return minDuration / maxDuration;
  }

  /**
   * Normalize exercise name for comparison
   */
  private normalizeExerciseName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\b(running|run|jog|jogging)\b/g, "running") // Normalize running variants
      .replace(/\b(walking|walk)\b/g, "walking") // Normalize walking variants
      .replace(/\b(cycling|bike|biking|bicycle)\b/g, "cycling") // Normalize cycling variants
      .replace(/\b(swimming|swim)\b/g, "swimming") // Normalize swimming variants
      .replace(/\b(workout|exercise|training)\b/g, "workout"); // Normalize workout variants
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const currentRow = matrix[j];
        const prevRow = matrix[j - 1];

        if (currentRow && prevRow) {
          currentRow[i] = Math.min(
            (currentRow[i - 1] || 0) + 1, // deletion
            (prevRow[i] || 0) + 1, // insertion
            (prevRow[i - 1] || 0) + indicator // substitution
          );
        }
      }
    }

    return matrix[str2.length]?.[str1.length] || 0;
  }

  /**
   * Generate a unique conflict ID
   */
  private generateConflictId(
    manualRecord: Exercise_Record,
    syncedRecord: Exercise_Record
  ): string {
    const timestamp = Date.now();
    const hash = this.simpleHash(`${manualRecord.id}_${syncedRecord.id}`);
    return `conflict_${timestamp}_${hash}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if a specific record pair would create a conflict
   */
  wouldConflict(record1: Exercise_Record, record2: Exercise_Record): boolean {
    if (record1.source === record2.source) {
      return false; // Same source, no conflict
    }

    const overlapResult = this.calculateTimeOverlap(record1, record2);
    return overlapResult.hasOverlap;
  }

  /**
   * Get conflicts for a specific record
   */
  getConflictsForRecord(
    targetRecord: Exercise_Record,
    allRecords: Exercise_Record[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const record of allRecords) {
      if (
        record.id === targetRecord.id ||
        record.source === targetRecord.source
      ) {
        continue; // Skip same record or same source
      }

      const conflict = this.analyzeRecordPair(
        targetRecord.source === DataSource.MANUAL ? targetRecord : record,
        targetRecord.source === DataSource.SYNCED ? targetRecord : record
      );

      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Validate conflict detection configuration
   */
  static validateConfiguration(): boolean {
    return (
      CONFLICT_DETECTION.OVERLAP_THRESHOLD_MINUTES > 0 &&
      CONFLICT_DETECTION.SIMILARITY_THRESHOLD >= 0 &&
      CONFLICT_DETECTION.SIMILARITY_THRESHOLD <= 1
    );
  }

  /**
   * Get conflict statistics for analysis
   */
  getConflictStatistics(conflicts: Conflict[]): {
    totalConflicts: number;
    averageOverlapDuration: number;
    mostCommonConflictType: ConflictType;
    conflictsByHour: Record<number, number>;
    conflictsByDay: Record<string, number>;
  } {
    if (conflicts.length === 0) {
      return {
        totalConflicts: 0,
        averageOverlapDuration: 0,
        mostCommonConflictType: ConflictType.TIME_OVERLAP,
        conflictsByHour: {},
        conflictsByDay: {},
      };
    }

    const totalOverlap = conflicts.reduce(
      (sum, c) => sum + c.overlapDuration,
      0
    );
    const averageOverlapDuration = totalOverlap / conflicts.length;

    // Count conflicts by type
    const typeCount: Record<ConflictType, number> = {
      [ConflictType.TIME_OVERLAP]: 0,
      [ConflictType.DUPLICATE_EXERCISE]: 0,
      [ConflictType.CONFLICTING_DATA]: 0,
    };

    const conflictsByHour: Record<number, number> = {};
    const conflictsByDay: Record<string, number> = {};

    for (const conflict of conflicts) {
      typeCount[conflict.conflictType]++;

      const hour = conflict.detectedAt.getHours();
      conflictsByHour[hour] = (conflictsByHour[hour] || 0) + 1;

      const day = conflict.detectedAt.toISOString().split("T")[0];
      if (day) {
        conflictsByDay[day] = (conflictsByDay[day] || 0) + 1;
      }
    }

    // Find most common conflict type
    const mostCommonConflictType = Object.entries(typeCount).reduce((a, b) =>
      typeCount[a[0] as ConflictType] > typeCount[b[0] as ConflictType] ? a : b
    )[0] as ConflictType;

    return {
      totalConflicts: conflicts.length,
      averageOverlapDuration,
      mostCommonConflictType,
      conflictsByHour,
      conflictsByDay,
    };
  }
}
