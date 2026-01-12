// Mock React Native for testing and development

export const Platform = {
  OS: "ios" as "ios" | "android" | "web" | "windows" | "macos",
  Version: "17.0",
  select: (obj: any) => obj.ios || obj.default,
};

export const StyleSheet = {
  create: (styles: any) => styles,
};

export const View = "View";
export const Text = "Text";
export const TextInput = "TextInput";
export const TouchableOpacity = "TouchableOpacity";
export const ScrollView = "ScrollView";
export const KeyboardAvoidingView = "KeyboardAvoidingView";
export const SafeAreaView = "SafeAreaView";
export const StatusBar = "StatusBar";

export const Alert = {
  alert: jest.fn(),
};

export const AppRegistry = {
  registerComponent: jest.fn(),
};

// Mock other React Native components as needed
export default {
  Platform,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
  Alert,
  AppRegistry,
};
