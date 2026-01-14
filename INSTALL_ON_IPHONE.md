# How to Install Health Tracker on Your iPhone

This guide will walk you through installing the Health Tracker app on your physical iPhone.

---

## 📋 What You Need

Before starting, make sure you have:

- ✅ **Your iPhone** (any model running iOS 12 or later)
- ✅ **USB cable** (Lightning or USB-C, depending on your iPhone)
- ✅ **This Mac** (the one you're reading this on)
- ✅ **Xcode installed** (already installed ✅)
- ✅ **Apple ID** (free - the one you use for the App Store)

**Time needed**: 5-10 minutes (first time)

---

## 🚀 Method 1: Direct Installation (Recommended)

This is the easiest and fastest way to get the app on your iPhone.

### Step 1: Connect Your iPhone

1. **Plug your iPhone** into this Mac using a USB cable
2. **Unlock your iPhone**
3. You'll see a popup on your iPhone asking **"Trust This Computer?"**
4. **Tap "Trust"** and enter your iPhone passcode if prompted

### Step 2: Open the Project in Xcode

Open Terminal and run:

```bash
cd ~/path/to/health-tracker-app
cd ios
open HealthTracker.xcworkspace
```

Or simply double-click `HealthTracker.xcworkspace` in the `ios` folder.

**⚠️ Important**: Open the `.xcworkspace` file, NOT the `.xcodeproj` file!

### Step 3: Select Your iPhone as the Build Target

In Xcode:

1. Look at the top toolbar
2. Find the device selector (it probably says "iPhone 17 Pro" or similar)
3. **Click on it** to open the dropdown menu
4. **Select your actual iPhone** from the list (it will show your iPhone's name)

![Device Selection](https://i.imgur.com/example.png)

### Step 4: Configure Code Signing (First Time Only)

1. In the left sidebar, **click on the blue "HealthTracker" project** icon (at the very top)
2. In the main area, make sure **"HealthTracker" target** is selected (not HealthTrackerTests)
3. Click the **"Signing & Capabilities"** tab
4. Check the box **"Automatically manage signing"**
5. Under "Team", select your Apple ID
   - If you don't see your Apple ID:
     - Go to **Xcode → Preferences** (or Settings on newer Xcode)
     - Click **"Accounts"** tab
     - Click the **"+"** button
     - Sign in with your Apple ID
     - Go back to the project settings

6. You might see a warning about Bundle Identifier. If so:
   - Change the **Bundle Identifier** to something unique like:
   - `com.yourname.healthtracker` (replace "yourname" with your actual name)

### Step 5: Build and Install

1. Click the **▶️ Play button** in the top left (or press `Cmd + R`)
2. Xcode will start building the app
3. **Wait 2-5 minutes** for the first build (subsequent builds are much faster)
4. You'll see progress in the top bar

### Step 6: Trust the Developer on Your iPhone (First Time Only)

After the build completes, you might see an error on your iPhone saying:

**"Untrusted Developer"** or **"Unable to Verify App"**

To fix this:

1. On your iPhone, go to **Settings**
2. Scroll down and tap **General**
3. Scroll down and tap **VPN & Device Management** (or **Device Management**)
4. Under "Developer App", tap your **Apple ID email**
5. Tap **"Trust [Your Email]"**
6. Tap **"Trust"** again to confirm

### Step 7: Launch the App

1. Go to your iPhone home screen
2. Find the **Health Tracker** app icon
3. **Tap to open** it
4. The app should launch successfully! 🎉

---

## 📦 Method 2: Build IPA File (For Sharing)

If you want to create a file you can send to others or install later:

### Step 1: Build the IPA

Open Terminal and run:

```bash
cd ~/path/to/health-tracker-app
npm run build:ios
```

This will:
- Install dependencies
- Build the app
- Create an IPA file at `ios/build/HealthTracker.ipa`

**Note**: This requires proper code signing setup. If it fails, use Method 1 instead.

### Step 2: Share the IPA

**Option A: Upload to Diawi (Easiest)**

1. Go to https://www.diawi.com/
2. Drag and drop the `HealthTracker.ipa` file
3. Wait for upload to complete
4. Copy the link and share it
5. Recipients open the link on their iPhone and tap "Install"

**Option B: Install via Apple Configurator 2**

1. Download **Apple Configurator 2** from the Mac App Store (free)
2. Open Apple Configurator 2
3. Connect the iPhone you want to install on
4. Drag and drop the IPA file onto the device

**Option C: Install via Xcode**

1. Open Xcode
2. Go to **Window → Devices and Simulators**
3. Select your connected iPhone
4. Click the **"+"** button under "Installed Apps"
5. Select the IPA file

---

## ⚠️ Important Notes

### About Free Apple Developer Accounts

If you're using a **free Apple ID** (not a paid $99/year developer account):

- ✅ You can install on up to **3 devices**
- ✅ Perfect for personal testing
- ⚠️ Apps **expire after 7 days**
- ⚠️ You'll need to **reinstall** after 7 days (just repeat the process)

### About Paid Apple Developer Accounts ($99/year)

If you upgrade to a paid account:

- ✅ Apps **don't expire**
- ✅ Can use **TestFlight** for easy distribution
- ✅ Can distribute to **unlimited testers**
- ✅ Can publish to the **App Store**

---

## 🔧 Troubleshooting

### Problem: "No provisioning profile found"

**Solution**:
1. Open Xcode
2. Go to **Xcode → Preferences → Accounts**
3. Click **"+"** and sign in with your Apple ID
4. Close preferences and try building again

---

### Problem: "Failed to register bundle identifier"

**Solution**:
1. In Xcode, select the project in the left sidebar
2. Select the "HealthTracker" target
3. Go to "Signing & Capabilities" tab
4. Change the **Bundle Identifier** to something unique:
   - Example: `com.yourname.healthtracker`
   - Replace "yourname" with your actual name or username

---

### Problem: "Unable to install [app name]"

**Solution**:
1. Delete any existing version of the app from your iPhone
2. Restart your iPhone
3. Try installing again

---

### Problem: "This app cannot be installed because its integrity could not be verified"

**Solution**:
1. On your iPhone: **Settings → General → VPN & Device Management**
2. Tap your Apple ID
3. Tap **"Trust"**
4. Try opening the app again

---

### Problem: Build fails with CocoaPods errors

**Solution**:
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

---

### Problem: "iPhone is busy: Preparing debugger support"

**Solution**:
1. Wait a few minutes (this happens after iOS updates)
2. Keep your iPhone unlocked and connected
3. Try building again

---

### Problem: Xcode can't find my iPhone

**Solution**:
1. Unplug and replug the USB cable
2. Unlock your iPhone
3. Trust the computer again if prompted
4. In Xcode: **Window → Devices and Simulators** - check if your device appears
5. If not, restart both your iPhone and Mac

---

## 📱 What Happens After Installation

Once installed, the Health Tracker app will:

- ✅ Appear on your iPhone home screen
- ✅ Work completely **offline** (no internet needed)
- ✅ Store all data **locally** on your device
- ✅ Show your exercise dashboard
- ✅ Let you log new exercises
- ✅ Display exercise history and statistics
- ✅ Provide weekly summaries

### App Features:

- **Dashboard**: Overview of your fitness data
- **Exercise Logging**: Add new workouts
- **History**: View past exercises
- **Statistics**: Daily and weekly summaries
- **Recommendations**: Personalized fitness suggestions
- **Offline Mode**: Works without internet

---

## 🔄 Reinstalling After 7 Days (Free Account)

If you're using a free Apple ID, the app will stop working after 7 days. To reinstall:

1. Connect your iPhone to your Mac
2. Open Xcode (the project should still be open)
3. Click the **▶️ Play button** again
4. Wait for the build to complete
5. The app will work for another 7 days

**Tip**: Your data is saved locally, so you won't lose any exercise records when reinstalling!

---

## 🎯 Quick Command Reference

```bash
# Open the project in Xcode
cd ios && open HealthTracker.xcworkspace

# Build and run on connected iPhone (alternative method)
npm run ios

# Build IPA file
npm run build:ios

# Install dependencies
npm install

# Run tests
npm test

# Start Metro bundler (if needed)
npm start
```

---

## 📞 Need More Help?

- **Quick questions**: Check the troubleshooting section above
- **Detailed distribution info**: See `IOS_DISTRIBUTION_GUIDE.md`
- **TestFlight setup**: See `IOS_DISTRIBUTION_GUIDE.md` (Method 3)
- **App icon generation**: See `design/icon-generation-guide.md`

---

## ✅ Success Checklist

After following this guide, you should have:

- [ ] iPhone connected and trusted
- [ ] Xcode project opened
- [ ] Code signing configured
- [ ] App built successfully
- [ ] Developer trusted on iPhone
- [ ] App installed and running on iPhone
- [ ] App icon visible on home screen

---

## 🎉 You're Done!

Your Health Tracker app is now installed on your iPhone. Start logging your exercises and tracking your fitness journey!

**Enjoy your app!** 💪📱

---

*Last updated: January 2026*
