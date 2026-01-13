/**
 * Home Screen Dashboard Component
 * 
 * The main dashboard screen that serves as the entry point for the Health Tracker app.
 * Provides users with:
 * - Daily and weekly exercise summaries
 * - Recent exercise entries
 * - Intelligent exercise recommendations
 * - Quick action navigation to other screens
 * 
 * Requirements: 6.1, 6.2, 7.3
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { DashboardService } from '@/services/DashboardService';
import { DataStorageManager } from '@/services/database/DataStorageManager';
import { DashboardData, AppScreen, Exercise_Record, DataSource } from '@/types';
import { DailyStatsCard } from './DailyStatsCard';
import { WeeklyStatsCard } from './WeeklyStatsCard';
import { RecentExercisesCard } from './RecentExercisesCard';
import { RecommendationsCard } from './RecommendationsCard';

interface HomeScreenProps {
  storageManager: DataStorageManager;
  onNavigateToScreen: (screen: AppScreen) => void;
  onExerciseRecommendationSelect: (exerciseName: string) => void;
  refreshKey?: number; // For triggering refreshes from parent
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  storageManager,
  onNavigateToScreen,
  onExerciseRecommendationSelect,
  refreshKey = 0,
}) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardService] = useState(() => new DashboardService(storageManager));
  const appState = useRef(AppState.currentState);
  const isScreenFocused = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handle reactive data updates from the dashboard service
   */
  const handleDataUpdate = useCallback(() => {
    // Only refresh if the screen is currently focused and visible
    if (isScreenFocused.current && appState.current === 'active') {
      // Debounce rapid updates to avoid excessive refreshes
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(() => {
        loadDashboardData(false);
      }, 100); // 100ms debounce
    }
  }, []);

  /**
   * Handle app state changes (foreground/background)
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const previousState = appState.current;
    appState.current = nextAppState;

    // If app is coming to foreground and this screen is focused, refresh data
    if (previousState !== 'active' && nextAppState === 'active' && isScreenFocused.current) {
      // Clear cache to ensure fresh data when returning to app
      dashboardService.clearCache();
      loadDashboardData(false);
    }
  }, [dashboardService, loadDashboardData]);

  // Set up reactive refresh listener and app state monitoring
  useEffect(() => {
    // Add refresh listener for reactive updates
    dashboardService.addRefreshListener(handleDataUpdate);
    
    // Add app state change listener for foreground refresh
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Cleanup listeners
      dashboardService.removeRefreshListener(handleDataUpdate);
      appStateSubscription?.remove();
      
      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // Cleanup dashboard service resources
      dashboardService.cleanup();
    };
  }, [dashboardService, handleDataUpdate, handleAppStateChange]);

  // Track screen focus state and performance
  useEffect(() => {
    isScreenFocused.current = true;
    
    // Log performance metrics for monitoring
    const metrics = dashboardService.getPerformanceMetrics();
    console.log('Dashboard performance metrics:', metrics);
    
    return () => {
      isScreenFocused.current = false;
    };
  }, [dashboardService]);

  /**
   * Load dashboard data from the service
   */
  const loadDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      const data = await dashboardService.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      
      // Only show alert if we don't have any cached data to display
      if (!dashboardData) {
        Alert.alert(
          'Error',
          'Unable to load dashboard data. Please check your connection and try again.',
          [
            { text: 'Retry', onPress: () => loadDashboardData(true) },
            { text: 'OK' }
          ]
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dashboardService, dashboardData]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Clear cache to force fresh data
      dashboardService.clearCache();
      await loadDashboardData(false);
    } catch (error) {
      console.error('Error during refresh:', error);
      // Error is already handled in loadDashboardData
    }
  }, [dashboardService, loadDashboardData]);

  /**
   * Handle navigation to exercise edit screen
   */
  const handleExerciseSelect = useCallback((exerciseId: string) => {
    // Navigate to edit screen - the parent will handle finding the exercise
    onNavigateToScreen('edit');
  }, [onNavigateToScreen]);

  /**
   * Handle recommendation selection with optimistic update
   */
  const handleRecommendationSelect = useCallback((exerciseName: string) => {
    // Create optimistic exercise record for immediate UI feedback
    const optimisticExercise: Exercise_Record = {
      id: `temp_${Date.now()}`,
      name: exerciseName,
      startTime: new Date(),
      duration: 30, // Assume 30 minutes as default
      source: DataSource.MANUAL,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add optimistic update for immediate feedback
    dashboardService.addOptimisticUpdate(optimisticExercise);
    
    // Trigger UI refresh
    loadDashboardData(false);
    
    // Navigate to logging screen
    onExerciseRecommendationSelect(exerciseName);
    onNavigateToScreen('logging');
  }, [onExerciseRecommendationSelect, onNavigateToScreen, dashboardService, loadDashboardData]);

  // Load data on component mount and when refreshKey changes
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, refreshKey]);

  // Auto-refresh when component becomes visible (simulated by refreshKey changes)
  useEffect(() => {
    if (refreshKey > 0) {
      // Clear cache and reload for fresh data
      dashboardService.clearCache();
      loadDashboardData(false);
    }
  }, [refreshKey, dashboardService, loadDashboardData]);

  /**
   * Render loading state with timeout handling
   */
  const renderLoadingState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.loadingText}>Loading your dashboard...</Text>
      <Text style={styles.loadingSubtext}>This may take a moment</Text>
    </View>
  );

  /**
   * Render error state with cached data fallback
   */
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>
        {error || 'Unable to load fresh data'}
      </Text>
      <Text style={styles.errorSubtext}>
        {dashboardData ? 'Showing cached data' : 'Pull down to retry'}
      </Text>
    </View>
  );

  /**
   * Render empty state for new users
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Welcome to Health Tracker!</Text>
      <Text style={styles.emptyText}>
        Start logging your exercises to see your progress here.
      </Text>
    </View>
  );


  // Show loading state on initial load
  if (isLoading && !dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        {renderLoadingState()}
      </SafeAreaView>
    );
  }

  // Show empty state for new users with no data
  if (!isLoading && !dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={styles.container}
      accessibilityLabel="Health Tracker Dashboard"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={handleRefresh}
            accessibilityLabel="Pull to refresh dashboard data"
          />
        }
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Dashboard content"
        accessibilityHint="Scroll to view all dashboard cards. Pull down to refresh data."
      >
        {/* Header */}
        <View 
          style={styles.header}
          accessibilityRole="header"
        >
          <Text 
            style={styles.welcomeText}
            accessibilityRole="text"
            accessibilityLabel="Welcome message"
          >
            Good day!
          </Text>
        </View>

        {/* Error indicator (if showing cached data) */}
        {error && dashboardData && renderErrorState()}

        {/* Dashboard Cards */}
        {dashboardData && (
          <View 
            style={styles.cardsContainer}
            accessibilityRole="group"
            accessibilityLabel="Dashboard cards"
          >
            {/* Daily Stats Card */}
            <DailyStatsCard
              dailyStats={dashboardData.dailyStats}
              style={styles.card}
            />

            {/* Weekly Stats Card */}
            <WeeklyStatsCard
              weeklyStats={dashboardData.weeklyStats}
              style={styles.card}
            />

            {/* Recent Exercises Card */}
            <RecentExercisesCard
              recentExercises={dashboardData.recentExercises}
              onExerciseSelect={handleExerciseSelect}
              style={styles.card}
            />

            {/* Recommendations Card */}
            <RecommendationsCard
              recommendations={dashboardData.recommendations}
              onRecommendationSelect={handleRecommendationSelect}
              style={styles.card}
            />
          </View>
        )}

        {/* Last Updated Info */}
        {dashboardData && (
          <View 
            style={styles.footer}
            accessibilityRole="text"
            accessibilityLabel={`Dashboard last updated at ${dashboardData.lastUpdated.toLocaleTimeString()}`}
          >
            <Text style={styles.lastUpdatedText}>
              Last updated: {dashboardData.lastUpdated.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  cardsContainer: {
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#856404',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#95a5a6',
  },
});