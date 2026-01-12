// Android Health Connect adapter implementation

import { HealthConnectAdapter as IHealthConnectAdapter } from "@/services/interfaces";
import { DataStorageManager } from "../database/DataStorageManager";
import { SyncNotificationService } from "../SyncNotificationService";
import { OfflineManager } from "../OfflineManager";
import {
  PermissionStatus,
  SyncResult,
  DateRange,
  ExerciseSession,
  StepsRecord,
  Exercise_Record,
  HealthPlatform,
  SyncError,
} from "@/types";
import { BaseHealthAdapter } from "./BaseHealthAdapter";
import { ERROR_MESSAGES } from "@/utils/constants";

// Mock Health Connect for development (replace with actual react-native-health-connect in production)
interface HealthConnectAPI {
  initialize: () => Promise<void>;
  requestPermission: (permissions: string[]) => Promise<any>;
  readRecords: (type: string, options: any) => Promise<any[]>;
  isAvailable: () => Promise<boolean>;
  getGrantedPermissions: () => Promise<string[]>;
}

// This would be imported from 'react-native-health-connect' in production
const HealthConnect: HealthConnectAPI = {
  initialize: async () => {
    // Mock implementation
    console.log("Health Connect initialized");
  },
  requestPermission: async (permissions) => {
    // Mock implementation - return granted permissions
    return {
      granted: permissions,
      denied: [],
    };
  },
  readRecords: async (_type: any, _options: any) => {
    // Mock implementation - return sample data
    return [];
  },
  isAvailable: async () => {
    // Mock implementation
    return true;
  },
  getGrantedPermissions: async () => {
    // Mock implementation
    return [
      "android.permission.health.READ_STEPS",
      "android.permission.health.READ_EXERCISE",
    ];
  },
};

export class HealthConnectAdapter
  extends BaseHealthAdapter
  implements IHealthConnectAdapter
{
  private isHealthConnectInitialized: boolean = false;

  constructor(
    storageManager: DataStorageManager,
    notificationService?: SyncNotificationService,
    offlineManager?: OfflineManager
  ) {
    super(
      storageManager,
      HealthPlatform.GOOGLE_HEALTH_CONNECT,
      notificationService,
      offlineManager
    );
  }

  async isInitialized(): Promise<boolean> {
    return this.isHealthConnectInitialized;
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      await HealthConnect.initialize();
      this.isHealthConnectInitialized = true;

      const requiredPermissions = [
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_EXERCISE",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
      ];

      const permissionResult = await HealthConnect.requestPermission(
        requiredPermissions
      );

      return {
        granted: permissionResult.granted.length > 0,
        permissions: permissionResult.granted,
        deniedPermissions: permissionResult.denied,
      };
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.SYNC.PERMISSION_DENIED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async requestHealthConnectPermissions(): Promise<PermissionStatus> {
    return this.requestPermissions();
  }

  async syncExerciseData(): Promise<SyncResult> {
    try {
      if (!this.isHealthConnectInitialized) {
        throw new Error(
          "Health Connect not initialized. Call requestPermissions first."
        );
      }

      // Get exercise sessions from the last 7 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const exerciseSessions = await this.readExerciseSessions({
        start: startDate,
        end: endDate,
      });
      const exerciseRecords: Exercise_Record[] = [];

      for (const session of exerciseSessions) {
        // Check for duplicates
        const isDuplicate = await this.isDuplicateRecord(
          session.id,
          new Date(session.startTime)
        );

        if (!isDuplicate) {
          const exerciseRecord = this.convertSessionToExerciseRecord(session);
          exerciseRecords.push(exerciseRecord);
        }
      }

      // Save new records
      if (exerciseRecords.length > 0) {
        await this.saveSyncedRecords(exerciseRecords);
      }

      return this.createSuccessResult(exerciseRecords);
    } catch (error) {
      const syncError: SyncError = {
        code: "HEALTH_CONNECT_SYNC_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unknown Health Connect sync error",
        retryable: true,
      };

      const retryResult = await this.handleSyncFailure(syncError);

      if (retryResult.maxRetriesReached) {
        return this.createFailureResult(syncError.message);
      }

      throw syncError; // Re-throw for retry mechanism
    }
  }

  async syncStepData(): Promise<SyncResult> {
    try {
      if (!this.isHealthConnectInitialized) {
        throw new Error(
          "Health Connect not initialized. Call requestPermissions first."
        );
      }

      // Get step data from the last 7 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stepsRecords = await this.readStepsData({
        start: startDate,
        end: endDate,
      });
      const exerciseRecords: Exercise_Record[] = [];

      // Convert step data to exercise records (daily summaries)
      const dailySteps = this.aggregateStepsByDay(stepsRecords);

      for (const [date, steps] of Object.entries(dailySteps)) {
        const stepDate = new Date(date);

        // Only create exercise record if significant steps (> 1000)
        if (steps > 1000) {
          const isDuplicate = await this.isDuplicateRecord(
            `steps_${date}`,
            stepDate
          );

          if (!isDuplicate) {
            const exerciseRecord = this.createExerciseRecord(
              `steps_${date}`,
              "Daily Steps",
              stepDate,
              this.estimateWalkingDuration(steps),
              {
                steps,
                estimatedDistance: this.estimateDistance(steps),
                dataType: "steps",
              }
            );
            exerciseRecords.push(exerciseRecord);
          }
        }
      }

      // Save new records
      if (exerciseRecords.length > 0) {
        await this.saveSyncedRecords(exerciseRecords);
      }

      return this.createSuccessResult(exerciseRecords);
    } catch (error) {
      const syncError: SyncError = {
        code: "HEALTH_CONNECT_STEPS_SYNC_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unknown Health Connect steps sync error",
        retryable: true,
      };

      return this.createFailureResult(syncError.message);
    }
  }

  async readExerciseSessions(dateRange: DateRange): Promise<ExerciseSession[]> {
    try {
      const options = {
        timeRangeFilter: {
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        },
        dataOriginFilter: [], // All sources
        ascendingOrder: false,
        pageSize: 100,
      };

      const sessions = await HealthConnect.readRecords(
        "ExerciseSession",
        options
      );

      return sessions.map((session) => ({
        id: session.metadata?.id || `session_${Date.now()}_${Math.random()}`,
        exerciseType: session.exerciseType || "UNKNOWN",
        startTime: session.startTime,
        endTime: session.endTime,
        title: session.title,
        notes: session.notes,
      }));
    } catch (error) {
      console.error("Error reading Health Connect exercise sessions:", error);
      return [];
    }
  }

  async readStepsData(dateRange: DateRange): Promise<StepsRecord[]> {
    try {
      const options = {
        timeRangeFilter: {
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        },
        dataOriginFilter: [], // All sources
        ascendingOrder: false,
        pageSize: 1000,
      };

      const steps = await HealthConnect.readRecords("Steps", options);

      return steps.map((step) => ({
        count: step.count || 0,
        startTime: step.startTime,
        endTime: step.endTime,
      }));
    } catch (error) {
      console.error("Error reading Health Connect steps data:", error);
      return [];
    }
  }

  convertSessionToExerciseRecord(session: ExerciseSession): Exercise_Record {
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const duration = Math.round(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    ); // minutes

    // Map Health Connect exercise types to readable names
    const exerciseName = this.mapExerciseTypeToName(session.exerciseType);

    return this.createExerciseRecord(
      session.id,
      exerciseName,
      startTime,
      duration,
      {
        exerciseType: session.exerciseType,
        title: session.title,
        notes: session.notes,
        endTime: endTime,
        dataType: "exercise_session",
      }
    );
  }

  private mapExerciseTypeToName(exerciseType: string): string {
    const exerciseTypeMap: { [key: string]: string } = {
      RUNNING: "Running",
      Running: "Running",
      WALKING: "Walking",
      Walking: "Walking",
      CYCLING: "Cycling",
      Cycling: "Cycling",
      SWIMMING: "Swimming",
      Swimming: "Swimming",
      YOGA: "Yoga",
      Yoga: "Yoga",
      STRENGTH_TRAINING: "Strength Training",
      HIGH_INTENSITY_INTERVAL_TRAINING: "HIIT",
      HIIT: "HIIT",
      DANCING: "Dancing",
      Dancing: "Dancing",
      HIKING: "Hiking",
      Hiking: "Hiking",
      TENNIS: "Tennis",
      Tennis: "Tennis",
      BASKETBALL: "Basketball",
      Basketball: "Basketball",
      FOOTBALL_AMERICAN: "Football",
      SOCCER: "Soccer",
      Soccer: "Soccer",
      WEIGHTLIFTING: "Weightlifting",
      PILATES: "Pilates",
      MARTIAL_ARTS: "Martial Arts",
      ROWING: "Rowing",
      SKIING: "Skiing",
      SURFING: "Surfing",
      UNKNOWN: "Exercise",
      OTHER: "Exercise",
      Other: "Exercise",
    };

    // Normalize the input to uppercase for consistent lookup
    const normalizedType = exerciseType.toUpperCase();
    return (
      exerciseTypeMap[normalizedType] ||
      exerciseTypeMap[exerciseType] ||
      "Exercise"
    );
  }

  private aggregateStepsByDay(stepsRecords: StepsRecord[]): {
    [date: string]: number;
  } {
    const dailySteps: { [date: string]: number } = {};

    stepsRecords.forEach((record) => {
      const date = new Date(record.startTime).toISOString().split("T")[0]; // YYYY-MM-DD
      if (date) {
        dailySteps[date] = (dailySteps[date] || 0) + record.count;
      }
    });

    return dailySteps;
  }

  private estimateWalkingDuration(steps: number): number {
    // Rough estimate: average person takes 120 steps per minute walking
    const stepsPerMinute = 120;
    return Math.round(steps / stepsPerMinute);
  }

  private estimateDistance(steps: number): number {
    // Rough estimate: average step length is 0.762 meters
    const averageStepLength = 0.762; // meters
    return Math.round(((steps * averageStepLength) / 1000) * 100) / 100; // km, rounded to 2 decimal places
  }

  /**
   * Check if Health Connect is available on device
   */
  async checkAvailability(): Promise<boolean> {
    try {
      return await HealthConnect.isAvailable();
    } catch (error) {
      console.error("Error checking Health Connect availability:", error);
      return false;
    }
  }

  /**
   * Get currently granted permissions
   */
  async getGrantedPermissions(): Promise<string[]> {
    try {
      return await HealthConnect.getGrantedPermissions();
    } catch (error) {
      console.error("Error getting Health Connect granted permissions:", error);
      return [];
    }
  }

  /**
   * Read heart rate data (if available)
   */
  async readHeartRateData(dateRange: DateRange): Promise<any[]> {
    try {
      const options = {
        timeRangeFilter: {
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        },
        dataOriginFilter: [],
        ascendingOrder: false,
        pageSize: 1000,
      };

      return await HealthConnect.readRecords("HeartRate", options);
    } catch (error) {
      console.error("Error reading Health Connect heart rate data:", error);
      return [];
    }
  }

  /**
   * Read active calories data (if available)
   */
  async readActiveCaloriesData(dateRange: DateRange): Promise<any[]> {
    try {
      const options = {
        timeRangeFilter: {
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        },
        dataOriginFilter: [],
        ascendingOrder: false,
        pageSize: 1000,
      };

      return await HealthConnect.readRecords("ActiveCaloriesBurned", options);
    } catch (error) {
      console.error(
        "Error reading Health Connect active calories data:",
        error
      );
      return [];
    }
  }

  /**
   * Get available data types that can be read
   */
  getAvailableDataTypes(): string[] {
    return [
      "ExerciseSession",
      "Steps",
      "HeartRate",
      "ActiveCaloriesBurned",
      "Distance",
      "Speed",
      "Power",
      "Weight",
      "Height",
      "BloodPressure",
      "SleepSession",
    ];
  }

  /**
   * Check if specific data type is supported
   */
  isDataTypeSupported(dataType: string): boolean {
    const availableTypes = this.getAvailableDataTypes();
    return availableTypes.includes(dataType);
  }
}
