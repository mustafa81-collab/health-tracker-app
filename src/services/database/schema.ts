// Database schema definitions and SQL statements

export const DATABASE_SCHEMA = {
  // Exercise Records Table
  EXERCISE_RECORDS: `
    CREATE TABLE IF NOT EXISTS exercise_records (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('manual', 'synced')),
      platform TEXT CHECK (platform IN ('apple_healthkit', 'google_health_connect')),
      metadata TEXT, -- JSON blob
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,

  // Conflicts Table
  CONFLICTS: `
    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      manual_record_id TEXT NOT NULL,
      synced_record_id TEXT NOT NULL,
      overlap_duration INTEGER NOT NULL,
      conflict_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detected_at INTEGER NOT NULL,
      FOREIGN KEY (manual_record_id) REFERENCES exercise_records(id),
      FOREIGN KEY (synced_record_id) REFERENCES exercise_records(id)
    );
  `,

  // Audit Trail Table
  AUDIT_RECORDS: `
    CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      record_id TEXT,
      before_data TEXT, -- JSON blob
      after_data TEXT,  -- JSON blob
      metadata TEXT     -- JSON blob
    );
  `,

  // Held Records Table (for conflict preservation)
  HELD_RECORDS: `
    CREATE TABLE IF NOT EXISTS held_records (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('manual', 'synced')),
      platform TEXT CHECK (platform IN ('apple_healthkit', 'google_health_connect')),
      metadata TEXT, -- JSON blob
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      held_at INTEGER NOT NULL
    );
  `,

  // Conflict Resolutions Table
  CONFLICT_RESOLUTIONS: `
    CREATE TABLE IF NOT EXISTS conflict_resolutions (
      id TEXT PRIMARY KEY,
      conflict_id TEXT NOT NULL,
      resolution_choice TEXT NOT NULL,
      resolved_at INTEGER NOT NULL,
      before_state TEXT, -- JSON blob
      after_state TEXT,  -- JSON blob
      user_notes TEXT,
      FOREIGN KEY (conflict_id) REFERENCES conflicts(id)
    );
  `,

  // Indexes for performance
  INDEXES: [
    "CREATE INDEX IF NOT EXISTS idx_exercise_records_start_time ON exercise_records(start_time);",
    "CREATE INDEX IF NOT EXISTS idx_exercise_records_source ON exercise_records(source);",
    "CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);",
    "CREATE INDEX IF NOT EXISTS idx_audit_records_timestamp ON audit_records(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_held_records_held_at ON held_records(held_at);",
    "CREATE INDEX IF NOT EXISTS idx_conflict_resolutions_conflict_id ON conflict_resolutions(conflict_id);",
  ],
};

export const MIGRATION_QUERIES = {
  // Version 1.0 - Initial schema
  "1.0": [
    DATABASE_SCHEMA.EXERCISE_RECORDS,
    DATABASE_SCHEMA.CONFLICTS,
    DATABASE_SCHEMA.AUDIT_RECORDS,
    DATABASE_SCHEMA.HELD_RECORDS,
    DATABASE_SCHEMA.CONFLICT_RESOLUTIONS,
    ...DATABASE_SCHEMA.INDEXES,
  ],
};

export const DROP_TABLES = [
  "DROP TABLE IF EXISTS conflict_resolutions;",
  "DROP TABLE IF EXISTS held_records;",
  "DROP TABLE IF EXISTS audit_records;",
  "DROP TABLE IF EXISTS conflicts;",
  "DROP TABLE IF EXISTS exercise_records;",
];
