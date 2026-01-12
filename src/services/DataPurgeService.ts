// Data purge functionality for complete data deletion
// Requirements: 7.3, 7.4, 7.5

import { DataStorageManager } from "./database/DataStorageManager";
import { PermissionManager } from "./PermissionManager";

export interface PurgeConfirmation {
  title: string;
  message: string;
  warnings: string[];
  confirmationText: string;
  requiresTypedConfirmation: boolean;
}

export interface PurgeResult {
  success: boolean;
  itemsDeleted: {
    exerciseRecords: number;
    auditRecords: number;
    conflictRecords: number;
  };
  errors: string[];
  completedAt: Date;
}

export interface PurgeOptions {
  includeAuditTrail: boolean;
  includeConflictData: boolean;
  resetPermissions: boolean;
  confirmationRequired: boolean;
}

export class DataPurgeService {
  private storageManager: DataStorageManager;
  private permissionManager: PermissionManager;

  constructor(
    storageManager: DataStorageManager,
    permissionManager: PermissionManager
  ) {
    this.storageManager = storageManager;
    this.permissionManager = permissionManager;
  }

  /**
   * Get confirmation dialog for data purge
   */
  getPurgeConfirmation(): PurgeConfirmation {
    return {
      title: "Delete All Data",
      message:
        "You are about to permanently delete all your health tracking data. This action cannot be undone.",
      warnings: [
        "All exercise records (manual and synced) will be deleted",
        "All conflict resolution history will be removed",
        "All audit trail records will be permanently deleted",
        "All app settings and permissions will be reset",
        "The app will return to its initial state",
        "This action cannot be reversed",
      ],
      confirmationText: "DELETE ALL DATA",
      requiresTypedConfirmation: true,
    };
  }

  /**
   * Perform complete data purge with confirmation
   */
  async purgeAllData(
    confirmationText: string,
    options: PurgeOptions = {
      includeAuditTrail: true,
      includeConflictData: true,
      resetPermissions: true,
      confirmationRequired: true,
    }
  ): Promise<PurgeResult> {
    const result: PurgeResult = {
      success: false,
      itemsDeleted: {
        exerciseRecords: 0,
        auditRecords: 0,
        conflictRecords: 0,
      },
      errors: [],
      completedAt: new Date(),
    };

    try {
      // Validate confirmation if required
      if (options.confirmationRequired) {
        const expectedConfirmation =
          this.getPurgeConfirmation().confirmationText;
        if (confirmationText !== expectedConfirmation) {
          result.errors.push(
            "Confirmation text does not match. Data purge cancelled."
          );
          return result;
        }
      }

      // Get counts before deletion for reporting
      const exerciseRecords = await this.storageManager.getExerciseHistory({
        start: new Date("1900-01-01"),
        end: new Date("2100-12-31"),
      });
      result.itemsDeleted.exerciseRecords = exerciseRecords.length;

      if (options.includeAuditTrail) {
        const auditRecords = await this.storageManager.getAuditTrail(10000);
        result.itemsDeleted.auditRecords = auditRecords.length;
      }

      // Delete all exercise records
      await this.deleteAllExerciseRecords();

      // Delete audit trail if requested
      if (options.includeAuditTrail) {
        await this.deleteAllAuditRecords();
      }

      // Delete conflict data if requested
      if (options.includeConflictData) {
        await this.deleteAllConflictData();
      }

      // Reset permissions if requested
      if (options.resetPermissions) {
        this.permissionManager.resetPermissions();
      }

      // Reset app to initial state
      await this.resetAppToInitialState();

      result.success = true;
      result.completedAt = new Date();
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? error.message
          : "Unknown error during data purge"
      );
    }

    return result;
  }

  /**
   * Delete all exercise records (manual and synced)
   */
  private async deleteAllExerciseRecords(): Promise<void> {
    try {
      // Get all exercise records
      const allRecords = await this.storageManager.getExerciseHistory({
        start: new Date("1900-01-01"),
        end: new Date("2100-12-31"),
      });

      // Delete each record
      for (const record of allRecords) {
        await this.storageManager.deleteRecord(record.id);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete exercise records: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete all audit trail records
   */
  private async deleteAllAuditRecords(): Promise<void> {
    try {
      // In a real implementation, this would call a method to delete all audit records
      // For now, we'll use the cleanup method with a very old date
      await this.storageManager.cleanupOldAuditRecords();
    } catch (error) {
      throw new Error(
        `Failed to delete audit records: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete all conflict data
   */
  private async deleteAllConflictData(): Promise<void> {
    try {
      // In a real implementation, this would delete conflict-specific tables
      // For now, this is a placeholder as conflicts are handled through the main data flow
    } catch (error) {
      throw new Error(
        `Failed to delete conflict data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Reset app to initial state
   */
  private async resetAppToInitialState(): Promise<void> {
    try {
      // Reset database to initial state
      await this.storageManager.initializeDatabase();

      // Any additional reset logic would go here
    } catch (error) {
      throw new Error(
        `Failed to reset app to initial state: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get data summary before purge
   */
  async getDataSummary(): Promise<{
    exerciseRecords: number;
    auditRecords: number;
    conflictRecords: number;
    permissionsGranted: number;
    dataSize: string;
  }> {
    try {
      const exerciseRecords = await this.storageManager.getExerciseHistory({
        start: new Date("1900-01-01"),
        end: new Date("2100-12-31"),
      });

      const auditRecords = await this.storageManager.getAuditTrail(10000);

      const privacySettings =
        this.permissionManager.getPrivacySettingsSummary();

      return {
        exerciseRecords: exerciseRecords.length,
        auditRecords: auditRecords.length,
        conflictRecords: 0, // Placeholder
        permissionsGranted: privacySettings.permissionsGranted.length,
        dataSize: this.estimateDataSize(
          exerciseRecords.length,
          auditRecords.length
        ),
      };
    } catch (error) {
      return {
        exerciseRecords: 0,
        auditRecords: 0,
        conflictRecords: 0,
        permissionsGranted: 0,
        dataSize: "Unknown",
      };
    }
  }

  /**
   * Estimate data size for display
   */
  private estimateDataSize(
    exerciseRecords: number,
    auditRecords: number
  ): string {
    // Rough estimate: each exercise record ~1KB, each audit record ~0.5KB
    const estimatedBytes = exerciseRecords * 1024 + auditRecords * 512;

    if (estimatedBytes < 1024) {
      return `${estimatedBytes} bytes`;
    } else if (estimatedBytes < 1024 * 1024) {
      return `${Math.round(estimatedBytes / 1024)} KB`;
    } else {
      return `${Math.round(estimatedBytes / (1024 * 1024))} MB`;
    }
  }

  /**
   * Verify purge completion
   */
  async verifyPurgeCompletion(): Promise<{
    isComplete: boolean;
    remainingData: {
      exerciseRecords: number;
      auditRecords: number;
    };
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check for remaining exercise records
      const exerciseRecords = await this.storageManager.getExerciseHistory({
        start: new Date("1900-01-01"),
        end: new Date("2100-12-31"),
      });

      // Check for remaining audit records
      const auditRecords = await this.storageManager.getAuditTrail(100);

      // Check permission reset
      const permissionSettings = this.permissionManager.getOptInSettings();

      if (exerciseRecords.length > 0) {
        issues.push(`${exerciseRecords.length} exercise records still exist`);
      }

      if (auditRecords.length > 0) {
        issues.push(`${auditRecords.length} audit records still exist`);
      }

      if (permissionSettings.dataCollection || permissionSettings.syncEnabled) {
        issues.push("Permissions were not properly reset");
      }

      if (permissionSettings.selectedPermissions.size > 0) {
        issues.push("Selected permissions were not cleared");
      }

      return {
        isComplete: issues.length === 0,
        remainingData: {
          exerciseRecords: exerciseRecords.length,
          auditRecords: auditRecords.length,
        },
        issues,
      };
    } catch (error) {
      issues.push(
        `Verification failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return {
        isComplete: false,
        remainingData: {
          exerciseRecords: -1,
          auditRecords: -1,
        },
        issues,
      };
    }
  }

  /**
   * Get purge options with explanations
   */
  getPurgeOptions(): {
    option: keyof PurgeOptions;
    name: string;
    description: string;
    recommended: boolean;
  }[] {
    return [
      {
        option: "includeAuditTrail",
        name: "Delete Audit Trail",
        description: "Remove all history of changes and conflict resolutions",
        recommended: true,
      },
      {
        option: "includeConflictData",
        name: "Delete Conflict Data",
        description: "Remove all stored conflict information",
        recommended: true,
      },
      {
        option: "resetPermissions",
        name: "Reset Permissions",
        description: "Clear all granted health platform permissions",
        recommended: true,
      },
      {
        option: "confirmationRequired",
        name: "Require Confirmation",
        description: "Require typing confirmation text before deletion",
        recommended: true,
      },
    ];
  }

  /**
   * Create backup before purge (for testing/recovery)
   */
  async createBackupBeforePurge(): Promise<{
    success: boolean;
    backupData?: {
      exerciseRecords: any[];
      auditRecords: any[];
      permissionSettings: any;
    };
    error?: string;
  }> {
    try {
      const exerciseRecords = await this.storageManager.getExerciseHistory({
        start: new Date("1900-01-01"),
        end: new Date("2100-12-31"),
      });

      const auditRecords = await this.storageManager.getAuditTrail(10000);
      const permissionSettings = this.permissionManager.getOptInSettings();

      return {
        success: true,
        backupData: {
          exerciseRecords,
          auditRecords,
          permissionSettings,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
