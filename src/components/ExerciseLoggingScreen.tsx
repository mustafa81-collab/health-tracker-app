// Exercise logging screen with input validation and user feedback
// Requirements: 1.1, 1.3, 1.4, 1.5

import React, { useState, useEffect, useMemo } from "react";
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
import { ExerciseLogger } from "@/services/ExerciseLogger";
import { DataStorageManager } from "@/services/database/DataStorageManager";
import { ExerciseInput } from "@/types";
import { VALIDATION_RULES, ERROR_MESSAGES } from "@/utils/constants";

interface ExerciseLoggingScreenProps {
  onExerciseLogged?: (success: boolean) => void;
  storageManager: DataStorageManager;
}

export const ExerciseLoggingScreen: React.FC<ExerciseLoggingScreenProps> = ({
  onExerciseLogged,
  storageManager,
}) => {
  const [exerciseName, setExerciseName] = useState("");
  const [duration, setDuration] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    duration?: string;
    startTime?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false); // Additional protection
  const [showValidationSummary, setShowValidationSummary] = useState(false); // Only show after submit attempt

  const exerciseLogger = useMemo(() => new ExerciseLogger(storageManager), [storageManager]);

  // Real-time validation as user types
  useEffect(() => {
    console.log("Validation useEffect triggered - exerciseName:", exerciseName, "duration:", duration, "startTime:", startTime);
    validateFields();
  }, [exerciseName, duration, startTime]);

  const validateFields = () => {
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

    // Validate start time (if provided, otherwise use current time)
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
    }

    setFieldErrors(fieldErrs);
    setValidationErrors(Object.values(fieldErrs));
  };

  const getCurrentTimeString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleLogExercise = async () => {
    const submissionId = Date.now() + Math.random(); // Unique ID for this submission
    console.log(`[${submissionId}] handleLogExercise called - isLogging:`, isLogging, "isSubmitting:", isSubmitting);
    
    // Double protection against multiple calls
    if (isLogging || isSubmitting) {
      console.log(`[${submissionId}] Already processing, ignoring duplicate call`);
      return;
    }
    
    // Show validation summary on submit attempt
    setShowValidationSummary(true);
    
    if (validationErrors.length > 0) {
      Alert.alert(
        "Validation Error",
        "Please fix the errors before logging the exercise."
      );
      return;
    }

    console.log(`[${submissionId}] Starting exercise logging process`);
    setIsLogging(true);
    setIsSubmitting(true);

    try {
      const exerciseInput: ExerciseInput = {
        name: exerciseName.trim(),
        duration: parseFloat(duration),
        startTime: startTime.trim() ? new Date(startTime) : new Date(),
      };

      console.log(`[${submissionId}] Exercise input prepared:`, exerciseInput);

      // Validate input using ExerciseLogger
      const validation = exerciseLogger.validateExerciseData(exerciseInput);
      if (!validation.isValid) {
        Alert.alert("Validation Error", validation.errors.join("\n"));
        setIsLogging(false);
        setIsSubmitting(false);
        return;
      }

      console.log(`[${submissionId}] Validation passed, saving exercise...`);
      // Log the exercise
      const exerciseRecord = await exerciseLogger.saveManualLog(exerciseInput);
      console.log(`[${submissionId}] Exercise saved successfully:`, exerciseRecord);

      // Clear form immediately after successful save
      console.log(`[${submissionId}] Clearing form...`);
      setExerciseName("");
      setDuration("");
      setStartTime("");
      setShowValidationSummary(false); // Hide validation summary after successful save
      
      // Call the callback immediately
      console.log(`[${submissionId}] Calling onExerciseLogged callback...`);
      onExerciseLogged?.(true);

      // Show success message without any callbacks
      Alert.alert("Success", "Exercise logged successfully!");
    } catch (error) {
      console.error(`[${submissionId}] Error saving exercise:`, error);
      Alert.alert(
        "Error",
        "An unexpected error occurred while logging the exercise"
      );
      onExerciseLogged?.(false);
    } finally {
      console.log(`[${submissionId}] Setting isLogging and isSubmitting to false`);
      setIsLogging(false);
      setIsSubmitting(false);
    }
  };

  const handleUseCurrentTime = () => {
    setStartTime(getCurrentTimeString());
  };

  const isFormValid =
    validationErrors.length === 0 &&
    exerciseName.trim().length > 0 &&
    duration.trim().length > 0;

  const isButtonDisabled = !isFormValid || isLogging || isSubmitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Log Exercise</Text>
          <Text style={styles.subtitle}>
            Track your workout manually with detailed information
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
            <Text style={styles.label}>Start Time (optional)</Text>
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
              Leave empty to use current time, or use format: YYYY-MM-DD
              HH:MM:SS
            </Text>
          </View>

          {/* Validation Summary - Only show after submit attempt */}
          {showValidationSummary && validationErrors.length > 0 && (
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

          {/* Log Button */}
          <TouchableOpacity
            style={[
              styles.logButton,
              isButtonDisabled ? styles.logButtonDisabled : null,
            ]}
            onPress={handleLogExercise}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.logButtonText,
                isButtonDisabled ? styles.logButtonTextDisabled : null,
              ]}
            >
              {isLogging || isSubmitting ? "Logging..." : "Log Exercise"}
            </Text>
          </TouchableOpacity>

          {/* Form Status */}
          <View style={styles.statusContainer}>
            <Text
              style={[
                styles.statusText,
                isFormValid ? styles.statusValid : styles.statusInvalid,
              ]}
            >
              {isFormValid
                ? "✓ Ready to log"
                : "⚠ Please complete required fields"}
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
  logButton: {
    backgroundColor: "#27ae60",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  logButtonDisabled: {
    backgroundColor: "#bdc3c7",
  },
  logButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  logButtonTextDisabled: {
    color: "#7f8c8d",
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
});
