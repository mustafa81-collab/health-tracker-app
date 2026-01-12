// Duplicate detection service for preventing duplicate entries during sync
// Requirements: 8.5

import { Exercise_Record, DataSource } from "@/types";

export interface DuplicateMatch {
  existingRecord: Exercise_Record;
  incomingRecord: Exercise_Record;
  matchScore: number;
  matchReasons: string[];
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  confidence: number;
}

export interface DuplicateDetectionOptions {
  timeToleranceMinutes: number;
  nameMatchThreshold: number;
  durationToleranceMinutes: number;
  strictMatching: boolean;
}

export class DuplicateDetectionService {
  private defaultOptions: DuplicateDetectionOptions = {
    timeToleranceMinutes: 5, // Allow 5-minute difference in start times
    nameMatchThreshold: 0.8, // 80% similarity for exercise names
    durationToleranceMinutes: 2, // Allow 2-minute difference in duration
    strictMatching: false, // Allow fuzzy matching by default
  };

  /**
   * Detect if an incoming record is a duplicate of existing records
   */
  detectDuplicates(
    incomingRecord: Exercise_Record,
    existingRecords: Exercise_Record[],
    options: Partial<DuplicateDetectionOptions> = {}
  ): DuplicateDetectionResult {
    const opts = { ...this.defaultOptions, ...options };
    const matches: DuplicateMatch[] = [];

    for (const existingRecord of existingRecords) {
      const match = this.compareRecords(incomingRecord, existingRecord, opts);
      if (match.matchScore > 0.7) {
        // 70% match threshold
        matches.push(match);
      }
    }

    // Sort matches by score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const isDuplicate = matches.length > 0 && matches[0]!.matchScore > 0.85; // 85% confidence threshold
    const confidence = matches.length > 0 ? matches[0]!.matchScore : 0;

    return {
      isDuplicate,
      matches,
      confidence,
    };
  }

  /**
   * Compare two exercise records for similarity
   */
  private compareRecords(
    incomingRecord: Exercise_Record,
    existingRecord: Exercise_Record,
    options: DuplicateDetectionOptions
  ): DuplicateMatch {
    const matchReasons: string[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Time comparison (most important factor)
    const timeScore = this.compareStartTimes(
      incomingRecord.startTime,
      existingRecord.startTime,
      options.timeToleranceMinutes
    );
    totalScore += timeScore * 0.4; // 40% weight
    maxScore += 0.4;

    if (timeScore > 0.8) {
      matchReasons.push(
        `Start times within ${options.timeToleranceMinutes} minutes`
      );
    }

    // Exercise name comparison
    const nameScore = this.compareExerciseNames(
      incomingRecord.name,
      existingRecord.name,
      options.nameMatchThreshold
    );
    totalScore += nameScore * 0.3; // 30% weight
    maxScore += 0.3;

    if (nameScore > options.nameMatchThreshold) {
      matchReasons.push(
        `Exercise names are similar (${Math.round(nameScore * 100)}% match)`
      );
    }

    // Duration comparison
    const durationScore = this.compareDurations(
      incomingRecord.duration,
      existingRecord.duration,
      options.durationToleranceMinutes
    );
    totalScore += durationScore * 0.2; // 20% weight
    maxScore += 0.2;

    if (durationScore > 0.8) {
      matchReasons.push(
        `Durations within ${options.durationToleranceMinutes} minutes`
      );
    }

    // Source type consideration (bonus points for cross-platform matches)
    if (incomingRecord.source !== existingRecord.source) {
      totalScore += 0.1; // 10% bonus for cross-platform matches
      maxScore += 0.1;
      matchReasons.push("Cross-platform match (manual vs synced)");
    }

    const matchScore = maxScore > 0 ? totalScore / maxScore : 0;

    return {
      existingRecord,
      incomingRecord,
      matchScore,
      matchReasons,
    };
  }

  /**
   * Compare start times with tolerance
   */
  private compareStartTimes(
    time1: Date,
    time2: Date,
    toleranceMinutes: number
  ): number {
    const diffMinutes =
      Math.abs(time1.getTime() - time2.getTime()) / (1000 * 60);

    if (diffMinutes === 0) {
      return 1.0;
    }
    if (diffMinutes <= toleranceMinutes) {
      return Math.max(0, 1 - diffMinutes / toleranceMinutes);
    }

    return 0;
  }

  /**
   * Compare exercise names using fuzzy matching
   */
  private compareExerciseNames(
    name1: string,
    name2: string,
    threshold: number
  ): number {
    const normalized1 = this.normalizeExerciseName(name1);
    const normalized2 = this.normalizeExerciseName(name2);

    // Exact match
    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Handle very short names - if either normalized name is too short, use original names
    if (normalized1.length < 2 || normalized2.length < 2) {
      const originalSimilarity = this.calculateStringSimilarity(
        name1.toLowerCase().trim(),
        name2.toLowerCase().trim()
      );
      return originalSimilarity >= threshold ? originalSimilarity : 0;
    }

    // Levenshtein distance-based similarity
    const similarity = this.calculateStringSimilarity(normalized1, normalized2);

    return similarity >= threshold ? similarity : 0;
  }

  /**
   * Normalize exercise name for comparison
   */
  private normalizeExerciseName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\b(workout|exercise|training|session)\b/g, "") // Remove common words
      .trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) {
      return len2 === 0 ? 1 : 0;
    }
    if (len2 === 0) {
      return 0;
    }

    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1, // deletion
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j - 1]! + cost // substitution
        );
      }
    }

    const distance = matrix[len1]![len2]!;
    const maxLength = Math.max(len1, len2);

    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Compare durations with tolerance
   */
  private compareDurations(
    duration1: number,
    duration2: number,
    toleranceMinutes: number
  ): number {
    const diffMinutes = Math.abs(duration1 - duration2);

    if (diffMinutes === 0) {
      return 1.0;
    }
    if (diffMinutes <= toleranceMinutes) {
      return Math.max(0, 1 - diffMinutes / toleranceMinutes);
    }

    return 0;
  }

  /**
   * Filter out duplicates from a list of incoming records
   */
  filterDuplicates(
    incomingRecords: Exercise_Record[],
    existingRecords: Exercise_Record[],
    options: Partial<DuplicateDetectionOptions> = {}
  ): {
    uniqueRecords: Exercise_Record[];
    duplicates: DuplicateMatch[];
    summary: {
      total: number;
      unique: number;
      duplicatesFound: number;
    };
  } {
    const uniqueRecords: Exercise_Record[] = [];
    const duplicates: DuplicateMatch[] = [];

    for (const incomingRecord of incomingRecords) {
      const result = this.detectDuplicates(
        incomingRecord,
        existingRecords,
        options
      );

      if (result.isDuplicate) {
        duplicates.push(...result.matches);
      } else {
        uniqueRecords.push(incomingRecord);
        // Add to existing records for subsequent comparisons
        existingRecords.push(incomingRecord);
      }
    }

    return {
      uniqueRecords,
      duplicates,
      summary: {
        total: incomingRecords.length,
        unique: uniqueRecords.length,
        duplicatesFound: duplicates.length,
      },
    };
  }

  /**
   * Get duplicate detection statistics
   */
  getDetectionStatistics(matches: DuplicateMatch[]): {
    averageConfidence: number;
    highConfidenceMatches: number;
    commonReasons: { reason: string; count: number }[];
  } {
    if (matches.length === 0) {
      return {
        averageConfidence: 0,
        highConfidenceMatches: 0,
        commonReasons: [],
      };
    }

    const averageConfidence =
      matches.reduce((sum, match) => sum + match.matchScore, 0) /
      matches.length;
    const highConfidenceMatches = matches.filter(
      (match) => match.matchScore > 0.9
    ).length;

    // Count common reasons
    const reasonCounts = new Map<string, number>();
    matches.forEach((match) => {
      match.matchReasons.forEach((reason) => {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      });
    });

    const commonReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 reasons

    return {
      averageConfidence,
      highConfidenceMatches,
      commonReasons,
    };
  }

  /**
   * Create duplicate detection options for different scenarios
   */
  static createOptionsForScenario(
    scenario: "strict" | "normal" | "lenient"
  ): DuplicateDetectionOptions {
    switch (scenario) {
      case "strict":
        return {
          timeToleranceMinutes: 2,
          nameMatchThreshold: 0.9,
          durationToleranceMinutes: 1,
          strictMatching: true,
        };

      case "lenient":
        return {
          timeToleranceMinutes: 10,
          nameMatchThreshold: 0.6,
          durationToleranceMinutes: 5,
          strictMatching: false,
        };

      case "normal":
      default:
        return {
          timeToleranceMinutes: 5,
          nameMatchThreshold: 0.8,
          durationToleranceMinutes: 2,
          strictMatching: false,
        };
    }
  }
}
