/**
 * Core Type Definitions for Health Tracker Application
 * 
 * This file contains all TypeScript type definitions, interfaces, and enums
 * used throughout the Health Tracker application. It provides:
 * 
 * - Data source and platform enumerations
 * - Exercise record and metadata structures
 * - Conflict detection and resolution types
 * - Audit trail and validation types
 * - Health platform integration interfaces
 * - Application navigation and UI types
 * 
 * The types are organized to support:
 * - Manual exercise logging with validation
 * - Health platform data synchronization
 * - Conflict detection and resolution workflows
 * - Comprehensive audit trails
 * - Cross-platform health data integration
 */

/**
 * Enumeration of data sources for exercise records
 * 
 * Distinguishes between manually entered data and data synchronized
 * from external health platforms.
 */
export enum DataSource {
  MANUAL = "manual",    // User manually entered the exercise
  SYNCED = "synced",    // Exercise data synchronized from health platform
}

/**
 * Supported health platforms for data synchronization
 * 
 * Currently supports major mobile health platforms with plans
 * for expansion to additional platforms.
 */
export enum HealthPlatform {
  APPLE_HEALTHKIT = "apple_healthkit",           // iOS HealthKit integration
  GOOGLE_HEALTH_CONNECT = "google_health_connect", // Android Health Connect
}

/**
 * Validation status for exercise records
 * 
 * Tracks the validation state of exercise data throughout
 * the application lifecycle.
 */
export enum ValidationStatus {
  VALID = "valid",       // Data has passed all validation checks
  INVALID = "invalid",   // Data has failed validation
  PENDING = "pending",   // Validation is in progress
}

/**
 * User choices for resolving data conflicts
 * 
 * Provides options when manual and synced data conflict,
 * allowing users to choose their preferred resolution strategy.
 */
export enum ResolutionChoice {
  KEEP_MANUAL = "keep_manual",     // Keep the manually entered data
  KEEP_SYNCED = "keep_synced",     // Keep the synchronized data
  MERGE_RECORDS = "merge_records", // Combine both records into one
  KEEP_BOTH = "keep_both",         // Preserve both as separate records
}

/**
 * Types of conflicts that can occur between data sources
 * 
 * Categorizes different conflict scenarios to enable
 * appropriate resolution strategies.
 */
export enum ConflictType {
  TIME_OVERLAP = "time_overlap",         // Exercises overlap in time
  DUPLICATE_EXERCISE = "duplicate_exercise", // Same exercise from different sources
  CONFLICTING_DATA = "conflicting_data", // Different data for same time period
}

/**
 * Audit trail action types
 * 
 * Tracks all significant actions performed on exercise records
 * for accountability and debugging purposes.
 */
export enum AuditAction {
  CONFLICT_RESOLVED = "conflict_resolved", // A data conflict was resolved
  RECORD_CREATED = "record_created",       // New exercise record created
  RECORD_UPDATED = "record_updated",       // Existing record modified
  RECORD_DELETED = "record_deleted",       // Record was deleted
  RESOLUTION_UNDONE = "resolution_undone", // Conflict resolution was reversed
}

/**
 * Exercise metadata interface
 * 
 * Flexible container for additional exercise information that varies
 * by data source and health platform. Supports extensibility through
 * index signature while providing common fields.
 * 
 * Common fields include:
 * - Biometric data (calories, heart rate, steps)
 * - Device and app identification
 * - Synchronization metadata
 * - Exercise classification data
 * - User notes and confidence scores
 */
export interface ExerciseMetadata {
  calories?: number;           // Estimated calories burned
  heartRate?: number;          // Average heart rate during exercise
  deviceId?: string;           // Device that recorded the exercise
  appSource?: string;          // Source application name
  originalId?: string;         // Original ID from health platform
  syncedAt?: Date;            // When the data was synchronized
  dataType?: string;          // Type of health data
  steps?: number;             // Step count during exercise
  estimatedDistance?: number; // Distance covered (in meters)
  workoutType?: string;       // Specific workout classification
  exerciseType?: string;      // General exercise category
  sourceName?: string;        // Name of the data source
  endTime?: Date;            // Exercise end time (if different from start + duration)
  title?: string;            // User-defined title
  notes?: string;            // User notes about the exercise
  confidence?: number;       // Confidence score (0-1) for synced data
  // Allow additional properties for extensibility
  [key: string]: any;
}

/**
 * Core exercise record interface
 * 
 * Represents a single exercise session with all essential information.
 * This is the primary data structure used throughout the application
 * for storing and manipulating exercise data.
 * 
 * All exercise records, regardless of source, conform to this interface
 * to ensure consistent handling across the application.
 */
export interface Exercise_Record {
  id: string;                    // Unique identifier for the record
  name: string;                  // Human-readable exercise name
  startTime: Date;              // When the exercise began
  duration: number;             // Exercise duration in minutes
  source: DataSource;           // Whether manually entered or synced
  platform?: HealthPlatform | undefined; // Health platform (if synced)
  metadata: ExerciseMetadata;   // Additional exercise information
  createdAt: Date;             // When this record was created
  updatedAt: Date;             // When this record was last modified
}

/**
 * Manual exercise log interface
 * 
 * Extends Exercise_Record with additional fields specific to manually
 * entered exercises, including validation status and user notes.
 */
export interface Manual_Log extends Exercise_Record {
  source: DataSource.MANUAL;           // Always manual for this type
  validationStatus: ValidationStatus; // Current validation state
  userNotes?: string;                 // Optional user-provided notes
}

/**
 * Synchronized exercise data interface
 * 
 * Extends Exercise_Record with fields specific to data synchronized
 * from external health platforms, including platform identification
 * and confidence scoring.
 */
export interface Synced_Data extends Exercise_Record {
  source: DataSource.SYNCED;    // Always synced for this type
  platform: HealthPlatform;     // Required platform identification
  originalId: string;           // Required original platform ID
  syncedAt: Date;              // Required synchronization timestamp
  confidence: number;          // Required confidence score (0-1)
}

/**
 * Exercise input interface
 * 
 * Simplified interface for capturing user input when creating
 * new exercise records. Contains only the essential fields
 * required from the user.
 */
export interface ExerciseInput {
  name: string;        // Exercise name
  startTime: Date;     // When the exercise started
  duration: number;    // Duration in minutes
}

/**
 * Validation result interface
 * 
 * Contains the results of validating exercise input data,
 * including validity status and detailed error messages.
 */
export interface ValidationResult {
  isValid: boolean;    // Whether the data passed validation
  errors: string[];    // Array of validation error messages
}

/**
 * Validation rules configuration
 * 
 * Defines the validation rules applied to exercise input,
 * allowing for configurable validation behavior.
 */
export interface ValidationRules {
  nameRequired: boolean;     // Whether exercise name is required
  nameMinLength: number;     // Minimum length for exercise names
  durationMin: number;       // Minimum duration in minutes
  timeFormat: string;        // Expected time format string
}

export interface Conflict {
  id: string;
  manualRecord: Exercise_Record;
  syncedRecord: Exercise_Record;
  overlapDuration: number;
  conflictType: ConflictType;
  detectedAt: Date;
}

export interface OverlapResult {
  hasOverlap: boolean;
  overlapDuration: number;
  overlapStart: Date;
  overlapEnd: Date;
}

export interface ConflictState {
  manualRecord?: Exercise_Record;
  syncedRecord?: Exercise_Record;
  mergedRecord?: Exercise_Record;
}

export interface ConflictResolution {
  id: string;
  conflictId: string;
  resolutionChoice: ResolutionChoice;
  resolvedAt: Date;
  beforeState: ConflictState;
  afterState: ConflictState;
  userNotes?: string;
}

export interface AuditMetadata {
  userId?: string;
  deviceId?: string;
  appVersion?: string;
  source?: string;
  platform?: HealthPlatform;
  originalId?: string;
  validationStatus?: ValidationStatus;
  updatedFields?: string[];
}

export interface AuditRecord {
  id: string;
  action: AuditAction;
  timestamp: Date;
  recordId: string;
  beforeData?: any;
  afterData?: any;
  metadata: AuditMetadata;
}

export interface PermissionStatus {
  granted: boolean;
  permissions: string[];
  deniedPermissions: string[];
}

export interface SyncResult {
  newRecords: Exercise_Record[];
  conflicts: Conflict[];
  lastSyncTimestamp: Date;
  success: boolean;
  error?: string;
}

export interface SyncError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RetryResult {
  success: boolean;
  nextRetryDelay: number;
  maxRetriesReached: boolean;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Health Platform specific types
export interface HKWorkout {
  uuid: string;
  workoutActivityType: string;
  startDate: string;
  endDate: string;
  duration: number;
  totalEnergyBurned?: number;
  sourceName: string;
}

export interface HKQuantitySample {
  uuid: string;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  sourceName: string;
}

export interface ExerciseSession {
  id: string;
  exerciseType: string;
  startTime: string;
  endTime: string;
  title?: string;
  notes?: string;
}

export interface StepsRecord {
  count: number;
  startTime: string;
  endTime: string;
}

// Application navigation types
export type AppScreen = "logging" | "history" | "edit" | "conflict";

// Alias for consistency with database naming
export type Conflict_Record = Conflict;
