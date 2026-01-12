// Manual Exercise Service for handling manual exercise data persistence

import { ExerciseInput, Exercise_Record, DateRange } from "@/types";
import { ExerciseLogger } from "./ExerciseLogger";
import { DataStorageManager } from "./database/DataStorageManager";

export class ManualExerciseService {
  private exerciseLogger: ExerciseLogger;
  private storageManager: DataStorageManager;

  constructor(storageManager: DataStorageManager) {
    this.storageManager = storageManager;
    this.exerciseLogger = new ExerciseLogger(storageManager);
  }

  /**
   * Save a manual exercise log with timestamp generation
   * Validates input and creates Exercise_Record with proper metadata
   */
  async saveManualExercise(
    exerciseInput: ExerciseInput
  ): Promise<Exercise_Record> {
    // Delegate to ExerciseLogger which handles validation and persistence
    return await this.exerciseLogger.saveManualLog(exerciseInput);
  }

  /**
   * Update an existing manual exercise log
   */
  async updateManualExercise(
    id: string,
    updates: Partial<ExerciseInput>
  ): Promise<Exercise_Record> {
    return await this.exerciseLogger.updateManualLog(id, updates);
  }

  /**
   * Delete a manual exercise log
   */
  async deleteManualExercise(id: string): Promise<void> {
    await this.exerciseLogger.deleteManualLog(id);
  }

  /**
   * Get manual exercise history for a date range
   */
  async getManualExerciseHistory(
    dateRange: DateRange
  ): Promise<Exercise_Record[]> {
    const allRecords = await this.storageManager.getExerciseHistory(dateRange);

    // Filter to only manual records
    return allRecords.filter((record) => record.source === "manual");
  }

  /**
   * Get a specific manual exercise record by ID
   */
  async getManualExerciseById(id: string): Promise<Exercise_Record | null> {
    const record = await this.storageManager.getRecordById(id);

    if (!record || record.source !== "manual") {
      return null;
    }

    return record;
  }

  /**
   * Validate exercise input without saving
   */
  validateExerciseInput(input: ExerciseInput) {
    return this.exerciseLogger.validateExerciseData(input);
  }

  /**
   * Get validation rules for the UI
   */
  getValidationRules() {
    return this.exerciseLogger.getValidationRules();
  }

  /**
   * Batch save multiple manual exercises (useful for imports)
   */
  async saveMultipleManualExercises(
    exercises: ExerciseInput[]
  ): Promise<Exercise_Record[]> {
    const savedRecords: Exercise_Record[] = [];

    // Use transaction for batch operations
    await this.storageManager.executeTransaction(async () => {
      for (const exercise of exercises) {
        const savedRecord = await this.exerciseLogger.saveManualLog(exercise);
        savedRecords.push(savedRecord);
      }
    });

    return savedRecords;
  }

  /**
   * Get exercise statistics for manual logs
   */
  async getManualExerciseStats(dateRange: DateRange): Promise<{
    totalExercises: number;
    totalDuration: number;
    averageDuration: number;
    exerciseTypes: { [key: string]: number };
  }> {
    const manualRecords = await this.getManualExerciseHistory(dateRange);

    const stats = {
      totalExercises: manualRecords.length,
      totalDuration: manualRecords.reduce(
        (sum, record) => sum + record.duration,
        0
      ),
      averageDuration: 0,
      exerciseTypes: {} as { [key: string]: number },
    };

    if (stats.totalExercises > 0) {
      stats.averageDuration = stats.totalDuration / stats.totalExercises;
    }

    // Count exercise types
    manualRecords.forEach((record) => {
      const exerciseType = record.name.toLowerCase();
      stats.exerciseTypes[exerciseType] =
        (stats.exerciseTypes[exerciseType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Search manual exercises by name
   */
  async searchManualExercises(
    searchTerm: string,
    dateRange: DateRange
  ): Promise<Exercise_Record[]> {
    const manualRecords = await this.getManualExerciseHistory(dateRange);

    const searchTermLower = searchTerm.toLowerCase();

    return manualRecords.filter((record) =>
      record.name.toLowerCase().includes(searchTermLower)
    );
  }

  /**
   * Get recent exercise names for autocomplete
   */
  async getRecentExerciseNames(limit: number = 10): Promise<string[]> {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30); // Last 30 days

    const dateRange: DateRange = {
      start: recentDate,
      end: new Date(),
    };

    const recentRecords = await this.getManualExerciseHistory(dateRange);

    // Get unique exercise names, sorted by most recent
    const exerciseNames = new Set<string>();

    recentRecords
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .forEach((record) => exerciseNames.add(record.name));

    return Array.from(exerciseNames).slice(0, limit);
  }
}
