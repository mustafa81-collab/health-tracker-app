# Design Document: Home Screen Dashboard

## Overview

The Home Screen Dashboard serves as the main entry point for the Health Tracker application, providing users with an at-a-glance summary of their exercise activities, intelligent recommendations, and quick access to core functionality. The dashboard follows a card-based layout design that prioritizes readability, accessibility, and user engagement.

## Architecture

### Component Hierarchy
```
HomeScreen
├── DashboardHeader (Welcome message, current date)
├── DailyStatsCard (Today's exercise count and duration)
├── WeeklyStatsCard (Weekly totals and trends)
├── RecentExercisesCard (Last 3-5 exercise entries)
├── RecommendationsCard (2 suggested exercises)
├── QuickActionsCard (Navigation buttons)
└── RefreshIndicator (Pull-to-refresh functionality)
```

### Navigation Integration
- Update AppScreen type to include "home" as the default screen
- Modify App.tsx navigation to set "home" as the initial screen
- Add home navigation button to existing navigation bar
- Implement navigation from dashboard cards to relevant screens

## Components and Interfaces

### HomeScreen Component
```typescript
interface HomeScreenProps {
  storageManager: DataStorageManager;
  onNavigateToScreen: (screen: AppScreen) => void;
  onExerciseRecommendationSelect: (exerciseName: string) => void;
}

interface DashboardData {
  dailyStats: DailyExerciseStats;
  weeklyStats: WeeklyExerciseStats;
  recentExercises: Exercise_Record[];
  recommendations: ExerciseRecommendation[];
  lastUpdated: Date;
}
```

### Statistics Components
```typescript
interface DailyExerciseStats {
  exerciseCount: number;
  totalDuration: number;
  lastExerciseTime?: Date;
  lastExerciseName?: string;
}

interface WeeklyExerciseStats {
  exerciseCount: number;
  totalDuration: number;
  mostFrequentExercise?: string;
  averageDaily: number;
  comparedToPreviousWeek: 'above' | 'below' | 'same';
}

interface ExerciseRecommendation {
  exerciseName: string;
  lastPerformed?: Date;
  daysSinceLastPerformed: number;
  description: string;
}
```

### Dashboard Service Layer
```typescript
class DashboardService {
  constructor(private storageManager: DataStorageManager) {}
  
  async getDashboardData(): Promise<DashboardData>
  async getDailyStats(date: Date): Promise<DailyExerciseStats>
  async getWeeklyStats(weekStart: Date): Promise<WeeklyExerciseStats>
  async getRecentExercises(limit: number): Promise<Exercise_Record[]>
  async getExerciseRecommendations(): Promise<ExerciseRecommendation[]>
  private calculateRecommendations(exercises: Exercise_Record[]): ExerciseRecommendation[]
}
```

## Data Models

### Dashboard Data Flow
1. **Data Retrieval**: DashboardService queries DataStorageManager for exercise records
2. **Statistics Calculation**: Service calculates daily/weekly aggregations
3. **Recommendation Engine**: Analyzes exercise patterns to suggest variety
4. **UI Rendering**: HomeScreen displays formatted data in card components
5. **Real-time Updates**: Dashboard refreshes when returning from other screens

### Recommendation Algorithm
```typescript
// Recommendation logic:
// 1. Get all unique exercise names from user's history
// 2. Find exercises not performed in last 7 days
// 3. Prioritize exercises performed before but not recently
// 4. Fall back to popular exercise suggestions for new users
// 5. Return top 2 recommendations with context
```

### Data Caching Strategy
- Cache dashboard data for 5 minutes to improve performance
- Invalidate cache when new exercises are logged
- Use optimistic updates for immediate UI feedback
- Implement pull-to-refresh for manual data updates

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Daily Exercise Count Accuracy
*For any* date and set of exercise records, the dashboard daily count should equal the number of exercises logged on that specific date
**Validates: Requirements 1.1**

### Property 2: Daily Duration Calculation
*For any* date and set of exercise records, the dashboard daily duration should equal the sum of all exercise durations for that date
**Validates: Requirements 1.2**

### Property 3: Most Recent Exercise Identification
*For any* set of today's exercises, the dashboard should highlight the exercise with the latest timestamp
**Validates: Requirements 1.4**

### Property 4: Mixed Data Source Inclusion
*For any* combination of manual logs and synced data for today, the daily totals should include exercises from both sources
**Validates: Requirements 1.5**

### Property 5: Weekly Exercise Count Accuracy
*For any* week boundary and set of exercise records, the weekly count should equal exercises within that week's date range
**Validates: Requirements 2.1**

### Property 6: Weekly Duration Calculation
*For any* week and set of exercise records, the weekly duration should equal the sum of all exercise durations within that week
**Validates: Requirements 2.2**

### Property 7: Most Frequent Exercise Detection
*For any* set of weekly exercises, the dashboard should identify the exercise name that appears most frequently
**Validates: Requirements 2.3**

### Property 8: Weekly Comparison Calculation
*For any* current week and historical data, the comparison indicator should correctly reflect whether current week is above, below, or equal to historical average
**Validates: Requirements 2.4**

### Property 9: Recent Exercises Limiting and Ordering
*For any* set of exercise records, the recent exercises display should show the most recent 3-5 exercises in chronological order (newest first)
**Validates: Requirements 3.1**

### Property 10: Recent Exercise Information Completeness
*For any* recent exercise entry displayed, the UI should include exercise name, duration, and relative time information
**Validates: Requirements 3.2**

### Property 11: Recent Exercise Navigation
*For any* recent exercise entry, tapping should trigger navigation to the appropriate detail or edit screen
**Validates: Requirements 3.3**

### Property 12: Mixed Source Attribution
*For any* recent exercises list containing both manual and synced data, each entry should clearly indicate its data source
**Validates: Requirements 3.5**

### Property 13: Recommendation Time Filtering
*For any* set of exercise history, recommendations should only include exercises not performed within the last 7 days
**Validates: Requirements 4.1**

### Property 14: Recommendation Count and Content
*For any* recommendation display, exactly 2 exercises should be shown with descriptions
**Validates: Requirements 4.2**

### Property 15: Recommendation Navigation with Data
*For any* recommendation selection, the exercise logging screen should be pre-populated with the selected exercise name
**Validates: Requirements 4.3**

### Property 16: Recommendation Historical Context
*For any* displayed recommendation, the last performed date should be accurately shown based on exercise history
**Validates: Requirements 4.5**

### Property 17: Quick Action Navigation
*For any* quick action button press, navigation should occur immediately to the correct target screen
**Validates: Requirements 5.3**

### Property 18: Accessibility Labels Presence
*For any* dashboard UI element, appropriate accessibility labels should be present for screen reader compatibility
**Validates: Requirements 5.4, 9.1**

### Property 19: Interactive Button State
*For any* dashboard load completion, all quick action buttons should be in an enabled and interactive state
**Validates: Requirements 5.5**

### Property 20: Dashboard Data Refresh
*For any* dashboard screen focus event, exercise summary data should be refreshed from the current data source
**Validates: Requirements 6.1**

### Property 21: Reactive Statistics Updates
*For any* new exercise addition, dashboard statistics should automatically update to reflect the new data
**Validates: Requirements 6.2**

### Property 22: Navigation Return Refresh
*For any* return navigation to the dashboard, recent entries and recommendations should be refreshed
**Validates: Requirements 6.3**

### Property 23: Sync Data Integration
*For any* data synchronization event, dashboard metrics should update to include the newly synced exercise data
**Validates: Requirements 6.4**

### Property 24: Touch Target Sizing
*For any* quick action button, the touch target should meet or exceed 44x44 points for accessibility compliance
**Validates: Requirements 9.3**

### Property 25: Keyboard Navigation Order
*For any* dashboard layout, tab order should follow a logical sequence for keyboard navigation accessibility
**Validates: Requirements 9.4**

### Property 26: Visual Element Accessibility
*For any* icon or visual element in recommendations, alternative text descriptions should be provided
**Validates: Requirements 9.5**

## Error Handling

### Data Loading Failures
- Display cached data when fresh data cannot be loaded
- Show refresh indicators for failed operations
- Provide manual refresh options via pull-to-refresh
- Graceful degradation with placeholder content for missing data

### Calculation Errors
- Handle edge cases like division by zero in averages
- Validate date ranges for weekly calculations
- Handle empty datasets gracefully
- Provide fallback values for statistical calculations

### Navigation Errors
- Ensure navigation targets exist before attempting navigation
- Handle missing exercise data for detail navigation
- Provide error feedback for failed navigation attempts
- Maintain app stability during navigation failures

## Testing Strategy

### Unit Testing Approach
- Test individual dashboard service methods with various data scenarios
- Verify statistical calculations with edge cases (empty data, single entries, large datasets)
- Test recommendation algorithm with different exercise patterns
- Validate date range calculations across week/month boundaries
- Test error handling for invalid or missing data

### Property-Based Testing Configuration
- Use fast-check library for TypeScript property-based testing
- Configure each test to run minimum 100 iterations
- Generate random exercise datasets with varying dates, durations, and sources
- Test statistical calculations across all possible input combinations
- Validate UI component behavior with randomized data

**Property Test Tags:**
- Each property test must reference its design document property
- Tag format: **Feature: home-screen-dashboard, Property {number}: {property_text}**
- Tests should validate universal correctness across all valid inputs

### Integration Testing
- Test dashboard data flow from database to UI components
- Verify navigation integration with existing app screens
- Test real-time updates when data changes in other screens
- Validate accessibility features with screen reader simulation
- Test performance with large datasets and frequent updates

### UI Testing
- Test responsive layout across different screen sizes
- Verify accessibility compliance with automated tools
- Test touch interactions and navigation flows
- Validate loading states and error conditions
- Test pull-to-refresh functionality and visual feedback
