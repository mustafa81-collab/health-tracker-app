// Delete confirmation modal for exercise records
// Requirements: 5.4

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Exercise_Record, DataSource } from "@/types";

interface DeleteConfirmationModalProps {
  visible: boolean;
  exercise: Exercise_Record;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<
  DeleteConfirmationModalProps
> = ({ visible, exercise, onConfirm, onCancel, isDeleting = false }) => {
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} minutes`
        : `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getSourceLabel = (exercise: Exercise_Record): string => {
    if (exercise.source === DataSource.MANUAL) {
      return "Manual Entry";
    } else {
      return "Synced from Health Platform";
    }
  };

  const getWarningLevel = (): "low" | "medium" | "high" => {
    return exercise.source === DataSource.MANUAL ? "medium" : "high";
  };

  const getWarningColor = (): string => {
    const level = getWarningLevel();
    switch (level) {
      case "low":
        return "#f39c12";
      case "medium":
        return "#e67e22";
      case "high":
        return "#e74c3c";
      default:
        return "#e74c3c";
    }
  };

  const getWarningMessage = (): string => {
    if (exercise.source === DataSource.MANUAL) {
      return "This action cannot be undone.";
    } else {
      return "This exercise was synced from your health platform. Deleting it may cause it to reappear during the next sync.\n\nThis action cannot be undone.";
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Delete Exercise</Text>
          <View
            style={[
              styles.warningBadge,
              { backgroundColor: getWarningColor() },
            ]}
          >
            <Text style={styles.warningBadgeText}>
              {getWarningLevel().toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseDetails}>
            {formatDuration(exercise.duration)} •{" "}
            {formatDate(exercise.startTime)}
          </Text>
          <Text style={styles.exerciseTime}>
            Started at {formatTime(exercise.startTime)}
          </Text>
          <Text style={styles.sourceLabel}>{getSourceLabel(exercise)}</Text>
        </View>

        <View style={styles.warningSection}>
          <Text style={styles.warningTitle}>⚠️ Warning</Text>
          <Text style={styles.warningMessage}>{getWarningMessage()}</Text>
        </View>

        <Text style={styles.confirmationText}>
          Are you sure you want to delete this exercise?
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={isDeleting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              { backgroundColor: getWarningColor() },
              isDeleting && styles.deleteButtonDisabled,
            ]}
            onPress={onConfirm}
            disabled={isDeleting}
          >
            <Text
              style={[
                styles.deleteButtonText,
                isDeleting && styles.deleteButtonTextDisabled,
              ]}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  exerciseInfo: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  exerciseDetails: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 4,
  },
  exerciseTime: {
    fontSize: 14,
    color: "#95a5a6",
    marginBottom: 8,
  },
  sourceLabel: {
    fontSize: 12,
    color: "#3498db",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  warningSection: {
    backgroundColor: "#fdf2f2",
    borderWidth: 1,
    borderColor: "#e74c3c",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#e74c3c",
    marginBottom: 8,
  },
  warningMessage: {
    fontSize: 14,
    color: "#e74c3c",
    lineHeight: 20,
  },
  confirmationText: {
    fontSize: 16,
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#95a5a6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButtonTextDisabled: {
    color: "#bdc3c7",
  },
});
