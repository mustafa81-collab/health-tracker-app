/**
 * Quick Actions Card Component
 * 
 * Provides quick navigation buttons for core app functions including:
 * - Direct access to exercise logging
 * - Navigation to full exercise history
 * - Accessibility compliance with proper labels
 * - Minimum touch target sizes (44x44 points)
 * - Clear icons and labels for usability
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

interface QuickActionsCardProps {
  onNavigateToLogging: () => void;
  onNavigateToHistory: () => void;
  style?: ViewStyle;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onNavigateToLogging,
  onNavigateToHistory,
  style,
}) => {
  /**
   * Action button configuration
   */
  const actions = [
    {
      id: 'log-exercise',
      title: 'Log Exercise',
      subtitle: 'Add a new workout',
      icon: '📝',
      color: '#27ae60',
      backgroundColor: '#d5f4e6',
      onPress: onNavigateToLogging,
      accessibilityLabel: 'Log new exercise',
      accessibilityHint: 'Navigate to exercise logging screen to add a new workout',
    },
    {
      id: 'view-history',
      title: 'View History',
      subtitle: 'See all exercises',
      icon: '📊',
      color: '#3498db',
      backgroundColor: '#dbeafe',
      onPress: onNavigateToHistory,
      accessibilityLabel: 'View exercise history',
      accessibilityHint: 'Navigate to exercise history screen to see all logged workouts',
    },
  ];

  /**
   * Render action button
   */
  const renderActionButton = (action: typeof actions[0]) => (
    <TouchableOpacity
      key={action.id}
      style={[
        styles.actionButton,
        { backgroundColor: action.backgroundColor }
      ]}
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityHint={action.accessibilityHint}
      activeOpacity={0.7}
    >
      <View style={styles.actionContent}>
        {/* Icon */}
        <View 
          style={[styles.iconContainer, { backgroundColor: action.color }]}
          accessibilityElementsHidden={true}
        >
          <Text 
            style={styles.actionIcon}
            accessibilityLabel={`${action.title} icon`}
          >
            {action.icon}
          </Text>
        </View>
        
        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={[styles.actionTitle, { color: action.color }]}>
            {action.title}
          </Text>
          <Text style={styles.actionSubtitle}>
            {action.subtitle}
          </Text>
        </View>
        
        {/* Arrow Indicator */}
        <View 
          style={styles.arrowContainer}
          accessibilityElementsHidden={true}
        >
          <Text style={[styles.arrowIcon, { color: action.color }]}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View 
      style={[styles.container, style]} 
      accessibilityRole="group"
      accessibilityLabel="Quick Actions: Log Exercise and View History buttons"
      testID="quick-actions-card"
    >
      {/* Card Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
      >
        <Text 
          style={styles.title}
          accessibilityRole="text"
          accessibilityLabel="Quick Actions section"
        >
          Quick Actions
        </Text>
        <Text 
          style={styles.subtitle}
          accessibilityRole="text"
          accessibilityLabel="Get started quickly"
        >
          Get started quickly
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {actions.map(action => renderActionButton(action))}
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
  
  // Actions Container
  actionsContainer: {
    gap: 12, // Space between action buttons
  },
  
  // Action Button Styles
  actionButton: {
    borderRadius: 12,
    padding: 16,
    minHeight: 44, // Accessibility minimum touch target (44x44 points)
    minWidth: 44,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  textContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  arrowContainer: {
    width: 24,
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 20,
    fontWeight: '300',
  },
});