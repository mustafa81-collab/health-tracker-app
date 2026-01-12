# Health Tracker Application Architecture

## Overview

The Health Tracker is a React Native application designed to manage exercise data from multiple sources, handle conflicts between manual and synchronized data, and provide comprehensive exercise logging and history management.

## Application Architecture

### Core Design Principles

1. **Separation of Concerns**: Clear separation between UI components, business logic services, and data persistence layers
2. **Dependency Injection**: Services are injected into components to enable testing and modularity
3. **Type Safety**: Comprehensive TypeScript types ensure data integrity throughout the application
4. **Error Handling**: Robust error handling with user-friendly feedback
5. **Audit Trail**: Complete audit logging for all data operations
6. **Conflict Resolution**: Sophisticated conflict detection and resolution for multi-source data

### Layer Architecture

```
┌─────────────────────────────────────────┐
│              UI Components              │
│  (Screens, Modals, Input Validation)   │
├─────────────────────────────────────────┤
│             Service Layer               │
│   (Business Logic, Validation, Sync)   │
├─────────────────────────────────────────┤
│            Data Access Layer           │
│     (Storage Manager, Database)        │
├─────────────────────────────────────────┤
│           Platform Services            │
│    (SQLite, Health Platforms, OS)      │
└─────────────────────────────────────────┘
```

## File Structure and Responsibilities

### Root Application (`src/App.tsx`)

**Purpose**: Main application component that orchestrates the entire application

**Responsibilities**:
- Application initialization and database setup
- Service dependency injection and management
- Screen navigation and state management
- Global error handling and user feedback
- Centralized event handling for cross-screen operations

**Key Features**:
- Initializes SQLite database connection
- Creates and manages service instances
- Provides navigation between different screens
- Handles exercise deletion with confirmation
- Manages conflict resolution workflows

### Type Definitions (`src/types/index.ts`)

**Purpose**: Comprehensive type system for the entire application

**Key Types**:
- `Exercise_Record`: Core exercise data structure
- `DataSource`: Enumeration of data sources (manual vs synced)
- `HealthPlatform`: Supported health platforms
- `Conflict`: Conflict detection and resolution types
- `ValidationResult`: Input validation results
- `AuditRecord`: Audit trail data structures

**Design Features**:
- Extensible metadata system for platform-specific data
- Strong typing for all data operations
- Comprehensive enumerations for controlled vocabularies
- Flexible interfaces supporting multiple data sources

## Service Layer Architecture

### Exercise Logger (`src/services/ExerciseLogger.ts`)

**Purpose**: Handles manual exercise logging with validation

**Key Responsibilities**:
- Input validation with comprehensive error reporting
- Manual exercise record creation and persistence
- Audit trail creation for all operations
- CRUD operations for manual exercise logs

**Validation Features**:
- Exercise name length and format validation
- Duration range checking and type validation
- Start time bounds checking (not too far in past/future)
- Comprehensive error message generation

### Exercise Record Manager (`src/services/ExerciseRecordManager.ts`)

**Purpose**: Manages exercise record operations (edit, delete, batch operations)

**Key Features**:
- Safe deletion with confirmation and audit trails
- Batch operations for multiple records
- Soft delete functionality with restoration
- Deletion statistics and cleanup operations
- Source-aware deletion policies (manual vs synced)

### Conflict Detector (`src/services/ConflictDetector.ts`)

**Purpose**: Detects conflicts between manual and synchronized exercise data

**Detection Algorithms**:
- Time overlap calculation with configurable thresholds
- Exercise name similarity using Levenshtein distance
- Duration similarity analysis
- Conflict type classification (overlap, duplicate, conflicting data)

**Advanced Features**:
- Normalized exercise name comparison
- Configurable similarity thresholds
- Statistical analysis of conflicts
- Performance-optimized conflict detection

### Conflict Resolver (`src/services/ConflictResolver.ts`)

**Purpose**: Provides user-friendly conflict resolution with multiple strategies

**Resolution Strategies**:
- Keep manual entry (discard synced)
- Keep synced data (discard manual)
- Merge records into single exercise
- Keep both as separate records

**User Experience Features**:
- Visual timeline representation of conflicts
- Intelligent resolution recommendations
- Detailed conflict presentation with metadata
- Validation of resolution choices

### Data Storage Manager (`src/services/database/DataStorageManager.ts`)

**Purpose**: Comprehensive data persistence layer with SQLite integration

**Core Operations**:
- CRUD operations for exercise records
- Audit trail management with automatic cleanup
- Conflict preservation and resolution tracking
- Transaction support for data integrity

**Advanced Features**:
- Held records system for conflict resolution
- Automatic audit record cleanup
- Comprehensive error handling with detailed messages
- Support for complex queries and data relationships

## UI Component Architecture

### Exercise Logging Screen (`src/components/ExerciseLoggingScreen.tsx`)

**Purpose**: User interface for manual exercise entry

**Features**:
- Real-time input validation with immediate feedback
- Comprehensive form validation with error display
- User-friendly input helpers (current time button)
- Responsive design with keyboard handling
- Visual validation status indicators

**Validation Integration**:
- Integrates with ExerciseLogger service for validation
- Displays field-specific error messages
- Provides validation summary for user guidance
- Prevents submission of invalid data

### Exercise History Screen (`src/components/ExerciseHistoryScreen.tsx`)

**Purpose**: Displays chronological exercise history with source attribution

**Features**:
- Chronological grouping by date (Today, Yesterday, specific dates)
- Source identification with visual indicators
- Comprehensive exercise details display
- Touch interaction for record selection
- Loading states and error handling

**Data Presentation**:
- Groups exercises by date for easy navigation
- Shows data source (manual vs synced platform)
- Displays duration, timing, and metadata
- Provides visual distinction between data sources

### Conflict Resolution Screen (`src/components/ConflictResolutionScreen.tsx`)

**Purpose**: Interactive interface for resolving data conflicts

**User Experience**:
- Side-by-side comparison of conflicting records
- Clear visual distinction between manual and synced data
- Multiple resolution options with descriptions
- Visual feedback for selected resolution
- Confirmation and cancellation workflows

**Resolution Interface**:
- Detailed record comparison with all metadata
- Color-coded source identification
- Interactive resolution choice selection
- Progress indication during resolution

## Data Flow Architecture

### Manual Exercise Logging Flow

1. **User Input**: User enters exercise data in ExerciseLoggingScreen
2. **Validation**: ExerciseLogger validates input against defined rules
3. **Record Creation**: Valid data is converted to Exercise_Record
4. **Persistence**: DataStorageManager saves record to SQLite database
5. **Audit Trail**: Audit record is created for the operation
6. **User Feedback**: Success/error feedback is provided to user

### Conflict Detection and Resolution Flow

1. **Data Synchronization**: External health platform data is imported
2. **Conflict Detection**: ConflictDetector analyzes for overlaps and duplicates
3. **Conflict Preservation**: Conflicting records are held for user review
4. **User Notification**: User is notified of conflicts requiring resolution
5. **Resolution Interface**: ConflictResolutionScreen presents options
6. **Resolution Execution**: ConflictResolver applies user's choice
7. **Data Persistence**: Resolved state is saved with audit trail

### Data Persistence Flow

1. **Service Layer**: Business logic services prepare data operations
2. **Storage Manager**: DataStorageManager handles database operations
3. **SQLite Database**: Data is persisted to local SQLite database
4. **Audit Trail**: All operations are logged for accountability
5. **Error Handling**: Failures are caught and reported appropriately

## Error Handling Strategy

### Validation Errors
- Comprehensive input validation with detailed error messages
- Real-time validation feedback in UI components
- Prevention of invalid data submission
- User-friendly error descriptions

### Database Errors
- Graceful handling of database connection issues
- Transaction rollback on operation failures
- Detailed error logging for debugging
- User-friendly error messages

### Conflict Resolution Errors
- Validation of resolution choices before execution
- Rollback capability for failed resolutions
- Clear error reporting for resolution failures
- Preservation of original data on errors

## Performance Considerations

### Database Optimization
- Indexed queries for fast data retrieval
- Automatic cleanup of old audit records
- Efficient conflict detection algorithms
- Batch operations for multiple records

### UI Performance
- Lazy loading of exercise history
- Efficient re-rendering with React hooks
- Optimized list rendering for large datasets
- Responsive design for various screen sizes

### Memory Management
- Proper cleanup of database connections
- Efficient data structures for large datasets
- Garbage collection friendly object patterns
- Minimal memory footprint for mobile devices

## Security and Privacy

### Data Protection
- Local SQLite database with no external transmission
- Secure handling of health platform credentials
- Privacy-focused design with minimal data collection
- User control over data retention and deletion

### Audit Trail Security
- Immutable audit records for accountability
- Comprehensive logging of all data operations
- Secure storage of audit information
- User access to their own audit history

## Testing Strategy

### Unit Testing
- Service layer methods with comprehensive test coverage
- Validation logic testing with edge cases
- Database operation testing with mock data
- Error handling verification

### Integration Testing
- End-to-end workflow testing
- Database integration testing
- Service layer integration verification
- UI component integration testing

### User Acceptance Testing
- Manual testing of all user workflows
- Conflict resolution scenario testing
- Data integrity verification
- Performance testing with large datasets

## Future Extensibility

### Platform Integration
- Modular design supports additional health platforms
- Extensible metadata system for platform-specific data
- Configurable synchronization strategies
- Plugin architecture for new data sources

### Feature Extensions
- Additional conflict resolution strategies
- Enhanced analytics and reporting
- Export capabilities for exercise data
- Social sharing and collaboration features

### Scalability Considerations
- Database schema designed for growth
- Service layer supports additional business logic
- UI components designed for feature expansion
- Modular architecture supports new functionality

This architecture provides a solid foundation for a comprehensive health tracking application with robust conflict resolution, comprehensive audit trails, and excellent user experience.