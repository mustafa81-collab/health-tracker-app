// Exercise edit screen for manual exercise records
// Requirements: 5.3

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { DataStorageManager } from "@/services/database/DataStorageManager";
import {
  Exercise_Record,
  ExerciseInput,
  ValidationResult,
  DataSource,
} from "@/types";
import { ExerciseLogger } from "@/services/ExerciseLogger";
import { VALIDATION_RULES, ERROR_MESSAGES } from "@/utils/constants";

interface ExerciseEditScreenProps {
  exercise: Exercise_Record;
  storageManager: DataStorageManager;
  onEditComplete: (success: boolean, updatedRecord?: Exercise_Record) => void;
}

export const ExerciseEditScreen: React.FC<ExerciseEditScreenProps> = ({
  exercise,
  storageManager,
  onEditComplete,
}) => {
  const [exerciseName, setExerciseName] = useState(exercise.name);
  const [duration, setDuration] = useState(exercise.duration.toString());
  const [startTime, setStartTime] = useState(
    formatDateTimeForInput(exercise.startTime)
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    duration?: string;
    startTime?: string;
  }>({});

  const exerciseLogger = new ExerciseLogger(storageManager);

  // Check if this is a manual exercise (only manual exercises can be edited)
  const isManualExercise = exercise.source === DataSource.MANUAL;

  useEffect(() => {
    if (!isManualExercise) {
      Alert.alert(
        "Cannot Edit",
        "Only manually entered exercises can be edited. Synced exercises cannot be modified.",
        [
          {
            text: "OK",
            onPress: () => onEditComplete(false),
          },
        ]
      );
    }
  }, [isManualExercise, onEditComplete]);

  // Real-time validation as user types
  useEffect(() => {
    validateFields();
  }, [exerciseName, duration, startTime]);

  function formatDateTimeForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  const validateFields = () => {
    const errors: string[] = [];
    const fieldErrs: typeof fieldErrors = {};

    // Validate exercise name
    if (exerciseName.trim().length === 0) {
      fieldErrs.name = ERROR_MESSAGES.VALIDATION.NAME_REQUIRED;
    } else if (exerciseName.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      fieldErrs.name = ERROR_MESSAGES.VALIDATION.NAME_TOO_SHORT;
    } else if (exerciseName.length > VALIDATION_RULES.NAME_MAX_LENGTH) {
      fieldErrs.name = ERROR_MESSAGES.VALIDATION.NAME_TOO_LONG;
    }

    // Validate duration
    const durationNum = parseFloat(duration);
    if (duration.trim().length === 0) {
      fieldErrs.duration = ERROR_MESSAGES.VALIDATION.DURATION_REQUIRED;
    } else if (isNaN(durationNum) || durationNum <= 0) {
      fieldErrs.duration = ERROR_MESSAGES.VALIDATION.DURATION_INVALID;
    } else if (durationNum < VALIDATION_RULES.DURATION_MIN) {
      fieldErrs.duration = ERROR_MESSAGES.VALIDATION.DURATION_TOO_SHORT;
    } else if (durationNum > VALIDATION_RULES.DURATION_MAX) {
      fieldErrs.duration = ERROR_MESSAGES.VALIDATION.DURATION_TOO_LONG;
    }

    // Validate start time
    if (startTime.trim().length > 0) {
      const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (!timeRegex.test(startTime)) {
        fieldErrs.startTime = ERROR_MESSAGES.VALIDATION.TIME_INVALID;
      } else {
        const parsedTime = new Date(startTime);
        if (isNaN(parsedTime.getTime())) {
          fieldErrs.startTime = ERROR_MESSAGES.VALIDATION.TIME_INVALID;
        }
      }
    } else {
      fieldErrs.startTime = ERROR_MESSAGES.VALIDATION.TIME_REQUIRED;
    }

    setFieldErrors(fieldErrs);
    setValidationErrors(Object.values(fieldErrs));
  };

  const handleUpdateExercise = async () => {
    if (!isManualExercise) {
      Alert.alert("Error", "Only manual exercises can be edited.");
      return;
    }

    if (validationErrors.length > 0) {
      Alert.alert(
        "Validation Error",
        "Please fix the errors before updating the exercise."
      );
      return;
    }

    setIsUpdating(true);

    try {
      const exerciseInput: ExerciseInput = {
        name: exerciseName.trim(),
        duration: parseFloat(duration),
        startTime: new Date(startTime),
      };

      // Validate input using ExerciseLogger
      const validation = exerciseLogger.validateExerciseData(exerciseInput);
      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"));
        setIsUpdating(false);
        return;
      }

      // Create updated record
      const updatedRecord: Exercise_Record = {
        ...exercise,
        name: exerciseInput.name,
        duration: exerciseInput.duration,
        startTime: exerciseInput.startTime,
        updatedAt: new Date(),
      };

      // Update the record in storage
      await storageManager.updateRecord(exercise.id, {
        name: updatedRecord.name,
        duration: updatedRecord.duration,
        startTime: updatedRecord.startTime,
        updatedAt: updatedRecord.updatedAt,
      });

      Alert.alert("Success", "Exercise updated successfully!", [
        {
          text: "OK",
          onPress: () => onEditComplete(true, updatedRecord),
        },
      ]);
    } catch (error) {
      Alert.alert(
        "Error",
        "An unexpected error occurred while updating the exercise"
      );
      onEditComplete(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Edit",
      "Are you sure you want to cancel? Your changes will be lost.",
      [
        {
          text: "Continue Editing",
          style: "cancel",
        },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => onEditComplete(false),
        },
      ]
    );
  };

  const getCurrentTimeString = (): string => {
    const now = new Date();
    return formatDateTimeForInput(now);
  };

  const handleUseCurrentTime = () => {
    setStartTime(getCurrentTimeString());
  };

  const isFormValid =
    validationErrors.length === 0 &&
    exerciseName.trim().length > 0 &&
    duration.trim().length > 0 &&
    startTime.trim().length > 0;

  const hasChanges =
    exerciseName !== exercise.name ||
    parseFloat(duration) !== exercise.duration ||
    new Date(startTime).getTime() !== exercise.startTime.getTime();

  if (!isManualExercise) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Cannot Edit Exercise</Text>
          <Text style={styles.errorMessage}>
            This exercise was synced from a health platform and cannot be
            edited. Only manually entered exercises can be modified.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Edit Exercise</Text>
          <Text style={styles.subtitle}>
            Modify the details of your manually logged exercise
          </Text>

          {/* Exercise Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Exercise Name *</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.name ? styles.inputError : null,
              ]}
              value={exerciseName}
              onChangeText={setExerciseName}
              placeholder="e.g., Running, Push-ups, Yoga"
              placeholderTextColor="#999"
              maxLength={VALIDATION_RULES.NAME_MAX_LENGTH}
            />
            {fieldErrors.name && (
              <Text style={styles.errorText}>{fieldErrors.name}</Text>
            )}
            <Text style={styles.helperText}>
              {exerciseName.length}/{VALIDATION_RULES.NAME_MAX_LENGTH}{" "}
              characters
            </Text>
          </View>

          {/* Duration Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration (minutes) *</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.duration ? styles.inputError : null,
              ]}
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 30"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            {fieldErrors.duration && (
              <Text style={styles.errorText}>{fieldErrors.duration}</Text>
            )}
            <Text style={styles.helperText}>
              Enter duration in minutes (1-{VALIDATION_RULES.DURATION_MAX})
            </Text>
          </View>

          {/* Start Time Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Time *</Text>
            <View style={styles.timeInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.timeInput,
                  fieldErrors.startTime ? styles.inputError : null,
                ]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="YYYY-MM-DD HH:MM:SS"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.currentTimeButton}
                onPress={handleUseCurrentTime}
              >
                <Text style={styles.currentTimeButtonText}>Now</Text>
              </TouchableOpacity>
            </View>
            {fieldErrors.startTime && (
              <Text style={styles.errorText}>{fieldErrors.startTime}</Text>
            )}
            <Text style={styles.helperText}>
              Use format: YYYY-MM-DD HH:MM:SS
            </Text>
          </View>

          {/* Validation Summary */}
          {validationErrors.length > 0 && (
            <View style={styles.validationSummary}>
              <Text style={styles.validationTitle}>
                Please fix these issues:
              </Text>
              {validationErrors.map((error, index) => (
                <Text key={index} style={styles.validationError}>
                  • {error}
                </Text>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.updateButton,
                !isFormValid || !hasChanges || isUpdating
                  ? styles.updateButtonDisabled
                  : null,
              ]}
              onPress={handleUpdateExercise}
              disabled={!isFormValid || !hasChanges || isUpdating}
            >
              <Text
                style={[
                  styles.updateButtonText,
                  !isFormValid || !hasChanges || isUpdating
                    ? styles.updateButtonTextDisabled
                    : null,
                ]}
              >
                {isUpdating ? "Updating..." : "Update Exercise"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isUpdating}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Form Status */}
          <View style={styles.statusContainer}>
            <Text
              style={[
                styles.statusText,
                isFormValid && hasChanges
                  ? styles.statusValid
                  : styles.statusInvalid,
              ]}
            >
              {!isFormValid
                ? "⚠ Please fix validation errors"
                : !hasChanges
                ? "ℹ No changes made"
                : "✓ Ready to update"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34495e",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#2c3e50",
  },
  inputError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fdf2f2",
  },
  timeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeInput: {
    flex: 1,
    marginRight: 12,
  },
  currentTimeButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  currentTimeButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    color: "#95a5a6",
    fontSize: 12,
    marginTop: 4,
  },
  validationSummary: {
    backgroundColor: "#fdf2f2",
    borderWidth: 1,
    borderColor: "#e74c3c",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  validationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e74c3c",
    marginBottom: 8,
  },
  validationError: {
    color: "#e74c3c",
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  updateButton: {
    backgroundColor: "#f39c12",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  updateButtonDisabled: {
    backgroundColor: "#bdc3c7",
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  updateButtonTextDisabled: {
    color: "#7f8c8d",
  },
  cancelButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  statusContainer: {
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusValid: {
    color: "#27ae60",
  },
  statusInvalid: {
    color: "#e67e22",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#e74c3c",
    marginBottom: 16,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
  },
});
