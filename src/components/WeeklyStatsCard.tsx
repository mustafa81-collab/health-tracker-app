/**
 * Weekly Stats Card Component
 * 
 * Displays weekly exercise statistics including:
 * - Total number of exercises for the current week
 * - Total duration across all exercises this week
 * - Most frequently performed exercise type
 * - Comparison to previous weeks (above/below/same)
 * - Motivational content for new users
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { WeeklyExerciseStats } from '@/types';

interface WeeklyStatsCardProps {
  weeklyStats: WeeklyExerciseStats;
  style?: ViewStyle;
}

export const WeeklyStatsCard: React.FC<WeeklyStatsCardProps> = ({
  weeklyStats,
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
   * Get comparison indicator and text
   */
  const getComparisonInfo = () => {
    switch (weeklyStats.comparedToPreviousWeek) {
      case 'above':
        return {
          icon: '📈',
          text: 'Above last week',
          color: '#27ae60',
        };
      case 'below':
        return {
          icon: '📉',
          text: 'Below last week',
          color: '#e74c3c',
        };
      case 'same':
        return {
          icon: '➡️',
          text: 'Same as last week',
          color: '#f39c12',
        };
      default:
        return {
          icon: '📊',
          text: 'First week',
          color: '#3498db',
        };
    }
  };

  /**
   * Get motivational message for new users
   */
  const getMotivationalMessage = (): string => {
    const messages = [
      "This is the beginning of your fitness journey!",
      "Every expert was once a beginner. Start today!",
      "Your first week of tracking starts now!",
      "Great things start with small steps.",
      "Welcome to your health transformation!",
    ];
    
    // Use a consistent message based on the current week
    const now = new Date();
    const weekNumber = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7));
    return messages[weekNumber % messages.length];
  };

  /**
   * Get current week date range
   */
  const getWeekDateRange = (): string => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    startOfWeek.setDate(diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.getDate()}`;
    } else {
      return `${startOfWeek.toLocaleDateString('en-US', formatOptions)} - ${endOfWeek.toLocaleDateString('en-US', formatOptions)}`;
    }
  };

  /**
   * Render empty state for new users
   */
  const renderEmptyState = () => (
    <View 
      style={styles.emptyStateContainer}
      accessibilityRole="text"
      accessibilityLabel={`No exercises this week. ${getMotivationalMessage()}`}
    >
      <Text 
        style={styles.emptyStateIcon}
        accessibilityLabel="Star icon"
        accessibilityElementsHidden={true}
      >
        🌟
      </Text>
      <Text style={styles.emptyStateTitle}>Start Your Week Strong</Text>
      <Text style={styles.emptyStateMessage}>{getMotivationalMessage()}</Text>
    </View>
  );

  /**
   * Render stats content
   */
  const renderStatsContent = () => {
    const comparisonInfo = getComparisonInfo();
    
    return (
      <View accessibilityRole="group" accessibilityLabel="Weekly exercise statistics">
        {/* Main Stats Row */}
        <View 
          style={styles.statsRow}
          accessibilityRole="group"
          accessibilityLabel={`Weekly totals: ${weeklyStats.exerciseCount} ${weeklyStats.exerciseCount === 1 ? 'exercise' : 'exercises'}, ${formatDuration(weeklyStats.totalDuration)} total time`}
        >
          <View 
            style={styles.statItem}
            accessibilityRole="text"
            accessibilityLabel={`${weeklyStats.exerciseCount} ${weeklyStats.exerciseCount === 1 ? 'exercise' : 'exercises'} this week`}
          >
            <Text style={styles.statNumber}>{weeklyStats.exerciseCount}</Text>
            <Text style={styles.statLabel}>
              {weeklyStats.exerciseCount === 1 ? 'Exercise' : 'Exercises'}
            </Text>
          </View>
          
          <View 
            style={styles.statDivider}
            accessibilityElementsHidden={true}
          />
          
          <View 
            style={styles.statItem}
            accessibilityRole="text"
            accessibilityLabel={`${formatDuration(weeklyStats.totalDuration)} total exercise time this week`}
          >
            <Text style={styles.statNumber}>{formatDuration(weeklyStats.totalDuration)}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>

        {/* Additional Stats */}
        <View 
          style={styles.additionalStats}
          accessibilityRole="group"
          accessibilityLabel={`Additional weekly statistics: ${weeklyStats.averageDaily.toFixed(1)} exercises daily average${weeklyStats.mostFrequentExercise ? `, most frequent exercise is ${weeklyStats.mostFrequentExercise}` : ''}`}
        >
          {/* Average Daily */}
          <View 
            style={styles.additionalStatItem}
            accessibilityRole="text"
            accessibilityLabel={`Daily average: ${weeklyStats.averageDaily.toFixed(1)} exercises`}
          >
            <Text style={styles.additionalStatLabel}>Daily Average</Text>
            <Text style={styles.additionalStatValue}>
              {weeklyStats.averageDaily.toFixed(1)} exercises
            </Text>
          </View>

          {/* Most Frequent Exercise */}
          {weeklyStats.mostFrequentExercise && (
            <View 
              style={styles.additionalStatItem}
              accessibilityRole="text"
              accessibilityLabel={`Most frequent exercise: ${weeklyStats.mostFrequentExercise}`}
            >
              <Text style={styles.additionalStatLabel}>Most Frequent</Text>
              <Text style={styles.additionalStatValue}>
                {weeklyStats.mostFrequentExercise}
              </Text>
            </View>
          )}
        </View>

        {/* Comparison to Previous Week */}
        <View 
          style={styles.comparisonContainer}
          accessibilityRole="text"
          accessibilityLabel={`Week comparison: ${comparisonInfo.text}`}
        >
          <View style={styles.comparisonContent}>
            <Text 
              style={styles.comparisonIcon}
              accessibilityElementsHidden={true}
            >
              {comparisonInfo.icon}
            </Text>
            <Text style={[styles.comparisonText, { color: comparisonInfo.color }]}>
              {comparisonInfo.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View 
      style={[styles.container, style]} 
      accessibilityRole="summary"
      accessibilityLabel={`Weekly exercise summary: ${weeklyStats.exerciseCount} ${weeklyStats.exerciseCount === 1 ? 'exercise' : 'exercises'}, ${formatDuration(weeklyStats.totalDuration)} total time this week`}
      testID="weekly-stats-card"
    >
      {/* Card Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text 
          style={styles.title}
          accessibilityRole="text"
          accessibilityLabel="This Week section"
        >
          This Week
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel={`Week range: ${getWeekDateRange()}`}
        >
          {getWeekDateRange()}
        </Text>
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        {weeklyStats.exerciseCount === 0 ? renderEmptyState() : renderStatsContent()}
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
    minHeight: 120,
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
    color: '#3498db',
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
  
  // Additional Stats Styles
  additionalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  additionalStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  additionalStatLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  additionalStatValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  
  // Comparison Styles
  comparisonContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  comparisonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  comparisonText: {
    fontSize: 14,
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