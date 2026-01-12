// iOS HealthKit adapter implementation

import { HealthKitAdapter as IHealthKitAdapter } from "@/services/interfaces";
import { DataStorageManager } from "../database/DataStorageManager";
import { SyncNotificationService } from "../SyncNotificationService";
import { OfflineManager } from "../OfflineManager";
import {
  PermissionStatus,
  SyncResult,
  DateRange,
  HKWorkout,
  HKQuantitySample,
  Exercise_Record,
  HealthPlatform,
  SyncError,
} from "@/types";
import { BaseHealthAdapter } from "./BaseHealthAdapter";
import { ERROR_MESSAGES } from "@/utils/constants";

// Mock HealthKit for development (replace with actual react-native-health in production)
interface HealthKitAPI {
  initHealthKit: (permissions: any) => Promise<void>;
  getPermissions: (permissions: string[]) => Promise<any>;
  getSamples: (type: string, options: any) => Promise<any[]>;
  isAvailable: () => Promise<boolean>;
}

// This would be imported from 'react-native-health' in production
const HealthKit: HealthKitAPI = {
  initHealthKit: async (permissions) => {
    // Mock implementation
    console.log("HealthKit initialized with permissions:", permissions);
  },
  getPermissions: async (permissions) => {
    // Mock implementation - return granted permissions
    return permissions.reduce((acc: any, perm: string) => {
      acc[perm] = 2; // 2 = granted in HealthKit
      return acc;
    }, {});
  },
  getSamples: async (_type: any, _options: any) => {
    // Mock implementation - return sample data
    return [];
  },
  isAvailable: async () => {
    // Mock implementation
    return true;
  },
};

export class HealthKitAdapter
  extends BaseHealthAdapter
  implements IHealthKitAdapter
{
  private isHealthKitInitialized: boolean = false;

  constructor(
    storageManager: DataStorageManager,
    notificationService?: SyncNotificationService,
    offlineManager?: OfflineManager
  ) {
    super(
      storageManager,
      HealthPlatform.APPLE_HEALTHKIT,
      notificationService,
      offlineManager
    );
  }

  async isInitialized(): Promise<boolean> {
    return this.isHealthKitInitialized;
  }

  async requestPermissions(): Promise<PermissionStatus> {
    try {
      const permissions = {
        permissions: {
          read: ["Steps", "Workout", "HeartRate", "ActiveEnergyBurned"],
        },
      };

      await HealthKit.initHealthKit(permissions);
      this.isHealthKitInitialized = true;

      // Check which permissions were actually granted
      const grantedPermissions = await HealthKit.getPermissions(
        permissions.permissions.read
      );

      const granted: string[] = [];
      const denied: string[] = [];

      for (const [permission, status] of Object.entries(grantedPermissions)) {
        if (status === 2) {
          // 2 = granted in HealthKit
          granted.push(permission);
        } else {
          denied.push(permission);
        }
      }

      return {
        granted: granted.length > 0,
        permissions: granted,
        deniedPermissions: denied,
      };
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.SYNC.PERMISSION_DENIED}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async requestHealthKitPermissions(): Promise<PermissionStatus> {
    return this.requestPermissions();
  }

  async syncExerciseData(): Promise<SyncResult> {
    try {
      if (!this.isHealthKitInitialized) {
        throw new Error(
          "HealthKit not initialized. Call requestPermissions first."
        );
      }

      // Get workouts from the last 7 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const workouts = await this.queryWorkouts({
        start: startDate,
        end: endDate,
      });
      const exerciseRecords: Exercise_Record[] = [];

      for (const workout of workouts) {
        // Check for duplicates
        const isDuplicate = await this.isDuplicateRecord(
          workout.uuid,
          new Date(workout.startDate)
        );

        if (!isDuplicate) {
          const exerciseRecord = this.convertHKWorkoutToExerciseRecord(workout);
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
        code: "HEALTHKIT_SYNC_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unknown HealthKit sync error",
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
      if (!this.isHealthKitInitialized) {
        throw new Error(
          "HealthKit not initialized. Call requestPermissions first."
        );
      }

      // Get step data from the last 7 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stepSamples = await this.queryStepCount({
        start: startDate,
        end: endDate,
      });
      const exerciseRecords: Exercise_Record[] = [];

      // Convert step data to exercise records (daily summaries)
      const dailySteps = this.aggregateStepsByDay(stepSamples);

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
        code: "HEALTHKIT_STEPS_SYNC_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unknown HealthKit steps sync error",
        retryable: true,
      };

      return this.createFailureResult(syncError.message);
    }
  }

  async queryWorkouts(dateRange: DateRange): Promise<HKWorkout[]> {
    try {
      const options = {
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        ascending: false,
        limit: 100,
      };

      const workouts = await HealthKit.getSamples("Workout", options);

      return workouts.map((workout) => ({
        uuid: workout.uuid || `workout_${Date.now()}_${Math.random()}`,
        workoutActivityType: workout.workoutActivityType || "Other",
        startDate: workout.startDate,
        endDate: workout.endDate,
        duration: workout.duration || 0,
        totalEnergyBurned: workout.totalEnergyBurned,
        sourceName: workout.sourceName || "HealthKit",
      }));
    } catch (error) {
      console.error("Error querying HealthKit workouts:", error);
      return [];
    }
  }

  async queryStepCount(dateRange: DateRange): Promise<HKQuantitySample[]> {
    try {
      const options = {
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        ascending: false,
        limit: 1000,
      };

      const steps = await HealthKit.getSamples("StepCount", options);

      return steps.map((step) => ({
        uuid: step.uuid || `step_${Date.now()}_${Math.random()}`,
        value: step.value || 0,
        unit: "count",
        startDate: step.startDate,
        endDate: step.endDate,
        sourceName: step.sourceName || "HealthKit",
      }));
    } catch (error) {
      console.error("Error querying HealthKit step count:", error);
      return [];
    }
  }

  convertHKWorkoutToExerciseRecord(workout: HKWorkout): Exercise_Record {
    const startTime = new Date(workout.startDate);
    const endTime = new Date(workout.endDate);
    const duration = this.convertDurationToMinutes(
      workout.duration || 0,
      "seconds"
    );

    // Map HealthKit workout types to readable names
    const exerciseName = this.mapWorkoutTypeToName(workout.workoutActivityType);

    return this.createExerciseRecord(
      workout.uuid,
      exerciseName,
      startTime,
      duration,
      {
        workoutType: workout.workoutActivityType,
        calories: workout.totalEnergyBurned,
        sourceName: workout.sourceName,
        endTime: endTime,
        dataType: "workout",
      }
    );
  }

  private mapWorkoutTypeToName(workoutType: string): string {
    const workoutTypeMap: { [key: string]: string } = {
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
      STRENGTH: "Strength Training",
      Strength: "Strength Training",
      HIIT: "High Intensity Interval Training",
      Dance: "Dancing",
      DANCING: "Dancing",
      Hiking: "Hiking",
      HIKING: "Hiking",
      Tennis: "Tennis",
      TENNIS: "Tennis",
      Basketball: "Basketball",
      BASKETBALL: "Basketball",
      Soccer: "Soccer",
      SOCCER: "Soccer",
      Other: "Exercise",
      OTHER: "Exercise",
      UNKNOWN: "Exercise",
    };

    // Normalize the input to uppercase for consistent lookup
    const normalizedType = workoutType.toUpperCase();
    return (
      workoutTypeMap[normalizedType] ||
      workoutTypeMap[workoutType] ||
      "Exercise"
    );
  }

  private aggregateStepsByDay(stepSamples: HKQuantitySample[]): {
    [date: string]: number;
  } {
    const dailySteps: { [date: string]: number } = {};

    stepSamples.forEach((sample) => {
      const date = new Date(sample.startDate).toISOString().split("T")[0]; // YYYY-MM-DD
      if (date) {
        dailySteps[date] = (dailySteps[date] || 0) + sample.value;
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
   * Check if HealthKit is available on device
   */
  async checkAvailability(): Promise<boolean> {
    try {
      return await HealthKit.isAvailable();
    } catch (error) {
      console.error("Error checking HealthKit availability:", error);
      return false;
    }
  }

  /**
   * Get HealthKit authorization status for specific data types
   */
  async getAuthorizationStatus(
    dataTypes: string[]
  ): Promise<{ [key: string]: string }> {
    try {
      const permissions = await HealthKit.getPermissions(dataTypes);

      const statusMap: { [key: string]: string } = {};

      for (const [dataType, status] of Object.entries(permissions)) {
        const statusValue = status as number;
        switch (statusValue) {
          case 0:
            statusMap[dataType] = "notDetermined";
            break;
          case 1:
            statusMap[dataType] = "sharingDenied";
            break;
          case 2:
            statusMap[dataType] = "sharingAuthorized";
            break;
          default:
            statusMap[dataType] = "unknown";
        }
      }

      return statusMap;
    } catch (error) {
      console.error("Error getting HealthKit authorization status:", error);
      return {};
    }
  }
}
