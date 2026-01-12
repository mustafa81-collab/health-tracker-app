// Service for resolving conflicts between manual and synced exercise records

import {
  Conflict,
  ConflictResolution,
  ResolutionChoice,
  Exercise_Record,
  ConflictState,
  DataSource,
  ExerciseMetadata,
} from "@/types";

export interface ConflictResolutionOptions {
  userNotes?: string;
  preserveMetadata?: boolean;
  mergeStrategy?: "prefer_manual" | "prefer_synced" | "combine_all";
}

export interface ConflictPresentationData {
  conflict: Conflict;
  manualRecordDisplay: ExerciseDisplayData;
  syncedRecordDisplay: ExerciseDisplayData;
  overlapVisualization: OverlapVisualization;
  recommendedAction: ResolutionChoice;
  reasoning: string;
}

export interface ExerciseDisplayData {
  name: string;
  startTime: string;
  endTime: string;
  duration: string;
  source: string;
  platform?: string;
  metadata: Record<string, any>;
  confidence?: number;
}

export interface OverlapVisualization {
  overlapStart: string;
  overlapEnd: string;
  overlapDuration: string;
  overlapPercentage: number;
  timelineData: TimelineSegment[];
}

export interface TimelineSegment {
  type: "manual" | "synced" | "overlap";
  startTime: string;
  endTime: string;
  label: string;
}

export interface ResolutionResult {
  success: boolean;
  resolution: ConflictResolution;
  resultingRecords: Exercise_Record[];
  error?: string;
}

export class ConflictResolver {
  /**
   * Present conflict data in a user-friendly format for resolution UI
   */
  presentConflict(conflict: Conflict): ConflictPresentationData {
    const manualDisplay = this.formatExerciseForDisplay(conflict.manualRecord);
    const syncedDisplay = this.formatExerciseForDisplay(conflict.syncedRecord);
    const overlapViz = this.createOverlapVisualization(conflict);
    const recommendation = this.recommendResolution(conflict);

    return {
      conflict,
      manualRecordDisplay: manualDisplay,
      syncedRecordDisplay: syncedDisplay,
      overlapVisualization: overlapViz,
      recommendedAction: recommendation.choice,
      reasoning: recommendation.reasoning,
    };
  }

  /**
   * Apply user's resolution choice to resolve a conflict
   */
  resolveConflict(
    conflict: Conflict,
    choice: ResolutionChoice,
    options: ConflictResolutionOptions = {}
  ): ResolutionResult {
    try {
      const beforeState: ConflictState = {
        manualRecord: conflict.manualRecord,
        syncedRecord: conflict.syncedRecord,
      };

      let resultingRecords: Exercise_Record[] = [];
      let afterState: ConflictState = {};

      switch (choice) {
        case ResolutionChoice.KEEP_MANUAL:
          resultingRecords = [conflict.manualRecord];
          afterState.manualRecord = conflict.manualRecord;
          break;

        case ResolutionChoice.KEEP_SYNCED:
          resultingRecords = [conflict.syncedRecord];
          afterState.syncedRecord = conflict.syncedRecord;
          break;

        case ResolutionChoice.MERGE_RECORDS:
          const mergedRecord = this.mergeRecords(
            conflict.manualRecord,
            conflict.syncedRecord,
            options
          );
          resultingRecords = [mergedRecord];
          afterState.mergedRecord = mergedRecord;
          break;

        case ResolutionChoice.KEEP_BOTH:
          // Adjust timing to prevent future conflicts
          const adjustedRecords = this.adjustRecordsToPreventConflict(
            conflict.manualRecord,
            conflict.syncedRecord
          );
          resultingRecords = adjustedRecords;
          if (adjustedRecords[0] && adjustedRecords[1]) {
            afterState.manualRecord = adjustedRecords[0];
            afterState.syncedRecord = adjustedRecords[1];
          }
          break;

        default:
          throw new Error(`Unknown resolution choice: ${choice}`);
      }

      const resolution: ConflictResolution = {
        id: this.generateResolutionId(conflict.id),
        conflictId: conflict.id,
        resolutionChoice: choice,
        resolvedAt: new Date(),
        beforeState,
        afterState,
        ...(options.userNotes && { userNotes: options.userNotes }),
      };

      return {
        success: true,
        resolution,
        resultingRecords,
      };
    } catch (error) {
      return {
        success: false,
        resolution: {} as ConflictResolution,
        resultingRecords: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Format exercise record for user-friendly display
   */
  private formatExerciseForDisplay(
    record: Exercise_Record
  ): ExerciseDisplayData {
    const startTime = record.startTime;
    const endTime = new Date(startTime.getTime() + record.duration * 60 * 1000);

    return {
      name: record.name,
      startTime: this.formatDateTime(startTime),
      endTime: this.formatDateTime(endTime),
      duration: this.formatDuration(record.duration),
      source:
        record.source === DataSource.MANUAL
          ? "Manual Entry"
          : "Health App Sync",
      ...(record.platform && {
        platform: this.formatPlatformName(record.platform),
      }),
      metadata: this.filterDisplayMetadata(record.metadata),
      ...(record.source === DataSource.SYNCED &&
        record.metadata.confidence !== undefined && {
          confidence: record.metadata.confidence as number,
        }),
    };
  }

  /**
   * Create visualization data for time overlap
   */
  private createOverlapVisualization(conflict: Conflict): OverlapVisualization {
    const manualStart = conflict.manualRecord.startTime;
    const manualEnd = new Date(
      manualStart.getTime() + conflict.manualRecord.duration * 60 * 1000
    );

    const syncedStart = conflict.syncedRecord.startTime;
    const syncedEnd = new Date(
      syncedStart.getTime() + conflict.syncedRecord.duration * 60 * 1000
    );

    const overlapStart = new Date(
      Math.max(manualStart.getTime(), syncedStart.getTime())
    );
    const overlapEnd = new Date(
      Math.min(manualEnd.getTime(), syncedEnd.getTime())
    );

    // Calculate overlap percentage relative to shorter exercise
    const manualDuration = conflict.manualRecord.duration;
    const syncedDuration = conflict.syncedRecord.duration;
    const shorterDuration = Math.min(manualDuration, syncedDuration);
    const overlapPercentage =
      (conflict.overlapDuration / shorterDuration) * 100;

    // Create timeline segments
    const timelineData: TimelineSegment[] = [];

    // Sort all time points
    const timePoints = [
      { time: manualStart, type: "manual_start" },
      { time: manualEnd, type: "manual_end" },
      { time: syncedStart, type: "synced_start" },
      { time: syncedEnd, type: "synced_end" },
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    // Build timeline segments
    for (let i = 0; i < timePoints.length - 1; i++) {
      const current = timePoints[i];
      const next = timePoints[i + 1];

      if (current && next) {
        const segmentStart = current.time;
        const segmentEnd = next.time;

        // Determine segment type based on which exercises are active
        const manualActive =
          segmentStart >= manualStart && segmentEnd <= manualEnd;
        const syncedActive =
          segmentStart >= syncedStart && segmentEnd <= syncedEnd;

        let segmentType: "manual" | "synced" | "overlap";
        let label: string;

        if (manualActive && syncedActive) {
          segmentType = "overlap";
          label = "Overlap";
        } else if (manualActive) {
          segmentType = "manual";
          label = "Manual Only";
        } else if (syncedActive) {
          segmentType = "synced";
          label = "Synced Only";
        } else {
          continue; // Skip gaps
        }

        timelineData.push({
          type: segmentType,
          startTime: this.formatDateTime(segmentStart),
          endTime: this.formatDateTime(segmentEnd),
          label,
        });
      }
    }

    return {
      overlapStart: this.formatDateTime(overlapStart),
      overlapEnd: this.formatDateTime(overlapEnd),
      overlapDuration: this.formatDuration(conflict.overlapDuration),
      overlapPercentage: Math.round(overlapPercentage),
      timelineData,
    };
  }

  /**
   * Recommend the best resolution choice based on conflict analysis
   */
  private recommendResolution(conflict: Conflict): {
    choice: ResolutionChoice;
    reasoning: string;
  } {
    const manual = conflict.manualRecord;
    const synced = conflict.syncedRecord;

    // Calculate various factors for recommendation
    const overlapPercentage =
      (conflict.overlapDuration / Math.min(manual.duration, synced.duration)) *
      100;
    const nameSimilarity = this.calculateNameSimilarity(
      manual.name,
      synced.name
    );
    const durationSimilarity =
      Math.min(manual.duration, synced.duration) /
      Math.max(manual.duration, synced.duration);
    const confidence = (synced.metadata.confidence as number) || 0.5;

    // High similarity suggests duplicate exercise
    if (
      nameSimilarity > 0.8 &&
      durationSimilarity > 0.8 &&
      overlapPercentage > 80
    ) {
      if (confidence > 0.8) {
        return {
          choice: ResolutionChoice.KEEP_SYNCED,
          reasoning:
            "High confidence synced data appears to be the same exercise with more accurate timing",
        };
      } else {
        return {
          choice: ResolutionChoice.KEEP_MANUAL,
          reasoning:
            "Manual entry is likely more accurate than low-confidence synced data",
        };
      }
    }

    // Partial overlap suggests different exercises
    if (overlapPercentage < 50 && nameSimilarity < 0.6) {
      return {
        choice: ResolutionChoice.KEEP_BOTH,
        reasoning:
          "Different exercises with minor time overlap - both should be preserved",
      };
    }

    // Significant overlap with different exercises suggests timing conflict
    if (overlapPercentage > 50 && nameSimilarity < 0.6) {
      return {
        choice: ResolutionChoice.MERGE_RECORDS,
        reasoning:
          "Significant time overlap suggests these may be parts of the same workout session",
      };
    }

    // Default to keeping manual entry
    return {
      choice: ResolutionChoice.KEEP_MANUAL,
      reasoning: "Manual entries are generally more reliable when in doubt",
    };
  }

  /**
   * Merge two exercise records based on specified strategy
   */
  private mergeRecords(
    manualRecord: Exercise_Record,
    syncedRecord: Exercise_Record,
    options: ConflictResolutionOptions
  ): Exercise_Record {
    const strategy = options.mergeStrategy || "prefer_manual";

    let baseRecord: Exercise_Record;
    let supplementRecord: Exercise_Record;

    if (strategy === "prefer_synced") {
      baseRecord = syncedRecord;
      supplementRecord = manualRecord;
    } else {
      baseRecord = manualRecord;
      supplementRecord = syncedRecord;
    }

    // Determine merged timing (use the broader time range)
    const manualStart = manualRecord.startTime;
    const manualEnd = new Date(
      manualStart.getTime() + manualRecord.duration * 60 * 1000
    );

    const syncedStart = syncedRecord.startTime;
    const syncedEnd = new Date(
      syncedStart.getTime() + syncedRecord.duration * 60 * 1000
    );

    const mergedStart = new Date(
      Math.min(manualStart.getTime(), syncedStart.getTime())
    );
    const mergedEnd = new Date(
      Math.max(manualEnd.getTime(), syncedEnd.getTime())
    );
    const mergedDuration = Math.round(
      (mergedEnd.getTime() - mergedStart.getTime()) / (60 * 1000)
    );

    // Merge metadata
    const mergedMetadata: ExerciseMetadata = { ...baseRecord.metadata };

    if (options.preserveMetadata || strategy === "combine_all") {
      // Combine metadata from both records
      Object.entries(supplementRecord.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key in mergedMetadata) {
            // Handle conflicts in metadata
            mergedMetadata[`${key}_alt`] = value;
          } else {
            mergedMetadata[key] = value;
          }
        }
      });
    }

    // Add merge information to metadata
    mergedMetadata.mergedFrom = [manualRecord.id, syncedRecord.id];
    mergedMetadata.mergeStrategy = strategy;
    mergedMetadata.mergedAt = new Date();

    return {
      id: this.generateMergedRecordId(manualRecord.id, syncedRecord.id),
      name: baseRecord.name,
      startTime: mergedStart,
      duration: mergedDuration,
      source: DataSource.MANUAL, // Merged records are treated as manual
      metadata: mergedMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Adjust record timing to prevent future conflicts while preserving both
   */
  private adjustRecordsToPreventConflict(
    manualRecord: Exercise_Record,
    syncedRecord: Exercise_Record
  ): Exercise_Record[] {
    // Create copies to avoid modifying originals
    const adjustedManual = { ...manualRecord };
    const adjustedSynced = { ...syncedRecord };

    // Add metadata to indicate adjustment
    adjustedManual.metadata = {
      ...adjustedManual.metadata,
      adjustedForConflict: true,
      originalConflictWith: syncedRecord.id,
      adjustedAt: new Date(),
    };

    adjustedSynced.metadata = {
      ...adjustedSynced.metadata,
      adjustedForConflict: true,
      originalConflictWith: manualRecord.id,
      adjustedAt: new Date(),
    };

    // Adjust timing to eliminate overlap
    // Strategy: Move the synced record to start after the manual record ends
    const manualEndTime = new Date(
      manualRecord.startTime.getTime() + manualRecord.duration * 60 * 1000
    );

    // Add a 5-minute buffer to ensure no overlap
    const bufferMinutes = 5;
    const newSyncedStartTime = new Date(
      manualEndTime.getTime() + bufferMinutes * 60 * 1000
    );

    adjustedSynced.startTime = newSyncedStartTime;

    return [adjustedManual, adjustedSynced];
  }

  /**
   * Calculate similarity between exercise names
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalized1 = name1.toLowerCase().trim();
    const normalized2 = name2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Simple similarity based on common words
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }

  /**
   * Format date and time for display
   */
  private formatDateTime(date: Date): string {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  /**
   * Format duration for display
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} hr`;
    }

    return `${hours} hr ${remainingMinutes} min`;
  }

  /**
   * Format platform name for display
   */
  private formatPlatformName(platform: string): string {
    switch (platform) {
      case "apple_healthkit":
        return "Apple Health";
      case "google_health_connect":
        return "Google Health Connect";
      default:
        return platform;
    }
  }

  /**
   * Filter metadata for user display (remove technical fields)
   */
  private filterDisplayMetadata(
    metadata: ExerciseMetadata
  ): Record<string, any> {
    const displayMetadata: Record<string, any> = {};

    // Include user-friendly metadata fields
    const displayFields = [
      "calories",
      "heartRate",
      "steps",
      "estimatedDistance",
      "workoutType",
      "notes",
    ];

    displayFields.forEach((field) => {
      if (metadata[field] !== undefined && metadata[field] !== null) {
        displayMetadata[field] = metadata[field];
      }
    });

    return displayMetadata;
  }

  /**
   * Generate unique resolution ID
   */
  private generateResolutionId(conflictId: string): string {
    const timestamp = Date.now();
    return `resolution_${conflictId}_${timestamp}`;
  }

  /**
   * Generate unique merged record ID
   */
  private generateMergedRecordId(manualId: string, syncedId: string): string {
    const timestamp = Date.now();
    return `merged_${manualId}_${syncedId}_${timestamp}`;
  }

  /**
   * Validate resolution choice is applicable to conflict
   */
  validateResolutionChoice(
    conflict: Conflict,
    choice: ResolutionChoice
  ): { valid: boolean; reason?: string } {
    switch (choice) {
      case ResolutionChoice.KEEP_MANUAL:
      case ResolutionChoice.KEEP_SYNCED:
      case ResolutionChoice.KEEP_BOTH:
        return { valid: true };

      case ResolutionChoice.MERGE_RECORDS:
        // Merging only makes sense for similar exercises
        const nameSimilarity = this.calculateNameSimilarity(
          conflict.manualRecord.name,
          conflict.syncedRecord.name
        );

        if (nameSimilarity < 0.3) {
          return {
            valid: false,
            reason: "Exercises are too different to merge meaningfully",
          };
        }
        return { valid: true };

      default:
        return {
          valid: false,
          reason: `Unknown resolution choice: ${choice}`,
        };
    }
  }

  /**
   * Get resolution statistics for analysis
   */
  getResolutionStatistics(resolutions: ConflictResolution[]): {
    totalResolutions: number;
    resolutionsByChoice: Record<ResolutionChoice, number>;
    averageResolutionTime: number;
    mostCommonChoice: ResolutionChoice;
  } {
    if (resolutions.length === 0) {
      return {
        totalResolutions: 0,
        resolutionsByChoice: {
          [ResolutionChoice.KEEP_MANUAL]: 0,
          [ResolutionChoice.KEEP_SYNCED]: 0,
          [ResolutionChoice.MERGE_RECORDS]: 0,
          [ResolutionChoice.KEEP_BOTH]: 0,
        },
        averageResolutionTime: 0,
        mostCommonChoice: ResolutionChoice.KEEP_MANUAL,
      };
    }

    const choiceCount: Record<ResolutionChoice, number> = {
      [ResolutionChoice.KEEP_MANUAL]: 0,
      [ResolutionChoice.KEEP_SYNCED]: 0,
      [ResolutionChoice.MERGE_RECORDS]: 0,
      [ResolutionChoice.KEEP_BOTH]: 0,
    };

    let totalResolutionTime = 0;

    for (const resolution of resolutions) {
      choiceCount[resolution.resolutionChoice]++;
      // Note: In a real implementation, you'd track when conflict was detected
      // vs when it was resolved to calculate resolution time
    }

    const mostCommonChoice = Object.entries(choiceCount).reduce((a, b) =>
      choiceCount[a[0] as ResolutionChoice] >
      choiceCount[b[0] as ResolutionChoice]
        ? a
        : b
    )[0] as ResolutionChoice;

    return {
      totalResolutions: resolutions.length,
      resolutionsByChoice: choiceCount,
      averageResolutionTime: totalResolutionTime / resolutions.length,
      mostCommonChoice,
    };
  }
}
