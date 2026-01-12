// Service interfaces for the Health Tracker application

import {
  Exercise_Record,
  ExerciseInput,
  ValidationResult,
  ValidationRules,
  PermissionStatus,
  SyncResult,
  SyncError,
  RetryResult,
  Conflict,
  ConflictType,
  OverlapResult,
  ResolutionChoice,
  ConflictResolution,
  DateRange,
  AuditRecord,
  HKWorkout,
  HKQuantitySample,
  ExerciseSession,
  StepsRecord,
} from "@/types";

export interface ExerciseLogger {
  validateExerciseData(data: ExerciseInput): ValidationResult;
  saveManualLog(exercise: ExerciseInput): Promise<Exercise_Record>;
  getValidationRules(): ValidationRules;
}

export interface HealthPlatformSync {
  requestPermissions(): Promise<PermissionStatus>;
  syncExerciseData(): Promise<SyncResult>;
  syncStepData(): Promise<SyncResult>;
  handleSyncFailure(error: SyncError): Promise<RetryResult>;
}

export interface ConflictDetector {
  detectConflicts(
    manualLogs: Exercise_Record[],
    syncedData: Exercise_Record[]
  ): Conflict[];
  analyzeTimeOverlap(
    record1: Exercise_Record,
    record2: Exercise_Record
  ): OverlapResult;
  categorizeConflict(conflict: Conflict): ConflictType;
}

export interface ConflictResolver {
  presentConflictToUser(conflict: Conflict): Promise<ResolutionChoice>;
  applyResolution(conflict: Conflict, choice: ResolutionChoice): Promise<void>;
  createAuditRecord(resolution: ConflictResolution): Promise<void>;
  undoResolution(auditId: string): Promise<void>;
}

export interface DataStorageManager {
  saveExerciseRecord(record: Exercise_Record): Promise<void>;
  getExerciseHistory(dateRange: DateRange): Promise<Exercise_Record[]>;
  updateRecord(id: string, updates: Partial<Exercise_Record>): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  getAuditTrail(limit: number): Promise<AuditRecord[]>;
  initializeDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;
}

export interface HealthKitAdapter extends HealthPlatformSync {
  requestHealthKitPermissions(): Promise<PermissionStatus>;
  queryWorkouts(dateRange: DateRange): Promise<HKWorkout[]>;
  queryStepCount(dateRange: DateRange): Promise<HKQuantitySample[]>;
  convertHKWorkoutToExerciseRecord(workout: HKWorkout): Exercise_Record;
}

export interface HealthConnectAdapter extends HealthPlatformSync {
  requestHealthConnectPermissions(): Promise<PermissionStatus>;
  readExerciseSessions(dateRange: DateRange): Promise<ExerciseSession[]>;
  readStepsData(dateRange: DateRange): Promise<StepsRecord[]>;
  convertSessionToExerciseRecord(session: ExerciseSession): Exercise_Record;
}
