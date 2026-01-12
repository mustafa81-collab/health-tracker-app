/**
 * Exercise Logger Service
 * 
 * Handles manual exercise logging with comprehensive validation and data persistence.
 * This service provides:
 * 
 * - Input validation for exercise data
 * - Manual exercise record creation and management
 * - Integration with data storage layer
 * - Audit trail creation for all operations
 * - CRUD operations for manual exercise logs
 * 
 * The service implements strict validation rules to ensure data quality
 * and provides detailed error messages for user feedback.
 * 
 * Requirements addressed:
 * - Manual exercise logging (1.1, 1.3)
 * - Input validation (1.4, 1.5)
 * - Data persistence (2.1, 2.2)
 * - Audit trails (6.1, 6.2)
 */

import {
  ExerciseInput,
  ValidationResult,
  ValidationRules,
  Exercise_Record,
  DataSource,
  ValidationStatus,
} from "@/types";
import { ExerciseLogger as IExerciseLogger } from "@/services/interfaces";
import { VALIDATION_RULES, ERROR_MESSAGES } from "@/utils/constants";
import { DataStorageManager } from "./database/DataStorageManager";

/**
 * Exercise Logger Service Implementation
 * 
 * Provides comprehensive exercise logging functionality with validation,
 * data persistence, and audit trail management.
 */
export class ExerciseLogger implements IExerciseLogger {
  private storageManager: DataStorageManager;

  /**
   * Initialize the Exercise Logger with required dependencies
   * @param storageManager - Data storage service for persistence
   */
  constructor(storageManager: DataStorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Validate exercise input data against defined rules
   * 
   * Performs comprehensive validation including:
   * - Exercise name requirements and length limits
   * - Duration validation and range checking
   * - Start time validation and reasonable bounds
   * 
   * @param data - Exercise input data to validate
   * @returns Validation result with success status and error details
   */
  validateExerciseData(data: ExerciseInput): ValidationResult {
    const errors: string[] = [];

    // Validate exercise name
    if (!data.name || data.name.trim().length === 0) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_REQUIRED);
    } else if (data.name.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_TOO_SHORT);
    } else if (data.name.length > VALIDATION_RULES.NAME_MAX_LENGTH) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_TOO_LONG);
    }

    // Validate duration
    if (data.duration === undefined || data.duration === null) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_REQUIRED);
    } else if (typeof data.duration !== "number" || isNaN(data.duration)) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_INVALID);
    } else if (data.duration <= 0) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_INVALID);
    } else if (data.duration < VALIDATION_RULES.DURATION_MIN) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_TOO_SHORT);
    } else if (data.duration > VALIDATION_RULES.DURATION_MAX) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_TOO_LONG);
    }

    // Validate start time
    if (!data.startTime) {
      errors.push(ERROR_MESSAGES.VALIDATION.TIME_REQUIRED);
    } else if (
      !(data.startTime instanceof Date) ||
      isNaN(data.startTime.getTime())
    ) {
      errors.push(ERROR_MESSAGES.VALIDATION.TIME_INVALID);
    } else {
      // Check if start time is not in the future (more than 5 minutes from now)
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (data.startTime > fiveMinutesFromNow) {
        errors.push("Start time cannot be more than 5 minutes in the future");
      }

      // Check if start time is not too far in the past (more than 3 years)
      const threeYearsAgo = new Date(
        now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000
      );

      if (data.startTime < threeYearsAgo) {
        errors.push("Start time cannot be more than 3 years in the past");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Save a manual exercise log to persistent storage
   * 
   * This method:
   * 1. Validates the input data
   * 2. Creates a complete Exercise_Record
   * 3. Persists the record to storage
   * 4. Creates an audit trail entry
   * 
   * @param exercise - Exercise input data from user
   * @returns Promise resolving to the created Exercise_Record
   * @throws Error if validation fails or storage operation fails
   */
  async saveManualLog(exercise: ExerciseInput): Promise<Exercise_Record> {
    console.log("ExerciseLogger.saveManualLog called with:", exercise);
    
    // First validate the input
    const validation = this.validateExerciseData(exercise);

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Generate unique ID and timestamps
    const id = this.generateExerciseId();
    const now = new Date();

    console.log("Generated exercise ID:", id);

    // Create Exercise_Record from input
    const exerciseRecord: Exercise_Record = {
      id,
      name: exercise.name.trim(),
      startTime: exercise.startTime,
      duration: exercise.duration,
      source: DataSource.MANUAL,
      metadata: {
        // Add any default metadata for manual logs
      },
      createdAt: now,
      updatedAt: now,
    };

    console.log("Created exercise record:", exerciseRecord);

    // Save to storage
    try {
      console.log("Calling storageManager.saveExerciseRecord...");
      await this.storageManager.saveExerciseRecord(exerciseRecord);
      console.log("Exercise record saved to storage successfully");

      // Create audit record for the creation
      console.log("Creating audit record...");
      await this.storageManager.saveAuditRecord({
        id: this.generateAuditId(),
        action: "record_created" as any,
        timestamp: now,
        recordId: exerciseRecord.id,
        beforeData: null,
        afterData: exerciseRecord,
        metadata: {
          source: "manual_entry",
          validationStatus: ValidationStatus.VALID,
        },
      });
      console.log("Audit record created successfully");

      return exerciseRecord;
    } catch (error) {
      console.error("Error in saveManualLog:", error);
      throw new Error(
        `Failed to save manual log: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get the current validation rules configuration
   * @returns Current validation rules
   */
  getValidationRules(): ValidationRules {
    return {
      nameRequired: true,
      nameMinLength: VALIDATION_RULES.NAME_MIN_LENGTH,
      durationMin: VALIDATION_RULES.DURATION_MIN,
      timeFormat: VALIDATION_RULES.TIME_FORMAT,
    };
  }

  // Additional helper methods

  async updateManualLog(
    id: string,
    updates: Partial<ExerciseInput>
  ): Promise<Exercise_Record> {
    // Get existing record
    const existingRecord = await this.storageManager.getRecordById(id);

    if (!existingRecord) {
      throw new Error("Exercise record not found");
    }

    if (existingRecord.source !== DataSource.MANUAL) {
      throw new Error("Cannot update non-manual exercise records");
    }

    // Create updated input for validation
    const updatedInput: ExerciseInput = {
      name: updates.name !== undefined ? updates.name : existingRecord.name,
      startTime:
        updates.startTime !== undefined
          ? updates.startTime
          : existingRecord.startTime,
      duration:
        updates.duration !== undefined
          ? updates.duration
          : existingRecord.duration,
    };

    // Validate updated data
    const validation = this.validateExerciseData(updatedInput);

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Prepare updates for storage
    const recordUpdates: Partial<Exercise_Record> = {};

    if (updates.name !== undefined) {
      recordUpdates.name = updates.name.trim();
    }
    if (updates.startTime !== undefined) {
      recordUpdates.startTime = updates.startTime;
    }
    if (updates.duration !== undefined) {
      recordUpdates.duration = updates.duration;
    }

    // Update record
    await this.storageManager.updateRecord(id, recordUpdates);

    // Get updated record
    const updatedRecord = await this.storageManager.getRecordById(id);

    if (!updatedRecord) {
      throw new Error("Failed to retrieve updated record");
    }

    // Create audit record for the update
    await this.storageManager.saveAuditRecord({
      id: this.generateAuditId(),
      action: "record_updated" as any,
      timestamp: new Date(),
      recordId: id,
      beforeData: existingRecord,
      afterData: updatedRecord,
      metadata: {
        source: "manual_update",
        updatedFields: Object.keys(recordUpdates),
      },
    });

    return updatedRecord;
  }

  async deleteManualLog(id: string): Promise<void> {
    // Get existing record for audit trail
    const existingRecord = await this.storageManager.getRecordById(id);

    if (!existingRecord) {
      throw new Error("Exercise record not found");
    }

    if (existingRecord.source !== DataSource.MANUAL) {
      throw new Error("Cannot delete non-manual exercise records");
    }

    // Delete the record
    await this.storageManager.deleteRecord(id);

    // Create audit record for the deletion
    await this.storageManager.saveAuditRecord({
      id: this.generateAuditId(),
      action: "record_deleted" as any,
      timestamp: new Date(),
      recordId: id,
      beforeData: existingRecord,
      afterData: null,
      metadata: {
        source: "manual_deletion",
      },
    });
  }

  // Validation helper methods

  validateExerciseName(name: string): string[] {
    const errors: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_REQUIRED);
    } else if (name.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_TOO_SHORT);
    } else if (name.length > VALIDATION_RULES.NAME_MAX_LENGTH) {
      errors.push(ERROR_MESSAGES.VALIDATION.NAME_TOO_LONG);
    }

    return errors;
  }

  validateDuration(duration: number): string[] {
    const errors: string[] = [];

    if (duration === undefined || duration === null) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_REQUIRED);
    } else if (typeof duration !== "number" || isNaN(duration)) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_INVALID);
    } else if (duration <= 0) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_INVALID);
    } else if (duration < VALIDATION_RULES.DURATION_MIN) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_TOO_SHORT);
    } else if (duration > VALIDATION_RULES.DURATION_MAX) {
      errors.push(ERROR_MESSAGES.VALIDATION.DURATION_TOO_LONG);
    }

    return errors;
  }

  validateStartTime(startTime: Date): string[] {
    const errors: string[] = [];

    if (!startTime) {
      errors.push(ERROR_MESSAGES.VALIDATION.TIME_REQUIRED);
    } else if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
      errors.push(ERROR_MESSAGES.VALIDATION.TIME_INVALID);
    } else {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      const threeYearsAgo = new Date(
        now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000
      );

      if (startTime > fiveMinutesFromNow) {
        errors.push("Start time cannot be more than 5 minutes in the future");
      }

      if (startTime < threeYearsAgo) {
        errors.push("Start time cannot be more than 3 years in the past");
      }
    }

    return errors;
  }

  private generateExerciseId(): string {
    return `exercise_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
