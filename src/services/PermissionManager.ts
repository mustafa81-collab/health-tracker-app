// Permission management system for health platform access
// Requirements: 7.1, 7.2

import { HealthPlatform } from "@/types";

export interface PermissionRequest {
  platform: HealthPlatform;
  permissions: HealthPermission[];
  explanation: string;
  required: boolean;
}

export interface HealthPermission {
  type: PermissionType;
  name: string;
  description: string;
  explanation: string;
  required: boolean;
  granted?: boolean;
}

export enum PermissionType {
  READ_WORKOUTS = "READ_WORKOUTS",
  READ_STEPS = "READ_STEPS",
  READ_HEART_RATE = "READ_HEART_RATE",
  READ_ACTIVITY = "READ_ACTIVITY",
}

export interface PermissionStatus {
  platform: HealthPlatform;
  permissions: Map<PermissionType, boolean>;
  allGranted: boolean;
  requiredGranted: boolean;
}

export interface OptInSettings {
  dataCollection: boolean;
  syncEnabled: boolean;
  selectedPermissions: Set<PermissionType>;
  explanationShown: boolean;
  consentTimestamp?: Date;
}

export class PermissionManager {
  private optInSettings: OptInSettings = {
    dataCollection: false,
    syncEnabled: false,
    selectedPermissions: new Set(),
    explanationShown: false,
  };

  /**
   * Display clear opt-in messages explaining data collection and usage
   */
  getDataCollectionOptIn(): {
    title: string;
    message: string;
    benefits: string[];
    dataUsage: string[];
    userRights: string[];
  } {
    return {
      title: "Welcome to Health Tracker",
      message:
        "Health Tracker helps you track and manage your exercise data. We respect your privacy and want to be transparent about how we handle your information.",
      benefits: [
        "Automatically sync exercise data from your health platform",
        "Track your fitness progress over time",
        "Resolve conflicts between manual entries and synced data",
        "Keep your data secure and private on your device",
      ],
      dataUsage: [
        "Exercise data is stored locally on your device",
        "No data is sent to external servers",
        "You control which health permissions to grant",
        "You can delete all data at any time",
      ],
      userRights: [
        "You can opt out of data collection at any time",
        "You can selectively choose which permissions to grant",
        "You can delete all your data completely",
        "You can review and modify your privacy settings",
      ],
    };
  }

  /**
   * Get permission requests with explanations for a specific platform
   */
  getPermissionRequests(platform: HealthPlatform): PermissionRequest {
    const basePermissions = this.getBasePermissions();

    return {
      platform,
      permissions: basePermissions,
      explanation: this.getPlatformExplanation(platform),
      required: false, // Allow selective opt-in
    };
  }

  /**
   * Get base health permissions with explanations
   */
  private getBasePermissions(): HealthPermission[] {
    return [
      {
        type: PermissionType.READ_WORKOUTS,
        name: "Exercise & Workout Data",
        description: "Access to your recorded workouts and exercise sessions",
        explanation:
          "This allows us to sync your exercise data from your health platform, so you can see all your workouts in one place without manual entry.",
        required: true,
      },
      {
        type: PermissionType.READ_STEPS,
        name: "Step Count Data",
        description: "Access to your daily step count and walking data",
        explanation:
          "Step data helps provide a complete picture of your daily activity and can be used to track walking-based exercises.",
        required: false,
      },
      {
        type: PermissionType.READ_HEART_RATE,
        name: "Heart Rate Data",
        description: "Access to heart rate measurements during exercise",
        explanation:
          "Heart rate data can help provide more detailed insights into your workout intensity and recovery.",
        required: false,
      },
      {
        type: PermissionType.READ_ACTIVITY,
        name: "General Activity Data",
        description: "Access to general physical activity and movement data",
        explanation:
          "Activity data helps identify periods of exercise that might not be formally recorded as workouts.",
        required: false,
      },
    ];
  }

  /**
   * Get platform-specific explanation
   */
  private getPlatformExplanation(platform: HealthPlatform): string {
    switch (platform) {
      case HealthPlatform.APPLE_HEALTHKIT:
        return "Health Tracker would like to access your Apple Health data to automatically sync your exercise information. You can choose which types of data to share, and all data remains private on your device.";

      case HealthPlatform.GOOGLE_HEALTH_CONNECT:
        return "Health Tracker would like to access your Google Health Connect data to automatically sync your exercise information. You have full control over which data types to share, and your privacy is protected.";

      default:
        return "Health Tracker would like to access your health platform data to provide automatic exercise tracking. You control which permissions to grant.";
    }
  }

  /**
   * Handle selective permission opt-in
   */
  async requestSelectivePermissions(
    platform: HealthPlatform,
    selectedPermissions: Set<PermissionType>
  ): Promise<PermissionStatus> {
    // Update opt-in settings
    this.optInSettings.selectedPermissions = selectedPermissions;
    this.optInSettings.dataCollection = selectedPermissions.size > 0;
    this.optInSettings.syncEnabled = selectedPermissions.has(
      PermissionType.READ_WORKOUTS
    );
    this.optInSettings.consentTimestamp = new Date();

    // In a real implementation, this would call platform-specific permission APIs
    const permissionResults = new Map<PermissionType, boolean>();

    // Simulate permission requests
    for (const permission of selectedPermissions) {
      // For testing, assume permissions are granted
      permissionResults.set(permission, true);
    }

    const requiredPermissions = this.getBasePermissions()
      .filter((p) => p.required)
      .map((p) => p.type);

    const requiredGranted = requiredPermissions.every(
      (p) => permissionResults.get(p) === true
    );

    return {
      platform,
      permissions: permissionResults,
      allGranted: Array.from(selectedPermissions).every(
        (p) => permissionResults.get(p) === true
      ),
      requiredGranted,
    };
  }

  /**
   * Check current permission status
   */
  async getPermissionStatus(
    platform: HealthPlatform
  ): Promise<PermissionStatus> {
    // In a real implementation, this would check actual platform permissions
    const permissions = new Map<PermissionType, boolean>();

    for (const permission of this.optInSettings.selectedPermissions) {
      permissions.set(permission, true);
    }

    const requiredPermissions = this.getBasePermissions()
      .filter((p) => p.required)
      .map((p) => p.type);

    const requiredGranted = requiredPermissions.every(
      (p) => permissions.get(p) === true
    );

    return {
      platform,
      permissions,
      allGranted:
        this.optInSettings.selectedPermissions.size > 0 &&
        Array.from(this.optInSettings.selectedPermissions).every(
          (p) => permissions.get(p) === true
        ),
      requiredGranted,
    };
  }

  /**
   * Update opt-in settings
   */
  updateOptInSettings(settings: Partial<OptInSettings>): void {
    this.optInSettings = {
      ...this.optInSettings,
      ...settings,
    };

    if (settings.explanationShown) {
      this.optInSettings.explanationShown = true;
    }
  }

  /**
   * Get current opt-in settings
   */
  getOptInSettings(): OptInSettings {
    return { ...this.optInSettings };
  }

  /**
   * Check if user has seen data collection explanation
   */
  hasSeenDataCollectionExplanation(): boolean {
    return this.optInSettings.explanationShown;
  }

  /**
   * Mark data collection explanation as shown
   */
  markExplanationShown(): void {
    this.optInSettings.explanationShown = true;
  }

  /**
   * Check if sync is enabled
   */
  isSyncEnabled(): boolean {
    return (
      this.optInSettings.syncEnabled &&
      this.optInSettings.selectedPermissions.has(PermissionType.READ_WORKOUTS)
    );
  }

  /**
   * Get permission explanation for a specific permission type
   */
  getPermissionExplanation(permissionType: PermissionType): string {
    const permission = this.getBasePermissions().find(
      (p) => p.type === permissionType
    );
    return (
      permission?.explanation ||
      "This permission helps provide better health tracking features."
    );
  }

  /**
   * Revoke specific permissions
   */
  async revokePermissions(
    permissionsToRevoke: Set<PermissionType>
  ): Promise<void> {
    for (const permission of permissionsToRevoke) {
      this.optInSettings.selectedPermissions.delete(permission);
    }

    // Update sync status if workout permission is revoked
    if (permissionsToRevoke.has(PermissionType.READ_WORKOUTS)) {
      this.optInSettings.syncEnabled = false;
    }

    // If no permissions remain, disable data collection
    if (this.optInSettings.selectedPermissions.size === 0) {
      this.optInSettings.dataCollection = false;
    }
  }

  /**
   * Get privacy settings summary
   */
  getPrivacySettingsSummary(): {
    dataCollectionEnabled: boolean;
    syncEnabled: boolean;
    permissionsGranted: PermissionType[];
    consentDate?: Date;
  } {
    const summary = {
      dataCollectionEnabled: this.optInSettings.dataCollection,
      syncEnabled: this.optInSettings.syncEnabled,
      permissionsGranted: Array.from(this.optInSettings.selectedPermissions),
    };

    if (this.optInSettings.consentTimestamp) {
      return {
        ...summary,
        consentDate: this.optInSettings.consentTimestamp,
      };
    }

    return summary;
  }

  /**
   * Reset all permissions and opt-in settings
   */
  resetPermissions(): void {
    this.optInSettings = {
      dataCollection: false,
      syncEnabled: false,
      selectedPermissions: new Set(),
      explanationShown: false,
    };
  }
}
