/**
 * Daily Stats Card Component
 * 
 * Displays today's exercise statistics including:
 * - Total number of exercises logged today
 * - Total duration of exercises completed today
 * - Most recent exercise with timestamp
 * - Encouraging messages when no exercises are logged
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { DailyExerciseStats } from '@/types';

interface DailyStatsCardProps {
  dailyStats: DailyExerciseStats;
  style?: ViewStyle;
}

export const DailyStatsCard: React.FC<DailyStatsCardProps> = ({
  dailyStats,
  style,
}) => {
  /**
   * Format duration for display
   */
  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0 min';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} min`;
    } else if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  /**
   * Format relative time for last exercise
   */
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  /**
   * Get encouraging message for empty state
   */
  const getEncouragingMessage = (): string => {
    const messages = [
      "Ready to start your fitness journey today?",
      "Every step counts - log your first exercise!",
      "Today is a great day to be active!",
      "Your health journey begins with one exercise.",
      "Make today count - add your first workout!",
    ];
    
    // Use a consistent message based on the current date
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return messages[dayOfYear % messages.length];
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View 
      style={styles.emptyStateContainer}
      accessibilityRole="text"
      accessibilityLabel={`No exercises logged today. ${getEncouragingMessage()}`}
    >
      <Text 
        style={styles.emptyStateIcon}
        accessibilityLabel="Target icon"
        accessibilityElementsHidden={true}
      >
        🎯
      </Text>
      <Text style={styles.emptyStateTitle}>No exercises today</Text>
      <Text style={styles.emptyStateMessage}>{getEncouragingMessage()}</Text>
    </View>
  );

  /**
   * Render stats content
   */
  const renderStatsContent = () => (
    <View accessibilityRole="group" accessibilityLabel="Today's exercise statistics">
      {/* Main Stats Row */}
      <View 
        style={styles.statsRow}
        accessibilityRole="group"
        accessibilityLabel={`Exercise count: ${dailyStats.exerciseCount}, Total duration: ${formatDuration(dailyStats.totalDuration)}`}
      >
        <View 
          style={styles.statItem}
          accessibilityRole="text"
          accessibilityLabel={`${dailyStats.exerciseCount} ${dailyStats.exerciseCount === 1 ? 'exercise' : 'exercises'} completed today`}
        >
          <Text style={styles.statNumber}>{dailyStats.exerciseCount}</Text>
          <Text style={styles.statLabel}>
            {dailyStats.exerciseCount === 1 ? 'Exercise' : 'Exercises'}
          </Text>
        </View>
        
        <View 
          style={styles.statDivider}
          accessibilityElementsHidden={true}
        />
        
        <View 
          style={styles.statItem}
          accessibilityRole="text"
          accessibilityLabel={`${formatDuration(dailyStats.totalDuration)} total exercise time today`}
        >
          <Text style={styles.statNumber}>{formatDuration(dailyStats.totalDuration)}</Text>
          <Text style={styles.statLabel}>Total Time</Text>
        </View>
      </View>

      {/* Most Recent Exercise */}
      {dailyStats.lastExerciseName && dailyStats.lastExerciseTime && (
        <View 
          style={styles.recentExerciseContainer}
          accessibilityRole="text"
          accessibilityLabel={`Most recent exercise: ${dailyStats.lastExerciseName}, completed ${formatRelativeTime(dailyStats.lastExerciseTime)}`}
        >
          <View style={styles.recentExerciseHeader}>
            <Text style={styles.recentExerciseLabel}>Most Recent</Text>
            <Text style={styles.recentExerciseTime}>
              {formatRelativeTime(dailyStats.lastExerciseTime)}
            </Text>
          </View>
          <Text style={styles.recentExerciseName}>{dailyStats.lastExerciseName}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View 
      style={[styles.container, style]} 
      accessibilityRole="summary"
      accessibilityLabel={`Today's exercise summary: ${dailyStats.exerciseCount} ${dailyStats.exerciseCount === 1 ? 'exercise' : 'exercises'}, ${formatDuration(dailyStats.totalDuration)} total time`}
    >
      {/* Card Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text 
          style={styles.title}
          accessibilityRole="text"
          accessibilityLabel="Today's Activity section"
        >
          Today's Activity
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel={`Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        >
          {new Date().toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })}
        </Text>
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        {dailyStats.exerciseCount === 0 ? renderEmptyState() : renderStatsContent()}
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
    minHeight: 80,
  },
  
  // Stats Content Styles
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ecf0f1',
    marginHorizontal: 20,
  },
  
  // Recent Exercise Styles
  recentExerciseContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  recentExerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentExerciseLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  recentExerciseTime: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: '500',
  },
  recentExerciseName: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
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