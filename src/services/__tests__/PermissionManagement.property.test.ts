// Property test for permission management
// Property 13: Permission Management
// Validates: Requirements 7.2

import fc from "fast-check";
import {
  PermissionManager,
  PermissionType,
  OptInSettings,
} from "../PermissionManager";
import { HealthPlatform } from "@/types";

// Generators for test data
const permissionTypeArb = fc.constantFrom(
  PermissionType.READ_WORKOUTS,
  PermissionType.READ_STEPS,
  PermissionType.READ_HEART_RATE,
  PermissionType.READ_ACTIVITY
);

const healthPlatformArb = fc.constantFrom(
  HealthPlatform.APPLE_HEALTHKIT,
  HealthPlatform.GOOGLE_HEALTH_CONNECT
);

const permissionSetArb = fc
  .array(permissionTypeArb, { minLength: 0, maxLength: 4 })
  .map((arr) => new Set(arr));

const optInSettingsArb = fc
  .record({
    dataCollection: fc.boolean(),
    syncEnabled: fc.boolean(),
    selectedPermissions: fc
      .array(permissionTypeArb, { minLength: 0, maxLength: 4 })
      .map((arr) => new Set(arr)),
    explanationShown: fc.boolean(),
    consentTimestamp: fc.option(
      fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") })
    ),
  })
  .map((settings) => ({
    ...settings,
    consentTimestamp: settings.consentTimestamp || undefined,
  }));

describe("Property 13: Permission Management", () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager();
  });

  test("Property 13.1: Data collection explanation must always be comprehensive", () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed
        () => {
          const optIn = permissionManager.getDataCollectionOptIn();

          // Must have all required sections
          expect(optIn.title).toBeDefined();
          expect(optIn.message).toBeDefined();
          expect(optIn.benefits).toBeDefined();
          expect(optIn.dataUsage).toBeDefined();
          expect(optIn.userRights).toBeDefined();

          // All sections must be non-empty
          expect(optIn.title.length).toBeGreaterThan(0);
          expect(optIn.message.length).toBeGreaterThan(0);
          expect(optIn.benefits.length).toBeGreaterThan(0);
          expect(optIn.dataUsage.length).toBeGreaterThan(0);
          expect(optIn.userRights.length).toBeGreaterThan(0);

          // Benefits should highlight user value
          expect(
            optIn.benefits.some(
              (benefit) =>
                benefit.toLowerCase().includes("track") ||
                benefit.toLowerCase().includes("sync") ||
                benefit.toLowerCase().includes("progress")
            )
          ).toBe(true);

          // Data usage should mention privacy
          expect(
            optIn.dataUsage.some(
              (usage) =>
                usage.toLowerCase().includes("private") ||
                usage.toLowerCase().includes("local") ||
                usage.toLowerCase().includes("device")
            )
          ).toBe(true);

          // User rights should mention control
          expect(
            optIn.userRights.some(
              (right) =>
                right.toLowerCase().includes("opt out") ||
                right.toLowerCase().includes("delete") ||
                right.toLowerCase().includes("control")
            )
          ).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  test("Property 13.2: Permission requests must include clear explanations", () => {
    fc.assert(
      fc.property(healthPlatformArb, (platform) => {
        const request = permissionManager.getPermissionRequests(platform);

        // Request must have all required fields
        expect(request.platform).toBe(platform);
        expect(request.permissions).toBeDefined();
        expect(request.explanation).toBeDefined();
        expect(request.required).toBeDefined();

        // Must have at least one permission
        expect(request.permissions.length).toBeGreaterThan(0);

        // Each permission must have explanation
        for (const permission of request.permissions) {
          expect(permission.type).toBeDefined();
          expect(permission.name).toBeDefined();
          expect(permission.description).toBeDefined();
          expect(permission.explanation).toBeDefined();
          expect(permission.required).toBeDefined();

          // Explanations must be meaningful
          expect(permission.name.length).toBeGreaterThan(0);
          expect(permission.description.length).toBeGreaterThan(0);
          expect(permission.explanation.length).toBeGreaterThan(10); // Substantial explanation

          // Explanation should mention benefit or purpose
          expect(
            permission.explanation.toLowerCase().includes("help") ||
              permission.explanation.toLowerCase().includes("allow") ||
              permission.explanation.toLowerCase().includes("provide") ||
              permission.explanation.toLowerCase().includes("track")
          ).toBe(true);
        }

        // Platform explanation should be specific
        expect(request.explanation.length).toBeGreaterThan(20);
        if (platform === HealthPlatform.APPLE_HEALTHKIT) {
          expect(request.explanation.toLowerCase()).toContain("apple");
        } else if (platform === HealthPlatform.GOOGLE_HEALTH_CONNECT) {
          expect(request.explanation.toLowerCase()).toContain("google");
        }
      }),
      { numRuns: 20 }
    );
  });

  test("Property 13.3: Selective opt-in must respect user choices", async () => {
    await fc.assert(
      fc.asyncProperty(
        healthPlatformArb,
        permissionSetArb,
        async (platform, selectedPermissions) => {
          const permissionSet = selectedPermissions as Set<PermissionType>;

          const status = await permissionManager.requestSelectivePermissions(
            platform,
            permissionSet
          );

          // Status must reflect selections
          expect(status.platform).toBe(platform);
          expect(status.permissions.size).toBe(permissionSet.size);

          // All selected permissions should be in the status
          for (const permission of permissionSet) {
            expect(status.permissions.has(permission)).toBe(true);
            expect(status.permissions.get(permission)).toBe(true);
          }

          // Opt-in settings should be updated
          const optInSettings = permissionManager.getOptInSettings();
          expect(optInSettings.selectedPermissions).toEqual(permissionSet);
          expect(optInSettings.dataCollection).toBe(permissionSet.size > 0);
          expect(optInSettings.syncEnabled).toBe(
            permissionSet.has(PermissionType.READ_WORKOUTS)
          );

          if (permissionSet.size > 0) {
            expect(optInSettings.consentTimestamp).toBeDefined();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test("Property 13.4: Permission status must be consistent with settings", async () => {
    await fc.assert(
      fc.asyncProperty(
        healthPlatformArb,
        permissionSetArb,
        async (platform, selectedPermissions) => {
          const permissionSet = selectedPermissions as Set<PermissionType>;

          // Set permissions
          await permissionManager.requestSelectivePermissions(
            platform,
            permissionSet
          );

          // Check status
          const status = await permissionManager.getPermissionStatus(platform);

          // Status must match what was set
          expect(status.platform).toBe(platform);
          expect(status.permissions.size).toBe(permissionSet.size);

          for (const permission of permissionSet) {
            expect(status.permissions.get(permission)).toBe(true);
          }

          // Required permissions check
          const hasRequiredWorkouts = permissionSet.has(
            PermissionType.READ_WORKOUTS
          );
          expect(status.requiredGranted).toBe(hasRequiredWorkouts);

          // All granted check
          expect(status.allGranted).toBe(
            permissionSet.size > 0 &&
              Array.from(permissionSet).every(
                (p) => status.permissions.get(p) === true
              )
          );
        }
      ),
      { numRuns: 25 }
    );
  });

  test("Property 13.5: Sync enablement must follow permission rules", () => {
    fc.assert(
      fc.property(permissionSetArb, (selectedPermissions) => {
        const permissionSet = selectedPermissions as Set<PermissionType>;

        // Update settings
        permissionManager.updateOptInSettings({
          selectedPermissions: permissionSet,
          syncEnabled: permissionSet.has(PermissionType.READ_WORKOUTS),
        });

        const isSyncEnabled = permissionManager.isSyncEnabled();
        const hasWorkoutPermission = permissionSet.has(
          PermissionType.READ_WORKOUTS
        );

        // Sync should only be enabled if workout permission is granted
        expect(isSyncEnabled).toBe(hasWorkoutPermission);
      }),
      { numRuns: 40 }
    );
  });

  test("Property 13.6: Permission revocation must update all related settings", async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionSetArb,
        permissionSetArb,
        async (initialPermissions, permissionsToRevoke) => {
          const initialSet = initialPermissions as Set<PermissionType>;
          const revokeSet = permissionsToRevoke as Set<PermissionType>;

          // Set initial permissions
          await permissionManager.requestSelectivePermissions(
            HealthPlatform.APPLE_HEALTHKIT,
            initialSet
          );

          // Revoke some permissions
          await permissionManager.revokePermissions(revokeSet);

          const settings = permissionManager.getOptInSettings();
          const expectedRemaining = new Set(
            Array.from(initialSet).filter((p) => !revokeSet.has(p))
          );

          // Remaining permissions should be correct
          expect(settings.selectedPermissions).toEqual(expectedRemaining);

          // Data collection should be disabled if no permissions remain
          expect(settings.dataCollection).toBe(expectedRemaining.size > 0);

          // Sync should be disabled if workout permission was revoked
          const workoutRevoked = revokeSet.has(PermissionType.READ_WORKOUTS);
          const workoutRemains = expectedRemaining.has(
            PermissionType.READ_WORKOUTS
          );

          if (workoutRevoked) {
            expect(settings.syncEnabled).toBe(false);
          } else {
            expect(settings.syncEnabled).toBe(workoutRemains);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test("Property 13.7: Permission explanations must be contextual", () => {
    fc.assert(
      fc.property(permissionTypeArb, (permissionType) => {
        const explanation =
          permissionManager.getPermissionExplanation(permissionType);

        // Must have meaningful explanation
        expect(explanation).toBeDefined();
        expect(explanation.length).toBeGreaterThan(10);

        // Should be contextual to permission type
        const lowerExplanation = explanation.toLowerCase();

        switch (permissionType) {
          case PermissionType.READ_WORKOUTS:
            expect(
              lowerExplanation.includes("workout") ||
                lowerExplanation.includes("exercise") ||
                lowerExplanation.includes("sync")
            ).toBe(true);
            break;

          case PermissionType.READ_STEPS:
            expect(
              lowerExplanation.includes("step") ||
                lowerExplanation.includes("walk") ||
                lowerExplanation.includes("activity")
            ).toBe(true);
            break;

          case PermissionType.READ_HEART_RATE:
            expect(
              lowerExplanation.includes("heart") ||
                lowerExplanation.includes("rate") ||
                lowerExplanation.includes("intensity")
            ).toBe(true);
            break;

          case PermissionType.READ_ACTIVITY:
            expect(
              lowerExplanation.includes("activity") ||
                lowerExplanation.includes("movement") ||
                lowerExplanation.includes("physical")
            ).toBe(true);
            break;
        }
      }),
      { numRuns: 50 }
    );
  });

  test("Property 13.8: Privacy settings summary must be accurate", () => {
    fc.assert(
      fc.property(optInSettingsArb, (settings) => {
        const typedSettings = settings as OptInSettings;

        // Update settings
        permissionManager.updateOptInSettings(typedSettings);

        const summary = permissionManager.getPrivacySettingsSummary();

        // Summary must match settings
        expect(summary.dataCollectionEnabled).toBe(
          typedSettings.dataCollection
        );
        expect(summary.syncEnabled).toBe(typedSettings.syncEnabled);
        expect(summary.permissionsGranted).toEqual(
          Array.from(typedSettings.selectedPermissions)
        );

        // Consent date should match if present
        if (typedSettings.consentTimestamp) {
          expect(summary.consentDate).toEqual(typedSettings.consentTimestamp);
        } else {
          expect(summary.consentDate).toBeUndefined();
        }
      }),
      { numRuns: 30 }
    );
  });

  test("Property 13.9: Explanation tracking must be persistent", () => {
    fc.assert(
      fc.property(fc.boolean(), (initialShown) => {
        // Set initial state
        permissionManager.updateOptInSettings({
          explanationShown: initialShown,
        });

        expect(permissionManager.hasSeenDataCollectionExplanation()).toBe(
          initialShown
        );

        // Mark as shown
        permissionManager.markExplanationShown();

        // Should now be true regardless of initial state
        expect(permissionManager.hasSeenDataCollectionExplanation()).toBe(true);

        // Should persist in settings
        const settings = permissionManager.getOptInSettings();
        expect(settings.explanationShown).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  test("Property 13.10: Permission reset must restore initial state", async () => {
    await fc.assert(
      fc.asyncProperty(
        healthPlatformArb,
        permissionSetArb,
        async (platform, selectedPermissions) => {
          const permissionSet = selectedPermissions as Set<PermissionType>;

          // Set some permissions and settings
          await permissionManager.requestSelectivePermissions(
            platform,
            permissionSet
          );
          permissionManager.markExplanationShown();

          // Verify settings are not default
          const settingsBeforeReset = permissionManager.getOptInSettings();
          if (permissionSet.size > 0) {
            expect(settingsBeforeReset.dataCollection).toBe(true);
            expect(
              settingsBeforeReset.selectedPermissions.size
            ).toBeGreaterThan(0);
          }
          expect(settingsBeforeReset.explanationShown).toBe(true);

          // Reset permissions
          permissionManager.resetPermissions();

          // Should be back to initial state
          const settingsAfterReset = permissionManager.getOptInSettings();
          expect(settingsAfterReset.dataCollection).toBe(false);
          expect(settingsAfterReset.syncEnabled).toBe(false);
          expect(settingsAfterReset.selectedPermissions.size).toBe(0);
          expect(settingsAfterReset.explanationShown).toBe(false);
          expect(settingsAfterReset.consentTimestamp).toBeUndefined();

          // Sync should be disabled
          expect(permissionManager.isSyncEnabled()).toBe(false);
        }
      ),
      { numRuns: 15 }
    );
  });
});
