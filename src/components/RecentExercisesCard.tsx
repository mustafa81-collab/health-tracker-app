/**
 * Recent Exercises Card Component
 * 
 * Displays the most recent exercise entries including:
 * - Last 3-5 exercise records
 * - Exercise name, duration, and relative time for each entry
 * - Navigation to exercise details on tap
 * - Data source attribution (manual vs synced)
 * - Encouraging message when no recent entries exist
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Exercise_Record, DataSource } from '@/types';

interface RecentExercisesCardProps {
  recentExercises: Exercise_Record[];
  onExerciseSelect: (exerciseId: string) => void;
  style?: ViewStyle;
}

export const RecentExercisesCard: React.FC<RecentExercisesCardProps> = ({
  recentExercises,
  onExerciseSelect,
  style,
}) => {
  /**
   * Format duration for display
   */
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  /**
   * Format relative time for exercise
   */
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  /**
   * Get data source icon and label
   */
  const getDataSourceInfo = (source: DataSource) => {
    switch (source) {
      case DataSource.MANUAL:
        return {
          icon: '✏️',
          label: 'Manual',
          color: '#3498db',
        };
      case DataSource.SYNCED:
        return {
          icon: '🔄',
          label: 'Synced',
          color: '#27ae60',
        };
      default:
        return {
          icon: '📝',
          label: 'Unknown',
          color: '#95a5a6',
        };
    }
  };

  /**
   * Handle exercise item press
   */
  const handleExercisePress = (exercise: Exercise_Record) => {
    onExerciseSelect(exercise.id);
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View 
      style={styles.emptyStateContainer}
      accessibilityRole="text"
      accessibilityLabel="No recent exercises. Start logging your exercises to see them here!"
    >
      <Text 
        style={styles.emptyStateIcon}
        accessibilityLabel="Clipboard icon"
        accessibilityElementsHidden={true}
      >
        📋
      </Text>
      <Text style={styles.emptyStateTitle}>No recent exercises</Text>
      <Text style={styles.emptyStateMessage}>
        Start logging your exercises to see them here!
      </Text>
    </View>
  );

  /**
   * Render exercise item
   */
  const renderExerciseItem = (exercise: Exercise_Record, index: number) => {
    const sourceInfo = getDataSourceInfo(exercise.source);
    const isLast = index === recentExercises.length - 1;
    
    return (
      <TouchableOpacity
        key={exercise.id}
        style={[styles.exerciseItem, !isLast && styles.exerciseItemBorder]}
        onPress={() => handleExercisePress(exercise)}
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${formatDuration(exercise.duration)}, ${formatRelativeTime(exercise.startTime)}, ${sourceInfo.label} entry`}
        accessibilityHint="Tap to view or edit this exercise"
      >
        <View style={styles.exerciseContent}>
          {/* Exercise Name and Source */}
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exercise.name}
            </Text>
            <View style={styles.sourceIndicator}>
              <Text 
                style={styles.sourceIcon}
                accessibilityElementsHidden={true}
              >
                {sourceInfo.icon}
              </Text>
              <Text 
                style={[styles.sourceLabel, { color: sourceInfo.color }]}
                accessibilityLabel={`Data source: ${sourceInfo.label}`}
              >
                {sourceInfo.label}
              </Text>
            </View>
          </View>
          
          {/* Duration and Time */}
          <View style={styles.exerciseDetails}>
            <Text style={styles.exerciseDuration}>
              {formatDuration(exercise.duration)}
            </Text>
            <Text style={styles.exerciseTime}>
              {formatRelativeTime(exercise.startTime)}
            </Text>
          </View>
        </View>
        
        {/* Navigation Arrow */}
        <View 
          style={styles.navigationArrow}
          accessibilityElementsHidden={true}
        >
          <Text style={styles.arrowIcon}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View 
      style={[styles.container, style]} 
      accessibilityRole="list"
      accessibilityLabel={`Recent exercises: ${recentExercises.length > 0 ? `${recentExercises.length} recent ${recentExercises.length === 1 ? 'exercise' : 'exercises'}` : 'No recent exercises'}`}
    >
      {/* Card Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text 
          style={styles.title}
          accessibilityRole="text"
          accessibilityLabel="Recent Activity section"
        >
          Recent Activity
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel={recentExercises.length > 0 
            ? `${recentExercises.length} recent ${recentExercises.length === 1 ? 'exercise' : 'exercises'}`
            : 'No exercises yet'
          }
        >
          {recentExercises.length > 0 
            ? `${recentExercises.length} recent ${recentExercises.length === 1 ? 'exercise' : 'exercises'}`
            : 'No exercises yet'
          }
        </Text>
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        {recentExercises.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.exercisesList}>
            {recentExercises.map((exercise, index) => 
              renderExerciseItem(exercise, index)
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  content: {
    minHeight: 100,
  },
  
  // Exercise List Styles
  exercisesList: {
    // No additional styles needed - items handle their own spacing
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44, // Accessibility minimum touch target
  },
  exerciseItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  exerciseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseDuration: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  exerciseTime: {
    fontSize: 14,
    color: '#95a5a6',
  },
  navigationArrow: {
    marginLeft: 12,
    width: 20,
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 18,
    color: '#bdc3c7',
    fontWeight: '300',
  },
  
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    lineHeight: 20,
  },
});