# Quick Install Guide - Get Health Tracker on Your iPhone

## 🚀 Fastest Method (5 minutes)

### What You Need:
- Your iPhone
- USB cable
- This Mac

### Steps:

1. **Connect your iPhone** to this Mac with a USB cable

2. **Unlock your iPhone** and tap "Trust This Computer" when prompted

3. **Run this command**:
   ```bash
   npm run ios
   ```
   
   Or manually:
   ```bash
   cd ios
   open HealthTracker.xcworkspace
   ```

4. **In Xcode** (when it opens):
   - Click the device dropdown at the top (says "iPhone 17 Pro" or similar)
   - Select your actual iPhone from the list
   - Click the ▶️ Play button (or press `Cmd + R`)

5. **Wait for the build** (2-3 minutes first time)

6. **On your iPhone** (if you see "Untrusted Developer"):
   - Go to: Settings → General → VPN & Device Management
   - Tap your Apple ID
   - Tap "Trust"
   - Go back to home screen and open the app

**Done! 🎉** The app is now installed on your iPhone.

---

## 📦 Create IPA File (for sharing)

If you want to create a package file to send to someone else:

```bash
npm run build:ios
```

The IPA file will be created at: `ios/build/HealthTracker.ipa`

### Share the IPA:

**Option 1: Upload to Diawi** (easiest)
1. Go to https://www.diawi.com/
2. Upload the IPA file
3. Share the link with others
4. They open the link on their iPhone and tap "Install"

**Option 2: Send via AirDrop/Email**
- Send the IPA file directly
- They need to install it using Apple Configurator 2 or Xcode

---

## ⚠️ Important Notes

### Free Apple Developer Account:
- Apps expire after 7 days (need to reinstall)
- Can only install on 3 devices
- Perfect for personal testing

### Paid Account ($99/year):
- Apps don't expire
- Can use TestFlight for easy sharing
- Can distribute to unlimited testers

---

## 🆘 Troubleshooting

### "No provisioning profile found"
1. Open Xcode
2. Go to: Xcode → Preferences → Accounts
3. Click "+" and sign in with your Apple ID
4. Try building again

### "Failed to register bundle identifier"
1. In Xcode, select the project in the left sidebar
2. Select the "HealthTracker" target
3. Go to "Signing & Capabilities"
4. Change the Bundle Identifier to something unique like:
   `com.yourname.healthtracker`

### "Unable to install"
1. Delete the app from your iPhone if it exists
2. Try installing again

### Build takes forever
- First build takes 3-5 minutes (normal)
- Subsequent builds are much faster (30 seconds)

---

## 📱 What Happens Next

After installation:
- The app will appear on your iPhone home screen
- It will have the Health Tracker icon
- All your exercise data is stored locally on your device
- The app works offline (no internet needed)

---

## Need More Help?

See the full guide: `IOS_DISTRIBUTION_GUIDE.md`
