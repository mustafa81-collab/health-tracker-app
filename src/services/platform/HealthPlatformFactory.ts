// Factory for creating platform-specific health adapters

import { HealthPlatformSync } from "@/services/interfaces";
import { HealthPlatform } from "@/types";
import { PlatformDetector } from "./PlatformDetector";
import { HealthKitAdapter } from "./HealthKitAdapter";
import { HealthConnectAdapter } from "./HealthConnectAdapter";
import { DataStorageManager } from "../database/DataStorageManager";

export class HealthPlatformFactory {
  /**
   * Create appropriate health platform adapter based on current platform
   */
  static createAdapter(storageManager: DataStorageManager): HealthPlatformSync {
    const platformInfo = PlatformDetector.detectPlatform();

    if (!platformInfo.isSupported) {
      throw new Error(
        `Health APIs not supported on platform: ${platformInfo.platform}`
      );
    }

    switch (platformInfo.platform) {
      case HealthPlatform.APPLE_HEALTHKIT:
        return new HealthKitAdapter(storageManager);

      case HealthPlatform.GOOGLE_HEALTH_CONNECT:
        return new HealthConnectAdapter(storageManager);

      default:
        throw new Error(
          `Unsupported health platform: ${platformInfo.platform}`
        );
    }
  }

  /**
   * Create adapter for specific platform (useful for testing)
   */
  static createSpecificAdapter(
    platform: HealthPlatform,
    storageManager: DataStorageManager
  ): HealthPlatformSync {
    switch (platform) {
      case HealthPlatform.APPLE_HEALTHKIT:
        return new HealthKitAdapter(storageManager);

      case HealthPlatform.GOOGLE_HEALTH_CONNECT:
        return new HealthConnectAdapter(storageManager);

      default:
        throw new Error(`Unsupported health platform: ${platform}`);
    }
  }

  /**
   * Check if platform supports health APIs
   */
  static isPlatformSupported(): boolean {
    return PlatformDetector.isHealthAPISupported();
  }

  /**
   * Get current platform information
   */
  static getCurrentPlatformInfo() {
    return PlatformDetector.detectPlatform();
  }

  /**
   * Get platform configuration
   */
  static getPlatformConfig() {
    return PlatformDetector.getPlatformConfig();
  }
}
