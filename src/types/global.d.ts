// Global type declarations for tests and development

import { Exercise_Record } from "./index";

declare global {
  var mockExerciseRecord: Exercise_Record;

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(a: number, b: number): R;
    }
  }
}

export {};
