// Exercise history display with chronological organization and source attribution
// Requirements: 5.1, 5.2, 5.5

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { DataStorageManager } from "@/services/database/DataStorageManager";
import { Exercise_Record, DataSource, HealthPlatform } from "@/types";

interface ExerciseHistoryScreenProps {
  storageManager: DataStorageManager;
  onRecordSelect?: (record: Exercise_Record) => void;
}

interface GroupedExercises {
  date: string;
  exercises: Exercise_Record[];
}

export const ExerciseHistoryScreen: React.FC<ExerciseHistoryScreenProps> = ({
  storageManager,
  onRecordSelect,
}) => {
  const [exercises, setExercises] = useState<Exercise_Record[]>([]);
  const [groupedExercises, setGroupedExercises] = useState<GroupedExercises[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExercises = useCallback(async () => {
    try {
      setError(null);
      // Get all records by using a wide date range
      const dateRange = {
        start: new Date("2020-01-01"),
        end: new Date("2030-12-31"),
      };
      const records = await storageManager.getExerciseHistory(dateRange);

      // Sort by start time (most recent first)
      const sortedRecords = records.sort(
        (a, b) => b.startTime.getTime() - a.startTime.getTime()
      );

      setExercises(sortedRecords);

      // Group exercises by date
      const grouped = groupExercisesByDate(sortedRecords);
      setGroupedExercises(grouped);
    } catch (err) {
      setError("Failed to load exercise history");
      console.error("Error loading exercises:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [storageManager]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const groupExercisesByDate = (
    records: Exercise_Record[]
  ): GroupedExercises[] => {
    const groups: { [key: string]: Exercise_Record[] } = {};

    records.forEach((record) => {
      const dateKey = record.startTime.toISOString().split("T")[0]!; // YYYY-MM-DD
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey]!.push(record);
    });

    // Convert to array and sort by date (most recent first)
    return Object.entries(groups)
      .map(([date, exercises]) => ({ date, exercises }))
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    }
  };

  const getSourceIcon = (source: DataSource): string => {
    return source === DataSource.MANUAL ? "✏️" : "📱";
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
        return "Synced";
      }
    }
  };

  const getSourceColor = (source: DataSource): string => {
    return source === DataSource.MANUAL ? "#3498db" : "#27ae60";
  };

  const handleRecordPress = (record: Exercise_Record) => {
    if (onRecordSelect) {
      onRecordSelect(record);
    } else {
      // Show record details in alert
      Alert.alert(
        record.name,
        `Duration: ${formatDuration(record.duration)}\n` +
          `Start: ${formatTime(record.startTime)}\n` +
          `Source: ${getSourceLabel(record)}\n` +
          `Created: ${record.createdAt.toLocaleDateString()}`
      );
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadExercises();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading exercise history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadExercises}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No exercises yet</Text>
        <Text style={styles.emptySubtitle}>
          Start logging your workouts to see them here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercise History</Text>
        <Text style={styles.subtitle}>
          {exercises.length} total exercise{exercises.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {groupedExercises.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{formatDate(group.date)}</Text>
              <Text style={styles.exerciseCount}>
                {group.exercises.length} exercise
                {group.exercises.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {group.exercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                style={styles.exerciseItem}
                onPress={() => handleRecordPress(exercise)}
                activeOpacity={0.7}
              >
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseNameContainer}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View
                      style={[
                        styles.sourceTag,
                        { backgroundColor: getSourceColor(exercise.source) },
                      ]}
                    >
                      <Text style={styles.sourceIcon}>
                        {getSourceIcon(exercise.source)}
                      </Text>
                      <Text style={styles.sourceText}>
                        {getSourceLabel(exercise)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.exerciseTime}>
                    {formatTime(exercise.startTime)}
                  </Text>
                </View>

                <View style={styles.exerciseDetails}>
                  <Text style={styles.exerciseDuration}>
                    Duration: {formatDuration(exercise.duration)}
                  </Text>
                  {exercise.metadata.originalId && (
                    <Text style={styles.exerciseId}>
                      ID: {exercise.metadata.originalId.substring(0, 8)}...
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  dateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
  },
  exerciseCount: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  exerciseItem: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 4,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  exerciseNameContainer: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 6,
  },
  exerciseTime: {
    fontSize: 14,
    color: "#7f8c8d",
    fontWeight: "500",
  },
  sourceTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  sourceIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  sourceText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  exerciseDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseDuration: {
    fontSize: 14,
    color: "#34495e",
    fontWeight: "500",
  },
  exerciseId: {
    fontSize: 12,
    color: "#95a5a6",
    fontStyle: "italic",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#7f8c8d",
  },
  errorText: {
    fontSize: 16,
    color: "#e74c3c",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
  },
});
