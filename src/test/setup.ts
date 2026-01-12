// Jest test setup configuration

import "react-native-gesture-handler/jestSetup";

// Mock react-native modules
jest.mock("react-native-sqlite-storage", () => {
  // Create a factory function to ensure each test gets a fresh database
  const createMockDatabase = () => {
    // In-memory storage for this database instance
    const mockStorage = new Map<string, any[]>();

    const createMockRows = (data: any[]) => ({
      length: data.length,
      item: jest.fn((index: number) => data[index] || {}),
      raw: jest.fn(() => data),
    });

    const createMockResultSet = (
      data: any[] = [],
      rowsAffected: number = 0
    ) => ({
      rows: createMockRows(data),
      rowsAffected,
      insertId: 1,
    });

    const mockDatabase = {
      transaction: jest.fn((callback, errorCallback, successCallback) => {
        // Create a snapshot of current state for rollback
        const snapshot = new Map();
        for (const [key, value] of mockStorage.entries()) {
          snapshot.set(key, [...value]);
        }

        const rollback = () => {
          mockStorage.clear();
          for (const [key, value] of snapshot.entries()) {
            mockStorage.set(key, value);
          }
        };

        // Create a transaction-specific storage that can be rolled back
        const transactionStorage = new Map();
        for (const [key, value] of mockStorage.entries()) {
          transactionStorage.set(key, [...value]);
        }

        // Create a transaction object that uses transaction-specific storage
        const transactionObject = {
          executeSql: jest.fn((query: string, params: any[] = []) => {
            const normalizedQuery = query.trim().toLowerCase();

            // Handle different SQL operations on transaction storage
            if (
              normalizedQuery.includes("insert") ||
              normalizedQuery.includes("replace")
            ) {
              // Extract table name for INSERT/REPLACE operations
              const tableMatch = query.match(/into\s+(\w+)/i);
              const tableName = tableMatch ? tableMatch[1] : "unknown";

              if (!transactionStorage.has(tableName)) {
                transactionStorage.set(tableName, []);
              }

              // For exercise_records, create a mock record
              if (tableName === "exercise_records" && params.length >= 9) {
                const record = {
                  id: params[0],
                  name: params[1],
                  start_time: params[2],
                  duration: params[3],
                  source: params[4],
                  platform: params[5],
                  metadata: params[6],
                  created_at: params[7],
                  updated_at: params[8],
                };

                const records = transactionStorage.get(tableName)!;
                const existingIndex = records.findIndex(
                  (r: any) => r.id === record.id
                );
                if (existingIndex >= 0) {
                  records[existingIndex] = record;
                } else {
                  records.push(record);
                }
              }

              // For audit_records
              if (tableName === "audit_records" && params.length >= 7) {
                const record = {
                  id: params[0],
                  action: params[1],
                  timestamp: params[2],
                  record_id: params[3],
                  before_data: params[4],
                  after_data: params[5],
                  metadata: params[6],
                };

                const records = transactionStorage.get(tableName)!;
                records.push(record);

                // Simulate cleanup: keep only latest 100 records
                if (records.length > 100) {
                  records.sort((a: any, b: any) => b.timestamp - a.timestamp);
                  records.splice(100);
                }
              }

              return Promise.resolve([createMockResultSet([], 1)]);
            }

            if (normalizedQuery.includes("select")) {
              // Handle SELECT operations on transaction storage
              const tableMatch = query.match(/from\s+(\w+)/i);
              const tableName = tableMatch ? tableMatch[1] : "unknown";

              let records = transactionStorage.get(tableName) || [];

              // Handle WHERE clauses for specific queries
              if (
                normalizedQuery.includes("where id = ?") &&
                params.length > 0
              ) {
                records = records.filter((r: any) => r.id === params[0]);
              }

              // Handle date range queries
              if (
                normalizedQuery.includes("start_time >= ?") &&
                params.length >= 2
              ) {
                const startTime = params[0];
                const endTime = params[1];
                records = records.filter(
                  (r: any) =>
                    r.start_time >= startTime && r.start_time <= endTime
                );
              }

              // Handle ORDER BY
              if (normalizedQuery.includes("order by start_time desc")) {
                records = records.sort(
                  (a: any, b: any) => b.start_time - a.start_time
                );
              }

              if (normalizedQuery.includes("order by timestamp desc")) {
                records = records.sort(
                  (a: any, b: any) => b.timestamp - a.timestamp
                );
              }

              // Handle LIMIT
              const limitMatch = query.match(/limit\s+(\d+)/i);
              if (limitMatch && limitMatch[1]) {
                const limit = parseInt(limitMatch[1]);
                records = records.slice(0, limit);
              }

              return Promise.resolve([createMockResultSet(records)]);
            }

            if (normalizedQuery.includes("delete")) {
              // Handle DELETE operations on transaction storage
              const tableMatch = query.match(/from\s+(\w+)/i);
              const tableName = tableMatch ? tableMatch[1] : "unknown";

              if (transactionStorage.has(tableName)) {
                const records = transactionStorage.get(tableName)!;

                if (
                  normalizedQuery.includes("where id = ?") &&
                  params.length > 0
                ) {
                  const initialLength = records.length;
                  const filteredRecords = records.filter(
                    (r: any) => r.id !== params[0]
                  );
                  transactionStorage.set(tableName, filteredRecords);

                  const rowsAffected = initialLength - filteredRecords.length;
                  return Promise.resolve([
                    createMockResultSet([], rowsAffected),
                  ]);
                }

                // Handle cleanup queries (DELETE with complex WHERE clauses)
                if (normalizedQuery.includes("where id not in")) {
                  // For audit cleanup, simulate keeping only latest 100
                  records.sort((a: any, b: any) => b.timestamp - a.timestamp);
                  const toKeep = records.slice(0, 100);
                  transactionStorage.set(tableName, toKeep);
                  return Promise.resolve([
                    createMockResultSet([], records.length - toKeep.length),
                  ]);
                }
              }

              return Promise.resolve([createMockResultSet([], 0)]);
            }

            if (normalizedQuery.includes("update")) {
              // Handle UPDATE operations on transaction storage
              return Promise.resolve([createMockResultSet([], 1)]);
            }

            if (normalizedQuery.includes("drop table")) {
              // Handle DROP TABLE operations on transaction storage
              const tableMatch = query.match(/drop table if exists\s+(\w+)/i);
              if (tableMatch) {
                const tableName = tableMatch[1];
                transactionStorage.delete(tableName);
              }
              return Promise.resolve([createMockResultSet()]);
            }

            // Default case for CREATE TABLE, etc.
            return Promise.resolve([createMockResultSet()]);
          }),
        };

        try {
          // Execute the transaction callback with the transaction object
          const result = callback(transactionObject);

          // If the callback returns a promise, handle it properly
          if (result && typeof result.then === "function") {
            return result
              .then((res: any) => {
                // On success, commit transaction changes to main storage
                for (const [key, value] of transactionStorage.entries()) {
                  mockStorage.set(key, value);
                }
                if (successCallback) {
                  successCallback();
                }
                return res;
              })
              .catch((error: any) => {
                rollback();
                if (errorCallback) {
                  errorCallback(error);
                } else {
                  throw error;
                }
              });
          } else {
            // On success, commit transaction changes to main storage
            for (const [key, value] of transactionStorage.entries()) {
              mockStorage.set(key, value);
            }
            if (successCallback) {
              successCallback();
            }
            return result;
          }
        } catch (error) {
          rollback();
          if (errorCallback) {
            errorCallback(error);
          } else {
            throw error;
          }
        }
      }),
      executeSql: jest.fn((query: string, params: any[] = []) => {
        const normalizedQuery = query.trim().toLowerCase();

        // Handle different SQL operations
        if (
          normalizedQuery.includes("insert") ||
          normalizedQuery.includes("replace")
        ) {
          // Extract table name for INSERT/REPLACE operations
          const tableMatch = query.match(/into\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : "unknown";

          if (!mockStorage.has(tableName!)) {
            mockStorage.set(tableName!, []);
          }

          // For exercise_records, create a mock record
          if (tableName === "exercise_records" && params.length >= 9) {
            const record = {
              id: params[0],
              name: params[1],
              start_time: params[2],
              duration: params[3],
              source: params[4],
              platform: params[5],
              metadata: params[6],
              created_at: params[7],
              updated_at: params[8],
            };

            const records = mockStorage.get(tableName)!;
            const existingIndex = records.findIndex((r) => r.id === record.id);
            if (existingIndex >= 0) {
              records[existingIndex] = record;
            } else {
              records.push(record);
            }
          }

          // For audit_records
          if (tableName === "audit_records" && params.length >= 7) {
            const record = {
              id: params[0],
              action: params[1],
              timestamp: params[2],
              record_id: params[3],
              before_data: params[4],
              after_data: params[5],
              metadata: params[6],
            };

            const records = mockStorage.get(tableName)!;
            records.push(record);

            // Simulate cleanup: keep only latest 100 records
            if (records.length > 100) {
              records.sort((a, b) => b.timestamp - a.timestamp);
              records.splice(100);
            }
          }

          return Promise.resolve([createMockResultSet([], 1)]);
        }

        if (normalizedQuery.includes("select")) {
          // Handle SELECT operations
          const tableMatch = query.match(/from\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : "unknown";

          let records = mockStorage.get(tableName!) || [];

          // Handle WHERE clauses for specific queries
          if (normalizedQuery.includes("where id = ?") && params.length > 0) {
            records = records.filter((r) => r.id === params[0]);
          }

          // Handle date range queries
          if (
            normalizedQuery.includes("start_time >= ?") &&
            params.length >= 2
          ) {
            const startTime = params[0];
            const endTime = params[1];
            records = records.filter(
              (r) => r.start_time >= startTime && r.start_time <= endTime
            );
          }

          // Handle ORDER BY
          if (normalizedQuery.includes("order by start_time desc")) {
            records = records.sort((a, b) => b.start_time - a.start_time);
          }

          if (normalizedQuery.includes("order by timestamp desc")) {
            records = records.sort((a, b) => b.timestamp - a.timestamp);
          }

          // Handle LIMIT
          const limitMatch = query.match(/limit\s+(\d+)/i);
          if (limitMatch && limitMatch[1]) {
            const limit = parseInt(limitMatch[1]);
            records = records.slice(0, limit);
          }

          return Promise.resolve([createMockResultSet(records)]);
        }

        if (normalizedQuery.includes("delete")) {
          // Handle DELETE operations
          const tableMatch = query.match(/from\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : "unknown";

          if (mockStorage.has(tableName!)) {
            const records = mockStorage.get(tableName!)!;

            if (normalizedQuery.includes("where id = ?") && params.length > 0) {
              const initialLength = records.length;
              const filteredRecords = records.filter((r) => r.id !== params[0]);
              mockStorage.set(tableName!, filteredRecords);

              const rowsAffected = initialLength - filteredRecords.length;
              return Promise.resolve([createMockResultSet([], rowsAffected)]);
            }

            // Handle cleanup queries (DELETE with complex WHERE clauses)
            if (normalizedQuery.includes("where id not in")) {
              // For audit cleanup, simulate keeping only latest 100
              records.sort((a, b) => b.timestamp - a.timestamp);
              const toKeep = records.slice(0, 100);
              mockStorage.set(tableName!, toKeep);
              return Promise.resolve([
                createMockResultSet([], records.length - toKeep.length),
              ]);
            }
          }

          return Promise.resolve([createMockResultSet([], 0)]);
        }

        if (normalizedQuery.includes("update")) {
          // Handle UPDATE operations
          return Promise.resolve([createMockResultSet([], 1)]);
        }

        if (normalizedQuery.includes("drop table")) {
          // Handle DROP TABLE operations
          const tableMatch = query.match(/drop table if exists\s+(\w+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            mockStorage.delete(tableName!);
          }
          return Promise.resolve([createMockResultSet()]);
        }

        // Default case for CREATE TABLE, etc.
        return Promise.resolve([createMockResultSet()]);
      }),
      close: jest.fn(() => Promise.resolve()),

      // Add method to clear storage for test isolation
      _clearStorage: () => {
        mockStorage.clear();
      },
    };

    return mockDatabase;
  };

  // Create the mock database instance
  const mockDatabase = createMockDatabase();

  return {
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
    default: {
      DEBUG: jest.fn(),
      enablePromise: jest.fn(),
      openDatabase: jest.fn(() => Promise.resolve(mockDatabase)),
    },
  };
});

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock("react-native-health", () => ({
  initHealthKit: jest.fn(),
  getPermissions: jest.fn(),
  getSamples: jest.fn(),
}));

jest.mock("react-native-health-connect", () => ({
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  readRecords: jest.fn(),
}));

// Mock React Native Platform
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "17.0",
    select: (obj: any) => obj.ios || obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

// Global test utilities
(global as any).mockExerciseRecord = {
  id: "test-id",
  name: "Running",
  startTime: new Date("2024-01-01T10:00:00Z"),
  duration: 30,
  source: "manual" as const,
  metadata: {},
  createdAt: new Date("2024-01-01T10:00:00Z"),
  updatedAt: new Date("2024-01-01T10:00:00Z"),
};

// Suppress console warnings in tests
(global as any).console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
