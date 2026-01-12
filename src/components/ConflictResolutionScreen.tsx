// Conflict resolution interface showing manual vs synced data side by side
// Requirements: 4.2, 4.3, 4.4

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { ConflictResolver } from "@/services/ConflictResolver";
import { DataStorageManager } from "@/services/database/DataStorageManager";
import {
  Exercise_Record,
  Conflict,
  ResolutionChoice,
  DataSource,
  HealthPlatform,
} from "@/types";

interface ConflictResolutionScreenProps {
  conflictData: Conflict;
  storageManager: DataStorageManager;
  onResolutionComplete: (success: boolean) => void;
}

export const ConflictResolutionScreen: React.FC<
  ConflictResolutionScreenProps
> = ({ conflictData, storageManager, onResolutionComplete }) => {
  const [isResolving, setIsResolving] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<ResolutionChoice | null>(
    null
  );

  const conflictResolver = new ConflictResolver();

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

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

  const getSourceLabel = (record: Exercise_Record): string => {
    if (record.source === DataSource.MANUAL) {
      return "Manual Entry";
    } else {
      const platform = record.platform;
      if (platform === HealthPlatform.APPLE_HEALTHKIT) {
        return "Apple Health";
      } else if (platform === HealthPlatform.GOOGLE_HEALTH_CONNECT) {
        return "Google Health Connect";
      } else {
        return "Synced Data";
      }
    }
  };

  const getSourceColor = (record: Exercise_Record): string => {
    return record.source === DataSource.MANUAL ? "#3498db" : "#27ae60";
  };

  const getChoiceDescription = (choice: ResolutionChoice): string => {
    switch (choice) {
      case ResolutionChoice.KEEP_MANUAL:
        return "Keep your manual entry and discard the synced data";
      case ResolutionChoice.KEEP_SYNCED:
        return "Keep the synced data and discard your manual entry";
      case ResolutionChoice.MERGE_RECORDS:
        return "Combine both entries into a single exercise record";
      case ResolutionChoice.KEEP_BOTH:
        return "Keep both entries as separate exercise records";
      default:
        return "";
    }
  };

  const getChoiceButtonColor = (choice: ResolutionChoice): string => {
    switch (choice) {
      case ResolutionChoice.KEEP_MANUAL:
        return "#3498db";
      case ResolutionChoice.KEEP_SYNCED:
        return "#27ae60";
      case ResolutionChoice.MERGE_RECORDS:
        return "#f39c12";
      case ResolutionChoice.KEEP_BOTH:
        return "#9b59b6";
      default:
        return "#95a5a6";
    }
  };

  const handleChoiceSelection = (choice: ResolutionChoice) => {
    setSelectedChoice(choice);
  };

  const handleResolveConflict = async () => {
    if (!selectedChoice) {
      Alert.alert(
        "Selection Required",
        "Please select a resolution option before proceeding."
      );
      return;
    }

    setIsResolving(true);

    try {
      const resolution = await conflictResolver.resolveConflict(
        conflictData,
        selectedChoice
      );

      if (resolution.success) {
        Alert.alert(
          "Conflict Resolved",
          "The exercise conflict has been successfully resolved.",
          [
            {
              text: "OK",
              onPress: () => onResolutionComplete(true),
            },
          ]
        );
      } else {
        Alert.alert(
          "Resolution Failed",
          resolution.error || "An error occurred while resolving the conflict."
        );
        onResolutionComplete(false);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "An unexpected error occurred while resolving the conflict."
      );
      onResolutionComplete(false);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Resolution",
      "Are you sure you want to cancel? The conflict will remain unresolved.",
      [
        {
          text: "Continue Resolving",
          style: "cancel",
        },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => onResolutionComplete(false),
        },
      ]
    );
  };

  const renderExerciseCard = (record: Exercise_Record, title: string) => (
    <View style={styles.exerciseCard}>
      <View
        style={[styles.cardHeader, { backgroundColor: getSourceColor(record) }]}
      >
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.sourceLabel}>{getSourceLabel(record)}</Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Exercise:</Text>
          <Text style={styles.detailValue}>{record.name}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date:</Text>
          <Text style={styles.detailValue}>{formatDate(record.startTime)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Start Time:</Text>
          <Text style={styles.detailValue}>{formatTime(record.startTime)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration:</Text>
          <Text style={styles.detailValue}>
            {formatDuration(record.duration)}
          </Text>
        </View>

        {record.metadata.originalId && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID:</Text>
            <Text style={styles.detailValue}>
              {record.metadata.originalId.substring(0, 12)}...
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created:</Text>
          <Text style={styles.detailValue}>
            {record.createdAt.toLocaleDateString()}{" "}
            {formatTime(record.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderChoiceButton = (choice: ResolutionChoice, label: string) => (
    <TouchableOpacity
      key={choice}
      style={[
        styles.choiceButton,
        { backgroundColor: getChoiceButtonColor(choice) },
        selectedChoice === choice && styles.selectedChoiceButton,
      ]}
      onPress={() => handleChoiceSelection(choice)}
      activeOpacity={0.8}
    >
      <Text style={styles.choiceButtonText}>{label}</Text>
      <Text style={styles.choiceDescription}>
        {getChoiceDescription(choice)}
      </Text>
      {selectedChoice === choice && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedIndicatorText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercise Conflict Detected</Text>
        <Text style={styles.subtitle}>
          We found similar exercises from different sources. Please choose how
          to resolve this conflict.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.conflictSection}>
          <Text style={styles.sectionTitle}>Conflicting Exercises</Text>

          <View style={styles.exerciseComparison}>
            {renderExerciseCard(conflictData.manualRecord, "Your Manual Entry")}
            {renderExerciseCard(conflictData.syncedRecord, "Synced Data")}
          </View>
        </View>

        <View style={styles.resolutionSection}>
          <Text style={styles.sectionTitle}>Resolution Options</Text>
          <Text style={styles.sectionSubtitle}>
            Choose how you want to handle this conflict:
          </Text>

          <View style={styles.choicesContainer}>
            {renderChoiceButton(
              ResolutionChoice.KEEP_MANUAL,
              "Keep Manual Entry"
            )}
            {renderChoiceButton(
              ResolutionChoice.KEEP_SYNCED,
              "Keep Synced Data"
            )}
            {renderChoiceButton(ResolutionChoice.MERGE_RECORDS, "Merge Both")}
            {renderChoiceButton(
              ResolutionChoice.KEEP_BOTH,
              "Keep Both Separate"
            )}
          </View>
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.resolveButton,
              !selectedChoice && styles.resolveButtonDisabled,
            ]}
            onPress={handleResolveConflict}
            disabled={!selectedChoice || isResolving}
          >
            <Text
              style={[
                styles.resolveButtonText,
                !selectedChoice && styles.resolveButtonTextDisabled,
              ]}
            >
              {isResolving ? "Resolving..." : "Resolve Conflict"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isResolving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#e74c3c",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  conflictSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 16,
    lineHeight: 22,
  },
  exerciseComparison: {
    gap: 16,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  sourceLabel: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
  cardContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7f8c8d",
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: "#2c3e50",
    flex: 2,
    textAlign: "right",
  },
  resolutionSection: {
    padding: 20,
    paddingTop: 0,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    padding: 16,
    borderRadius: 12,
    position: "relative",
  },
  selectedChoiceButton: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  choiceDescription: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
    lineHeight: 18,
  },
  selectedIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedIndicatorText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#27ae60",
  },
  actionSection: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  resolveButton: {
    backgroundColor: "#27ae60",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  resolveButtonDisabled: {
    backgroundColor: "#bdc3c7",
  },
  resolveButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  resolveButtonTextDisabled: {
    color: "#7f8c8d",
  },
  cancelButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
