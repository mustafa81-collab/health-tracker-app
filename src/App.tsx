/**
 * Main Application Component
 * 
 * This is the root component of the Health Tracker application that manages:
 * - Application initialization and database setup
 * - Screen navigation and state management
 * - Service instance management and dependency injection
 * - Global error handling and user feedback
 * 
 * The app provides a multi-screen interface for:
 * - Manual exercise logging with validation
 * - Exercise history viewing and management
 * - Conflict resolution between manual and synced data
 * - Exercise editing and deletion
 * 
 * Architecture:
 * - Uses React hooks for state management
 * - Implements service layer pattern for business logic
 * - Provides centralized navigation and screen management
 * - Handles database initialization and service dependency injection
 */

import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Alert,
  Text,
} from "react-native";
import SQLite from "react-native-sqlite-storage";

// Import all UI components
import { ExerciseLoggingScreen } from "./components/ExerciseLoggingScreen";
import { ExerciseHistoryScreen } from "./components/ExerciseHistoryScreen";
import { ConflictResolutionScreen } from "./components/ConflictResolutionScreen";
import { ExerciseEditScreen } from "./components/ExerciseEditScreen";
import { DeleteConfirmationModal } from "./components/DeleteConfirmationModal";

// Import all business logic services
import { DataStorageManager } from "./services/database/DataStorageManager";
import { ExerciseRecordManager } from "./services/ExerciseRecordManager";
import { PermissionManager } from "./services/PermissionManager";
import { DataPurgeService } from "./services/DataPurgeService";

// Import type definitions
import { Exercise_Record, Conflict, AppScreen } from "./types";

/**
 * Main Application Component
 * 
 * Manages the overall application state, navigation, and service initialization.
 * Provides a centralized hub for all major application functionality.
 */
const App: React.FC = () => {
  // Application state management
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("logging");
  const [selectedExercise, setSelectedExercise] =
    useState<Exercise_Record | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Service instances - dependency injection pattern
  const [database, setDatabase] = useState<SQLite.SQLiteDatabase | null>(null);
  const [storageManager, setStorageManager] =
    useState<DataStorageManager | null>(null);
  const [recordManager, setRecordManager] =
    useState<ExerciseRecordManager | null>(null);
  const [permissionManager] = useState(() => new PermissionManager());
  const [dataPurgeService, setDataPurgeService] =
    useState<DataPurgeService | null>(null);

  // Initialize application on component mount
  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Initialize the application by setting up database and services
   * 
   * This method:
   * 1. Opens the SQLite database connection
   * 2. Initializes all service instances with proper dependencies
   * 3. Sets up the service layer for the application
   * 4. Handles initialization errors gracefully
   */
  const initializeApp = async () => {
    try {
      setIsLoading(true);

      // Initialize SQLite database
      const db = await SQLite.openDatabase({
        name: "health_tracker.db",
        location: "default",
      });

      setDatabase(db);

      // Initialize service layer with dependency injection
      const storage = new DataStorageManager(db);
      const records = new ExerciseRecordManager(storage);
      const purge = new DataPurgeService(storage, permissionManager);

      setStorageManager(storage);
      setRecordManager(records);
      setDataPurgeService(purge);

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to initialize app:", error);
      Alert.alert("Error", "Failed to initialize the application");
      setIsLoading(false);
    }
  };

  // Navigation handlers - manage screen transitions and state
  
  /**
   * Navigate to a specific screen and reset related state
   * @param screen - The target screen to navigate to
   */
  const navigateToScreen = (screen: AppScreen) => {
    setCurrentScreen(screen);
    setSelectedExercise(null);
    setSelectedConflict(null);
  };

  /**
   * Navigate to exercise edit screen with selected exercise
   * @param exercise - The exercise record to edit
   */
  const navigateToEdit = (exercise: Exercise_Record) => {
    setSelectedExercise(exercise);
    setCurrentScreen("edit");
  };

  /**
   * Navigate to conflict resolution screen with selected conflict
   * @param conflict - The conflict to resolve
   */
  const navigateToConflictResolution = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setCurrentScreen("conflict");
  };

  // Exercise management handlers - business logic integration

  /**
   * Handle successful or failed exercise logging
   * @param success - Whether the exercise was logged successfully
   */
  const handleExerciseLogged = async (success: boolean) => {
    if (success) {
      Alert.alert("Success", "Exercise logged successfully");
    }
  };

  /**
   * Handle exercise edit completion
   * @param success - Whether the edit was successful
   * @param updatedRecord - The updated exercise record (if successful)
   */
  const handleExerciseEditComplete = async (
    success: boolean,
    updatedRecord?: Exercise_Record
  ) => {
    if (success) {
      setCurrentScreen("history");
      Alert.alert("Success", "Exercise updated successfully");
    } else {
      Alert.alert("Error", "Failed to update exercise");
    }
  };

  /**
   * Handle record selection from history screen
   * @param record - The selected exercise record
   */
  const handleRecordSelect = (record: Exercise_Record) => {
    setSelectedExercise(record);
  };

  /**
   * Handle exercise deletion with proper error handling
   * @param exerciseId - ID of the exercise to delete
   */
  const handleExerciseDeleted = async (exerciseId: string) => {
    try {
      if (recordManager) {
        await recordManager.deleteExerciseRecord(exerciseId);
        setShowDeleteModal(false);
        setSelectedExercise(null);
        Alert.alert("Success", "Exercise deleted successfully");
      }
    } catch (error) {
      console.error("Failed to delete exercise:", error);
      Alert.alert("Error", "Failed to delete exercise");
    }
  };

  /**
   * Handle delete request by showing confirmation modal
   * @param exercise - The exercise to potentially delete
   */
  const handleDeleteRequest = (exercise: Exercise_Record) => {
    setSelectedExercise(exercise);
    setShowDeleteModal(true);
  };

  // Conflict resolution handlers

  /**
   * Handle conflict resolution completion
   * @param success - Whether the conflict was resolved successfully
   */
  const handleConflictResolutionComplete = async (success: boolean) => {
    if (success) {
      setCurrentScreen("history");
      Alert.alert("Success", "Conflict resolved successfully");
    } else {
      Alert.alert("Error", "Failed to resolve conflict");
    }
  };

  // Data management handlers

  /**
   * Handle data purge request with user confirmation
   * Shows confirmation dialog and executes purge if confirmed
   */
  const handleDataPurge = async () => {
    try {
      if (dataPurgeService) {
        const confirmation = dataPurgeService.getPurgeConfirmation();
        Alert.alert(confirmation.title, confirmation.message, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete All Data",
            style: "destructive",
            onPress: async () => {
              await dataPurgeService.purgeAllData("DELETE ALL DATA");
              Alert.alert("Success", "All data has been deleted");
            },
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to purge data:", error);
      Alert.alert("Error", "Failed to delete data");
    }
  };

  /**
   * Render the current screen based on application state
   * 
   * This method implements a simple router that renders different screens
   * based on the currentScreen state and passes appropriate props.
   * 
   * @returns The appropriate screen component or loading indicator
   */
  const renderCurrentScreen = () => {
    if (isLoading || !storageManager) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    switch (currentScreen) {
      case "logging":
        return (
          <ExerciseLoggingScreen
            storageManager={storageManager}
            onExerciseLogged={handleExerciseLogged}
          />
        );

      case "history":
        return (
          <ExerciseHistoryScreen
            storageManager={storageManager}
            onRecordSelect={handleRecordSelect}
          />
        );

      case "edit":
        return selectedExercise ? (
          <ExerciseEditScreen
            exercise={selectedExercise}
            storageManager={storageManager}
            onEditComplete={handleExerciseEditComplete}
          />
        ) : null;

      case "conflict":
        return selectedConflict ? (
          <ConflictResolutionScreen
            conflictData={selectedConflict}
            storageManager={storageManager}
            onResolutionComplete={handleConflictResolutionComplete}
          />
        ) : null;

      default:
        return null;
    }
  };

  /**
   * Main render method
   * 
   * Renders the application with:
   * - Safe area handling for different device types
   * - Status bar configuration
   * - Current screen content
   * - Delete confirmation modal overlay
   */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderCurrentScreen()}

      {/* Delete confirmation modal - shown when user requests exercise deletion */}
      {selectedExercise && (
        <DeleteConfirmationModal
          visible={showDeleteModal}
          exercise={selectedExercise}
          onConfirm={() => handleExerciseDeleted(selectedExercise.id)}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedExercise(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

/**
 * Stylesheet for the main application component
 * 
 * Defines consistent styling for:
 * - Main container layout and background
 * - Loading state presentation
 * - Typography and color scheme
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5", // Light gray background for the entire app
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#666", // Medium gray for loading text
  },
});

export default App;
