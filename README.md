# Health Tracker - React Native App

A comprehensive React Native application for tracking exercise data with sophisticated conflict resolution between manual entries and synchronized health platform data.

## ✅ Current Status (Latest Update - January 2026)

**Fully Functional Features:**
- ✅ **Home Dashboard**: Comprehensive dashboard with daily/weekly stats, recent exercises, and intelligent recommendations
- ✅ **Custom App Icon**: Professional health/fitness themed launcher icon
- ✅ **Database & Storage**: SQLite with proper migrations and schema
- ✅ **Navigation**: Complete navigation between all 6 screens with home as default
- ✅ **Exercise Logging**: Manual exercise entry with improved validation UX
- ✅ **Exercise History**: View, edit, and delete exercises
- ✅ **Data Management**: Clear all data functionality
- ✅ **Auto-Refresh**: All screens update automatically on data changes
- ✅ **Error Handling**: Comprehensive error handling and user feedback
- ✅ **Accessibility**: Full screen reader support and keyboard navigation
- ✅ **Testing**: 26 property-based tests with comprehensive coverage

**Available Screens:**
1. **🏠 Home Dashboard** - Main screen with stats, recommendations, and quick actions
2. **📝 Exercise Logging** - Add new exercises manually with improved validation
3. **📊 Exercise History** - View all logged exercises  
4. **✏️ Exercise Edit** - Edit manual exercises (via history)
5. **🗑️ Delete Confirmation** - Confirm exercise deletions
6. **⚖️ Conflict Resolution** - Resolve data conflicts (when they occur)

**Latest Improvements:**
- Complete home screen dashboard with intelligent recommendations
- Validation summary only shows after submit attempt (improved UX)
- Custom app launcher icon with health/fitness theme
- Comprehensive property-based test suite (26 tests)
- Full accessibility compliance with screen reader support
- Performance optimizations with caching and reactive updates
- Automatic data refresh across all screens

## 🚀 Features

- **Manual Exercise Logging**: Log workouts with comprehensive validation
- **Exercise History**: View chronological exercise history with source attribution
- **Conflict Resolution**: Intelligent detection and resolution of data conflicts
- **Cross-Platform Health Integration**: Support for Apple HealthKit and Google Health Connect
- **Comprehensive Audit Trail**: Complete tracking of all data operations
- **Property-Based Testing**: Robust testing with formal correctness properties

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (version 20 or higher)
- **npm** or **yarn**
- **React Native CLI**: `npm install -g react-native-cli`
- **Xcode** (for iOS development)
- **CocoaPods**: `sudo gem install cocoapods`

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd health-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install iOS dependencies**
   ```bash
   cd ios && pod install && cd ..
   ```

## 🏃‍♂️ Running the App

### On Simulator/Emulator

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on iOS Simulator** (in another terminal)
   ```bash
   npm run ios
   ```

3. **Run on Android Emulator** (if Android setup is complete)
   ```bash
   npm run android
   ```

### 📱 On Physical iPhone

**Want to install on your actual iPhone?** See the complete guide:

👉 **[INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md)** - Step-by-step installation guide

**Quick summary:**
1. Connect your iPhone via USB
2. Open `ios/HealthTracker.xcworkspace` in Xcode
3. Select your iPhone as the build target
4. Click the Play button
5. Trust the developer on your iPhone

**Alternative methods:**
- **Build IPA file**: `npm run build:ios` (see [IOS_DISTRIBUTION_GUIDE.md](./IOS_DISTRIBUTION_GUIDE.md))
- **TestFlight**: For professional distribution (requires paid Apple Developer account)

For detailed instructions, troubleshooting, and distribution options, see:
- 📖 [INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md) - Complete installation guide
- 📦 [IOS_DISTRIBUTION_GUIDE.md](./IOS_DISTRIBUTION_GUIDE.md) - All distribution methods
- 📋 [DISTRIBUTION_SUMMARY.md](./DISTRIBUTION_SUMMARY.md) - Quick overview

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run property-based tests
npm run test:properties

# Run with coverage
npm run test:coverage
```

## 📚 Documentation

This project includes comprehensive documentation:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Detailed system architecture and design patterns
- **[DOCUMENTATION_SUMMARY.md](./DOCUMENTATION_SUMMARY.md)**: Overview of all documentation updates
- **Inline JSDoc Comments**: Comprehensive code documentation throughout

## 🏗️ Project Structure

```
src/
├── App.tsx                    # Main application component with navigation
├── types/                     # TypeScript type definitions
├── services/                  # Business logic services
│   ├── DashboardService.ts   # Dashboard data aggregation and recommendations
│   ├── ExerciseLogger.ts     # Exercise logging with validation
│   ├── ConflictDetector.ts   # Conflict detection algorithms
│   ├── ConflictResolver.ts   # Conflict resolution strategies
│   └── database/             # Data persistence layer
├── components/               # React Native UI components
│   ├── HomeScreen.tsx        # Main dashboard with stats and recommendations
│   ├── DailyStatsCard.tsx    # Today's exercise statistics
│   ├── WeeklyStatsCard.tsx   # Weekly exercise statistics
│   ├── RecentExercisesCard.tsx # Recent exercise history
│   ├── RecommendationsCard.tsx # Intelligent exercise recommendations
│   ├── QuickActionsCard.tsx  # Navigation shortcuts
│   ├── ExerciseLoggingScreen.tsx # Exercise entry with improved validation
│   ├── ExerciseHistoryScreen.tsx # Exercise history management
│   └── ConflictResolutionScreen.tsx # Conflict resolution interface
├── __tests__/               # Comprehensive test suite
│   ├── services/            # Service layer tests
│   ├── components/          # Component and accessibility tests
│   ├── integration/         # Navigation and integration tests
│   └── configuration/       # App configuration tests
└── design/                  # App design assets
    ├── app-icon.svg         # Custom app icon design
    └── icon-generation-guide.md # Icon implementation guide
```

## 🔧 Key Technologies

- **React Native**: Cross-platform mobile development
- **TypeScript**: Type-safe JavaScript development
- **SQLite**: Local data persistence
- **Property-Based Testing**: Formal correctness verification
- **JSDoc**: Comprehensive code documentation

## 🎯 Core Architecture

The application follows a layered architecture:

1. **UI Layer**: React Native components with comprehensive validation
2. **Service Layer**: Business logic with dependency injection
3. **Data Layer**: SQLite with audit trails and conflict management
4. **Platform Layer**: Health platform integrations (iOS/Android)

## 🔍 Key Features Explained

### Conflict Resolution
The app intelligently detects and resolves conflicts between:
- Manual exercise entries
- Synchronized health platform data

### Property-Based Testing
Comprehensive testing using formal properties that verify:
- Data integrity across all operations
- Conflict resolution correctness
- Audit trail completeness

### Comprehensive Documentation
Every component includes:
- Detailed JSDoc comments
- Architecture explanations
- Usage examples
- Error handling patterns

## 🤝 Contributing

1. Read the [ARCHITECTURE.md](./ARCHITECTURE.md) for system understanding
2. Follow the established patterns and documentation standards
3. Add comprehensive tests for new features
4. Update documentation for any changes

## 📄 License

[Add your license information here]

## 🆘 Troubleshooting

### Common Issues

1. **Metro bundler issues**: `npx react-native start --reset-cache`
2. **iOS build issues**: Clean Xcode project and rebuild
3. **Pod install issues**: `cd ios && pod deintegrate && pod install`

### Getting Help

- Check the comprehensive documentation in `ARCHITECTURE.md`
- Review inline code comments for specific implementation details
- Examine the test suite for usage examples

---

**Note**: This project includes comprehensive documentation and follows React Native best practices. The codebase is fully documented with JSDoc comments and includes a complete test suite with property-based testing.