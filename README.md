# Health Tracker - React Native App

A comprehensive React Native application for tracking exercise data with sophisticated conflict resolution between manual entries and synchronized health platform data.

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

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on iOS** (in another terminal)
   ```bash
   npm run ios
   ```

3. **Run on Android** (if Android setup is complete)
   ```bash
   npm run android
   ```

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
├── App.tsx                    # Main application component
├── types/                     # TypeScript type definitions
├── services/                  # Business logic services
│   ├── ExerciseLogger.ts     # Exercise logging with validation
│   ├── ConflictDetector.ts   # Conflict detection algorithms
│   ├── ConflictResolver.ts   # Conflict resolution strategies
│   └── database/             # Data persistence layer
├── components/               # React Native UI components
│   ├── ExerciseLoggingScreen.tsx
│   ├── ExerciseHistoryScreen.tsx
│   └── ConflictResolutionScreen.tsx
└── __tests__/               # Comprehensive test suite
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