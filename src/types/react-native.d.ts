// React Native type declarations for development environment

declare module "react-native" {
  export interface PlatformStatic {
    OS: "ios" | "android" | "web" | "windows" | "macos";
    Version: string | number;
    select<T>(
      specifics: {
        [platform in "ios" | "android" | "web" | "windows" | "macos"]?: T;
      } & { default?: T }
    ): T;
  }

  export const Platform: PlatformStatic;

  export interface StyleSheetStatic {
    create<T extends { [key: string]: any }>(styles: T): T;
  }

  export const StyleSheet: StyleSheetStatic;

  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const ScrollView: any;
  export const KeyboardAvoidingView: any;
  export const SafeAreaView: any;
  export const StatusBar: any;

  export interface AlertStatic {
    alert(title: string, message?: string, buttons?: any[]): void;
  }

  export const Alert: AlertStatic;

  export interface AppRegistryStatic {
    registerComponent(appKey: string, componentProvider: () => any): void;
  }

  export const AppRegistry: AppRegistryStatic;
}

declare module "react-native-sqlite-storage" {
  export interface SQLiteDatabase {
    transaction(
      fn: (tx: any) => void,
      errorCallback?: (error: any) => void,
      successCallback?: () => void
    ): void;
    executeSql(sql: string, params?: any[]): Promise<any>;
    close(): Promise<void>;
  }

  export interface SQLiteStatic {
    DEBUG: (debug: boolean) => void;
    enablePromise: (enable: boolean) => void;
    openDatabase(options: any): Promise<SQLiteDatabase>;
  }

  const SQLite: SQLiteStatic;
  export default SQLite;
  export = SQLite;
}

declare module "react-native-health" {
  export function initHealthKit(permissions: any): Promise<void>;
  export function getPermissions(permissions: string[]): Promise<any>;
  export function getSamples(type: string, options: any): Promise<any[]>;
  export function isAvailable(): Promise<boolean>;
}

declare module "react-native-health-connect" {
  export function initialize(): Promise<void>;
  export function requestPermission(permissions: string[]): Promise<any>;
  export function readRecords(type: string, options: any): Promise<any[]>;
  export function isAvailable(): Promise<boolean>;
  export function getGrantedPermissions(): Promise<string[]>;
}
