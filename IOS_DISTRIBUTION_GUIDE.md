# iOS Distribution Guide for Health Tracker

This guide explains how to build and distribute your Health Tracker app to physical iPhones.

## Prerequisites

Before you can install the app on a physical iPhone, you need:

1. **Mac with Xcode** (already have ✅)
2. **Apple Developer Account** (free or paid)
3. **Physical iPhone** with USB cable
4. **iPhone registered in your Apple Developer account**

## Distribution Methods

### Method 1: Direct Installation via Xcode (Easiest - No IPA needed)

This is the simplest method for testing on your own device.

#### Steps:

1. **Connect your iPhone** to your Mac via USB cable

2. **Trust your Mac** on the iPhone when prompted

3. **Open the project in Xcode**:
   ```bash
   cd ios
   open HealthTracker.xcworkspace
   ```

4. **Select your device** in Xcode:
   - Click the device selector at the top (next to the scheme)
   - Choose your connected iPhone from the list

5. **Configure signing**:
   - Select the `HealthTracker` project in the left sidebar
   - Select the `HealthTracker` target
   - Go to "Signing & Capabilities" tab
   - Check "Automatically manage signing"
   - Select your Apple Developer team

6. **Build and run**:
   - Press `Cmd + R` or click the Play button
   - The app will install and launch on your iPhone

7. **Trust the developer** (first time only):
   - On your iPhone, go to Settings > General > VPN & Device Management
   - Tap your Apple ID
   - Tap "Trust [Your Name]"

### Method 2: Build IPA for Ad-hoc Distribution

This method creates an IPA file you can share with others (requires paid Apple Developer account).

#### Steps:

1. **Make the build script executable**:
   ```bash
   chmod +x ios/build-ipa.sh
   ```

2. **Run the build script**:
   ```bash
   cd ios
   ./build-ipa.sh
   ```

3. **The IPA will be created at**: `ios/build/HealthTracker.ipa`

#### Installing the IPA:

**Option A: Using Apple Configurator 2** (Mac)
1. Download Apple Configurator 2 from the Mac App Store
2. Connect your iPhone
3. Drag and drop the IPA file onto your device in Apple Configurator

**Option B: Using Xcode**
1. Open Xcode
2. Go to Window > Devices and Simulators
3. Select your connected iPhone
4. Click the "+" button under "Installed Apps"
5. Select the IPA file

**Option C: Using Third-party Tools**
- [Diawi](https://www.diawi.com/) - Upload IPA and share download link
- [TestFlight](https://developer.apple.com/testflight/) - Official Apple beta testing

### Method 3: TestFlight Distribution (Best for Multiple Testers)

TestFlight is Apple's official beta testing platform (requires paid Apple Developer account - $99/year).

#### Steps:

1. **Create an App Store Connect record**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Click "My Apps" > "+" > "New App"
   - Fill in app information

2. **Archive the app in Xcode**:
   ```bash
   cd ios
   open HealthTracker.xcworkspace
   ```
   - Select "Any iOS Device" as the build target
   - Go to Product > Archive
   - Wait for the archive to complete

3. **Upload to App Store Connect**:
   - In the Archives window, click "Distribute App"
   - Select "App Store Connect"
   - Follow the prompts to upload

4. **Add testers in App Store Connect**:
   - Go to TestFlight tab
   - Add internal or external testers
   - Testers will receive an email invitation

5. **Testers install via TestFlight app**:
   - Install TestFlight from the App Store
   - Accept the invitation
   - Download and test your app

## Quick Start: Install on Your Own iPhone

The fastest way to get the app on your iPhone right now:

```bash
# 1. Connect your iPhone to your Mac via USB

# 2. Open Xcode
cd ios
open HealthTracker.xcworkspace

# 3. In Xcode:
#    - Select your iPhone from the device dropdown
#    - Click the Play button (or press Cmd + R)
#    - Wait for the build to complete
#    - The app will launch on your iPhone

# 4. If you see "Untrusted Developer":
#    - On iPhone: Settings > General > VPN & Device Management
#    - Tap your Apple ID and tap "Trust"
```

## Troubleshooting

### "Failed to register bundle identifier"
- The bundle ID might be taken
- Change it in Xcode: Select project > General > Bundle Identifier
- Use something like: `com.yourname.healthtracker`

### "No provisioning profiles found"
- Make sure you're signed in to Xcode with your Apple ID
- Xcode > Preferences > Accounts > Add your Apple ID
- Enable "Automatically manage signing" in project settings

### "This app cannot be installed because its integrity could not be verified"
- You need to trust the developer certificate on your iPhone
- Settings > General > VPN & Device Management > Trust

### "Unable to install [app name]"
- Delete any existing version of the app from your iPhone
- Try again

### Build fails with CocoaPods errors
```bash
cd ios
pod deintegrate
pod install
```

## Free vs Paid Apple Developer Account

### Free Account (Personal Team):
- ✅ Install on your own devices (up to 3)
- ✅ Test on physical devices
- ✅ 7-day app validity (need to reinstall weekly)
- ❌ No TestFlight
- ❌ No App Store distribution
- ❌ No ad-hoc distribution to others

### Paid Account ($99/year):
- ✅ Install on unlimited devices
- ✅ TestFlight for up to 10,000 testers
- ✅ App Store distribution
- ✅ Ad-hoc distribution
- ✅ Apps don't expire

## Sharing Your App

### For Personal Use:
- Use Method 1 (Direct Installation via Xcode)
- Free and works immediately

### For a Few Friends:
- Use Method 1 for each device (connect their iPhone to your Mac)
- Or use Method 2 with Diawi to share IPA links

### For Many Testers:
- Use Method 3 (TestFlight)
- Requires paid developer account
- Professional and easy for testers

## Next Steps

1. **For immediate testing**: Use Method 1 (Direct Installation)
2. **For sharing with friends**: Build an IPA and use Diawi
3. **For serious testing**: Set up TestFlight

## Additional Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [React Native iOS Setup](https://reactnative.dev/docs/running-on-device)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com/)
