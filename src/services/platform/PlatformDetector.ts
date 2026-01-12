// Platform detection service for iOS/Android health API selection

import { Platform } from "react-native";
import { HealthPlatform } from "@/types";

export interface PlatformInfo {
  platform: HealthPlatform;
  isSupported: boolean;
  version?: string;
}

export class PlatformDetector {
  /**
   * Detect the current platform and return appropriate health platform
   */
  static detectPlatform(): PlatformInfo {
    if (Platform.OS === "ios") {
      return {
        platform: HealthPlatform.APPLE_HEALTHKIT,
        isSupported: true,
        version: Platform.Version as string,
      };
    } else if (Platform.OS === "android") {
      return {
        platform: HealthPlatform.GOOGLE_HEALTH_CONNECT,
        isSupported: true,
        version: Platform.Version.toString(),
      };
    } else {
      // Unsupported platform (web, windows, etc.)
      return {
        platform: HealthPlatform.APPLE_HEALTHKIT, // Default fallback
        isSupported: false,
      };
    }
  }

  /**
   * Check if health APIs are available on current platform
   */
  static isHealthAPISupported(): boolean {
    return Platform.OS === "ios" || Platform.OS === "android";
  }

  /**
   * Get platform-specific health permissions
   */
  static getRequiredPermissions(): string[] {
    const platformInfo = this.detectPlatform();

    switch (platformInfo.platform) {
      case HealthPlatform.APPLE_HEALTHKIT:
        return [
          "AppleHealthKit.Constants.Permissions.Steps",
          "AppleHealthKit.Constants.Permissions.Workout",
          "AppleHealthKit.Constants.Permissions.HeartRate",
          "AppleHealthKit.Constants.Permissions.ActiveEnergyBurned",
        ];

      case HealthPlatform.GOOGLE_HEALTH_CONNECT:
        return [
          "android.permission.health.READ_STEPS",
          "android.permission.health.READ_EXERCISE",
          "android.permission.health.READ_HEART_RATE",
          "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        ];

      default:
        return [];
    }
  }

  /**
   * Get platform-specific configuration
   */
  static getPlatformConfig() {
    const platformInfo = this.detectPlatform();

    return {
      platform: platformInfo.platform,
      isSupported: platformInfo.isSupported,
      permissions: this.getRequiredPermissions(),
      apiVersion: platformInfo.version,
      capabilities: {
        steps: true,
        workouts: true,
        heartRate: true,
        calories: true,
        sleep: platformInfo.platform === HealthPlatform.APPLE_HEALTHKIT, // iOS has better sleep data
        bloodPressure: true,
      },
    };
  }

  /**
   * Check if specific health data type is supported
   */
  static isDataTypeSupported(dataType: string): boolean {
    const config = this.getPlatformConfig();

    switch (dataType.toLowerCase()) {
      case "steps":
        return config.capabilities.steps;
      case "workouts":
      case "exercise":
        return config.capabilities.workouts;
      case "heartrate":
      case "heart_rate":
        return config.capabilities.heartRate;
      case "calories":
      case "active_calories":
        return config.capabilities.calories;
      case "sleep":
        return config.capabilities.sleep;
      case "blood_pressure":
        return config.capabilities.bloodPressure;
      default:
        return false;
    }
  }
}
