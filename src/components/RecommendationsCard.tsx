/**
 * Recommendations Card Component
 * 
 * Displays exercise recommendations including:
 * - 2 suggested exercises based on user's history
 * - Last performed date for each recommendation
 * - Navigation to pre-populate logging screen
 * - Fallback recommendations for new users
 * - Descriptions for each recommended exercise
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { ExerciseRecommendation } from '@/types';

interface RecommendationsCardProps {
  recommendations: ExerciseRecommendation[];
  onRecommendationSelect: (exerciseName: string) => void;
  style?: ViewStyle;
}

export const RecommendationsCard: React.FC<RecommendationsCardProps> = ({
  recommendations,
  onRecommendationSelect,
  style,
}) => {
  /**
   * Format days since last performed
   */
  const formatDaysSince = (days: number): string => {
    if (days === 0) {
      return 'New to you';
    } else if (days === 1) {
      return '1 day ago';
    } else if (days < 7) {
      return `${days} days ago`;
    } else if (days < 14) {
      return '1 week ago';
    } else if (days < 30) {
      return `${Math.floor(days / 7)} weeks ago`;
    } else if (days < 60) {
      return '1 month ago';
    } else {
      return `${Math.floor(days / 30)} months ago`;
    }
  };

  /**
   * Get recommendation icon based on exercise name
   */
  const getExerciseIcon = (exerciseName: string): string => {
    const name = exerciseName.toLowerCase();
    
    if (name.includes('run') || name.includes('jog')) return '🏃‍♂️';
    if (name.includes('walk')) return '🚶‍♂️';
    if (name.includes('cycle') || name.includes('bike')) return '🚴‍♂️';
    if (name.includes('swim')) return '🏊‍♂️';
    if (name.includes('yoga')) return '🧘‍♂️';
    if (name.includes('weight') || name.includes('lift')) return '🏋️‍♂️';
    if (name.includes('push')) return '💪';
    if (name.includes('stretch')) return '🤸‍♂️';
    if (name.includes('dance')) return '💃';
    if (name.includes('climb')) return '🧗‍♂️';
    
    return '🎯'; // Default icon
  };

  /**
   * Handle recommendation selection
   */
  const handleRecommendationPress = (recommendation: ExerciseRecommendation) => {
    onRecommendationSelect(recommendation.exerciseName);
  };

  /**
   * Render empty state (should rarely happen as service provides fallbacks)
   */
  const renderEmptyState = () => (
    <View 
      style={styles.emptyStateContainer}
      accessibilityRole="text"
      accessibilityLabel="No recommendations available. Start logging exercises to get personalized recommendations!"
    >
      <Text 
        style={styles.emptyStateIcon}
        accessibilityLabel="Light bulb icon"
        accessibilityElementsHidden={true}
      >
        💡
      </Text>
      <Text style={styles.emptyStateTitle}>No recommendations available</Text>
      <Text style={styles.emptyStateMessage}>
        Start logging exercises to get personalized recommendations!
      </Text>
    </View>
  );

  /**
   * Render recommendation item
   */
  const renderRecommendationItem = (recommendation: ExerciseRecommendation, index: number) => {
    const isFirst = index === 0;
    const exerciseIcon = getExerciseIcon(recommendation.exerciseName);
    
    return (
      <TouchableOpacity
        key={`${recommendation.exerciseName}_${index}`}
        style={[styles.recommendationItem, !isFirst && styles.recommendationItemSpacing]}
        onPress={() => handleRecommendationPress(recommendation)}
        accessibilityRole="button"
        accessibilityLabel={`Try ${recommendation.exerciseName}. ${recommendation.description}. Last performed ${formatDaysSince(recommendation.daysSinceLastPerformed)}`}
        accessibilityHint="Tap to start logging this exercise"
      >
        <View style={styles.recommendationContent}>
          {/* Icon and Header */}
          <View style={styles.recommendationHeader}>
            <View 
              style={styles.iconContainer}
              accessibilityElementsHidden={true}
            >
              <Text 
                style={styles.exerciseIcon}
                accessibilityLabel={`${recommendation.exerciseName} icon`}
              >
                {exerciseIcon}
              </Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {recommendation.exerciseName}
              </Text>
              <Text style={styles.lastPerformed}>
                {formatDaysSince(recommendation.daysSinceLastPerformed)}
              </Text>
            </View>
            <View 
              style={styles.actionIndicator}
              accessibilityElementsHidden={true}
            >
              <Text style={styles.actionIcon}>+</Text>
            </View>
          </View>
          
          {/* Description */}
          <Text style={styles.exerciseDescription} numberOfLines={2}>
            {recommendation.description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View 
      style={[styles.container, style]} 
      accessibilityRole="list"
      accessibilityLabel={`Exercise recommendations: ${recommendations.length > 0 ? `${recommendations.length} suggestions available` : 'No recommendations available'}`}
      testID="recommendations-card"
    >
      {/* Card Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text 
          style={styles.title}
          accessibilityRole="text"
          accessibilityLabel="Recommended for You section"
        >
          Recommended for You
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel={recommendations.length > 0 
            ? 'Try something new'
            : 'No suggestions'
          }
        >
          {recommendations.length > 0 
            ? 'Try something new'
            : 'No suggestions'
          }
        </Text>
      </View>

      {/* Card Content */}
      <View style={styles.content}>
        {recommendations.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.recommendationsList}>
            {recommendations.slice(0, 2).map((recommendation, index) => 
              renderRecommendationItem(recommendation, index)
            )}
          </View>
        )}
      </View>

      {/* Footer Note */}
      {recommendations.length > 0 && (
        <View 
          style={styles.footer}
          accessibilityRole="text"
          accessibilityLabel="Tap to start logging. Based on your activity patterns"
        >
          <Text style={styles.footerText}>
            Tap to start logging • Based on your activity patterns
          </Text>
        </View>
      )}
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
  
  // Recommendations List Styles
  recommendationsList: {
    // No additional styles needed - items handle their own spacing
  },
  recommendationItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 44, // Accessibility minimum touch target
  },
  recommendationItemSpacing: {
    marginTop: 12,
  },
  recommendationContent: {
    // No additional styles needed
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseIcon: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  lastPerformed: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  actionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
    marginLeft: 52, // Align with exercise name
  },
  
  // Footer Styles
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f2f6',
  },
  footerText: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
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