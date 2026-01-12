// Application constants

export const DATABASE_NAME = "health_tracker.db";
export const DATABASE_VERSION = "1.0";

export const VALIDATION_RULES = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DURATION_MIN: 1, // minutes
  DURATION_MAX: 1440, // 24 hours in minutes
  TIME_FORMAT: "YYYY-MM-DD HH:mm:ss",
};

export const SYNC_CONFIG = {
  RETRY_ATTEMPTS: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
  BACKOFF_MULTIPLIER: 2,
};

export const AUDIT_CONFIG = {
  MAX_RECORDS: 100,
  CLEANUP_THRESHOLD: 120, // Clean up when we exceed this number
};

export const CONFLICT_DETECTION = {
  OVERLAP_THRESHOLD_MINUTES: 5, // Minimum overlap to consider a conflict
  SIMILARITY_THRESHOLD: 0.8, // For exercise name similarity
};

export const HEALTH_PERMISSIONS = {
  IOS: [
    "AppleHealthKit.Constants.Permissions.Steps",
    "AppleHealthKit.Constants.Permissions.Workout",
  ],
  ANDROID: [
    "android.permission.health.READ_STEPS",
    "android.permission.health.READ_EXERCISE",
  ],
};

export const ERROR_MESSAGES = {
  VALIDATION: {
    NAME_REQUIRED: "Exercise name is required",
    NAME_TOO_SHORT: "Exercise name must be at least 1 character",
    NAME_TOO_LONG: "Exercise name cannot exceed 100 characters",
    DURATION_REQUIRED: "Duration is required",
    DURATION_INVALID: "Duration must be a positive number",
    DURATION_TOO_SHORT: "Duration must be at least 1 minute",
    DURATION_TOO_LONG: "Duration cannot exceed 24 hours",
    TIME_REQUIRED: "Start time is required",
    TIME_INVALID: "Invalid time format",
  },
  SYNC: {
    PERMISSION_DENIED: "Health data access permission denied",
    NETWORK_ERROR: "Network connection error",
    PLATFORM_UNAVAILABLE: "Health platform is unavailable",
    SYNC_FAILED: "Failed to sync health data",
  },
  STORAGE: {
    SAVE_FAILED: "Failed to save exercise record",
    LOAD_FAILED: "Failed to load exercise data",
    DELETE_FAILED: "Failed to delete exercise record",
    UPDATE_FAILED: "Failed to update exercise record",
  },
};
