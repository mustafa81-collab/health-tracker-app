// Database migration system

import SQLite from "react-native-sqlite-storage";
import { MIGRATION_QUERIES } from "./schema";
import { DATABASE_NAME, DATABASE_VERSION } from "@/utils/constants";

export interface MigrationResult {
  success: boolean;
  version: string;
  error?: string;
}

export class DatabaseMigrator {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<MigrationResult> {
    try {
      // Enable promise-based API
      SQLite.enablePromise(true);

      // Open database (remove the createFromLocation as it might not exist)
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        location: "default",
      });

      // Check current version
      const currentVersion = await this.getCurrentVersion();

      // Run migrations if needed
      if (currentVersion !== DATABASE_VERSION) {
        await this.runMigrations(currentVersion, DATABASE_VERSION);
      }

      return {
        success: true,
        version: DATABASE_VERSION,
      };
    } catch (error) {
      return {
        success: false,
        version: "0.0",
        error:
          error instanceof Error ? error.message : "Unknown migration error",
      };
    }
  }

  private async getCurrentVersion(): Promise<string> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    try {
      // Try to get version from a metadata table
      const result = await this.db.executeSql(
        "SELECT version FROM database_metadata WHERE key = ?",
        ["schema_version"]
      );

      if (result && result.length > 0 && result[0].rows && result[0].rows.length > 0) {
        return result[0].rows.item(0).version;
      }
    } catch (error) {
      // If metadata table doesn't exist, this is a fresh install
      console.log("No existing version found, treating as fresh install");
    }

    return "0.0";
  }

  private async runMigrations(
    fromVersion: string,
    toVersion: string
  ): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    console.log(`Running migrations from ${fromVersion} to ${toVersion}`);

    // Create metadata table if it doesn't exist
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS database_metadata (
        key TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // For now, we only have version 1.0, so run all migrations
    if (fromVersion === "0.0" && toVersion === "1.0") {
      await this.runMigrationBatch(MIGRATION_QUERIES["1.0"]);
    }

    // Update version in metadata
    await this.db.executeSql(
      "INSERT OR REPLACE INTO database_metadata (key, version, updated_at) VALUES (?, ?, ?)",
      ["schema_version", toVersion, Date.now()]
    );

    console.log(`Migration completed to version ${toVersion}`);
  }

  private async runMigrationBatch(queries: string[]): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    for (const query of queries) {
      try {
        await this.db.executeSql(query);
        console.log(
          "Executed migration query:",
          query.substring(0, 50) + "..."
        );
      } catch (error) {
        console.error("Migration query failed:", query);
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  // For testing purposes
  async resetDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Drop all tables
    await this.db.executeSql("DROP TABLE IF EXISTS audit_records;");
    await this.db.executeSql("DROP TABLE IF EXISTS conflicts;");
    await this.db.executeSql("DROP TABLE IF EXISTS exercise_records;");
    await this.db.executeSql("DROP TABLE IF EXISTS database_metadata;");

    // Re-run migrations
    await this.runMigrations("0.0", DATABASE_VERSION);
  }
}
