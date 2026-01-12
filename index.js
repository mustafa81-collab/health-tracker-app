/**
 * Health Tracker App Entry Point
 */

import { AppRegistry } from 'react-native';
import App from './src/App';

// Register with the exact name expected by iOS (HealthTracker)
// This must match the moduleName in ios/HealthTracker/AppDelegate.mm
AppRegistry.registerComponent('HealthTracker', () => App);
